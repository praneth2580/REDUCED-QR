export function dictionaryGroupEncode(text: string, groupSize: number): { encoded: string; dictionary: string[] } {
  if (groupSize <= 0) {
    return { encoded: '', dictionary: [] };
  }
  const groups: string[] = [];
  for (let i = 0; i < text.length; i += groupSize) {
    groups.push(text.substring(i, i + groupSize));
  }

  const uniqueGroups = Array.from(new Set(groups));
  const dictionary = uniqueGroups;

  const encoded = groups.map(group => dictionary.indexOf(group)).join(' ');
  return { encoded, dictionary };
}

export function dictionaryGroupDecode(encoded: string, dictionary: string[]): string {
  const codes = encoded.split(' ').map(Number);
  const decoded = codes.map(code => dictionary[code]).join('');
  return decoded;
}
