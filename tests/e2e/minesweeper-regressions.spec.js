import { test, expect } from '@playwright/test';
import { Minesweeper } from '../../public/games/minesweeper/game.js';

test('a slower win cannot overwrite a faster record saved by another tab', async ({ page }) => {
  let seed = 42817;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  await page.addInitScript(() => {
    let value = 42817;
    Math.random = () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  });
  await page.clock.install();
  await page.goto('/games/minesweeper/');
  await page.locator('.cell').nth(40).click();
  const model = new Minesweeper('classic', random);
  model.reveal(40);
  await page.clock.runFor(10000);
  // A second tab writes to this origin's shared storage after this game mounted.
  await page.evaluate(() => localStorage.setItem('minesweeper.best.classic.v1', '1'));
  for (let index = 0; index < model.cells.length; index++) {
    if (!model.cells[index].mine && !model.cells[index].revealed) {
      await page.locator('.cell').nth(index).click();
      model.reveal(index);
    }
  }
  await expect(page.locator('#board')).toHaveAttribute('data-state', 'won');
  await expect(page.locator('#best')).toHaveText('00:01');
  expect(await page.evaluate(() => localStorage.getItem('minesweeper.best.classic.v1'))).toBe('1');
});

test('hard board keeps usable targets at 320px without overflowing the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/play.html?game=minesweeper');
  const game = page.frameLocator('#game-frame');
  await game.locator('[data-level="hard"]').click();
  await expect(game.locator('.cell')).toHaveCount(144);
  const box = await game.locator('.cell').first().boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
  const frame = page.frames().find(item => item.url().includes('/games/minesweeper/'));
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await game.locator('.cell').nth(143).click();
  await expect(game.locator('.cell').nth(143)).toHaveClass(/revealed/);
});
