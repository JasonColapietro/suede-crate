import { createQloo } from '../lib/qloo.mjs';
import { allowRequest, fail, requireMethod, send } from '../lib/http.mjs';
let qloo;
export function makeSearch(client) {
  return async (req, res) => {
    if (!requireMethod(req, res, 'GET')) return;
    try { allowRequest(req); const url = new URL(req.url, 'http://localhost'); send(res, 200, { artists: await client.search(url.searchParams.get('q')), provider: 'Qloo' }); } catch (error) { fail(res, error); }
  };
}
export default async function handler(req, res) { try { qloo ??= createQloo(); return makeSearch(qloo)(req, res); } catch (error) { fail(res, error); } }
