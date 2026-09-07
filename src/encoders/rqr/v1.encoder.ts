import { colorEncoder } from '../color.encoders';
import { compactCodes, huffmanEncode } from '../huffman.encoders';
import { asciiToBinary, padBits, rgbToHex, uintToBits } from '../utils';
import { countDataCells, getCalibrationMarkerColor, isBorder, isDataCell, v1Info } from './geometry';
import { GRID_SIZE_BITS, HEADER_LENGTH_BITS, PAYLOAD_LENGTH_BITS, V1_VERSION, VERSION_BITS } from './v1.format';

export { countDataCells, isDataCell };

export class RqrCapacityError extends Error {
  cellsNeeded: number;
  maxCells: number;

  constructor(cellsNeeded: number, maxCells: number) {
    const largest = v1Info.gridSize[v1Info.gridSize.length - 1];
    super(
      `Data is too large to fit in the largest RQR grid (${largest}×${largest}). Needs ${cellsNeeded} cells, ${maxCells} available.`
    );
    this.name = 'RqrCapacityError';
    this.cellsNeeded = cellsNeeded;
    this.maxCells = maxCells;
  }
}

export type RqrEncodeResult = {
  grid: string[][];
  gridSize: number;
  bitLength: number;
  cellsUsed: number;
  cellsAvailable: number;
  backupCells: number;
  backupCopies: number;
  backupLevel: number;
};

function buildBitstream(data: string, gridSize: number): string {
  const { encoded: payload, freq } = huffmanEncode(data);
  const header = compactCodes(freq);

  if (header.length >= 2 ** HEADER_LENGTH_BITS) {
    throw new Error('Huffman header is too large to encode.');
  }
  if (payload.length >= 2 ** PAYLOAD_LENGTH_BITS) {
    throw new Error('Huffman payload is too large to encode.');
  }

  return (
    uintToBits(V1_VERSION, VERSION_BITS) +
    uintToBits(gridSize, GRID_SIZE_BITS) +
    uintToBits(header.length, HEADER_LENGTH_BITS) +
    asciiToBinary(header) +
    uintToBits(payload.length, PAYLOAD_LENGTH_BITS) +
    payload
  );
}

function tileBits(bits: string, totalLength: number): string {
  if (totalLength < bits.length) {
    throw new Error('Backup fill is shorter than the primary bitstream.');
  }
  if (bits.length === 0) {
    return '0'.repeat(totalLength);
  }
  const repeats = Math.ceil(totalLength / bits.length);
  return bits.repeat(repeats).slice(0, totalLength);
}

function pickGridSize(cellsNeeded: number): { gridSize: number; cellsAvailable: number } {
  for (const gridSize of v1Info.gridSize) {
    const cellsAvailable = countDataCells(gridSize);
    if (cellsAvailable >= cellsNeeded) {
      return { gridSize, cellsAvailable };
    }
  }

  const largest = v1Info.gridSize[v1Info.gridSize.length - 1];
  throw new RqrCapacityError(cellsNeeded, countDataCells(largest));
}

function ArrayToGrid(data: string[], gridSize: number): string[][] {
  const grid: string[][] = [];
  let current_data_index = 0;

  for (let x = 0; x < gridSize; x++) {
    grid[x] = [];
    for (let y = 0; y < gridSize; y++) {
      let colorCode = getCalibrationMarkerColor(x, y, gridSize);

      if (!colorCode && isBorder(x, y, gridSize, 1)) colorCode = rgbToHex(255, 255, 255);

      if (!colorCode && current_data_index < data.length) {
        colorCode = data[current_data_index];
        current_data_index++;
      }

      if (!colorCode) colorCode = rgbToHex(0, 0, 0);

      grid[x][y] = colorCode;
    }
  }

  if (current_data_index !== data.length) {
    throw new Error(`Failed to place all data cells (${current_data_index}/${data.length}).`);
  }

  return grid;
}

export function encode(data: string): RqrEncodeResult {
  if (!data) {
    throw new Error('Cannot encode empty data.');
  }

  const unpaddedBits = buildBitstream(data, 0);
  const bits = padBits(unpaddedBits, v1Info.bitSize);
  const cellsNeeded = bits.length / v1Info.bitSize;
  const { gridSize, cellsAvailable } = pickGridSize(cellsNeeded);

  const primaryBits = padBits(buildBitstream(data, gridSize), v1Info.bitSize);
  const primaryCells = primaryBits.length / v1Info.bitSize;
  const filledBits = tileBits(primaryBits, cellsAvailable * v1Info.bitSize);
  const colors = colorEncoder(filledBits, v1Info.bitSize);
  const grid = ArrayToGrid(colors, gridSize);

  return {
    grid,
    gridSize,
    bitLength: primaryBits.length,
    cellsUsed: primaryCells,
    cellsAvailable,
    backupCells: cellsAvailable - primaryCells,
    backupCopies: Math.floor(cellsAvailable / primaryCells) - 1,
    backupLevel: cellsAvailable / primaryCells,
  };
}
