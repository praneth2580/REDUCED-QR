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
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export const pattern = (len1: number, len0: number, repeats: number) =>
  Array.from({ length: repeats }, () => "1".repeat(len1) + "0".repeat(len0)).join("");

