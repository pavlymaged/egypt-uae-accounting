// Accepts any value (numbers included) and ignores Arabic diacritics and tatweel so search never crashes or misses.
export function foldText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesQuery(query: string, values: unknown[]): boolean {
  const q = foldText(query);
  return !q || values.some((v) => foldText(v).includes(q));
}
