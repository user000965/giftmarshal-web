// S2c (spec 4.6): can holds be renewed after the 3-day honor period, for card AND
// wallet funding? Run on day 0 (expect "too soon") and again on day 4 or later.
import { log, pp, readOut } from './paypal.js';

const { keepAuthorizationId } = await readOut<{ keepAuthorizationId: string | null }>('s1');
const { walletAuthorizationId } = await readOut<{ walletAuthorizationId: string | null }>('s2');
const day = new Date().toISOString().slice(0, 10);

for (const [label, id] of [['card', keepAuthorizationId], ['wallet', walletAuthorizationId]] as const) {
  if (!id) { console.log(`skip ${label}: no authorization id saved`); continue; }
  const details = await pp('GET', `/v2/payments/authorizations/${id}`);
  log(`S2c ${label} authorization details (${day}): note expiration_time`, details);
  const re = await pp('POST', `/v2/payments/authorizations/${id}/reauthorize`, {
    amount: { currency_code: 'USD', value: '10.00' },
  }, `reauth:${id}:${day}`);
  log(`S2c ${label} REAUTHORIZE on ${day}`, re);
}
