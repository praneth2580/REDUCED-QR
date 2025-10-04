import { Node } from "./huffman.encoders";

export const US = String.fromCharCode(31); 

/**
 * Compacts Huffman codes for single characters into a string.
 * Format: charCode1:length1,charCode2:length2,...
 * @param freq The record of characters againsts there frequencies
 * @returns A order list of characters against there frequency.
 */
export function orderByFrequency(freq: Record<string, number>): [string, number][] {
  return Object.entries(freq).sort((a, b) => b[1] === a[1] ? b[0].charCodeAt(0) - a[0].charCodeAt(0) : b[1] - a[1]);
}



/**
 * Compacts Huffman codes for words into a string.
 * Format: encodedWord1:length1,encodedWord2:length2,...
 * @param codes The Huffman codes for words.
 * @returns A compact string representation.
 */
export function compactWordHuffmanCodes(codes: Record<string, string>): string {
  return Object.entries(codes)
    .map(([word, code]) => {
      return `${encodeURIComponent(word)}:${code.length}`;
    })
    .join(',');
}

/**
 * Decompacts a string of encoded words and lengths into a Huffman codes object.
 * @param compactString The compact string.
 * @returns The Huffman codes object for words.
 */
export function decompactWordHuffmanCodes(compactString: string): Record<string, string> {
  const codes: Record<string, string> = {};
  if (!compactString) {
    return codes;
  }

  const codeLengths: [string, number][] = [];
  const pairs = compactString.split(',');
  for (const pair of pairs) {
    const parts = pair.split(':', 2);
    if (parts.length === 2) {
      const word = decodeURIComponent(parts[0]);
      const length = parseInt(parts[1], 10);
      if (word && !isNaN(length)) {
        codeLengths.push([word, length]);
      }
    }
  }

  // Canonical code generation logic
  codeLengths.sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[0].localeCompare(b[0]);
  });

  if (codeLengths.length === 0) {
    return {};
  }

  let prevCode = -1;
  let prevLength = 0;

  for (const [symbol, length] of codeLengths) {
    if (length === 0) continue;

    let currentCode;
    if (prevCode === -1) { // First code
      currentCode = 0;
    } else {
      currentCode = (prevCode + 1) << (length - prevLength);
    }
    
    codes[symbol] = currentCode.toString(2).padStart(length, '0');
    
    prevCode = currentCode;
    prevLength = length;
  }

  return codes;
}