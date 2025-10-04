import type { Encoded } from "./normalizer";

export function rleEncode(text: string): Encoded {
  if (!text) return { encoded: '' };
  let encodedStr = '';
  let count = 1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === text[i + 1]) {
      count++;
    } else {
      encodedStr += count + text[i];
      count = 1;
    }
  }
  return { encoded: encodedStr };
}

export function rleDecode(encoded: string): string {
  if (!encoded) return '';
  let decoded = '';
  let i = 0;

  while (i < encoded.length) {
    let countStr = '';
    while (i < encoded.length && !isNaN(parseInt(encoded[i]))) {
      countStr += encoded[i];
      i++;
    }
    const count = parseInt(countStr);
    const char = encoded[i];
    decoded += char.repeat(count);
    i++;
  }

  return decoded;
}
