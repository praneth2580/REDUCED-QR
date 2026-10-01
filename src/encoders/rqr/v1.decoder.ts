import { colorDecoder } from '../color.encoders';
import { decompactCodes, huffmanDecode } from '../huffman.encoders';
import { binaryToAscii, bitsToUint, hexToRgb, padBits, rgbDistance, rgbToHex } from '../utils';
import { encode } from './v1.encoder';
import { unwarpRqr } from './perspective';
import {
  calculateMarkers,
  countDataCells,
  getCalibrationMarkerColor,
  isDataCell,
  v1Info,
} from './geometry';
import {
  GRID_SIZE_BITS,
  HEADER_LENGTH_BITS,
  PAYLOAD_LENGTH_BITS,
  V1_VERSION,
  VERSION_BITS,
} from './v1.format';

export type PixelBuffer = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

export type RqrDecodeResult = {
  text: string;
  version: number;
  gridSize: number;
  cellsUsed: number;
  cellsAvailable: number;
  backupLevel: number;
  detectScore?: number;
  agreement?: number;
};

type ParsedPrimary = {
  version: number;
  gridSize: number;
  header: string;
  payload: string;
  primaryLen: number;
};

const BIT_SIZE = v1Info.bitSize;
const MAX_HEADER_BYTES = 2048;
const MIN_CELL_AGREEMENT = 0.78;
const MAX_DETECT_SCORE = 95;
const SAMPLE_SHIFTS: Array<[number, number]> = [
  [0, 0],
  [0.16, 0],
  [-0.16, 0],
  [0, 0.16],
  [0, -0.16],
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getPixel(image: PixelBuffer, x: number, y: number): { r: number; g: number; b: number } {
  const px = clamp(Math.round(x), 0, image.width - 1);
  const py = clamp(Math.round(y), 0, image.height - 1);
  const index = (py * image.width + px) * 4;
  return { r: image.data[index], g: image.data[index + 1], b: image.data[index + 2] };
}

type RGB = { r: number; g: number; b: number };

function redness(p: RGB): number {
  return p.r - (p.g + p.b) / 2;
}

function greenness(p: RGB): number {
  return p.g - (p.r + p.b) / 2;
}

function blueness(p: RGB): number {
  return p.b - (p.r + p.g) / 2;
}

function luma(p: RGB): number {
  return (p.r + p.g + p.b) / 3;
}

function chroma(p: RGB): number {
  return Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
}

function sampleCell(
  image: PixelBuffer,
  row: number,
  col: number,
  cellWidth: number,
  cellHeight: number,
  shiftX = 0,
  shiftY = 0
): RGB {
  const cx = (col + 0.5 + shiftX) * cellWidth;
  const cy = (row + 0.5 + shiftY) * cellHeight;
  const radius = Math.max(1, Math.floor(Math.min(cellWidth, cellHeight) * 0.22));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const pixel = getPixel(image, cx + dx, cy + dy);
      r += pixel.r;
      g += pixel.g;
      b += pixel.b;
      count++;
    }
  }
  return { r: r / count, g: g / count, b: b / count };
}

function finderSignatureOk(image: PixelBuffer, gridSize: number): boolean {
  const cellWidth = image.width / gridSize;
  const cellHeight = image.height / gridSize;
  const last = gridSize - 1;
  const tl = sampleCell(image, 0, 0, cellWidth, cellHeight);
  const tr = sampleCell(image, 0, last, cellWidth, cellHeight);
  const bl = sampleCell(image, last, 0, cellWidth, cellHeight);
  const br = sampleCell(image, last, last, cellWidth, cellHeight);

  return (
    redness(tl) > 24 &&
    blueness(tr) > 24 &&
    greenness(bl) > 24 &&
    luma(br) < 90 &&
    chroma(tl) > 40 &&
    chroma(tr) > 40 &&
    chroma(bl) > 40 &&
    redness(tl) > redness(tr) &&
    redness(tl) > redness(bl) &&
    blueness(tr) > blueness(tl) &&
    greenness(bl) > greenness(tl)
  );
}

function scoreGridSize(image: PixelBuffer, gridSize: number): number {
  const cellWidth = image.width / gridSize;
  const cellHeight = image.height / gridSize;
  const markers = calculateMarkers(gridSize);
  let total = 0;
  let count = 0;

  for (const marker of markers) {
    for (const [row, col] of marker.coords) {
      const expected = hexToRgb(marker.color(row, col));
      const actual = sampleCell(image, row, col, cellWidth, cellHeight);
      total += rgbDistance(expected, actual);
      count++;
    }
  }

  return count === 0 ? Infinity : total / count;
}

