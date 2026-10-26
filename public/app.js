const $ = id => document.getElementById(id);
const state = { seeds: [], excluded: [], crate: null, crateSeeds: [], busy: false, searchVersion: 0, buildVersion: 0, searchAbort: null, buildAbort: null, matches: [] };
const mode = () => document.querySelector('input[name="discovery"]:checked').value;
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
function showError(message = '') { $('error').textContent = message; $('error').hidden = !message; }
async function request(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Discovery is unavailable. Please try again.');
  return data;
}
function button(text, className, action, label) {
  const b = el('button', className, text); b.type = 'button'; b.disabled = state.busy;
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', action); return b;
}
function link(text, url) { const a = el('a', '', text); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function markStale() {
  $('stale-note').hidden = !state.crate || (JSON.stringify(state.seeds.map(s => s.id)) === JSON.stringify(state.crate.seedIds) && mode() === state.crate.discovery && JSON.stringify(state.excluded) === JSON.stringify(state.crate.excludedIds));
}
function renderSeeds() {
  $('seeds').replaceChildren();
  state.seeds.forEach(artist => {
    const li = el('li', 'seed'); li.append(el('span', '', artist.name), button('×', '', () => { state.seeds = state.seeds.filter(s => s.id !== artist.id); renderSeeds(); renderMatches(); markStale(); }, `Remove ${artist.name}`)); $('seeds').append(li);
  });
  $('seed-count').textContent = `${state.seeds.length} / 5`;
  $('seed-empty').hidden = state.seeds.length > 0;
  $('build-crate').disabled = state.busy || state.seeds.length === 0;
}
function addSeed(artist) {
  if (state.busy || state.seeds.some(s => s.id === artist.id)) return;
  if (state.seeds.length >= 5) { showError('Your crate can start with up to five artists. Remove one to follow a new thread.'); return; }
  showError(); state.seeds.push(artist); state.excluded = state.excluded.filter(id => id !== artist.id); renderSeeds(); renderMatches(); markStale();
  $('search-status').textContent = `${artist.name} added. ${state.seeds.length} ${state.seeds.length === 1 ? 'artist' : 'artists'} selected.`;
  if (state.crate) renderResults(false);
}
function renderMatches() {
  $('search-results').replaceChildren();
  state.matches.forEach(artist => {
    const selected = state.seeds.some(s => s.id === artist.id);
    const li = el('li');
    const b = button('', 'match', () => addSeed(artist), `Add ${artist.name}`);
    b.disabled = selected || state.busy || state.seeds.length >= 5;
    const text = el('span', 'match-text'); text.append(el('strong', '', artist.name));
    if (artist.description) text.append(el('small', '', artist.description));
    b.append(text, el('span', 'add', selected ? '✓' : '+')); li.append(b); $('search-results').append(li);
  });
}
async function search(query) {
  if (state.busy) return;
  const version = ++state.searchVersion; state.searchAbort?.abort(); state.searchAbort = new AbortController();
  state.matches = []; renderMatches(); showError();
  $('search-status').textContent = `Looking up “${query}” in Qloo…`; $('search-button').disabled = true;
  try {
    const data = await request(`/api/search?q=${encodeURIComponent(query)}`, { signal: state.searchAbort.signal });
    if (version !== state.searchVersion) return;
    state.matches = data.artists; renderMatches();
    $('search-status').textContent = data.artists.length ? `${data.artists.length} ${data.artists.length === 1 ? 'match' : 'matches'}. Choose the artist you mean.` : 'No artist matched. Try another spelling or a different artist.';
  } catch (error) { if (version === state.searchVersion && error.name !== 'AbortError') { $('search-status').textContent = ''; showError(error.message); } }
  finally { if (version === state.searchVersion) $('search-button').disabled = state.busy; }
}
function setBusy(busy) {
  state.busy = busy; $('artist-query').disabled = busy; $('search-button').disabled = busy; $('discovery-settings').disabled = busy;
  document.querySelectorAll('[data-query]').forEach(b => b.disabled = busy);
  $('build-crate').textContent = busy ? 'Finding the connections…' : 'Build my crate ↗';
  $('workbench')?.setAttribute('aria-busy', String(busy));
  renderSeeds(); renderMatches();
  if (state.crate) renderResults(false);
}
async function buildCrate() {
  if (state.busy || state.seeds.length === 0) return;
  const version = ++state.buildVersion; state.buildAbort?.abort(); state.buildAbort = new AbortController();
  const seeds = structuredClone(state.seeds);
  showError(); setBusy(true); $('build-status').textContent = 'Following your artist signals through Qloo’s music, film, and book catalog…';
  try {
    const data = await request('/api/crate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seedIds: seeds.map(s => s.id), excludedIds: state.excluded, discovery: mode() }), signal: state.buildAbort.signal });
    if (version !== state.buildVersion) return;
    state.crate = data; state.crateSeeds = seeds;
    $('build-status').textContent = data.artists.length ? 'Your crate is ready. Every discovery below came from Qloo.' : 'Qloo returned no new artist matches for this combination.';
    renderResults(true);
  } catch (error) { if (version === state.buildVersion && error.name !== 'AbortError') { showError(error.message); $('build-status').textContent = ''; } }
  finally { if (version === state.buildVersion) { setBusy(false); if (state.crate) $('crate-title').focus({ preventScroll: true }); } }
}
function dismissArtist(artist) {
  if (state.excluded.length >= 30) { showError('You have passed on 30 artists. Clear exclusions to start another discovery pass.'); return; }
  if (!state.excluded.includes(artist.id)) state.excluded.push(artist.id);
  renderResults(false); markStale(); $('build-status').textContent = `${artist.name} excluded from your next discovery pass. Build again when you’re ready.`;
}
function artistCard(artist, i) {
  const article = el('article', 'artist-card');
  const art = el('div', `artist-art art-${i % 6}`); art.setAttribute('aria-hidden', 'true'); art.append(el('span', 'art-name', artist.name));
  const info = el('div', 'artist-info'); info.append(el('h3', '', artist.name));
  if (artist.description) info.append(el('p', 'artist-description', artist.description));
  if (artist.tags.length) info.append(el('p', '', artist.tags.join(' / ')));
  info.append(el('p', 'provider-note', 'Selected by Qloo from your artist signals'));
  const links = el('div', 'artist-links'); links.append(link('Find on Spotify', `https://open.spotify.com/search/${encodeURIComponent(artist.name)}`), link('YouTube', `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.name + ' music')}`));
  const controls = el('div', 'artist-controls');
  const selected = state.seeds.some(s => s.id === artist.id);
  const follow = button(selected ? 'Added to starting artists' : 'Follow this thread +', '', () => addSeed(artist), `Add ${artist.name} to starting artists`); follow.disabled = state.busy || selected || state.seeds.length >= 5;
  controls.append(follow, button('Pass for now', 'quiet', () => dismissArtist(artist), `Exclude ${artist.name}`));
  info.append(links, controls); article.append(art, info); return article;
}
function cultureCards(items, target, kind) {
  $(target).replaceChildren();
  if (!items.length) { $(target).append(el('p', 'small', `No ${kind === 'movie' ? 'film' : 'book'} connections returned for this crate.`)); return; }
  items.forEach(item => {
    const section = el('article', 'culture-item'); section.append(el('h5', '', item.name));
    if (item.description) section.append(el('p', '', item.description));
    section.append(link(kind === 'movie' ? 'Find this film' : 'Find this book', kind === 'movie' ? `https://www.imdb.com/find/?q=${encodeURIComponent(item.name)}` : `https://books.google.com/books?q=${encodeURIComponent(item.name)}`)); $(target).append(section);
  });
}
function renderResults(scroll = false) {
  const data = state.crate; if (!data) return;
  $('crate').hidden = false;
  $('crate-context').textContent = `Starting with ${state.crateSeeds.map(s => s.name).join(', ')}`;
  $('artists').replaceChildren(...data.artists.filter(a => !state.excluded.includes(a.id)).map(artistCard));
  $('artist-empty').hidden = $('artists').children.length !== 0;
  cultureCards(data.films, 'films', 'movie'); cultureCards(data.books, 'books', 'book');
  $('warnings').textContent = data.warnings.join(' '); $('warnings').hidden = data.warnings.length === 0;
  $('evidence').replaceChildren();
  $('evidence').append(el('p', '', data.evidence.description));
  const list = el('ol'); data.evidence.steps.forEach(step => list.append(el('li', '', step))); $('evidence').append(list);
  $('evidence').append(el('p', '', data.evidence.novelty), el('p', '', `Qloo artist IDs used: ${data.seedIds.join(', ')}`), el('p', '', `Generated ${new Date(data.generatedAt).toLocaleString()}. Descriptions, where available, are Qloo catalog text.`));
  $('dismissed-count').textContent = state.excluded.length ? `${state.excluded.length} ${state.excluded.length === 1 ? 'artist' : 'artists'} excluded from future passes.` : '';
  $('clear-dismissed').hidden = !state.excluded.length; $('clear-dismissed').disabled = state.busy; $('export').disabled = state.busy;
  markStale(); if (scroll) $('crate').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
function exportNotes() {
  if (!state.crate) return;
  const data = state.crate;
  const line = s => String(s).replace(/[\r\n]+/g, ' ');
  const items = [
    '# Suede Crate listening notes', '', `Built ${line(data.generatedAt)}`, `Starting artists: ${state.crateSeeds.map(s => line(s.name)).join(', ')}`, '',
    'These are Qloo taste associations, not claims of creative influence, sound-alike songs, or licensing permission.', '',
    '## Artists', ...data.artists.filter(a => !state.excluded.includes(a.id)).map(a => `- ${line(a.name)} — https://open.spotify.com/search/${encodeURIComponent(a.name)}`), '',
    '## Films', ...data.films.map(a => `- ${line(a.name)}`), '', '## Books', ...data.books.map(a => `- ${line(a.name)}`), '',
    `Qloo seed IDs: ${data.seedIds.join(', ')}`, `Discovery: ${data.discovery}`, ...data.warnings,
  ];
  const url = URL.createObjectURL(new Blob([items.join('\n')], { type: 'text/markdown' }));
  const a = el('a'); a.href = url; a.download = 'suede-crate-listening-notes.md'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('search-form').addEventListener('submit', e => { e.preventDefault(); search($('artist-query').value.trim()); });
$('artist-query').addEventListener('input', () => { state.searchVersion++; state.searchAbort?.abort(); state.matches = []; renderMatches(); $('search-status').textContent = ''; $('search-button').disabled = state.busy; });
document.querySelectorAll('[data-query]').forEach(b => b.addEventListener('click', () => { $('artist-query').value = b.dataset.query; search(b.dataset.query); }));
document.querySelectorAll('input[name="discovery"]').forEach(r => r.addEventListener('change', markStale));
$('build-crate').addEventListener('click', buildCrate);
$('export').addEventListener('click', exportNotes);
$('clear-dismissed').addEventListener('click', () => { state.excluded = []; renderResults(); markStale(); });
$('reset').addEventListener('click', () => { state.buildVersion++; state.searchVersion++; state.buildAbort?.abort(); state.searchAbort?.abort(); state.seeds = []; state.excluded = []; state.crate = null; state.crateSeeds = []; state.matches = []; setBusy(false); $('crate').hidden = true; $('search-status').textContent = ''; $('build-status').textContent = ''; $('artist-query').value = ''; showError(); $('artist-query').focus(); });
$('privacy-link').addEventListener('click', () => $('privacy').open = true);
$('mcp-link').addEventListener('click', e => { e.preventDefault(); $('assistant').open = true; $('assistant').scrollIntoView(); });
$('mcp-url').textContent = `${location.origin}/api/mcp`;
request('/api/status').then(data => {
  $('connection').textContent = data.configured ? 'Ready to discover' : 'Qloo connection pending'; $('connection').classList.toggle('online', data.configured);
  if (!data.configured) { $('connection-note').hidden = false; $('connection-note').textContent = 'This demo is waiting for Qloo API access. Artist search and discovery will become available when the connection is ready.'; }
}).catch(() => { $('connection').textContent = 'Connection unavailable'; $('connection-note').hidden = false; $('connection-note').textContent = 'The discovery service could not be reached. Please refresh or try again later.'; });
