import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminDb, waitFor } from './harness.mjs';

test('onEventCreated mints a 6-character code and its eventCodes lookup', async () => {
  const db = adminDb();
  const id = `ev_${Date.now()}`;
  await db.collection('events').doc(id).set({
    id, title: 'Trigger test', eventType: 'birthday', organizerId: 'u1',
    isPublic: false, assignmentsGenerated: false, eventCode: '',
  });
  const code = await waitFor(async () => (await db.collection('events').doc(id).get()).get('eventCode') || null);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal((await db.collection('eventCodes').doc(code).get()).get('eventId'), id);
});

test('onClaimWritten mirrors a pot claim with potId, and frees the item when the claim goes', async () => {
  const db = adminDb();
  const wl = `wl_${Date.now()}`;
  const claimId = `claim_${Date.now()}`;
  await db.collection('claims').doc(claimId).set({
    id: claimId, wishlistId: wl, itemId: 'item_1', isGroupGift: true, contributorCount: 3,
    potId: 'pot_1', claimerId: 'starter', wishlistOwnerId: 'owner',
  });

  const state = await waitFor(async () => {
    const snap = await db.doc(`wishlists/${wl}/claimState/item_1`).get();
    return snap.exists && snap.get('contributorCount') === 3 ? snap.data() : null;
  });
  assert.equal(state.isClaimed, true);
  assert.equal(state.isGroupGift, true);
  assert.equal(state.potId, 'pot_1');
  assert.equal(state.claimerId, undefined, 'the mirror must never carry claimer identity');
  assert.equal((await db.doc(`claimLocks/${wl}_item_1`).get()).get('isGroupGift'), true);

  await db.collection('claims').doc(claimId).delete();
  await waitFor(async () => !(await db.doc(`wishlists/${wl}/claimState/item_1`).get()).exists);
  assert.equal((await db.doc(`claimLocks/${wl}_item_1`).get()).exists, false);
});
