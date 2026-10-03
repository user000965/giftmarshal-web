import { describe, expect, it } from 'vitest';
import { type ClaimLike, claimSignature, deriveClaimState } from './claimState';

describe('deriveClaimState', () => {
  it('returns null when no live claim reserves the item', () => {
    expect(deriveClaimState([])).toBeNull();
    expect(deriveClaimState([{ hiddenPostEvent: true }])).toBeNull();
  });

  it('counts a plain claim as one contributor, not a group gift', () => {
    expect(deriveClaimState([{ isGroupGift: false }])).toEqual({ isGroupGift: false, contributorCount: 1, potId: null });
  });

  it('carries a pot claim\'s potId and contributor count into the mirror', () => {
    expect(deriveClaimState([{ isGroupGift: true, contributorCount: 4, potId: 'pot_1' }]))
      .toEqual({ isGroupGift: true, contributorCount: 4, potId: 'pot_1' });
  });

  it('is a group gift only if EVERY live claim is one (production lock semantics)', () => {
    expect(deriveClaimState([{ isGroupGift: true, contributorCount: 2 }, { isGroupGift: false }])?.isGroupGift).toBe(false);
  });

  it('ignores claims hidden after their event', () => {
    expect(deriveClaimState([{ isGroupGift: true, contributorCount: 3, potId: 'p' }, { hiddenPostEvent: true }]))
      .toEqual({ isGroupGift: true, contributorCount: 3, potId: 'p' });
  });
});

describe('claimSignature', () => {
  it('changes when potId changes, so the mirror is refreshed', () => {
    expect(claimSignature({ wishlistId: 'w', itemId: 'i', potId: 'a' }))
      .not.toBe(claimSignature({ wishlistId: 'w', itemId: 'i', potId: 'b' }));
  });

  it('ignores fields the mirror does not depend on', () => {
    const purchased = { wishlistId: 'w', itemId: 'i', isPurchased: true } as ClaimLike;
    expect(claimSignature(purchased)).toBe(claimSignature({ wishlistId: 'w', itemId: 'i' }));
  });

  it('is empty for a missing claim', () => {
    expect(claimSignature(null)).toBe('');
  });
});
