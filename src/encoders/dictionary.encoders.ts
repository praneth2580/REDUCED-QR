import type { Encoded } from "./normalizer";

export function dictionaryEncode(text: string): Encoded {
  const words = text.split(/(\s+)/);
  const uniqueWords = Array.from(new Set(words));
  const dictionary = uniqueWords;

  const encoded = words.map(word => dictionary.indexOf(word)).join(' ');
  return { encoded, dictionary };
}

export function dictionaryDecode(encoded: string, dictionary: string[]): string {
  const codes = encoded.split(' ').map(Number);
  const decoded = codes.map(code => dictionary[code]).join('');
  return decoded;
}

export function mergeEncodedAndDictionary(
  encoded: string,
  dictionary: string[]
): string {
  const dictionaryString = dictionary.join('\n');
  return `${encoded}\n--DICTIONARY--\n${dictionaryString}`;
}

export function splitEncodedAndDictionary(
  mergedString: string
): { encoded: string; dictionary: string[] } {
  const parts = mergedString.split('\n--DICTIONARY--\n');
  if (parts.length !== 2) {
    throw new Error('Invalid merged string format');
  }
  const encoded = parts[0];
  const dictionary = parts[1].split('\n');
  return { encoded, dictionary };
}