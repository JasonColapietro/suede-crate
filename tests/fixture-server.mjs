// Synthetic contract fixtures for automated UI tests only. Never imported by deployed handlers.
import { createServer } from '../server.mjs';
import { createQloo } from '../lib/qloo.mjs';
import { makeSearch } from '../api/search.js';
import { makeCrate } from '../api/crate.js';
import { makeMcp } from '../api/mcp.js';
import { send } from '../lib/http.mjs';
export const fixtureId = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const row = (n, name, kind = 'artist') => ({ entity_id: fixtureId(n), name, types: [`urn:entity:${kind}`], properties: { description: 'Synthetic test fixture. Not a live Qloo recommendation.' }, tags: [{ name: 'Synthetic fixture' }] });
const client = createQloo({ apiKey: 'synthetic-fixture-only', fetchFn: async url => {
  if (url.searchParams.get('query') === 'Slow Artist') await new Promise(resolve => setTimeout(resolve, 500));
  if (url.pathname === '/search') return Response.json({ results: url.searchParams.get('query') === 'No Match' ? [] : [row(1, 'Example Starting Artist'), row(2, 'Another Example Artist')] });
  const kind = url.searchParams.get('filter.type').split(':').at(-1);
  const omit = new Set(url.searchParams.get('filter.exclude.entities').split(','));
  const rows = kind === 'artist' ? [row(3, 'Example Discovery A'), row(4, 'Example Discovery B'), row(5, 'Example Discovery C'), row(6, '<img src=x onerror=alert(1)>'), row(7, 'Example Discovery E'), row(8, 'Example Discovery F')] : [row(kind === 'movie' ? 20 : 30, kind === 'movie' ? 'Example Film' : 'Example Book', kind)];
  return Response.json({ results: { entities: rows.filter(r => !omit.has(r.entity_id)) } });
} });
const handlers = new Map([['/api/search', makeSearch(client)], ['/api/crate', makeCrate(client)], ['/api/mcp', makeMcp(client)], ['/api/status', (req, res) => send(res, 200, { configured: true, testFixture: true })]]);
createServer({ handlers }).listen(3479, '127.0.0.1', () => process.stdout.write('Synthetic UI test server: http://127.0.0.1:3479\n'));
