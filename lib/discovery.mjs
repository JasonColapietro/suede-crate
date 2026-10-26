import { AppError, validateIds } from './qloo.mjs';

export const tools = [
  { name: 'search_artists', description: 'Resolve an artist name to real Qloo entity IDs. Ask the listener to disambiguate matches before building their crate.', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 2, maxLength: 100 } }, required: ['query'], additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true } },
  { name: 'build_music_crate', description: 'Use selected Qloo artist IDs to discover six artists and cross-domain film/book associations. To refine, add a liked artist ID to seedIds or a dismissed ID to excludedIds and call again. Association is not musical influence, song similarity, or licensing permission.', inputSchema: { type: 'object', properties: { seedIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 5 }, excludedIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 30 }, discovery: { type: 'string', enum: ['familiar', 'deep'], default: 'familiar' } }, required: ['seedIds'], additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true } },
];

export async function buildCrate(qloo, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'invalid_request', 'Choose an artist to start a crate.');
  const seedIds = validateIds(input.seedIds, { min: 1, max: 5 });
  const excludedIds = validateIds(input.excludedIds ?? []);
  const discovery = input.discovery ?? 'familiar';
  if (!['familiar', 'deep'].includes(discovery)) throw new AppError(400, 'invalid_discovery', 'Choose close connections or deeper cuts.');
  const results = await Promise.allSettled(['artist', 'movie', 'book'].map(kind => qloo.insights({ kind, seedIds, excludedIds, discovery })));
  if (results[0].status === 'rejected') throw results[0].reason;
  const warnings = [];
  const sections = results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    warnings.push(`${i === 1 ? 'Film' : 'Book'} discovery is unavailable. Your artist results are still from Qloo.`);
    return [];
  });
  return {
    provider: 'Qloo', generatedAt: new Date().toISOString(), seedIds, excludedIds, discovery,
    artists: sections[0], films: sections[1], books: sections[2], warnings,
    evidence: {
      description: 'Qloo taste associations based on the artist IDs you selected. These are not claims of creative influence or sound-alike songs.',
      steps: ['Used your selected Qloo artist IDs', 'Queried Qloo artist insights using your seeds and exclusions', 'Queried Qloo film and book insights with the same taste signals', 'Removed duplicate and excluded results'],
      requests: ['artist', 'movie', 'book'].map((kind, i) => ({ tool: 'Qloo Insights', outputType: kind, seedIds, status: results[i].status === 'fulfilled' ? 'completed' : 'unavailable' })),
      novelty: discovery === 'deep' ? 'Artist popularity capped at 0.65 in the Qloo request. This is a popularity filter, not a guarantee of unfamiliarity.' : 'No popularity cap applied.',
    },
  };
}

export async function callTool(qloo, name, args) {
  if (name === 'search_artists') return { artists: await qloo.search(args?.query), provider: 'Qloo' };
  if (name === 'build_music_crate') return buildCrate(qloo, args);
  throw new AppError(400, 'unknown_tool', 'That discovery tool is not available.');
}
