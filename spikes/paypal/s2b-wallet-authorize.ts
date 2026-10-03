// S2b: authorize the order the sandbox buyer just approved.
import { log, pp, readOut, saveOut } from './paypal.js';

const { orderId } = await readOut<{ orderId: string }>('s2');
const auth = await pp('POST', `/v2/checkout/orders/${orderId}/authorize`, undefined, `auth:${orderId}`);
log('S2b authorize approved wallet order', auth);
const authorization = auth.body?.purchase_units?.[0]?.payments?.authorizations?.[0];
await saveOut('s2', { orderId, walletAuthorizationId: authorization?.id ?? null });
console.log(`\nwallet authorization ${authorization?.id} status=${authorization?.status} expires=${authorization?.expiration_time}`);
