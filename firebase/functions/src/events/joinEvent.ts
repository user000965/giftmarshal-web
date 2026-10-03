import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { enforceRateLimit } from '../shared/rateLimit';

export const EVENT_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export const JoinEventInput = z.object({
  eventCode: z.string().trim().toUpperCase().regex(EVENT_CODE_PATTERN, 'That code does not look right.'),
  displayName: z.string().trim().min(1, 'Please add your name.').max(40, 'Names can be at most 40 characters.'),
});

export interface Caller {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
}

export interface JoinEventResult {
  eventId: string;
  eventTitle: string;
  alreadyJoined: boolean;
}

// Same answer for "no such code" and "deleted event", so codes cannot be probed.
const NOT_FOUND_MESSAGE = 'No event matches that code.';

/**
 * Join an event by code. Unlike the production guest flow, the participant document is
 * keyed by the caller's auth uid for anonymous guests too, so the rules' participant
 * checks (isEventParticipant) work for guests and they can see private event wishlists.
 */
export async function joinEventHandler(db: Firestore, caller: Caller, raw: unknown): Promise<JoinEventResult> {
  const parsed = JoinEventInput.safeParse(raw);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }
  const { eventCode, displayName } = parsed.data;

  await enforceRateLimit(db, { action: 'joinEvent', identifier: caller.uid, maxRequests: 20, windowMs: 60_000 });

  const codeSnap = await db.collection('eventCodes').doc(eventCode).get();
  if (!codeSnap.exists) throw new HttpsError('not-found', NOT_FOUND_MESSAGE);
  const eventId = codeSnap.get('eventId') as string;

  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) throw new HttpsError('not-found', NOT_FOUND_MESSAGE);
  const event = eventSnap.data() ?? {};

  if (event.status === 'archived' || event.status === 'cancelled' || event.isActive === false) {
    throw new HttpsError('failed-precondition', 'This event is no longer accepting new people.');
  }
  if (event.eventType === 'secret_santa') {
    throw new HttpsError('failed-precondition', 'Secret Santa events can only be joined in the Gift Marshal app.');
  }

  const participantRef = db.collection('events').doc(eventId).collection('participants').doc(caller.uid);
  const created = await db.runTransaction(async (tx) => {
    const existing = await tx.get(participantRef);
    if (existing.exists) return false;
    tx.set(participantRef, {
      id: caller.uid,
      eventId,
      role: 'Participant',
      joinedAt: FieldValue.serverTimestamp(),
      userName: displayName,
      userEmail: caller.email ?? '',
      tempName: caller.isAnonymous ? displayName : '',
      tempEmail: '',
      profileImageURL: '',
      isGuestParticipant: caller.isAnonymous,
    });
    return true;
  });

  return {
    eventId,
    eventTitle: typeof event.title === 'string' ? event.title : 'Event',
    alreadyJoined: !created,
  };
}
