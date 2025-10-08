import type { Encoded } from './normalizer';
import { orderByFrequency, US } from './utils';

// Node class
class Node {
  value: string | null;
  freq: number;
  left: Node | null;
  right: Node | null;

  constructor(
    value: string | null,
    freq: number,
    left: Node | null = null,
    right: Node | null = null
  ) {
    this.value = value;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
}

// Build Huffman Tree
function buildHuffmanTree(text: string, _freq?: Record<string, number>): Node {
  const words = text.split(/(\s+)/);
  let freq: Record<string, number> = {};

  if (!_freq) {
    for (let word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
    freq = orderByFrequency(freq).reduce(
      (acc, [word, freq]) => {
        acc[word] = freq;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  let nodes: Node[] = Object.entries(freq).map(([value, f]) => new Node(value, f));

  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    let left = nodes.shift() as Node;
    let right = nodes.shift() as Node;
    let parent = new Node(null, left.freq + right.freq, left, right);
    nodes.push(parent);
  }
  return nodes[0];
}

// Generate Codes
function generateCodes(
  node: Node,
  prefix = '',
  map: Record<string, string> = {}
): Record<string, string> {
  if (node.value !== null) {
    map[node.value] = prefix;
  } else {
    if (node.left) generateCodes(node.left, prefix + '0', map);
    if (node.right) generateCodes(node.right, prefix + '1', map);
  }
  return map;
}

export function huffmanWordEncode(text: string): Encoded {
  const tree = buildHuffmanTree(text);
  const codes = generateCodes(tree);
  const words = text.split(/(\s+)/);
  const encoded = words.map((w) => codes[w]).join('');
  return { encoded, codes };
}

export function huffmanWordDecode(encoded: string, codes: Record<string, string> | undefined): string {
  const reverseMap: Record<string, string> = {};
  for (const [value, code] of Object.entries(codes || {})) {
    reverseMap[code] = value;
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
export function compactCodes(freq?: Record<string, string>): string {
  if (!freq) return '';
  const ordered_freq = orderByFrequency(freq);
  const freq_wise_char_str: Record<number, string[]> = {};
  for (const [word, freq] of ordered_freq) {
    if (!freq_wise_char_str[freq]) {
      freq_wise_char_str[freq] = [word];
    } else {
      freq_wise_char_str[freq].push(word);
    }
  }
  return Object.entries(freq_wise_char_str)
    .map((value) => {
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
  for (const codes_word of codes_characters) {
    let word;
    if (codes_word.includes(':')) {
      const [_freq, _word] = codes_word.split(':');
      current_freq = parseInt(_freq);
      word = _word;
    } else {
      word = codes_word;
    }
    freq[word] = current_freq;
  }

  const tree = buildHuffmanTree('', freq);
  codes = generateCodes(tree);

  return codes;
}
