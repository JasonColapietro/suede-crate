import { AppError } from './qloo.mjs';

export function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

export function fail(res, error) {
  send(res, error instanceof AppError ? error.status : 500, { error: { code: error instanceof AppError ? error.code : 'internal_error', message: error instanceof AppError ? error.message : 'The crate could not be built. Please try again.' } });
}

export async function readBody(req) {
  const declared = Number(req.headers['content-length']);
  if (declared > 16000) throw new AppError(413, 'body_too_large', 'This request is too large.');
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new AppError(415, 'invalid_content_type', 'Send this request as JSON.');
  if (req.body !== undefined) {
    const size = Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    if (size > 16000) throw new AppError(413, 'body_too_large', 'This request is too large.');
    if (typeof req.body === 'object' && req.body !== null) return req.body;
    try { return JSON.parse(req.body); } catch { throw new AppError(400, 'invalid_json', 'This request could not be read.'); }
  }
  let data = '';
  for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 16000) throw new AppError(413, 'body_too_large', 'This request is too large.'); }
  try { return JSON.parse(data); } catch { throw new AppError(400, 'invalid_json', 'This request could not be read.'); }
}

// Per-instance traffic guard. Vercel's project firewall provides the global deployment limit.
const traffic = new Map();
export function allowRequest(req, { limit = 30, now = Date.now() } = {}) {
  const forwarded = req.headers['x-forwarded-for'];
  const key = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0];
  const bucket = traffic.get(key);
  if (traffic.size >= 1000) traffic.delete(traffic.keys().next().value);
  if (!bucket || bucket.until < now) { traffic.set(key, { count: 1, until: now + 60000 }); return; }
  bucket.count++;
  if (bucket.count > limit) throw new AppError(429, 'too_many_requests', 'Please wait a minute before making another discovery.');
}

export function requireMethod(req, res, expected) {
  if (req.method === expected) return true;
  res.setHeader('Allow', expected);
  send(res, 405, { error: { code: 'method_not_allowed', message: `Use ${expected} for this endpoint.` } });
  return false;
}

export function validateOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    const url = new URL(origin);
    if (url.host === host && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) return;
  } catch { /* Invalid origins are refused without echoing them. */ }
  throw new AppError(403, 'invalid_origin', 'This request came from an unsupported origin.');
}
