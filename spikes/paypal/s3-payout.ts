// S3 (spec 4.6): are Payouts enabled in the sandbox, how do fees appear, and does a
// reused sender_batch_id dedupe? Payouts dedupe on sender_batch_id (spec 4.3).
import { log, need, pp } from './paypal.js';

const senderBatchId = `pot:spike-${Date.now()}:1`;
const body = {
  sender_batch_header: {
    sender_batch_id: senderBatchId,
    email_subject: 'Your group gift pot has been paid out (spike)',
  },
  items: [{
    recipient_type: 'EMAIL',
    receiver: need('SANDBOX_PAYOUT_RECEIVER'),
    amount: { value: '5.00', currency: 'USD' },
    note: 'Spike payout',
    sender_item_id: 'spike-item-1',
  }],
};

const created = await pp('POST', '/v1/payments/payouts', body);
log('S3 create payout batch', created);
const batchId: string | undefined = created.body?.batch_header?.payout_batch_id;
if (!batchId) {
  console.log('\nRESULT S3: FAILED. No payout_batch_id. Copy the error into FINDINGS (Payouts probably not enabled on the app).');
  process.exit(1);
}

let batch = created;
for (let i = 0; i < 24; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  batch = await pp('GET', `/v1/payments/payouts/${batchId}`);
  const status = batch.body?.batch_header?.batch_status;
  console.log(`poll ${i + 1}: batch_status=${status}`);
  if (status && !['PENDING', 'PROCESSING'].includes(status)) break;
}
log('S3 final batch state: record batch_header.fees and items[0].payout_item_fee', batch);

const duplicate = await pp('POST', '/v1/payments/payouts', body);
log('S3 REPLAY with the same sender_batch_id: expect a duplicate error, not a second payout', duplicate);
console.log(`\nRESULT S3: batch ${batchId} final=${batch.body?.batch_header?.batch_status}; duplicate replay HTTP ${duplicate.status}`);