export function detectGridSize(image: PixelBuffer): { gridSize: number; score: number } {
  const ranked = v1Info.gridSize
    .map((gridSize) => ({
      gridSize,
      score: scoreGridSize(image, gridSize),
      signature: finderSignatureOk(image, gridSize),
    }))
    .sort((a, b) => a.score - b.score);

  const signed = ranked.filter((item) => item.signature);
  const best = signed[0] ?? ranked[0];
  const second = signed[1];

  if (!signed.length || best.score > MAX_DETECT_SCORE) {
    throw new Error(
      `Could not detect an RQR code (best ${ranked[0].gridSize}×${ranked[0].gridSize}, score ${ranked[0].score.toFixed(0)}).`
    );
  }

  if (second) {
    const gap = second.score - best.score;
    const clearWinner = best.score <= 40 || gap >= Math.max(8, best.score * 0.12);
    if (!clearWinner) {
      throw new Error(
        `Ambiguous RQR grid (best ${best.gridSize}×${best.gridSize} score ${best.score.toFixed(0)}, next ${second.gridSize}×${second.gridSize} score ${second.score.toFixed(0)}).`
      );
    }
  }

  return { gridSize: best.gridSize, score: best.score };
}

export type RqrFrameInspect = {
  width: number;
  height: number;
  content: RqrContentBounds | null;
  imageCorners: {
    tl: { r: number; g: number; b: number };
    tr: { r: number; g: number; b: number };
    bl: { r: number; g: number; b: number };
    br: { r: number; g: number; b: number };
  };
  sizes: Array<{ gridSize: number; score: number; signature: boolean }>;
};

function ensureSquare(image: PixelBuffer): PixelBuffer {
  if (image.width === image.height) return image;
  return cropSquare(image, 0);
}

export function inspectRqrFrame(image: PixelBuffer): RqrFrameInspect {
  const warped = unwarpRqr(image);
  const content = findContentBounds(image);
  const frame = warped ?? (content
    ? cropRect(image, content.x, content.y, content.size, content.size)
    : ensureSquare(image));
  const margin = Math.max(2, Math.round(Math.min(frame.width, frame.height) * 0.03));
  return {
    width: frame.width,
    height: frame.height,
    content,
    imageCorners: {
      tl: getPixel(frame, margin, margin),
      tr: getPixel(frame, frame.width - 1 - margin, margin),
      bl: getPixel(frame, margin, frame.height - 1 - margin),
      br: getPixel(frame, frame.width - 1 - margin, frame.height - 1 - margin),
    },
    sizes: v1Info.gridSize.map((gridSize) => ({
      gridSize,
      score: scoreGridSize(frame, gridSize),
      signature: finderSignatureOk(frame, gridSize),
    })),
  };
}

function estimateLevels(
  image: PixelBuffer,
  gridSize: number
): { black: RGB; white: RGB } | null {
  const cellWidth = image.width / gridSize;
  const cellHeight = image.height / gridSize;
  const last = gridSize - 1;
  const black = sampleCell(image, last, last, cellWidth, cellHeight);
  const whites = [
    sampleCell(image, 1, 1, cellWidth, cellHeight),
    sampleCell(image, 1, last - 1, cellWidth, cellHeight),
    sampleCell(image, last - 1, 1, cellWidth, cellHeight),
  ];
  const white = {
    r: whites.reduce((s, p) => s + p.r, 0) / whites.length,
    g: whites.reduce((s, p) => s + p.g, 0) / whites.length,
    b: whites.reduce((s, p) => s + p.b, 0) / whites.length,
  };
  if (luma(black) > 70 || luma(white) < 160) return null;
  if (white.r - black.r < 40 || white.g - black.g < 40 || white.b - black.b < 40) return null;
  return { black, white };
}

function applyLevels(color: RGB, levels: { black: RGB; white: RGB }): RGB {
  const stretch = (value: number, black: number, white: number) => {
    const span = white - black;
    if (span < 8) return value;
    return clamp(((value - black) / span) * 255, 0, 255);
  };
  return {
    r: stretch(color.r, levels.black.r, levels.white.r),
    g: stretch(color.g, levels.black.g, levels.white.g),
    b: stretch(color.b, levels.black.b, levels.white.b),
  };
}

