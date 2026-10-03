import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/** The claim fields the duplicate-claim lock and the de-identified mirror are derived from. */
export interface ClaimLike {
  wishlistId?: string;
  itemId?: string;
  isGroupGift?: boolean;
  contributorCount?: number;
  hiddenPostEvent?: boolean;
  potId?: string;
}

export interface DerivedClaimState {
  isGroupGift: boolean;
  contributorCount: number;
  potId: string | null;
}

/** A claim stops reserving its item once its event is archived (production spec 7.1). */
export function claimReservesItem(claim: ClaimLike): boolean {
  return claim.hiddenPostEvent !== true;
}

/**
 * What the lock and the mirror should say for one item, or null when nothing reserves it.
 * Recomputed from all claims rather than incremented, so it is idempotent and self-healing.
 */
export function deriveClaimState(claims: ClaimLike[]): DerivedClaimState | null {
  const active = claims.filter(claimReservesItem);
  if (active.length === 0) return null;
  return {
    isGroupGift: active.every((claim) => claim.isGroupGift === true),
    contributorCount: active.reduce(
      (total, claim) => total + (typeof claim.contributorCount === 'number' ? claim.contributorCount : 1),
      0,
    ),
    potId: active.find((claim) => typeof claim.potId === 'string' && claim.potId.length > 0)?.potId ?? null,
  };
}

/** Only these fields change the mirror; anything else (isPurchased, reminders) must not trigger a recompute. */
export function claimSignature(claim: ClaimLike | null): string {
  if (!claim) return '';
  return [
    claim.wishlistId,
    claim.itemId,
    claim.isGroupGift === true,
    typeof claim.contributorCount === 'number' ? claim.contributorCount : 1,
    claim.hiddenPostEvent === true,
    claim.potId ?? '',
  ].join('|');
}

/**
 * Recompute the lock (claimLocks/{wishlistId}_{itemId}) and the de-identified mirror
 * (wishlists/{id}/claimState/{itemId}) from the claims collection. The mirror never
 * carries claimer identity; potId lets event members open the pot from the item card,
 * and the wishlist owner can never read the mirror (path-derived rule).
 */
export async function syncItemClaimState(db: Firestore, wishlistId: string, itemId: string): Promise<void> {
  const snapshot = await db.collection('claims')
    .where('wishlistId', '==', wishlistId)
    .where('itemId', '==', itemId)
    .get();
  const derived = deriveClaimState(snapshot.docs.map((doc) => doc.data() as ClaimLike));
  const lockRef = db.collection('claimLocks').doc(`${wishlistId}_${itemId}`);
  const stateRef = db.collection('wishlists').doc(wishlistId).collection('claimState').doc(itemId);

  if (!derived) {
    await Promise.all([lockRef.delete(), stateRef.delete()]);
    return;
  }

  await Promise.all([
    // merge, and no lockedAt: that field belongs to whichever call first reserved the item.
    lockRef.set({ wishlistId, itemId, isGroupGift: derived.isGroupGift, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    stateRef.set({
      itemId,
      isClaimed: true,
      isGroupGift: derived.isGroupGift,
      contributorCount: derived.contributorCount,
      potId: derived.potId,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  ]);
}
