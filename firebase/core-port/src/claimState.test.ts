import { describe, expect, it } from 'vitest';
import { type ClaimLike, claimSignature, deriveClaimState } from './claimState';

describe('deriveClaimState', () => {
  it('returns null when no live claim reserves the item', () => {
    expect(deriveClaimState([])).toBeNull();
    expect(deriveClaimState([{ hiddenPostEvent: true }])).toBeNull();
  });

  it('counts a plain claim as one contributor, not a group gift', () => {
    expect(deriveClaimState([{ isGroupGift: false }])).toEqual({ isGroupGift: false, isJoinableGroupGift: false, contributorCount: 1 });
  });

  it('shows a pot as a group gift but locks it as NOT joinable (pots take money through PayPal)', () => {
    expect(deriveClaimState([{ isGroupGift: true, contributorCount: 4, potId: 'pot_1' }]))
      .toEqual({ isGroupGift: true, isJoinableGroupGift: false, contributorCount: 4 });
  });

  it('keeps a legacy group gift joinable', () => {
    expect(deriveClaimState([{ isGroupGift: true, contributorCount: 2 }]))
      .toEqual({ isGroupGift: true, isJoinableGroupGift: true, contributorCount: 2 });
  });

  it('treats potId null or empty as "no pot"', () => {
    expect(deriveClaimState([{ isGroupGift: true, potId: '' }])?.isJoinableGroupGift).toBe(true);
  });

  it('is a group gift only if EVERY live claim is one (production lock semantics)', () => {
    expect(deriveClaimState([{ isGroupGift: true, contributorCount: 2 }, { isGroupGift: false }])?.isGroupGift).toBe(false);
  });

  it('ignores claims hidden after their event', () => {
    expect(deriveClaimState([{ isGroupGift: true, contributorCount: 3, potId: 'p' }, { hiddenPostEvent: true }]))
      .toEqual({ isGroupGift: true, isJoinableGroupGift: false, contributorCount: 3 });
  });
});

describe('claimSignature', () => {
  it('changes when potId changes, so the lock is recomputed', () => {
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
