// Shared helpers for emulator-backed integration tests (reused by later plans).
import { getApps as getAdminApps, initializeApp as initAdmin } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

export const PROJECT_ID = 'demo-giftmarshal';
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Admin SDK; emulators:exec sets FIRESTORE_EMULATOR_HOST so this never touches a real project. */
export function adminDb() {
  if (getAdminApps().length === 0) initAdmin({ projectId: PROJECT_ID });
  return getFirestore();
}

let clientCount = 0;

/** A fresh anonymous browser-like client that can call the emulated functions. */
export async function anonymousClient() {
  const app = initializeApp(
    { apiKey: 'demo-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` },
    `client-${clientCount++}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const credential = await signInAnonymously(auth);
  return {
    uid: credential.user.uid,
    call: async (name, data) => (await httpsCallable(functions, name)(data)).data,
  };
}

/** Poll until fn returns a truthy value (triggers are asynchronous). */
export async function waitFor(fn, { timeoutMs = 15_000, intervalMs = 200 } = {}) {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function randomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}
