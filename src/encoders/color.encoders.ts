import { rgbToHex } from "./utils";

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
    possible_binary_with_value[possible_binary_combinations[i]] = i * (255 / (possiblities_per_color - 1));
  }
  return possible_binary_with_value;
}

export function colorEncoder(text: string, bit_length: number = 6): string[] {
  console.log(bit_length)
  const hexs: string[] = [];
  const bit_per_color = Math.floor(bit_length / 3);
  const possiblities_per_color = getPossibleBinaryStrings(bit_per_color);
  if (bit_length <= 0) return hexs;

  let color_value_buffer: number[] = [];
  for (let i = 0; i < text.length / bit_per_color; i++) {
    const per_color_bit = text.substring(i * bit_per_color, (i + 1) * bit_per_color).toString();
    color_value_buffer.push(possiblities_per_color[per_color_bit]);
    if (color_value_buffer.length === 3) {
        hexs.push(rgbToHex(color_value_buffer[0], color_value_buffer[1], color_value_buffer[2]));
        color_value_buffer = [];
    }
  }

  return hexs;
}
