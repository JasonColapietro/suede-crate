const ALLOWED_HOSTS = new Set(['hackathon.api.qloo.com', 'api.qloo.com', 'staging.api.qloo.com']);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(['artist', 'movie', 'book']);

export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function validateIds(value, { min = 0, max = 30 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max || value.some(id => typeof id !== 'string' || !UUID.test(id))) {
    throw new AppError(400, 'invalid_artists', `Choose ${min || 1}–${max} valid Qloo artists.`);
  }
  return [...new Set(value.map(id => id.toLowerCase()))];
}

function entitiesFrom(payload, path) {
  const list = path === '/search' ? payload?.results : payload?.results?.entities;
  if (!Array.isArray(list)) throw new AppError(502, 'provider_shape', 'Qloo returned an unreadable response. Please try again.');
  return list;
}

export function normalizeEntity(raw, kind) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.entity_id ?? raw.id;
  const name = raw.name;
  const types = raw.types ?? (raw.type ? [raw.type] : []);
  if (typeof id !== 'string' || !UUID.test(id) || typeof name !== 'string' || !name.trim()) return null;
  if (Array.isArray(types) && types.length && !types.includes(`urn:entity:${kind}`)) return null;
  const description = raw.properties?.short_description ?? raw.properties?.description ?? raw.description;
  return {
    id: id.toLowerCase(), name: name.trim().slice(0, 180), kind,
    description: typeof description === 'string' ? description.slice(0, 700) : '',
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => typeof t === 'string' ? t : t?.name).filter(t => typeof t === 'string').slice(0, 5) : [],
  };
}

export function createQloo({ apiKey = process.env.QLOO_API_KEY, baseUrl = process.env.QLOO_BASE_URL || 'https://hackathon.api.qloo.com', fetchFn = fetch, now = Date.now } = {}) {
  const cache = new Map();
  let base;
  try { base = new URL(baseUrl); } catch { throw new AppError(503, 'configuration', 'Qloo is not configured correctly.'); }
  if (base.protocol !== 'https:' || !ALLOWED_HOSTS.has(base.hostname) || base.username || base.password || base.port || base.pathname !== '/' || base.search || base.hash) {
    throw new AppError(503, 'configuration', 'Qloo is not configured correctly.');
  }

  async function request(path, params) {
    if (!apiKey?.trim()) throw new AppError(503, 'qloo_not_configured', 'Real recommendations are waiting for Qloo API access. Please come back once the demo is connected.');
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
    const cacheKey = url.toString();
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > now()) return structuredClone(hit.data);
    let response;
    try {
      response = await fetchFn(url, { headers: { 'X-Api-Key': apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(12000), redirect: 'error' });
    } catch {
      throw new AppError(502, 'qloo_unavailable', 'Qloo could not be reached. Please try again in a moment.');
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new AppError(503, 'qloo_access', 'Qloo API access needs attention. Recommendations are temporarily unavailable.');
      if (response.status === 429) throw new AppError(429, 'qloo_busy', 'Qloo is busy. Wait a minute before trying again.');
      if (response.status === 404 && path === '/search') return [];
      throw new AppError(502, 'qloo_response', 'Qloo could not complete this discovery. Try a different artist or try again later.');
    }
    const declaredSize = Number(response.headers.get('content-length'));
    if (declaredSize > 3_000_000) throw new AppError(502, 'provider_shape', 'Qloo returned an unreadable response. Please try again.');
    const chunks = []; let size = 0;
    if (!response.body) throw new AppError(502, 'provider_shape', 'Qloo returned an unreadable response. Please try again.');
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3_000_000) { await reader.cancel(); throw new AppError(502, 'provider_shape', 'Qloo returned an unreadable response. Please try again.'); }
      chunks.push(value);
    }
    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError(502, 'provider_shape', 'Qloo returned an unreadable response. Please try again.'); }
    const list = entitiesFrom(payload, path);
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { data: list, expires: now() + 300_000 });
    return structuredClone(list);
  }

  return {
    configured: Boolean(apiKey?.trim()),
    async search(query) {
      if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100) throw new AppError(400, 'invalid_query', 'Enter an artist name between 2 and 100 characters.');
      const rows = await request('/search', { query: query.trim(), types: 'urn:entity:artist', take: 7 });
      return rows.map(e => normalizeEntity(e, 'artist')).filter(Boolean);
    },
    async insights({ kind, seedIds, excludedIds = [], discovery = 'familiar' }) {
      if (!TYPES.has(kind)) throw new AppError(400, 'invalid_kind', 'Choose artists, books, or films.');
      const seeds = validateIds(seedIds, { min: 1, max: 5 });
      const excluded = validateIds(excludedIds);
      if (!['familiar', 'deep'].includes(discovery)) throw new AppError(400, 'invalid_discovery', 'Choose close connections or deeper cuts.');
      const omit = [...new Set([...seeds, ...excluded])];
      const rows = await request('/v2/insights', {
        'filter.type': `urn:entity:${kind}`,
        'signal.interests.entities': seeds.join(','),
        'filter.exclude.entities': omit.join(','),
        'filter.popularity.max': kind === 'artist' && discovery === 'deep' ? 0.65 : undefined,
        take: kind === 'artist' ? 9 : 2,
      });
      const seen = new Set(omit);
      return rows.map(e => normalizeEntity(e, kind)).filter(e => { if (!e || seen.has(e.id)) return false; seen.add(e.id); return true; }).slice(0, kind === 'artist' ? 6 : 2);
    },
  };
}