export function sampleImageToGrid(
  image: PixelBuffer,
  gridSize: number,
  shiftX = 0,
  shiftY = 0
): string[][] {
  const cellWidth = image.width / gridSize;
  const cellHeight = image.height / gridSize;
  const levels = estimateLevels(image, gridSize);
  const grid: string[][] = [];

  for (let row = 0; row < gridSize; row++) {
    grid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      const marker = getCalibrationMarkerColor(row, col, gridSize);
      if (marker) {
        grid[row][col] = marker;
        continue;
      }
      let color = sampleCell(image, row, col, cellWidth, cellHeight, shiftX, shiftY);
      if (levels) color = applyLevels(color, levels);
      grid[row][col] = rgbToHex(color.r, color.g, color.b);
    }
  }

  return grid;
}

function cropRect(image: PixelBuffer, x0: number, y0: number, width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = getPixel(image, x0 + x, y0 + y);
      const index = (y * width + x) * 4;
      data[index] = pixel.r;
      data[index + 1] = pixel.g;
      data[index + 2] = pixel.b;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

function cropSquare(image: PixelBuffer, inset: number): PixelBuffer {
  const minSide = Math.min(image.width, image.height);
  const size = Math.max(32, Math.round(minSide * (1 - 2 * inset)));
  const x0 = Math.round((image.width - size) / 2);
  const y0 = Math.round((image.height - size) / 2);
  return cropRect(image, x0, y0, size, size);
}

function isRedFinder(p: RGB): boolean {
  return p.r > 90 && redness(p) > 22 && p.r > p.g + 18 && p.r > p.b + 18;
}

function isBlueFinder(p: RGB): boolean {
  return p.b > 90 && blueness(p) > 22 && p.b > p.r + 18 && p.b > p.g + 18;
}

function isGreenFinder(p: RGB): boolean {
  return p.g > 90 && greenness(p) > 22 && p.g > p.r + 18 && p.g > p.b + 18;
}

type Point = { x: number; y: number };

export type RqrContentBounds = { x: number; y: number; size: number };

function toSquareBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  image: PixelBuffer,
  pad = 0
): RqrContentBounds | null {
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(image.width - 1, maxX + pad);
  maxY = Math.min(image.height - 1, maxY + pad);

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width < 21 || height < 21) return null;
  if (width >= image.width * 0.98 && height >= image.height * 0.98) return null;

  const size = Math.max(width, height);
  let x = minX - Math.floor((size - width) / 2);
  let y = minY - Math.floor((size - height) / 2);
  x = clamp(x, 0, Math.max(0, image.width - size));
  y = clamp(y, 0, Math.max(0, image.height - size));
  const square = Math.min(size, image.width - x, image.height - y);
  if (square < 21) return null;
  return { x, y, size: square };
}

function locateFinderSquare(image: PixelBuffer): RqrContentBounds | null {
  const stride = Math.max(1, Math.floor(Math.min(image.width, image.height) / 220));
  let tl: Point | null = null;
  let tr: Point | null = null;
  let bl: Point | null = null;
  let reds = 0;
  let blues = 0;
  let greens = 0;

  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      const pixel = getPixel(image, x, y);
      if (isRedFinder(pixel)) {
        reds++;
        if (!tl || x + y < tl.x + tl.y) tl = { x, y };
      }
      if (isBlueFinder(pixel)) {
        blues++;
        if (!tr || x - y > tr.x - tr.y) tr = { x, y };
      }
      if (isGreenFinder(pixel)) {
        greens++;
        if (!bl || y - x > bl.y - bl.x) bl = { x, y };
      }
    }
  }

  if (!tl || !tr || !bl || reds < 6 || blues < 6 || greens < 6) return null;

  const width = tr.x - Math.min(tl.x, bl.x);
  const height = bl.y - Math.min(tl.y, tr.y);
  if (width < 21 || height < 21) return null;
  if (Math.max(width, height) / Math.min(width, height) > 1.4) return null;
  if (tr.x <= tl.x + 16 || bl.y <= tl.y + 16) return null;
  if (Math.abs(tr.y - tl.y) > height * 0.28) return null;
  if (Math.abs(bl.x - tl.x) > width * 0.28) return null;

  return toSquareBounds(
    Math.min(tl.x, bl.x),
    Math.min(tl.y, tr.y),
    Math.max(tr.x, tl.x + height),
    Math.max(bl.y, tl.y + width),
    image,
    stride
  );
}

