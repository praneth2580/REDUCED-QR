export const US = String.fromCharCode(31);
export const BINARY_SEPARATOR = '1111111111111110';


/**
 * Compacts Huffman codes for single characters into a string.
 * Format: charCode1:length1,charCode2:length2,...
 * @param freq The record of characters againsts there frequencies
 * @returns A order list of characters against there frequency.
 */
export function orderByFrequency(freq: Record<string, number> | Record<string, string>): [string, number][] {
  return Object.entries(freq).sort((a, b) => b[1] === a[1] ? b[0].charCodeAt(0) - a[0].charCodeAt(0) : b[1] - a[1]);
}

/**
 * Converts a string to its ASCII binary representation.
 * Each character is converted to its 8-bit binary equivalent.
 * @param text The input string.
 * @returns The binary string.
 */
export function asciiToBinary(text: string): string {
  return text
    .split('')
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

/**
 * Encodes a non-negative integer as a fixed-width bit string.
 */
export function uintToBits(value: number, width: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Value must be a non-negative integer, got ${value}.`);
  }
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`Bit width must be a positive integer, got ${width}.`);
  }
  const max = 2 ** width;
  if (value >= max) {
    throw new Error(`Value ${value} does not fit in ${width} bits.`);
  }
  return value.toString(2).padStart(width, '0');
}

/**
 * Parses a bit string as an unsigned integer.
 */
export function bitsToUint(bits: string): number {
  if (!bits || /[^01]/.test(bits)) {
    throw new Error(`Bit string must contain only 0 and 1, got "${bits}".`);
  }
  return parseInt(bits, 2);
}

/**
 * Right-pads a bit string with zeros so its length is a multiple of `multiple`.
 */
export function padBits(bits: string, multiple: number): string {
  if (!Number.isInteger(multiple) || multiple <= 0) {
    throw new Error(`Pad multiple must be a positive integer, got ${multiple}.`);
  }
  const remainder = bits.length % multiple;
  if (remainder === 0) return bits;
  return bits + '0'.repeat(multiple - remainder);
}

/**
 * Converts an ASCII binary string back to its original string representation.
 * @param binaryString The binary string.
 * @returns The decoded string.
 */
export function binaryToAscii(binaryString: string): string {
  if (binaryString.length % 8 !== 0) {
    throw new Error('Binary string length must be a multiple of 8.');
  }
  let result = '';
  for (let i = 0; i < binaryString.length; i += 8) {
    const byte = binaryString.substring(i, i + 8);
    result += String.fromCharCode(parseInt(byte, 2));
  }
  return result;
}

/**
 * Converts an ASCII binary string back to its original string representation.
 * @param r nubmer value for red channel
 * @param g nubmer value for green channel
 * @param b nubmer value for blue channel
 * @returns The hex value for color.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + ((1 << 24) + (toByte(r) << 16) + (toByte(g) << 8) + toByte(b)).toString(16).slice(1);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export const pattern = (len1: number, len0: number, repeats: number) =>
  Array.from({ length: repeats }, () => "1".repeat(len1) + "0".repeat(len0)).join("");


export async function imageToRGBGrid(imageSrc: string): Promise<{ r: number; g: number; b: number }[][]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = img.width;
      const h = img.height;

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Canvas 2D context not supported");

      ctx.drawImage(img, 0, 0);

      const raw = ctx.getImageData(0, 0, w, h).data;

      const grid: { r: number; g: number; b: number }[][] = [];

      let index = 0;
      for (let y = 0; y < h; y++) {
        const row: { r: number; g: number; b: number }[] = [];
        for (let x = 0; x < w; x++) {
          const r = raw[index];
          const g = raw[index + 1];
          const b = raw[index + 2];
          // const a = raw[index + 3];  (ignored intentionally)

          row.push({ r, g, b });

          index += 4;
        }
        grid.push(row);
      }

      resolve(grid);
    };

    img.onerror = (e) => reject(e);
  });
}
