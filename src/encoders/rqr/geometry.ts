import { rgbToHex } from '../utils';
import version from '../../versions.json';

export const v1Info = version['1'];

type Marker = {
  name: string;
  coords: number[][];
  color: (x: number, y: number) => string;
};

export function calculateMarkers(gridSize: number): Marker[] {
  return [
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
      color: () => rgbToHex(0, 0, 0),
    },
  ];
}

export function isBorder(x: number, y: number, gridSize: number, borderSize = 1): boolean {
  const markers = calculateMarkers(gridSize);
  const allMarkerCoords = markers.flatMap((marker) => marker.coords);

  return allMarkerCoords.some(([mx, my]) => {
    const dx = Math.abs(mx - x);
    const dy = Math.abs(my - y);
    const withinBorder = dx <= borderSize && dy <= borderSize;
    const isMarker = dx === 0 && dy === 0;
    return withinBorder && !isMarker;
  });
}

export function getCalibrationMarkerColor(x: number, y: number, gridSize: number): string | null {
  const markers = calculateMarkers(gridSize);

  for (const marker of markers) {
    for (const [mx, my] of marker.coords) {
      if (x === mx && y === my) {
        return marker.color(x, y);
      }
    }
  }

  return null;
}

export function isDataCell(x: number, y: number, gridSize: number): boolean {
  return !getCalibrationMarkerColor(x, y, gridSize) && !isBorder(x, y, gridSize, 1);
}

export function countDataCells(gridSize: number): number {
  let count = 0;
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (isDataCell(x, y, gridSize)) count++;
    }
  }
  return count;
}
