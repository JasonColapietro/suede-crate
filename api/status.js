import { requireMethod, send } from '../lib/http.mjs';
export default function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  send(res, 200, { configured: Boolean(process.env.QLOO_API_KEY?.trim()), provider: 'Qloo', service: 'Suede Crate' });
}
