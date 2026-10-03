import { accessToken } from './paypal.js';

const token = await accessToken();
console.log(`S0 OK: sandbox OAuth works (token length ${token.length}).`);
