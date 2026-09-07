import { hexToRgb, padBits, rgbToHex } from "./utils";

function getBinaryCombinations(length: number): string[] {
  if (length < 0) {
    throw new Error('Length cannot be negative.');
  }
  const combinations: string[] = [];
  for (let i = 0; i < Math.pow(2, length); i++) {
    combinations.push(i.toString(2).padStart(length, '0'));
  }
  return combinations;
}

function getPossibleBinaryStrings(length: number): Record<string, number> {
  const possible_binary_with_value: Record<string, number> = {};

  if (length < 0) {
    throw new Error('Length cannot be negative.');
  }
  const possiblities_per_color = Math.pow(2, length);
  const possible_binary_combinations = getBinaryCombinations(length);

  for (let i = 0; i < possiblities_per_color; i++) {
    const level = possiblities_per_color === 1 ? 0 : i * (255 / (possiblities_per_color - 1));
    possible_binary_with_value[possible_binary_combinations[i]] = Math.round(level);
  }
  return possible_binary_with_value;
}

export function colorEncoder(text: string, bit_length: number = 6): string[] {
  const hexs: string[] = [];
  if (bit_length <= 0) return hexs;

  const bit_per_color = Math.floor(bit_length / 3);
  if (bit_per_color <= 0) return hexs;

  const palette = getPossibleBinaryStrings(bit_per_color);
  const padded = padBits(text, bit_length);

  let color_value_buffer: number[] = [];
  for (let i = 0; i < padded.length; i += bit_per_color) {
    const per_color_bit = padded.substring(i, i + bit_per_color);
    const channelValue = palette[per_color_bit];
    if (channelValue === undefined) {
      throw new Error(`Invalid color bit chunk: ${per_color_bit}`);
    }
    color_value_buffer.push(channelValue);
    if (color_value_buffer.length === 3) {
      hexs.push(rgbToHex(color_value_buffer[0], color_value_buffer[1], color_value_buffer[2]));
      color_value_buffer = [];
    }
  }

  if (color_value_buffer.length > 0) {
    while (color_value_buffer.length < 3) color_value_buffer.push(0);
    hexs.push(rgbToHex(color_value_buffer[0], color_value_buffer[1], color_value_buffer[2]));
  }

  return hexs;
}

function paletteLevels(bit_per_color: number): number[] {
  const levels = 2 ** bit_per_color;
  if (levels === 1) return [0];
  return Array.from({ length: levels }, (_, i) => Math.round(i * (255 / (levels - 1))));
}

function quantizeChannel(value: number, bit_per_color: number): string {
  const palette = paletteLevels(bit_per_color);
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dist = Math.abs(value - palette[i]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex.toString(2).padStart(bit_per_color, '0');
}

export function colorDecoder(hexs: string[], bit_length: number = 6): string {
  if (bit_length <= 0) return '';
  const bit_per_color = Math.floor(bit_length / 3);
  if (bit_per_color <= 0) return '';

  let bits = '';
  for (const hex of hexs) {
    const { r, g, b } = hexToRgb(hex);
    bits += quantizeChannel(r, bit_per_color);
    bits += quantizeChannel(g, bit_per_color);
    bits += quantizeChannel(b, bit_per_color);
  }
  return bits;
}
