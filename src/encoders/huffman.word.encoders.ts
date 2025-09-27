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
function buildHuffmanTree(text: string): Node {
  const words = text.split(/(\s+)/);
  const freq: Record<string, number> = {};
  for (let word of words) {
    freq[word] = (freq[word] || 0) + 1;
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

export function huffmanWordEncode(text: string): {
  encoded: string;
  codes: Record<string, string>;
} {
  const tree = buildHuffmanTree(text);
  const codes = generateCodes(tree);
  const words = text.split(/(\s+)/);
  const encoded = words.map((w) => codes[w]).join('');
  return { encoded, codes };
}

export function huffmanWordDecode(encoded: string, codes: Record<string, string>): string {
  const reverseMap: Record<string, string> = {};
  for (const [value, code] of Object.entries(codes)) {
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
