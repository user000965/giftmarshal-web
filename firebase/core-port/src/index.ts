import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { type ClaimLike, claimSignature, syncItemClaimState } from './claimState';
import { generateUniqueEventCode } from './eventCode';

// DEMO PROJECT ONLY. Production runs the original triggers under these names.
initializeApp();
const db = getFirestore();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

/** Mint the 6-character join code and its eventCodes lookup (clients cannot write either). */
export const onEventCreated = onDocumentCreated('events/{eventId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const eventCode = await generateUniqueEventCode(
    async (code) => (await db.collection('eventCodes').doc(code).get()).exists,
  );
  await snapshot.ref.update({ eventCode });
  await db.collection('eventCodes').doc(eventCode).set({
    eventId: event.params.eventId,
    createdAt: FieldValue.serverTimestamp(),
  });
});

/** Keep the duplicate-claim lock and the de-identified claimState mirror in step with claims. */
export const onClaimWritten = onDocumentWritten('claims/{claimId}', async (event) => {
  const before = event.data?.before.exists ? (event.data.before.data() as ClaimLike) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as ClaimLike) : null;
  if (before && after && claimSignature(before) === claimSignature(after)) return;

  const targets = new Map<string, { wishlistId: string; itemId: string }>();
  for (const claim of [before, after]) {
    if (claim?.wishlistId && claim?.itemId) {
      targets.set(`${claim.wishlistId}_${claim.itemId}`, { wishlistId: claim.wishlistId, itemId: claim.itemId });
    }
  }

  for (const target of targets.values()) {
    try {
      await syncItemClaimState(db, target.wishlistId, target.itemId);
    } catch (error) {
      logger.error('syncItemClaimState failed', { ...target, claimId: event.params.claimId, error });
      throw error;
    }
  }
});
