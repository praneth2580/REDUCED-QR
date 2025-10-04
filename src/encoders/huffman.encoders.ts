import type { Encoded } from './normalizer';
import { orderByFrequency, US } from './utils';

// Node class
export class Node {
  char: string | null;
  freq: number;
  left: Node | null;
  right: Node | null;

  constructor(
    char: string | null,
    freq: number,
    left: Node | null = null,
    right: Node | null = null
  ) {
    this.char = char;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
}

// Build Huffman Tree
export function buildHuffmanTree(
  text: string,
  _freq?: Record<string, number>
): { tree: Node; freq: Record<string, number> } {
  let freq: Record<string, number> = _freq || {};

  if (!_freq) {
    for (let char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }
    freq = orderByFrequency(freq).reduce(
      (acc, [char, freq]) => {
        acc[char] = freq;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  let nodes: Node[] = Object.entries(freq).map(([char, f]) => new Node(char, f));

  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    let left = nodes.shift() as Node;
    let right = nodes.shift() as Node;
    let parent = new Node(null, left.freq + right.freq, left, right);
    nodes.push(parent);
  }
  return { tree: nodes[0], freq };
}

// Generate Codes
export function generateCodes(
  node: Node,
  prefix = '',
  map: Record<string, string> = {}
): Record<string, string> {
  if (node.char !== null) {
    map[node.char] = prefix;
  } else {
    if (node.left) generateCodes(node.left, prefix + '0', map);
    if (node.right) generateCodes(node.right, prefix + '1', map);
  }
  return map;
}

export function huffmanEncode(text: string): Encoded {
  const { tree, freq } = buildHuffmanTree(text);
  const codes = generateCodes(tree);
  const encoded = text
    .split('')
    .map((c) => codes[c])
    .join('');
  return { encoded, codes, tree, freq };
}

export function huffmanDecode(encoded: string, codes: Record<string, string>): string {
  const reverseMap: Record<string, string> = {};
  for (const [char, code] of Object.entries(codes)) {
    reverseMap[code] = char;
  }

  let current = '';
  let decoded = '';

  for (let bit of encoded) {
    current += bit;
    if (reverseMap[current]) {
      decoded += reverseMap[current];
      current = '';
    }
  }
  return decoded;
}

/**
 * Compacts Huffman codes for single characters into a string.
 * Format: charCode1:length1,charCode2:length2,...
 * @param freq The record of characters againsts there frequencies
 * @returns A compact string representation.
 */
export function compactCodes(freq: Record<string, number>): string {
  const ordered_freq = orderByFrequency(freq);
  const freq_wise_char_str: Record<number, number[]> = {};
  for (const [char, freq] of ordered_freq) {
    if (!freq_wise_char_str[freq]) {
      freq_wise_char_str[freq] = [char.charCodeAt(0)];
    } else {
      freq_wise_char_str[freq].push(char.charCodeAt(0));
    }
  }
  return Object.entries(freq_wise_char_str)
    .map((value, key) => {
      return `${value[0]}:${value[1].join(US)}`;
    })
    .join(US);
}

/**
 * Decompacts a string of character codes and lengths into a Huffman codes object.
 * @param compactString The compact string.
 * @returns The Huffman codes object for characters.
 */
export function decompactCodes(compactString: string): Record<string, string> {
  let codes: Record<string, string> = {};
  if (!compactString) {
    return codes;
  }

  const codes_characters = compactString.split(US);
  if (codes_characters.length === 0) {
    return codes;
  }

  let current_freq = 1;
  const freq: Record<string, number> = {};
  for (const charCode of codes_characters) {
    let char;
    if (charCode.includes(':')) {
      const [_freq, _charCode] = charCode.split(':');
      current_freq = parseInt(_freq);
      char = String.fromCharCode(parseInt(_charCode));
    } else {
      char = String.fromCharCode(parseInt(charCode));
    }
    freq[char] = current_freq;
  }

  const { tree } = buildHuffmanTree('', freq);
  codes = generateCodes(tree);

  return codes;
}
