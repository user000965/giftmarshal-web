// S1 (spec 4.6): can a server create AND authorize an AUTHORIZE order with a sandbox
// test card and no popup? This is what "simulate friends" depends on.
import { log, need, pp, saveOut } from './paypal.js';

const card = {
  number: need('TEST_CARD_NUMBER'),
  expiry: need('TEST_CARD_EXPIRY'),
  name: 'Spike Friend',
  billing_address: {
    address_line_1: '1 Main St', admin_area_2: 'San Jose', admin_area_1: 'CA',
    postal_code: '95131', country_code: 'US',
  },
};

async function cardAuthorization(label: string, value: string) {
  const order = await pp('POST', '/v2/checkout/orders', {
    intent: 'AUTHORIZE',
    purchase_units: [{
      custom_id: `spike-pot:${label}`,
      description: 'Group gift contribution (spike)',
      amount: { currency_code: 'USD', value },
    }],
    payment_source: { card },
  }, `spike-s1-${label}-${Date.now()}`);
  log(`S1 create+authorize with card (${label}, ${value})`, order);
  const auth = order.body?.purchase_units?.[0]?.payments?.authorizations?.[0];
  return { order, auth } as { order: typeof order; auth: { id: string; status: string; expiration_time?: string } | undefined };
}

const first = await cardAuthorization('friend-1', '10.00');
if (!first.auth) {
  console.log('\nRESULT S1: FAILED. No authorization came back from a card order. Copy the error name/details above into FINDINGS. Fallback per spec 4.6.');
  process.exit(1);
}
console.log(`\nauthorization ${first.auth.id} status=${first.auth.status} expires=${first.auth.expiration_time}`);

const captureRequestId = `cap:${first.auth.id}`;
const capture = await pp('POST', `/v2/payments/authorizations/${first.auth.id}/capture`, {
  amount: { currency_code: 'USD', value: '7.00' },
  final_capture: true,
}, captureRequestId);
log('S1 partial capture 7.00 of 10.00 with final_capture=true', capture);

const replay = await pp('POST', `/v2/payments/authorizations/${first.auth.id}/capture`, {
  amount: { currency_code: 'USD', value: '7.00' },
  final_capture: true,
}, captureRequestId);
log('S1 REPLAY of the same capture (same PayPal-Request-Id): expect the SAME capture id, not a second charge', replay);
console.log(`\nidempotent replay: ${replay.body?.id === capture.body?.id ? 'YES (same capture id)' : 'NO, investigate'}`);

const capDetails = await pp('GET', `/v2/payments/captures/${capture.body?.id}`);
log('S1 capture details: look at seller_receivable_breakdown (paypal_fee, net_amount)', capDetails);

const second = await cardAuthorization('friend-2', '15.00');
if (second.auth) {
  const voided = await pp('POST', `/v2/payments/authorizations/${second.auth.id}/void`, undefined, `void:${second.auth.id}`);
  log('S1 void of a second card authorization', voided);
}

const keep = await cardAuthorization('keep-for-s2', '10.00');
await saveOut('s1', { keepAuthorizationId: keep.auth?.id ?? null, captureId: capture.body?.id ?? null });
console.log('\nRESULT S1: card authorization worked. Saved keep-for-s2 authorization to out/s1.json. Record fees from the capture details above.');
