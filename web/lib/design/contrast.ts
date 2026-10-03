/** Every foreground/background token pair that is allowed to carry text. */
// A mutable tuple array on purpose: vitest's it.each typing rejects readonly tuples under tsc.
export const TEXT_PAIRS: Array<[fg: string, bg: string]> = [
  ['ink', 'bg'],
  ['ink', 'card'],
  ['ink-2', 'bg'],
  ['ink-2', 'card'],
  ['card', 'ink'],
  ['ink', 'sun'],
  ['ink', 'rose'],
];

export function parseHexTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1]] = match[2].toUpperCase();
  }
  return tokens;
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
