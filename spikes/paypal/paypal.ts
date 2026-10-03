// Throwaway PayPal sandbox harness for the spikes. Prints evidence; never hides errors.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export function need(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('<')) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

const BASE = process.env.PAYPAL_API_BASE ?? 'https://api-m.sandbox.paypal.com';
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const basic = Buffer.from(`${need('PAYPAL_CLIENT_ID')}:${need('PAYPAL_CLIENT_SECRET')}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`OAuth token failed: HTTP ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export interface PpResult<T = any> { status: number; debugId: string | null; body: T }

export async function pp<T = any>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  requestId?: string,
): Promise<PpResult<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });
  const text = await res.text();
  return { status: res.status, debugId: res.headers.get('paypal-debug-id'), body: text ? JSON.parse(text) : null };
}

export function log(label: string, r: PpResult): void {
  console.log(`\n=== ${label} → HTTP ${r.status} (paypal-debug-id ${r.debugId})`);
  console.log(JSON.stringify(r.body, null, 2));
}

const OUT = new URL('./out/', import.meta.url);
export async function saveOut(name: string, data: unknown): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(data, null, 2));
}
export async function readOut<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(`${name}.json`, OUT), 'utf8')) as T;
}
