import { describe, expect, it } from 'vitest';
import { JoinEventInput } from './joinEvent';

describe('JoinEventInput', () => {
  it('normalises the code to upper case and trims both fields', () => {
    expect(JoinEventInput.parse({ eventCode: ' ab2cd3 ', displayName: '  Aida ' }))
      .toEqual({ eventCode: 'AB2CD3', displayName: 'Aida' });
  });

  it('rejects look-alike characters and wrong lengths', () => {
    for (const eventCode of ['AB0CD3', 'AB1CD3', 'ABICD3', 'ABOCD3', 'ABCDE', 'ABCDEFG']) {
      expect(JoinEventInput.safeParse({ eventCode, displayName: 'A' }).success).toBe(false);
    }
  });

  it('requires a display name of 1 to 40 characters', () => {
    expect(JoinEventInput.safeParse({ eventCode: 'AB2CD3', displayName: '   ' }).success).toBe(false);
    expect(JoinEventInput.safeParse({ eventCode: 'AB2CD3', displayName: 'x'.repeat(41) }).success).toBe(false);
    expect(JoinEventInput.safeParse({ eventCode: 'AB2CD3', displayName: 'x'.repeat(40) }).success).toBe(true);
  });
});
