// Node class
class Node {
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
function buildHuffmanTree(text: string): Node {
  const freq: Record<string, number> = {};
  for (let char of text) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let nodes: Node[] = Object.entries(freq).map(([char, f]) => new Node(char, f));

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
  if (node.char !== null) {
    map[node.char] = prefix;
  } else {
    if (node.left) generateCodes(node.left, prefix + '0', map);
    if (node.right) generateCodes(node.right, prefix + '1', map);
  }
  return map;
}

export function huffmanEncode(text: string): {
  encoded: string;
  codes: Record<string, string>;
  tree: Node;
} {
  const tree = buildHuffmanTree(text);
  console.log(tree)
  const codes = generateCodes(tree);
  const encoded = text
    .split('')
    .map((c) => codes[c])
    .join('');
  return { encoded, codes, tree };
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
