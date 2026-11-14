import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, notePages } from '../server.mjs';
import { verifyInlineCode } from '../lib/html-policy.mjs';
const site = 'https://suede-crate.vercel.app';
const read = file => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
test('notes pages carry unique SEO metadata, canonical URLs and safe JSON-LD', async () => {
  const titles = new Set();
  for (const slug of notePages) {
    const route = slug ? `/notes/${slug}/` : '/notes/';
    const html = await read(`${route.slice(1)}index.html`);
    assert.doesNotThrow(() => verifyInlineCode(html));
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    const description = html.match(/<meta name="description" content="([^"]+)">/)[1];
    assert.ok(title.length >= 50 && title.length <= 60, `${route} title length ${title.length}`);
    assert.ok(description.length >= 120 && description.length <= 160, `${route} description length ${description.length}`);
    assert.ok(!titles.has(title)); titles.add(title);
    assert.ok(html.includes(`<link rel="canonical" href="${site}${route}">`));
    assert.ok(html.includes('https://suedeai.agency/') && html.includes('https://suedeai.ai/founder'));
    const graph = jsonLd(html).flatMap(block => block['@graph']);
    assert.ok(graph.some(node => node['@type'] === 'BreadcrumbList'));
    if (slug) {
      const post = graph.find(node => node['@type'] === 'BlogPosting');
      assert.equal(post.author['@id'], 'https://suedeai.ai/founder#person');
      assert.equal(post.publisher['@id'], 'https://suedeai.ai/#organization');
      assert.equal(post.mainEntityOfPage['@id'], `${site}${route}`);
    }
    for (const node of graph) assert.ok(!['Person', 'Organization'].includes(node['@type']), 'notes must reference canonical entities, not define new ones');
  }
});
test('sitemap and llms.txt list every notes page', async () => {
  const sitemap = await read('sitemap.xml'), llms = await read('llms.txt');
  for (const slug of notePages) {
    const url = `${site}/notes/${slug ? `${slug}/` : ''}`;
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
    if (slug) assert.ok(llms.includes(url), url);
  }
});
test('local server serves notes, sitemap, robots and llms.txt', async () => {
  const server = createServer().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/notes/', '/notes', `/notes/${notePages[1]}/`, '/sitemap.xml', '/robots.txt', '/llms.txt']) {
      const response = await fetch(base + path); assert.equal(response.status, 200, path); await response.text();
    }
  } finally { server.close(); }
});
