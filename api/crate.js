import { createQloo } from '../lib/qloo.mjs';
import { buildCrate } from '../lib/discovery.mjs';
import { allowRequest, fail, readBody, requireMethod, send } from '../lib/http.mjs';
let qloo;
export function makeCrate(client) {
  return async (req, res) => {
    if (!requireMethod(req, res, 'POST')) return;
    try { allowRequest(req); send(res, 200, await buildCrate(client, await readBody(req))); } catch (error) { fail(res, error); }
  };
}
export default async function handler(req, res) { try { qloo ??= createQloo(); return makeCrate(qloo)(req, res); } catch (error) { fail(res, error); } }
