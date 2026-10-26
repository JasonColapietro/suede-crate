import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { makeMcp } from '../api/mcp.js';
import { makeSearch } from '../api/search.js';
import { makeCrate } from '../api/crate.js';
import { readBody, allowRequest } from '../lib/http.mjs';
import { AppError } from '../lib/qloo.mjs';
const a = '11111111-1111-4111-8111-111111111111';
function response() { return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, writeHead(s, h) { this.status = s; Object.assign(this.headers, h); }, end(v) { this.raw = v; this.body = v ? JSON.parse(v) : null; } }; }
const req = (method, body, headers = {}) => ({ method, body, headers: { 'content-type': 'application/json', host: 'crate.example', 'x-forwarded-for': crypto.randomUUID(), ...headers }, url: '/api/mcp' });
const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, params });
test('MCP initializes, discovers tools, pings and handles notifications without Qloo credentials', async () => {
  const handler = makeMcp({});
  let res = response(); await handler(req('POST', rpc('initialize', { protocolVersion: '2025-11-25' })), res); assert.equal(res.body.result.protocolVersion, '2025-11-25');
  res = response(); await handler(req('POST', rpc('tools/list')), res); assert.deepEqual(res.body.result.tools.map(t => t.name), ['search_artists', 'build_music_crate']);
  res = response(); await handler(req('POST', rpc('ping')), res); assert.deepEqual(res.body.result, {});
  res = response(); await handler(req('POST', { jsonrpc: '2.0', method: 'notifications/initialized' }), res); assert.equal(res.status, 202);
});
test('MCP tool calls return typed results, unknown methods and tool failures correctly', async () => {
  const handler = makeMcp({ search: async () => [{ id: a, name: 'Synthetic artist' }] });
  let res = response(); await handler(req('POST', rpc('tools/call', { name: 'search_artists', arguments: { query: 'Artist' } })), res); assert.equal(res.body.result.structuredContent.artists[0].id, a);
  res = response(); await handler(req('POST', rpc('unknown')), res); assert.equal(res.body.error.code, -32601);
  res = response(); await handler(req('POST', rpc('tools/call', { name: 'unknown' })), res); assert.equal(res.body.error.code, -32602);
  res = response(); await makeMcp({ search: async () => { throw new AppError(503, 'no_key', 'Not configured.'); } })(req('POST', rpc('tools/call', { name: 'search_artists', arguments: { query: 'Artist' } })), res); assert.equal(res.body.result.isError, true); assert.equal(res.body.result.content[0].text, 'Not configured.');
});
test('MCP refuses cross-origin requests and malformed JSON-RPC, allows matching origins', async () => {
  const h = makeMcp({}); let res = response(); await h(req('POST', rpc('ping'), { origin: 'https://evil.example' }), res); assert.equal(res.status, 403);
  res = response(); await h(req('POST', rpc('ping'), { origin: 'https://crate.example' }), res); assert.equal(res.status, 200);
  res = response(); await h(req('POST', []), res); assert.equal(res.status, 400);
  res = response(); await h(req('GET'), res); assert.equal(res.status, 405);
});
test('HTTP search and crate handlers reject wrong methods and expose no unexpected exception details', async () => {
  let res = response(); await makeSearch({})(req('POST', {}), res); assert.equal(res.status, 405);
  res = response(); const r = req('GET'); r.url = '/api/search?q=artist'; await makeSearch({ search: async () => { throw new Error('private-token'); } })(r, res); assert.equal(res.status, 500); assert.ok(!JSON.stringify(res.body).includes('private-token'));
  res = response(); await makeCrate({})(req('POST', { seedIds: ['bad'] }), res); assert.equal(res.status, 400);
});
test('body parser rejects oversized, wrong-content-type and invalid JSON requests', async () => {
  await assert.rejects(readBody(req('POST', 'x'.repeat(16001))), e => e.status === 413);
  await assert.rejects(readBody(req('POST', '{')), e => e.status === 400);
  await assert.rejects(readBody(req('POST', {}, { 'content-type': 'text/plain' })), e => e.status === 415);
  const stream = Readable.from(['{"ok":', 'true}']); stream.headers = { 'content-type': 'application/json' }; assert.deepEqual(await readBody(stream), { ok: true });
});
test('traffic guard bounds repeated requests and resets after a minute', () => {
  const r = req('POST', {}); allowRequest(r, { limit: 2, now: 100 }); allowRequest(r, { limit: 2, now: 101 }); assert.throws(() => allowRequest(r, { limit: 2, now: 102 }), e => e.status === 429); allowRequest(r, { limit: 2, now: 60101 });
});
