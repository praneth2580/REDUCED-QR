import { colorEncoder } from '../color.encoders';
import { compactCodes, huffmanEncode } from '../huffman.encoders';
import { asciiToBinary, BINARY_SEPARATOR, pattern, rgbToHex } from '../utils';
import version from '../../versions.json';


export const calibrationSize = 12 * 4;

const calculateMarkers = (gridSize: number) => [
  {
    name: 'top-left',
    coords: [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 2],
      [2, 0],
    ],
    color: (x: number, y: number) => rgbToHex(x + y === 2 ? 127 : 225, 0, 0),
  },
  {
    name: 'bottom-left',
    coords: [
      [gridSize - 1, 0],
      [gridSize - 1, 1],
      [gridSize - 2, 0],
      [gridSize - 3, 0],
      [gridSize - 1, 2],
    ],
    color: (x: number, y: number) => rgbToHex(0, y === 2 || x === gridSize - 3 ? 127 : 225, 0),
  },
  {
    name: 'top-right',
    coords: [
      [0, gridSize - 1],
      [0, gridSize - 2],
      [1, gridSize - 1],
      [0, gridSize - 3],
      [2, gridSize - 1],
    ],
    color: (x: number, y: number) => rgbToHex(0, 0, x === 2 || y === gridSize - 3 ? 127 : 225),
  },
  {
    name: 'bottom-right',
    coords: [
      [gridSize - 1, gridSize - 1],
      [gridSize - 1, gridSize - 2],
      [gridSize - 2, gridSize - 1],
      [gridSize - 3, gridSize - 1],
      [gridSize - 1, gridSize - 3],
    ],
    color: (_x: number, _y: number) => rgbToHex(0, 0, 0),
  },
];
const versionInfo = version["1"];
const endBit = pattern(versionInfo.bitSize, versionInfo.bitSize, 2);

export function encode(gridSize: number, data: string): string[][] {
  // huffman encoding
  const { encoded: huffman_encoded, freq: huffman_freq } = huffmanEncode(data);
  const huffman_header = compactCodes(huffman_freq);
  const binary_huffman_header = asciiToBinary(huffman_header);
  const gridSizeBinary = asciiToBinary(gridSize.toString());
  const versionBinary = asciiToBinary('1');

  const huffman_final_str =
    versionBinary + gridSizeBinary + binary_huffman_header + BINARY_SEPARATOR + huffman_encoded + "111111";
  console.log(huffman_final_str.length / 2 , gridSize * gridSize)

  return ArrayToGrid(colorEncoder(huffman_final_str, versionInfo.bitSize), gridSize);
}

function isBorder(x: number, y: number, gridSize: number, borderSize = 1): boolean {
  const markers = calculateMarkers(gridSize);

  // Collect all marker coordinates
  const allMarkerCoords = markers.flatMap((marker) => marker.coords);

  // Check if this (x, y) lies near any marker coordinate
  return allMarkerCoords.some(([mx, my]) => {
    const dx = Math.abs(mx - x);
    const dy = Math.abs(my - y);
    const withinBorder = dx <= borderSize && dy <= borderSize;
    const isMarker = dx === 0 && dy === 0;
    return withinBorder && !isMarker; // near a marker but not part of one
  });
}

function getCalibrationMarkerColor(x: number, y: number, gridSize: number): string | null {
  const markers = calculateMarkers(gridSize);

  for (const marker of markers) {
    for (const [mx, my] of marker.coords) {
      if (x === mx && y === my) {
        return marker.color(x, y);
      }
    }
  }

  return null; // not a marker
}

function ArrayToGrid(data: string[], gridSize: number): string[][] {
  const grid: string[][] = [];
  let current_data_index = 0;
  for (let x = 0; x < gridSize; x++) {
    grid[x] = []; // ✅ initialize row first
    for (let y = 0; y < gridSize; y++) {
      let colorCode = getCalibrationMarkerColor(x, y, gridSize);

      if (!colorCode && isBorder(x, y, gridSize, 1)) colorCode = rgbToHex(255, 255, 255);

      if (!colorCode && data[current_data_index]) {
        colorCode = data[current_data_index];
        current_data_index++;
      }

      if (!colorCode) colorCode = rgbToHex(0, 0, 0);

      grid[x][y] = colorCode;
    }
  }
  return grid;
}
