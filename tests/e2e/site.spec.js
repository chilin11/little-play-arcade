import { test, expect } from '@playwright/test';

const ALL_GAME_IDS = '(gomoku|meow-space|2048|minesweeper|chess|forest-post|memory-garden|star-basket|magic-wardrobe|pattern-train|picnic-count|star-circuit|tidy-warehouse)';

test('hall renders real games, filters, search, favorites and clear state', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.game-card')).toHaveCount(13);
  await page.getByRole('button', { name: '益智棋类', exact: true }).click();
  await expect(page.locator('.game-card')).toHaveCount(2);
  await expect(page.locator('.game-card h3')).toHaveText(['五子棋', '国际象棋']);
  await page.getByRole('button', { name: '收藏五子棋', exact: true }).click();
  await expect(page.locator('#favorite-count')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#favorite-count')).toHaveText('1');
  await page.locator('#nav-favorites').click();
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.getByRole('button', { name: '取消收藏五子棋', exact: true }).click();
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.locator('#reset-filters').click();
  await page.getByRole('searchbox').fill('猫猫');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page.locator('.game-card h3')).toHaveText('喵喵星际队');
  await page.getByRole('searchbox').fill('规律');
  await expect(page.locator('.game-card h3')).toHaveText('花花小火车');
  await page.getByRole('searchbox').fill('数量');
  await expect(page.locator('.game-card h3')).toHaveText('野餐分分乐');
  await page.getByRole('searchbox').fill('nonexistent');
  await expect(page.locator('#empty-state')).toBeVisible();
  expect(errors).toEqual([]);
});

test('gomoku loads, accepts moves, undo, local mode, and records recent play', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/play.html?game=gomoku');
  const game = page.frameLocator('#game-frame');
  await expect(game.locator('.cell')).toHaveCount(225);
  await expect(page.locator('#player-status')).toContainText('已就绪');
  await game.locator('.cell').nth(112).click();
  await expect(game.locator('.stone')).toHaveCount(2);
  await game.locator('#undo').click();
  await expect(game.locator('.stone')).toHaveCount(0);
  await game.locator('#local-mode').click();
  await game.locator('.cell').nth(0).click();
  await expect(game.locator('.stone')).toHaveCount(1);
  await game.locator('.cell').nth(15).click();
  await expect(game.locator('.stone')).toHaveCount(2);
  await page.locator('#reload-game').click();
  await expect(page.locator('#reload-dialog')).toBeVisible();
  await page.getByRole('button', { name: '继续玩', exact: true }).click();
  await expect(game.locator('.stone')).toHaveCount(2);
  await page.goto('/');
  await expect(page.locator('#recent-section')).toBeVisible();
  await expect(page.locator('#recent-games')).toContainText('五子棋');
  await page.locator('#clear-recent').click();
  await expect(page.locator('#recent-section')).toBeHidden();
  expect(errors).toEqual([]);
});

test('meow-space starts, moves, pauses and resumes under production CSP', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const violations = [];
  page.on('console', message => { if (message.type() === 'error') violations.push(message.text()); });
  await page.goto('/play.html?game=meow-space');
  const game = page.frameLocator('#game-frame');
  await game.locator('#startButton').click();
  await expect(game.locator('#overlay')).toBeHidden();
  await game.locator('[data-lane="0"]').click();
  await expect(game.locator('[data-lane="0"]')).toHaveAttribute('aria-pressed', 'true');
  await game.locator('#pauseButton').click();
  await expect(game.locator('#resumeButton')).toBeVisible();
  await game.locator('#resumeButton').click();
  await expect(game.locator('#overlay')).toBeHidden();
  expect(errors).toEqual([]);
  expect(violations).toEqual([]);
});

test('invalid links fail closed and private project files are not served', async ({ page, request }) => {
  await page.goto('/play.html?game=https://example.com');
  await expect(page.locator('#play-error')).toBeVisible();
  await expect(page.locator('#game-frame')).not.toHaveAttribute('src', /.+/);
  for (const path of ['/not-found', '/.env', '/package.json', '/deploy/Caddyfile']) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

test('storage denial leaves favorites and games usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '收藏五子棋', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏五子棋', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toast')).toContainText('浏览器存储不可用');
  await page.goto('/play.html?game=meow-space');
  await page.frameLocator('#game-frame').locator('#startButton').click();
  await expect(page.frameLocator('#game-frame').locator('#overlay')).toBeHidden();
});

test('home and player fit the viewport with no horizontal page overflow', async ({ page }) => {
  for (const url of ['/', '/play.html?game=gomoku', '/play.html?game=meow-space', '/play.html?game=2048', '/play.html?game=minesweeper', '/play.html?game=chess', '/play.html?game=forest-post', '/play.html?game=memory-garden', '/play.html?game=star-basket', '/play.html?game=magic-wardrobe', '/play.html?game=pattern-train', '/play.html?game=picnic-count', '/play.html?game=star-circuit', '/play.html?game=tidy-warehouse']) {
    await page.goto(url);
    if (url === '/') await expect(page.locator('.game-card')).toHaveCount(13);
    else await expect(page.locator('#player-status')).toContainText('已就绪');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (url !== '/') {
      const frame = page.frames().find(frame => frame.url().includes('/games/'));
      expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('catalog failures show a retry state instead of a blank hall', async ({ page }) => {
  await page.route('**/games.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '重新加载 ↻' })).toBeVisible();
  await expect(page.locator('.random-button')).toBeDisabled();
});

test('confirmed reload resets the game and share copies a stable URL', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/play.html?game=gomoku&tracking=unused');
  const game = page.frameLocator('#game-frame');
  await game.locator('.cell').nth(112).click();
  await expect(game.locator('.stone')).toHaveCount(2);
  await page.locator('#reload-game').click();
  await page.getByRole('button', { name: '确认重载', exact: true }).click();
  await expect(game.locator('.stone')).toHaveCount(0);
  await page.locator('#share-game').click();
  await expect(page.locator('#toast')).toContainText('链接已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://127.0.0.1:5187/play.html?game=gomoku');
});

test('narrow screens keep the embedded shooter usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/play.html?game=meow-space');
  const game = page.frameLocator('#game-frame');
  await game.locator('#startButton').click();
  await expect(game.locator('#overlay')).toBeHidden();
  const frame = page.frames().find(frame => frame.url().includes('/games/'));
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('random play opens a registered game', async ({ page }) => {
  await page.goto('/');
  await page.locator('.random-button').click();
  await expect(page).toHaveURL(new RegExp(`play\\.html\\?game=${ALL_GAME_IDS}$`));
  await expect(page.locator('#player-status')).toContainText('已就绪');
});
