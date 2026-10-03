// S2a: create an AUTHORIZE order to be approved by a sandbox PayPal (wallet) buyer.
import { log, pp, saveOut } from './paypal.js';

const order = await pp('POST', '/v2/checkout/orders', {
  intent: 'AUTHORIZE',
  purchase_units: [{
    custom_id: 'spike-pot:wallet-1',
    description: 'Group gift contribution (spike)',
    amount: { currency_code: 'USD', value: '20.00' },
  }],
  payment_source: {
    paypal: { experience_context: { return_url: 'https://example.com/return', cancel_url: 'https://example.com/cancel', user_action: 'CONTINUE' } },
  },
}, `spike-s2a-${Date.now()}`);
log('S2a create wallet order', order);
const approve = (order.body?.links ?? []).find((l: { rel: string }) => l.rel === 'payer-action' || l.rel === 'approve');
await saveOut('s2', { orderId: order.body?.id ?? null, walletAuthorizationId: null });
console.log(`\nOpen this link, sign in with the SANDBOX PERSONAL account, approve, then run: npm run s2b\n${approve?.href}`);
