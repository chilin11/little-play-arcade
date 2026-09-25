import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalPath, escapeHTML, playUrl, getFavorites, getRecent } from '../public/assets/shared.js';

test('catalog paths only permit local relative files', () => {
  for (const path of ['games/gomoku/index.html', 'assets/my-cover.svg']) assert.equal(isLocalPath(path), true);
  for (const path of ['https://example.com/a.html', '//evil.test/a', '/games/test.html', '../a.html', 'games/../a.html', 'games/./a.html', 'javascript:alert(1)', 'games/a.html?x=1', 'games/%2e%2e/a.html', 'games\\a.html', null]) assert.equal(isLocalPath(path), false, String(path));
  assert.equal(isLocalPath('games/a.js', '.html'), false);
});
test('catalog text cannot inject markup', () => {
  assert.equal(escapeHTML('<img src="x" onerror=\'bad()\'>&'), '&lt;img src=&quot;x&quot; onerror=&#39;bad()&#39;&gt;&amp;');
});
test('play links encode identifiers', () => {
  assert.equal(playUrl({ id: 'meow-space' }), 'play.html?game=meow-space');
  assert.equal(playUrl({ id: 'a&b' }), 'play.html?game=a%26b');
});
test('storage absence does not crash read operations', () => {
  assert.deepEqual(getFavorites(), []);
  assert.deepEqual(getRecent(), []);
});
