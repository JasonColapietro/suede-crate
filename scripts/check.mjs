import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vercel', 'artifacts', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(file)); else out.push(file);
  }
  return out;
}
let count = 0;
for (const file of await walk('.')) {
  if (/\.(mjs|js)$/.test(file)) { const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }); if (result.status !== 0) process.exit(1); count++; }
}
const html = await readFile('public/index.html', 'utf8');
if (/<script\b[^>]*>\s*[^<\s]/i.test(html) || /\son\w+\s*=/i.test(html)) throw new Error('Inline scripts violate the content security policy.');
const css = await readFile('public/style.css', 'utf8');
if (!css.includes('prefers-reduced-motion') || !css.includes(':focus-visible')) throw new Error('Motion and keyboard styles must be present.');
console.log(`Checked ${count} JavaScript modules and static security/accessibility contracts.`);
