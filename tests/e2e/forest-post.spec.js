import { test, expect } from '@playwright/test';
import { ForestPost, LEVELS } from '../../public/games/forest-post/game.js';

function completeModel(game) {
  for (const route of game.config.routes) {
    expect(game.select(route.id)).toBe(true);
    for (const cell of route.solution.slice(1)) expect(game.step(cell).ok).toBe(true);
  }
}

test('forest post core: all six authored puzzles have valid non-crossing solutions', () => {
  expect(LEVELS).toHaveLength(6);
  LEVELS.forEach((level,index) => {
    const game=new ForestPost(index),used=new Set();
    for(const route of level.routes){
      expect(route.solution[0]).not.toBe(route.solution.at(-1));
      for(const cell of route.solution){
        expect(cell).toBeGreaterThanOrEqual(0);expect(cell).toBeLessThan(level.size**2);
        expect(level.rocks).not.toContain(cell);expect(used.has(cell)).toBe(false);used.add(cell);
      }
      for(let i=1;i<route.solution.length;i++){
        const a=route.solution[i-1],b=route.solution[i];
        expect(Math.abs(Math.floor(a/level.size)-Math.floor(b/level.size))+Math.abs(a%level.size-b%level.size)).toBe(1);
      }
    }
    completeModel(game);expect(game.complete).toBe(true);
  });
});

test('forest post core: blocks jumps, rocks, other routes and supports backtracking, reset and hint', () => {
  const game=new ForestPost(0);game.select('sun');
  expect(game.step(10)).toEqual({ok:false,reason:'far'});
  expect(game.step(1).ok).toBe(true);
  expect(game.step(6)).toEqual({ok:false,reason:'rock'});
  expect(game.step(2).ok).toBe(true);
  expect(game.step(1)).toEqual({ok:true,back:true});
  expect(game.paths.sun).toEqual([0,1]);
  expect(game.step(2).ok).toBe(true);expect(game.step(3).ok).toBe(true);
  const hint=game.hint();expect(hint.restart).toBe(true);expect(hint.cell).toBe(0);
  expect(game.resetRoute()).toBe(true);expect(game.paths.sun).toEqual([0]);
  game.select('berry');expect(game.step(15).ok).toBe(true);expect(game.step(10).ok).toBe(true);expect(game.step(5).ok).toBe(true);
  expect(game.step(0)).toEqual({ok:false,reason:'endpoint'}); // Cannot enter another animal's starting point.
});

test('forest post keeps every row and cell square in all six levels and viewport sizes', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('forest-post.unlocked.v1', '5'));
    await page.goto('/games/forest-post/');
    for (let level = 0; level < LEVELS.length; level++) {
      if (level) await page.locator('#progress button').nth(level).click();
      await expect(page.locator('.cell')).toHaveCount(LEVELS[level].size ** 2);
      const geometry = await page.locator('.cell').evaluateAll(cells => cells.map(cell => {
        const rect = cell.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }));
      const first = geometry[0];
      for (const cell of geometry) {
        expect(Math.abs(cell.width - cell.height)).toBeLessThanOrEqual(0.7);
        expect(Math.abs(cell.width - first.width)).toBeLessThanOrEqual(0.7);
        expect(Math.abs(cell.height - first.height)).toBeLessThanOrEqual(0.7);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('forest post UI delivers a level, unlocks the next one, hints and resets a route', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto('/games/forest-post/');
  await expect(page.locator('.cell')).toHaveCount(25);
  await expect(page.locator('.house-sign')).toHaveCount(2);
  await expect(page.locator('[data-cell="12"] .house-sign')).toHaveText('🐰');
  await expect(page.locator('[data-cell="4"] .house-sign')).toHaveText('🦊');
  await page.locator('[data-cell="0"]').click();
  await page.locator('[data-cell="5"]').click();
  await page.locator('#hint').click();
  await expect(page.locator('[data-cell="1"]')).toHaveClass(/hint-cell/);
  await page.locator('#undo').click();
  await expect(page.locator('.route-layer')).toHaveCount(2); // each animal keeps its starting marker
  for (const route of LEVELS[0].routes) {
    await page.locator(`[data-cell="${route.solution[0]}"]`).click();
    for (const cell of route.solution.slice(1)) await page.locator(`[data-cell="${cell}"]`).click();
  }
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#status-title')).toHaveText('全部送到啦！');
  expect(await page.evaluate(()=>localStorage.getItem('forest-post.unlocked.v1'))).toBe('1');
  await page.locator('#next-level').click();
  await expect(page.locator('#level-name')).toHaveText('莓果转弯处');
  await expect(page.locator('.mail-item')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('forest post remains playable when browser storage is denied', async ({ page }) => {
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError')}}));
  await page.goto('/games/forest-post/');
  await page.locator('[data-cell="0"]').click();
  await page.locator('[data-cell="1"]').click();
  await expect(page.locator('.route-layer')).toHaveCount(3);
  await expect(page.locator('#save-note')).toContainText('浏览器没有保存');
});
