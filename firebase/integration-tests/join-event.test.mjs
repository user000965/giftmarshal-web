import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminDb, anonymousClient, randomCode } from './harness.mjs';

async function seedEvent(overrides = {}) {
  const db = adminDb();
  const id = `ev_${Math.random().toString(36).slice(2)}`;
  const code = randomCode();
  await db.collection('events').doc(id).set({
    id, title: 'Dana farewell', eventType: 'general', organizerId: 'org', status: 'active',
    isPublic: false, assignmentsGenerated: false, eventCode: code, ...overrides,
  });
  await db.collection('eventCodes').doc(code).set({ eventId: id });
  return { id, code };
}

const rejectsWith = (code) => (error) => {
  assert.equal(error.code, `functions/${code}`);
  return true;
};

test('an anonymous guest joins with a code and is keyed by their auth uid', async () => {
  const { id, code } = await seedEvent();
  const guest = await anonymousClient();
  const result = await guest.call('joinEvent', { eventCode: ` ${code.toLowerCase()} `, displayName: ' Aida ' });
  assert.deepEqual(result, { eventId: id, eventTitle: 'Dana farewell', alreadyJoined: false });

  const participant = await adminDb().doc(`events/${id}/participants/${guest.uid}`).get();
  assert.equal(participant.get('id'), guest.uid);
  assert.equal(participant.get('role'), 'Participant');
  assert.equal(participant.get('userName'), 'Aida');
  assert.equal(participant.get('isGuestParticipant'), true);
});

test('joining twice is harmless and reports alreadyJoined', async () => {
  const { code } = await seedEvent();
  const guest = await anonymousClient();
  await guest.call('joinEvent', { eventCode: code, displayName: 'Marat' });
  const again = await guest.call('joinEvent', { eventCode: code, displayName: 'Marat' });
  assert.equal(again.alreadyJoined, true);
});

test('a wrong code is not-found', async () => {
  const guest = await anonymousClient();
  await assert.rejects(guest.call('joinEvent', { eventCode: 'ZZZZZZ', displayName: 'A' }), rejectsWith('not-found'));
});

test('Secret Santa and cancelled events refuse web joins', async () => {
  const guest = await anonymousClient();
  const santa = await seedEvent({ eventType: 'secret_santa' });
  await assert.rejects(guest.call('joinEvent', { eventCode: santa.code, displayName: 'A' }), rejectsWith('failed-precondition'));
  const cancelled = await seedEvent({ status: 'cancelled' });
  await assert.rejects(guest.call('joinEvent', { eventCode: cancelled.code, displayName: 'A' }), rejectsWith('failed-precondition'));
});

test('bad input is invalid-argument', async () => {
  const guest = await anonymousClient();
  await assert.rejects(guest.call('joinEvent', { eventCode: 'AB2CD3', displayName: '' }), rejectsWith('invalid-argument'));
});
