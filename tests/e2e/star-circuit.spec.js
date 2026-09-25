import { test, expect } from '@playwright/test';
import { LEVELS, rotateMask, getConnectedCells, allBeaconsConnected } from '../../public/games/star-circuit/game.js';

test('star circuit has twelve progressive solvable levels', () => {
  expect(LEVELS).toHaveLength(12);
  expect(LEVELS.map(level => level.size)).toEqual([4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
  for (const level of LEVELS) {
    expect(level.solution).toHaveLength(level.size ** 2);
    expect(level.initial).toHaveLength(level.size ** 2);
    expect(level.fixed).toEqual([level.source]);
    expect(level.beacons.length).toBeGreaterThan(0);
    expect(allBeaconsConnected([...level.solution], level.size, level.source, level.beacons)).toBe(true);
    expect(allBeaconsConnected([...level.initial], level.size, level.source, level.beacons)).toBe(false);
    const connected = getConnectedCells([...level.solution], level.size, level.source);
    expect(level.beacons.every(index => connected.has(index))).toBe(true);
  }
});

test('star circuit rotations are reversible and every scramble reaches its authored solution', () => {
  for (const level of LEVELS) {
    const masks = [...level.initial];
    for (let index = 0; index < masks.length; index += 1) {
      expect(rotateMask(masks[index], 4)).toBe(masks[index]);
      let guard = 0;
      while (masks[index] !== level.solution[index] && guard < 4) {
        masks[index] = rotateMask(masks[index]);
        guard += 1;
      }
      expect(masks[index]).toBe(level.solution[index]);
    }
    expect(allBeaconsConnected(masks, level.size, level.source, level.beacons)).toBe(true);
  }
});

test('star circuit completion uses a native modal dialog', async ({ page }) => {
  await page.goto('/games/star-circuit/index.html');
  await page.evaluate(() => document.getElementById('win-dialog').showModal());
  const dialog = page.locator('#win-dialog');
  await expect(dialog).toHaveJSProperty('open', true);
  await page.locator('#dialog-next').focus();
  await page.keyboard.press('Tab');
  const focusInside = await page.evaluate(() => document.getElementById('win-dialog').contains(document.activeElement));
  expect(focusInside).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveJSProperty('open', false);
});
