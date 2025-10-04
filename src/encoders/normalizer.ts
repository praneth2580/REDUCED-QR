import { rleEncode } from "./basic_rle.encoders";
import { dictionaryEncode } from "./dictionary.encoders";
import { dictionaryGroupEncode } from "./dictionary.group.encoders";
import { huffmanEncode } from "./huffman.encoders";
import { huffmanWordEncode } from "./huffman.word.encoders";

export interface Encoded {
  encoded: string;
  dictionary?: string[];
  codes?: Record<string, string>;
  tree?: any;
  freq?: Record<string, number>;
}

export function encode(text: string, encoder: string, groupSize?: number): Encoded {
    switch (encoder) {
      case 'rle':
        return rleEncode(text);
      case 'huffman':
        return huffmanEncode(text);
      case 'huffmanWord':
        return huffmanWordEncode(text);
      case 'dictionary':
        return dictionaryEncode(text);
      case 'dictionaryGroup':
        return dictionaryGroupEncode(text, groupSize || 3);
      default:
        throw new Error('Invalid encoder');
    }
}
