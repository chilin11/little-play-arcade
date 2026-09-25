import { test, expect } from '@playwright/test';
import { Minesweeper, LEVELS, formatTime } from '../../public/games/minesweeper/game.js';

const url = '/games/minesweeper/';
const seed = 42817;
function seededRandom(value) {
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
async function openGame(page) {
  await page.addInitScript(value => {
    Math.random = () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }, seed);
  await page.goto(url);
  await expect(page.locator('.cell')).toHaveCount(81);
}
function reference(level = 'classic', first = 40) {
  const game = new Minesweeper(level, seededRandom(seed));
  game.reveal(first);
  return game;
}
async function complete(page, game) {
  for (let i = 0; i < game.cells.length; i++) {
    if (!game.cells[i].mine && !game.cells[i].revealed) {
      await page.locator('.cell').nth(i).click();
      game.reveal(i);
    }
  }
}

test('core: every first cell and its neighbors are safe, with exact mines and counts', () => {
  for (const [level, { size, mines }] of Object.entries(LEVELS)) {
    for (let first = 0; first < size ** 2; first++) {
      const game = new Minesweeper(level, seededRandom(seed + first));
      expect(game.cells.some(cell => cell.mine)).toBe(false);
      expect(game.reveal(first)).toBe(true);
      expect(game.cells.filter(cell => cell.mine)).toHaveLength(mines);
      expect(game.cells[first].count).toBe(0);
      for (const index of [first, ...game.neighbors(first)]) {
        expect(game.cells[index].mine).toBe(false);
        expect(game.cells[index].revealed).toBe(true);
      }
      game.cells.forEach((cell, index) => {
        // Independent geometry check, not the model's neighbors method.
        const r = Math.floor(index / size), c = index % size;
        const count = game.cells.filter((other, n) => other.mine && n !== index &&
          Math.abs(Math.floor(n / size) - r) <= 1 && Math.abs(n % size - c) <= 1).length;
        expect(cell.count).toBe(count);
      });
    }
  }
});

test('core: flags do not seed, flood respects flags, win requires every safe cell, terminal states lock', () => {
  const game = new Minesweeper('classic', seededRandom(seed));
  expect(game.toggleFlag(40)).toBe(true);
  expect(game.reveal(40)).toBe(false);
  expect(game.state).toBe('ready');
  expect(game.cells.some(cell => cell.mine)).toBe(false);
  game.reveal(41);
  expect(game.cells[40].revealed).toBe(false);
  game.cells.forEach((cell, index) => { if (!cell.mine && index !== 40) game.reveal(index); });
  expect(game.state).toBe('playing');
  game.toggleFlag(40);
  game.reveal(40);
  expect(game.state).toBe('won');
  expect(game.revealed).toBe(71);
  expect(game.toggleFlag(0)).toBe(false);
  expect(game.reveal(game.cells.findIndex(cell => cell.mine))).toBe(false);

  const loss = reference();
  const mine = loss.cells.findIndex(cell => cell.mine);
  loss.reveal(mine);
  expect(loss.state).toBe('lost');
  expect(loss.exploded).toBe(mine);
  expect(loss.cells.filter(cell => cell.mine && cell.revealed)).toHaveLength(10);
  expect(loss.reveal(0)).toBe(false);
  expect(loss.toggleFlag(0)).toBe(false);

  const flags = new Minesweeper();
  for (let i = 0; i < 10; i++) expect(flags.toggleFlag(i)).toBe(true);
  expect(flags.toggleFlag(10)).toBe(false);
  expect(flags.flags).toBe(10);
  flags.toggleFlag(0);
  expect(flags.toggleFlag(10)).toBe(true);
  expect(formatTime(125)).toBe('02:05');
});

test('first reveal floods safely, numbers match the model, hidden labels do not leak, CSP stays clean', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openGame(page);
  await expect(page.locator('.cell[tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('.hall-link')).toHaveAttribute('target', '_top');
  await expect(page.locator('.hall-link')).toHaveAttribute('href', '../../index.html');
  await page.locator('.cell').nth(40).click();
  const model = reference();
  expect(model.state).toBe('playing');
  expect(model.revealed).toBeGreaterThan(9);
  await expect(page.locator('.cell.revealed')).toHaveCount(model.revealed);
  await expect(page.locator('.cell.mine')).toHaveCount(0);
  const cells = await page.locator('.cell').evaluateAll(items => items.map(item => ({
    label: item.getAttribute('aria-label'), count: item.dataset.number, text: item.textContent
  })));
  cells.forEach((cell, index) => {
    if (model.cells[index].revealed) expect(cell.count).toBe(String(model.cells[index].count));
    else {
      expect(cell.label).toMatch(/未翻开$/);
      expect(cell.count).toBeUndefined();
      expect(cell.text).toBe('');
    }
  });
  expect(errors).toEqual([]);
});

test('touch flag mode, right click, keyboard navigation and activation work before the first reveal', async ({ page }) => {
  await page.clock.install();
  await openGame(page);
  await page.locator('#flag-mode').click();
  await expect(page.locator('#flag-mode')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mode-help')).toContainText('不会翻开');
  await page.locator('.cell').nth(40).click();
  await expect(page.locator('#flags-left')).toHaveText('9');
  await expect(page.locator('.cell').nth(40)).toHaveAttribute('aria-label', /已插旗/);
  await page.clock.runFor(2000);
  await expect(page.locator('#timer')).toHaveText('00:00');
  await page.locator('#flag-mode').click();
  await page.locator('.cell').nth(40).click();
  await expect(page.locator('#board')).toHaveAttribute('data-state', 'ready');
  await page.locator('.cell').nth(40).click({ button: 'right' });
  await expect(page.locator('#flags-left')).toHaveText('10');
  await page.locator('.cell').nth(40).press('ArrowRight');
  await expect(page.locator('.cell').nth(41)).toBeFocused();
  await page.keyboard.press('f');
  await expect(page.locator('.cell').nth(41)).toHaveClass(/flagged/);
  await page.keyboard.press('F');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(page.locator('#board')).toHaveAttribute('data-state', 'playing');
  await page.clock.runFor(2000);
  await expect(page.locator('#timer')).toHaveText('00:02');
  const model = reference();
  const safe = model.cells.findIndex(cell => !cell.mine && !cell.revealed);
  await page.locator('.cell').nth(safe).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.cell').nth(safe)).toHaveClass(/revealed/);
  await expect(page.locator('.cell[tabindex="0"]')).toHaveCount(1);
});

test('restart and difficulty confirmation retain progress on cancel and reset timer on accept', async ({ page }) => {
  await page.clock.install();
  await openGame(page);
  await page.locator('.cell').nth(40).click();
  await page.clock.runFor(3000);
  const revealed = await page.locator('.revealed').count();
  await page.locator('#restart').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#cancel-reset')).toBeFocused();
  await page.locator('#cancel-reset').click();
  await expect(page.locator('.revealed')).toHaveCount(revealed);
  await page.locator('[data-level="hard"]').click();
  await expect(page.locator('#dialog-title')).toContainText('进阶');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-level="classic"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cell')).toHaveCount(81);
  await page.locator('[data-level="hard"]').click();
  await page.locator('#confirm-reset').click();
  await expect(page.locator('.cell')).toHaveCount(144);
  await expect(page.locator('#flags-left')).toHaveText('24');
  await expect(page.locator('#progress')).toHaveText('已翻开 0 / 120');
  await page.clock.runFor(3000);
  await expect(page.locator('#timer')).toHaveText('00:00');
  await page.locator('.cell').nth(65).click();
  await expect(page.locator('.cell').nth(65)).toHaveAttribute('data-number', '0');
  await page.clock.runFor(2000);
  await page.locator('#restart').click();
  await page.locator('#confirm-reset').click();
  await expect(page.locator('.revealed')).toHaveCount(0);
  await page.clock.runFor(2000);
  await expect(page.locator('#timer')).toHaveText('00:00');
  // Even pre-reveal flagging is progress worth protecting.
  await page.locator('.cell').first().press('f');
  await page.locator('#restart').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('loss reveals every mine, distinguishes bad flags, stops time and offers replay', async ({ page }) => {
  await page.clock.install();
  await openGame(page);
  await page.locator('.cell').nth(40).click();
  const model = reference();
  const wrong = model.cells.findIndex(cell => !cell.mine && !cell.revealed);
  const mine = model.cells.findIndex(cell => cell.mine);
  await page.locator('.cell').nth(wrong).press('f');
  await page.clock.runFor(3000);
  await page.locator('.cell').nth(mine).click();
  await expect(page.locator('#board')).toHaveAttribute('data-state', 'lost');
  await expect(page.locator('.mine')).toHaveCount(10);
  await expect(page.locator('.exploded')).toHaveCount(1);
  await expect(page.locator('.wrong-flag')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('碰到一颗雷');
  await expect(page.locator('#flag-mode')).toBeDisabled();
  const time = await page.locator('#timer').textContent();
  await page.clock.runFor(5000);
  await expect(page.locator('#timer')).toHaveText(time);
  await expect(page.locator('#best')).toHaveText('—');
  await page.locator('.cell').nth(wrong).press('f');
  await expect(page.locator('.wrong-flag')).toHaveCount(1);
  await page.getByRole('button', { name: '↻ 再来一局' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#board')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.revealed')).toHaveCount(0);
});

test('win stops time, persists fastest completion per difficulty and ignores slower runs', async ({ page }) => {
  await page.clock.install();
  await openGame(page);
  await page.locator('.cell').nth(40).click();
  await page.clock.runFor(4000);
  await complete(page, reference());
  await expect(page.locator('#board')).toHaveAttribute('data-state', 'won');
  await expect(page.getByRole('status')).toContainText('晴朗了');
  await expect(page.locator('#progress')).toHaveText('已翻开 71 / 71');
  const best = await page.locator('#best').textContent();
  await page.clock.runFor(3000);
  await expect(page.locator('#timer')).toHaveText(best);
  const stored = await page.evaluate(() => localStorage.getItem('minesweeper.best.classic.v1'));
  expect(Number(stored)).toBeGreaterThanOrEqual(4);
  await page.reload();
  await expect(page.locator('#best')).toHaveText(best);
  await page.locator('[data-level="hard"]').click();
  await expect(page.locator('#best')).toHaveText('—');
  await page.locator('[data-level="classic"]').click();
  await page.locator('.cell').nth(40).click();
  await page.clock.runFor(15000);
  await complete(page, reference());
  await expect(page.locator('#best')).toHaveText(best);
  expect(await page.evaluate(() => localStorage.getItem('minesweeper.best.hard.v1'))).toBeNull();
});

for (const denial of ['getter', 'write']) {
  test(`storage ${denial} denial remains playable through a win`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(kind => {
      if (kind === 'getter') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
      else Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    }, denial);
    await openGame(page);
    await page.locator('.cell').nth(40).click();
    await complete(page, reference());
    await expect(page.locator('#board')).toHaveAttribute('data-state', 'won');
    await expect(page.locator('#storage-note')).toContainText('存储不可用');
    await expect(page.locator('#best')).not.toHaveText('—');
    await page.locator('#restart').click();
    await expect(page.locator('#board')).toHaveAttribute('data-state', 'ready');
    expect(errors).toEqual([]);
  });
}

test('malformed records are ignored and both boards fit an actual 320px iframe', async ({ page, isMobile }) => {
  await page.addInitScript(() => {
    localStorage.setItem('minesweeper.best.classic.v1', '-5');
    localStorage.setItem('minesweeper.best.hard.v1', 'not-a-time');
  });
  await page.goto('/');
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'narrow-game';
    frame.width = '320';
    frame.height = '720';
    frame.setAttribute('frameborder', '0');
    frame.src = '/games/minesweeper/';
    document.body.replaceChildren(frame);
  });
  const game = page.frameLocator('#narrow-game');
  await expect(game.locator('.cell')).toHaveCount(81);
  for (const level of ['classic', 'hard']) {
    await game.locator(`[data-level="${level}"]`).click();
    await expect(game.locator('#best')).toHaveText('—');
    const frame = page.frames().find(item => item.url().includes('/games/minesweeper/'));
    expect(await frame.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ width: 320, scroll: 320 });
    const viewport = await game.locator('.board-scroll').boundingBox();
    expect(viewport.width).toBeLessThan(320);
    const box = await game.locator('#board').boundingBox();
    expect(box.width).toBeGreaterThan(0);
    const last = await game.locator('.cell').last().boundingBox();
    expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width);
  }
  await game.locator('#flag-mode').click();
  if (isMobile) await game.locator('.cell').first().tap();
  else await game.locator('.cell').first().click();
  await expect(game.locator('.cell').first()).toHaveClass(/flagged/);
});
