import { colorDecoder } from '../color.encoders';
import { decompactCodes, huffmanDecode } from '../huffman.encoders';
import { binaryToAscii, bitsToUint, hexToRgb, padBits, rgbDistance, rgbToHex } from '../utils';
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
};

type ParsedPrimary = {
  version: number;
  gridSize: number;
  header: string;
  payload: string;
  primaryLen: number;
};

const BIT_SIZE = v1Info.bitSize;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getPixel(image: PixelBuffer, x: number, y: number): { r: number; g: number; b: number } {
  const px = clamp(Math.round(x), 0, image.width - 1);
  const py = clamp(Math.round(y), 0, image.height - 1);
  const index = (py * image.width + px) * 4;
  return { r: image.data[index], g: image.data[index + 1], b: image.data[index + 2] };
}

function sampleCell(
  image: PixelBuffer,
  row: number,
  col: number,
  cellWidth: number,
  cellHeight: number
): { r: number; g: number; b: number } {
  const cx = (col + 0.5) * cellWidth;
  const cy = (row + 0.5) * cellHeight;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const pixel = getPixel(image, cx + dx, cy + dy);
      r += pixel.r;
      g += pixel.g;
      b += pixel.b;
      count++;
    }
  }
  return { r: r / count, g: g / count, b: b / count };
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

export function detectGridSize(image: PixelBuffer): number {
  let bestSize = v1Info.gridSize[0];
  let bestScore = Infinity;

  for (const gridSize of v1Info.gridSize) {
    const score = scoreGridSize(image, gridSize);
    if (score < bestScore) {
      bestScore = score;
      bestSize = gridSize;
    }
  }

  if (bestScore > 48) {
    throw new Error('Could not detect an RQR code in this image.');
  }

  return bestSize;
}

export function sampleImageToGrid(image: PixelBuffer, gridSize: number): string[][] {
  const cellWidth = image.width / gridSize;
  const cellHeight = image.height / gridSize;
  const grid: string[][] = [];

  for (let row = 0; row < gridSize; row++) {
    grid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      const marker = getCalibrationMarkerColor(row, col, gridSize);
      if (marker) {
        grid[row][col] = marker;
        continue;
      }
      const { r, g, b } = sampleCell(image, row, col, cellWidth, cellHeight);
      grid[row][col] = rgbToHex(r, g, b);
    }
  }

  return grid;
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
  if (expectedGridSize !== undefined && gridSize !== expectedGridSize) {
    throw new Error(`Grid size mismatch: bitstream has ${gridSize}, image has ${expectedGridSize}.`);
  }

  const headerLength = bitsToUint(readBits(bits, offset, HEADER_LENGTH_BITS));
  offset += HEADER_LENGTH_BITS;
  const headerBits = readBits(bits, offset, headerLength * 8);
  offset += headerLength * 8;

  const payloadLength = bitsToUint(readBits(bits, offset, PAYLOAD_LENGTH_BITS));
  offset += PAYLOAD_LENGTH_BITS;
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
  const text = huffmanDecode(parsed.payload, codes);
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

  for (let offset = 0; offset + VERSION_BITS + GRID_SIZE_BITS + HEADER_LENGTH_BITS < rawBits.length; offset += BIT_SIZE) {
    try {
      return tryFinish(parsePrimary(rawBits.slice(offset), gridSize));
    } catch {
      // try next cell-aligned origin
    }
  }

  throw new Error(errors[0] || 'Could not decode RQR payload.');
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

  return decodeRawBits(colorDecoder(dataColors, BIT_SIZE), gridSize);
}

export function decodeFromImageData(image: PixelBuffer): RqrDecodeResult {
  if (image.width < 21 || image.height < 21) {
    throw new Error('Image is too small to contain an RQR code.');
  }
  const gridSize = detectGridSize(image);
  return decodeFromGrid(sampleImageToGrid(image, gridSize));
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
