import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import search from './api/search.js';
import crate from './api/crate.js';
import mcp from './api/mcp.js';
import status from './api/status.js';
import { send } from './lib/http.mjs';
const routes = new Map([['/api/search', search], ['/api/crate', crate], ['/api/mcp', mcp], ['/api/status', status]]);
const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]]);
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
export function createServer({ handlers = routes } = {}) {
  return http.createServer(async (req, res) => {
    for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (handlers.has(path)) return await handlers.get(path)(req, res);
      const file = files.get(path);
      if (!file) return send(res, 404, { error: { message: 'Page not found.' } });
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return send(res, 405, { error: { message: 'Use GET.' } }); }
      const data = await readFile(new URL(`./public/${file[0]}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { if (!res.headersSent) send(res, 500, { error: { message: 'Request failed.' } }); else res.end(); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3478);
  createServer().listen(port, '127.0.0.1', () => process.stdout.write(`Suede Crate: http://127.0.0.1:${port}\n`));
}
