import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export interface RateWindow {
  count: number;
  windowStart: number;
}

export interface RateLimitConfig {
  action: string;
  identifier: string;
  maxRequests: number;
  windowMs: number;
}

/** Pure fixed-window counter: decides one request and returns the window to store. */
export function applyRequest(
  current: RateWindow | null,
  now: number,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; next: RateWindow } {
  if (!current || current.windowStart < now - windowMs) {
    return { allowed: true, next: { count: 1, windowStart: now } };
  }
  if (current.count >= maxRequests) return { allowed: false, next: current };
  return { allowed: true, next: { count: current.count + 1, windowStart: current.windowStart } };
}

/** Transactional so two concurrent requests cannot both take the last slot. */
export async function enforceRateLimit(db: Firestore, config: RateLimitConfig): Promise<void> {
  const ref = db.collection('rateLimits').doc(`${config.action}_${config.identifier}`);
  const allowed = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = snapshot.exists ? (snapshot.data() as RateWindow) : null;
    const now = Date.now();
    const decision = applyRequest(current, now, config.maxRequests, config.windowMs);
    if (decision.allowed) {
      tx.set(ref, { ...decision.next, action: config.action, identifier: config.identifier, lastRequest: now });
    }
    return decision.allowed;
  });
  if (!allowed) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Please wait a minute and try again.');
  }
}
