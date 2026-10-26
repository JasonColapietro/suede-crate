import assert from 'node:assert/strict';
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/verify-live.mjs https://your-public-demo');
const base = new URL(input);
if (base.protocol !== 'https:') throw new Error('Use the public HTTPS demo URL.');
async function request(path, options) {
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return response.json();
}
const status = await request('/api/status');
assert.equal(status.configured, true, 'Qloo key is not configured. Live integration is NOT verified.');
const search = await request('/api/search?q=Radiohead');
const artist = search.artists.find(a => a.name.toLowerCase() === 'radiohead');
assert.ok(artist, 'Exact artist match not returned by real Qloo search.');
const post = data => ({ method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(data) });
const crate = await request('/api/crate', post({ seedIds: [artist.id] }));
assert.ok(crate.artists.length > 0, 'No real artist recommendations returned.');
assert.ok(crate.films.length > 0, 'No real film associations returned.');
assert.ok(crate.books.length > 0, 'No real book associations returned.');
const init = await request('/api/mcp', post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'suede-crate-verification', version: '1.0.0' } } }));
assert.equal(init.result.protocolVersion, '2025-11-25');
const list = await request('/api/mcp', post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }));
assert.equal(list.result.tools.length, 2);
for (const [id, name, args] of [[3, 'search_artists', { query: 'Radiohead' }], [4, 'build_music_crate', { seedIds: [artist.id] }]]) {
  const result = await request('/api/mcp', post({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }));
  assert.ok(!result.result.isError, `${name} failed`);
  assert.ok(result.result.structuredContent);
}
console.log(JSON.stringify({ result: 'passed', url: base.origin, provider: 'Qloo', liveSearch: true, artistRecommendations: crate.artists.length, filmAssociations: crate.films.length, bookAssociations: crate.books.length, mcpRealTools: 2, checkedAt: new Date().toISOString() }, null, 2));