export function findContentBounds(image: PixelBuffer): RqrContentBounds | null {
  return locateFinderSquare(image);
}

function contentFrame(image: PixelBuffer): PixelBuffer | null {
  const bounds = findContentBounds(image);
  if (!bounds) return null;
  return cropRect(image, bounds.x, bounds.y, bounds.size, bounds.size);
}

function decodeExactFrame(image: PixelBuffer): RqrDecodeResult {
  const detected = detectGridSize(image);
  let lastError: Error | null = null;
  let best: RqrDecodeResult | null = null;

  for (const [shiftX, shiftY] of SAMPLE_SHIFTS) {
    try {
      const decoded = decodeFromGrid(sampleImageToGrid(image, detected.gridSize, shiftX, shiftY));
      const candidate = { ...decoded, detectScore: detected.score };
      if (!best || (candidate.agreement ?? 0) > (best.agreement ?? 0)) {
        best = candidate;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (best) return best;
  throw lastError ?? new Error('Could not decode RQR payload.');
}

function readBits(bits: string, offset: number, width: number): string {
  if (offset + width > bits.length) {
    throw new Error('RQR bitstream is truncated.');
  }
  return bits.slice(offset, offset + width);
}

function parsePrimary(bits: string, expectedGridSize?: number): ParsedPrimary {
  let offset = 0;
  const version = bitsToUint(readBits(bits, offset, VERSION_BITS));
  offset += VERSION_BITS;
  if (version !== V1_VERSION) {
    throw new Error(`Unsupported RQR version ${version}.`);
  }

  const gridSize = bitsToUint(readBits(bits, offset, GRID_SIZE_BITS));
  offset += GRID_SIZE_BITS;
  if (!v1Info.gridSize.includes(gridSize)) {
    throw new Error(`Unsupported RQR grid size ${gridSize}.`);
  }
  if (expectedGridSize !== undefined && gridSize !== expectedGridSize) {
    throw new Error(`Grid size mismatch: bitstream has ${gridSize}, image has ${expectedGridSize}.`);
  }

  const headerLength = bitsToUint(readBits(bits, offset, HEADER_LENGTH_BITS));
  offset += HEADER_LENGTH_BITS;
  if (headerLength < 1 || headerLength > MAX_HEADER_BYTES) {
    throw new Error(`Invalid RQR header length ${headerLength}.`);
  }
  const headerBits = readBits(bits, offset, headerLength * 8);
  offset += headerLength * 8;

  const payloadLength = bitsToUint(readBits(bits, offset, PAYLOAD_LENGTH_BITS));
  offset += PAYLOAD_LENGTH_BITS;
  if (payloadLength < 1) {
    throw new Error('RQR payload is empty.');
  }
  const payload = readBits(bits, offset, payloadLength);
  offset += payloadLength;

  return {
    version,
    gridSize,
    header: binaryToAscii(headerBits),
    payload,
    primaryLen: padBits(bits.slice(0, offset), BIT_SIZE).length,
  };
}

function majorityVote(rawBits: string, primaryLen: number): string {
  if (primaryLen <= 0) {
    throw new Error('Invalid primary bitstream length.');
  }

  const voted: string[] = [];
  for (let i = 0; i < primaryLen; i++) {
    let zeros = 0;
    let ones = 0;
    let copy0: string | undefined;
    for (let start = 0; start < rawBits.length; start += primaryLen) {
      const bit = rawBits[start + i];
      if (bit === undefined) continue;
      if (start === 0) copy0 = bit;
      if (bit === '1') ones++;
      else zeros++;
    }
    if (ones === zeros) voted.push(copy0 ?? '0');
    else voted.push(ones > zeros ? '1' : '0');
  }
  return voted.join('');
}

function finishDecode(parsed: ParsedPrimary, cellsAvailable: number): RqrDecodeResult {
  const codes = decompactCodes(parsed.header);
  if (!Object.keys(codes).length) {
    throw new Error('RQR Huffman table is empty.');
  }
  const text = huffmanDecode(parsed.payload, codes, { strict: true });
  if (!text) {
    throw new Error('Decoded RQR text is empty.');
  }
  const cellsUsed = parsed.primaryLen / BIT_SIZE;

  return {
    text,
    version: parsed.version,
    gridSize: parsed.gridSize,
    cellsUsed,
    cellsAvailable,
    backupLevel: cellsAvailable / cellsUsed,
  };
}

function decodeRawBits(rawBits: string, gridSize: number): RqrDecodeResult {
  const cellsAvailable = countDataCells(gridSize);
  const errors: string[] = [];
  const tryFinish = (parsed: ParsedPrimary) => finishDecode(parsed, cellsAvailable);

  try {
    const parsed = parsePrimary(rawBits, gridSize);
    try {
      return tryFinish(parsePrimary(majorityVote(rawBits, parsed.primaryLen), gridSize));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    for (let offset = 0; offset + parsed.primaryLen <= rawBits.length; offset += parsed.primaryLen) {
      try {
        return tryFinish(parsePrimary(rawBits.slice(offset, offset + parsed.primaryLen), gridSize));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(errors[0] || 'Could not decode RQR payload.');
}

function dataCellAgreement(sampled: string[][], expected: string[][]): number {
  const gridSize = sampled.length;
  let same = 0;
  let total = 0;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (!isDataCell(row, col, gridSize)) continue;
      total++;
      if (colorDecoder([sampled[row][col]], BIT_SIZE) === colorDecoder([expected[row][col]], BIT_SIZE)) {
        same++;
      }
    }
  }
  return total === 0 ? 0 : same / total;
}

export function decodeFromGrid(grid: string[][]): RqrDecodeResult {
  if (!grid.length || grid.some((row) => row.length !== grid.length)) {
    throw new Error('RQR grid must be square.');
  }

  const gridSize = grid.length;
  if (!v1Info.gridSize.includes(gridSize)) {
    throw new Error(`Unsupported RQR grid size ${gridSize}.`);
  }

  const dataColors: string[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (isDataCell(row, col, gridSize)) {
        dataColors.push(grid[row][col]);
      }
    }
  }

  const result = decodeRawBits(colorDecoder(dataColors, BIT_SIZE), gridSize);
  const encoded = encode(result.text);
  if (encoded.gridSize !== gridSize) {
    throw new Error(
      `Decoded text does not match this RQR grid (${encoded.gridSize} vs ${gridSize}).`
    );
  }
  const agreement = dataCellAgreement(grid, encoded.grid);
  if (agreement < MIN_CELL_AGREEMENT) {
    throw new Error(`RQR cell agreement too low (${Math.round(agreement * 100)}%).`);
  }
  return { ...result, agreement };
}

export function decodeFromImageData(
  image: PixelBuffer,
  options?: { insets?: number[] }
): RqrDecodeResult {
  if (image.width < 21 || image.height < 21) {
    throw new Error('Image is too small to contain an RQR code.');
  }

  const frames: PixelBuffer[] = [];
  const warped = unwarpRqr(image);
  if (warped) frames.push(warped);
  const content = contentFrame(image);
  if (content) frames.push(content);
  const square = ensureSquare(image);
  if (!content || content.width !== square.width || content.height !== square.height) {
    frames.push(square);
  }

  const insets = options?.insets ?? [0, 0.05, 0.1, 0.16, 0.22, 0.28];
  let lastError: Error | null = null;
  let best: RqrDecodeResult | null = null;

  for (const base of frames) {
    for (const inset of insets) {
      const frame = inset === 0 ? base : cropSquare(base, inset);
      try {
        const decoded = decodeExactFrame(frame);
        if (
          !best ||
          (decoded.agreement ?? 0) > (best.agreement ?? 0) ||
          ((decoded.agreement ?? 0) === (best.agreement ?? 0) &&
            (decoded.detectScore ?? 999) < (best.detectScore ?? 999))
        ) {
          best = decoded;
        }
        if ((decoded.agreement ?? 0) >= 0.9 && (decoded.detectScore ?? 999) <= 55) {
          return decoded;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  if (best) return best;
  throw lastError ?? new Error('Could not detect an RQR code in this image.');
}

export function tryDecodeFromImageData(image: PixelBuffer): RqrDecodeResult | null {
  try {
    return decodeFromImageData(image);
  } catch {
    return null;
  }
}

function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load RQR image.'));
    image.src = typeof source === 'string' ? source : URL.createObjectURL(source);
  });
}

export async function decodeFromImageSource(source: Blob | string | HTMLImageElement): Promise<RqrDecodeResult> {
  const image = source instanceof HTMLImageElement ? source : await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }
  ctx.drawImage(image, 0, 0);
  return decodeFromImageData(ctx.getImageData(0, 0, image.width, image.height));
}
