import { describe, expect, it } from 'vitest';
import { generateUniqueEventCode, randomEventCode } from './eventCode';

describe('randomEventCode', () => {
  it('builds a 6-character code from the alphabet', () => {
    expect(randomEventCode(() => 0)).toBe('AAAAAA');
    expect(randomEventCode((max) => max - 1)).toBe('999999');
  });

  it('never uses look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(randomEventCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });
});

describe('generateUniqueEventCode', () => {
  it('skips codes that are already taken', async () => {
    const taken = new Set(['AAAAAA']);
    let call = 0;
    const pick = () => (call++ < 6 ? 0 : 1); // first AAAAAA, then BBBBBB
    await expect(generateUniqueEventCode(async (code) => taken.has(code), pick)).resolves.toBe('BBBBBB');
  });

  it('gives up after 100 attempts', async () => {
    await expect(generateUniqueEventCode(async () => true, () => 0)).rejects.toThrow('100 attempts');
  });
});
