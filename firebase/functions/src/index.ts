import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './admin';
import { joinEventHandler } from './events/joinEvent';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export const joinEvent = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');
  return joinEventHandler(db, {
    uid: request.auth.uid,
    isAnonymous: request.auth.token.firebase?.sign_in_provider === 'anonymous',
    email: request.auth.token.email ?? null,
  }, request.data);
});
