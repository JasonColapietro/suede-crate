import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQloo, normalizeEntity, validateIds } from '../lib/qloo.mjs';
import { buildCrate } from '../lib/discovery.mjs';
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222', c = '33333333-3333-4333-8333-333333333333';
const row = (id = b, name = 'Synthetic artist', kind = 'artist') => ({ entity_id: id, name, types: [`urn:entity:${kind}`], properties: { description: 'Synthetic contract fixture; not actual Qloo output.' } });
const json = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('search uses documented GET path, artist restriction, correct header, no secret in URL', async () => {
  let calls = 0;
  const q = createQloo({ apiKey: 'synthetic-test-secret', fetchFn: async (url, opts) => {
    calls++; assert.equal(url.origin, 'https://hackathon.api.qloo.com'); assert.equal(url.pathname, '/search');
    assert.equal(url.searchParams.get('types'), 'urn:entity:artist'); assert.equal(url.searchParams.get('query'), 'Test Artist');
    assert.equal(opts.headers['X-Api-Key'], 'synthetic-test-secret'); assert.ok(!url.toString().includes('secret'));
    return json({ results: [row(), row(c, 'Wrong type', 'book'), { name: 'Bad ID' }] });
  } });
  assert.equal((await q.search(' Test Artist ')).length, 1); await q.search('Test Artist'); assert.equal(calls, 1);
});
test('private cache entries expire and callers cannot mutate cached values', async () => {
  let now = 0, calls = 0;
  const q = createQloo({ apiKey: 'test', now: () => now, fetchFn: async () => { calls++; return json({ results: [row()] }); } });
  const result = await q.search('Artist'); result[0].name = 'Changed';
  assert.equal((await q.search('Artist'))[0].name, 'Synthetic artist'); now = 300001; await q.search('Artist'); assert.equal(calls, 2);
});
test('recommendations use exact selected IDs, deduplicate and exclude seeds/dismissals', async () => {
  const q = createQloo({ apiKey: 'test', fetchFn: async url => {
    assert.equal(url.pathname, '/v2/insights'); assert.equal(url.searchParams.get('signal.interests.entities'), a);
    assert.equal(url.searchParams.get('filter.exclude.entities'), `${a},${c}`); assert.equal(url.searchParams.get('filter.popularity.max'), '0.65');
    return json({ results: { entities: [row(a), row(b), row(b), row(c)] } });
  } });
  const results = await q.insights({ kind: 'artist', seedIds: [a], excludedIds: [c], discovery: 'deep' }); assert.deepEqual(results.map(e => e.id), [b]);
});
test('deep-cut artist filter is not silently applied to film or book queries', async () => {
  const q = createQloo({ apiKey: 'test', fetchFn: async url => { assert.equal(url.searchParams.has('filter.popularity.max'), false); return json({ results: { entities: [] } }); } });
  await q.insights({ kind: 'book', seedIds: [a], discovery: 'deep' });
});
test('missing key fails closed and never calls the provider', async () => {
  const q = createQloo({ apiKey: '', fetchFn: () => { throw new Error('must not fetch'); } });
  await assert.rejects(q.search('Artist'), e => e.status === 503 && e.code === 'qloo_not_configured');
});
test('unsupported base URLs cannot exfiltrate credentials or follow redirects', () => {
  for (const baseUrl of ['https://example.com', 'http://hackathon.api.qloo.com', 'https://user:pass@api.qloo.com', 'https://api.qloo.com/other', 'https://api.qloo.com/?x=y', 'https://api.qloo.com:444/']) assert.throws(() => createQloo({ apiKey: 'secret', baseUrl }));
});
test('provider HTTP failures expose no response body or secrets', async () => {
  for (const status of [401, 403, 429, 500]) {
    const q = createQloo({ apiKey: 'secret', fetchFn: async () => new Response('RAW_PROVIDER_SECRET', { status }) });
    await assert.rejects(q.search('Artist'), e => !e.message.includes('SECRET') && e.status === (status === 429 ? 429 : status === 500 ? 502 : 503));
  }
});
test('transport failure and invalid provider JSON are safe errors', async () => {
  for (const fetchFn of [async () => { throw new Error('raw-secret'); }, async () => new Response('bad json'), async () => json({ other: [] }), async () => new Response('{}', { headers: { 'content-length': '4000000' } })]) {
    const q = createQloo({ apiKey: 'secret', fetchFn }); await assert.rejects(q.search('Artist'), e => e.status === 502 && !e.message.includes('raw-secret'));
  }
});
test('empty search 404 and empty insights are real empty results, never sample recommendations', async () => {
  const q = createQloo({ apiKey: 'test', fetchFn: async url => url.pathname === '/search' ? new Response('', { status: 404 }) : json({ results: { entities: [] } }) });
  assert.deepEqual(await q.search('Nothing'), []); assert.deepEqual(await q.insights({ kind: 'artist', seedIds: [a] }), []);
});
test('validation rejects abuse before any provider request', async () => {
  assert.throws(() => validateIds(['not-an-id'])); assert.throws(() => validateIds(Array(31).fill(a)));
  assert.throws(() => validateIds([], { min: 1 }));
  const q = createQloo({ apiKey: 'test', fetchFn: () => { throw new Error('must not fetch'); } });
  await assert.rejects(q.search('a')); await assert.rejects(q.search('a'.repeat(101)));
  await assert.rejects(q.insights({ kind: 'place', seedIds: [a] })); await assert.rejects(q.insights({ kind: 'artist', seedIds: [a], discovery: 'invalid' }));
});
test('normalization tolerates nullable descriptions and tags without inventing metadata', () => {
  assert.deepEqual(normalizeEntity({ id: a, name: 'A', properties: null, tags: [null, { name: 'tag' }] }, 'artist'), { id: a, name: 'A', kind: 'artist', description: '', tags: ['tag'] });
  assert.equal(normalizeEntity(null, 'artist'), null);
});
test('workflow performs cross-domain queries using the same seeds and allows optional-domain partial failure', async () => {
  const calls = [];
  const q = { insights: async input => { calls.push(input); if (input.kind === 'book') throw new Error('upstream'); return [normalizeEntity(row(b, 'Synthetic', input.kind), input.kind)]; } };
  const result = await buildCrate(q, { seedIds: [a], excludedIds: [c] });
  assert.equal(calls.length, 3); assert.ok(calls.every(call => call.seedIds[0] === a)); assert.equal(result.artists.length, 1); assert.equal(result.films.length, 1); assert.deepEqual(result.books, []); assert.equal(result.warnings.length, 1);
  assert.equal(result.evidence.requests[2].status, 'unavailable'); assert.equal(result.provider, 'Qloo');
});
test('artist failure prevents presenting a usable crate', async () => {
  await assert.rejects(buildCrate({ insights: async () => { throw new Error('unavailable'); } }, { seedIds: [a] }), /unavailable/);
});
