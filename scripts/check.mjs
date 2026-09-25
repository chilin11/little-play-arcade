import { readFile, access, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { isLocalPath } from '../public/assets/shared.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const games = JSON.parse(await readFile(resolve(root, 'games.json'), 'utf8'));
assert.ok(Array.isArray(games) && games.length > 0, 'Catalog must contain games');
const ids = new Set();
for (const game of games) {
  assert.match(game.id, /^[a-z0-9-]+$/);
  assert.ok(!ids.has(game.id), `Duplicate game ID: ${game.id}`);
  ids.add(game.id);
  for (const key of ['title', 'subtitle', 'description', 'category', 'controls', 'note']) assert.ok(typeof game[key] === 'string' && game[key].trim(), `${game.id}: missing ${key}`);
  assert.ok(Array.isArray(game.tags) && game.tags.every(tag => typeof tag === 'string'));
  assert.ok(Array.isArray(game.devices) && game.devices.every(device => typeof device === 'string'));
  assert.match(game.addedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isFinite(Date.parse(game.addedAt)), 'Invalid date');
  assert.ok(isLocalPath(game.entry, '.html') && game.entry.startsWith('games/'));
  assert.ok(isLocalPath(game.cover) && game.cover.startsWith('assets/'));
  await access(resolve(root, game.entry));
  await access(resolve(root, game.cover));
}
async function checkFiles(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) { await checkFiles(path); continue; }
    if (path.endsWith('.js')) execFileSync(process.execPath, ['--check', path]);
    if (/\.(html|css|js)$/.test(path)) {
      const content = await readFile(path, 'utf8');
      assert.ok(!content.includes('fonts.googleapis.com'), `${path}: unexpected remote font`);
      if (path.endsWith('.html')) {
        for (const match of content.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
          const link = match[1];
          if (/^(https?:|data:|mailto:)/.test(link)) continue;
          const target = link.startsWith('/') ? resolve(root, '.' + link) : resolve(directory, link);
          await access(target).catch(() => { throw new Error(`Broken local link in ${path}: ${link}`); });
        }
      }
    }
  }
}
await checkFiles(root);
console.log(`✓ ${games.length} games validated; local links, self-hosted assets and JavaScript syntax checked.`);
