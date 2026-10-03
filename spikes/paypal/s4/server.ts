// S4: minimal local server for the PayPal JS SDK approval flow with intent=authorize.
import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { log, need, pp } from '../paypal.js';

const PORT = 4242;
const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      const html = (await readFile(new URL('./index.html', import.meta.url), 'utf8'))
        .replace('__CLIENT_ID__', need('PAYPAL_CLIENT_ID'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    if (req.method === 'POST' && req.url === '/api/orders') {
      const r = await pp('POST', '/v2/checkout/orders', {
        intent: 'AUTHORIZE',
        purchase_units: [{ custom_id: 'spike-s4', description: 'Group gift contribution (spike)', amount: { currency_code: 'USD', value: '25.00' } }],
      }, `spike-s4-${Date.now()}`);
      log('S4 create order', r);
      json(res, r.status, { id: r.body?.id });
      return;
    }
    const match = req.url?.match(/^\/api\/orders\/([A-Z0-9]+)\/authorize$/);
    if (req.method === 'POST' && match) {
      const r = await pp('POST', `/v2/checkout/orders/${match[1]}/authorize`, undefined, `auth:${match[1]}`);
      log('S4 authorize', r);
      json(res, r.status, r.body);
      return;
    }
    res.writeHead(404).end();
  } catch (error) {
    console.error('S4 server error', error);
    json(res, 500, { error: String(error) });
  }
}).listen(PORT, () => console.log(`S4 spike on http://localhost:${PORT}`));
