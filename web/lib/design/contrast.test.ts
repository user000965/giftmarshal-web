// @vitest-environment node
// Reads tokens.css from disk; under jsdom import.meta.url is not a file:// URL.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TEXT_PAIRS, contrastRatio, parseHexTokens } from './contrast';

const tokens = parseHexTokens(readFileSync(new URL('../../app/tokens.css', import.meta.url), 'utf8'));

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('D2 tokens', () => {
  it('declares every token the design uses', () => {
    for (const name of ['bg', 'card', 'ink', 'ink-2', 'track', 'coral', 'sun', 'rose']) {
      expect(tokens[name], `--${name}`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it.each(TEXT_PAIRS)('text %s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('coral is too light for text on a card, which is why it is never used for text', () => {
    expect(contrastRatio(tokens.coral, tokens.card)).toBeLessThan(4.5);
  });
});
