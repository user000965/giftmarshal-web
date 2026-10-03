import { describe, expect, it } from 'vitest';
import { formatUsd, progressPercent } from './money';

describe('formatUsd', () => {
  it('drops cents for whole dollars and keeps them otherwise', () => {
    expect(formatUsd(18000)).toBe('$180');
    expect(formatUsd(18050)).toBe('$180.50');
    expect(formatUsd(0)).toBe('$0');
  });

  it('refuses non-integer cents (money is never a float)', () => {
    expect(() => formatUsd(10.5)).toThrow('integer');
  });
});

describe('progressPercent', () => {
  it('floors to a whole percent', () => {
    expect(progressPercent(18000, 24000)).toBe(75);
    expect(progressPercent(1, 3)).toBe(33);
  });

  it('clamps to 0–100 and handles a zero target', () => {
    expect(progressPercent(30000, 24000)).toBe(100);
    expect(progressPercent(-5, 100)).toBe(0);
    expect(progressPercent(100, 0)).toBe(0);
  });
});
