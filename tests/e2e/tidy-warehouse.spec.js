import { test, expect } from '@playwright/test';
import { LEVELS, WarehouseGame, createState, findPath, findSolutionPath, isDeadlocked, isSolved } from '../../public/games/tidy-warehouse/game.js';

test('tidy warehouse has twelve progressive, initially safe and solvable levels', () => {
  expect(LEVELS).toHaveLength(12);
  expect(LEVELS.map(level => level.map.length)).toEqual([5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7]);
  for (const [index] of LEVELS.entries()) {
    const initial = createState(index);
    expect(isSolved(initial)).toBe(false);
    expect(isDeadlocked(initial)).toBe(false);
    const solution = findSolutionPath(initial, 200000);
    expect(solution, `level ${index + 1} should be solvable`).not.toBeNull();
    expect(solution.length).toBeGreaterThan(0);
    const game = new WarehouseGame(index);
    for (const direction of solution) game.move(direction);
    expect(isSolved(game.state)).toBe(true);
  }
});

test('tidy warehouse supports pushing, undo and tap-to-walk paths without automatic pushes', () => {
  const game = new WarehouseGame(0);
  const start = { ...game.state.player };
  expect(findPath(game.state, [1, 3])).toEqual(['right', 'right']);
  const walked = game.walkTo([1, 3]);
  expect(walked.walked).toBe(2);
  expect(game.state.boxes).toEqual(createState(0).boxes);
  expect(game.undo().undone).toBe(true);
  expect(game.state.player).toEqual(start);

  game.move('right');
  game.move('right');
  const push = game.move('down');
  expect(push.pushed).toBe(true);
  expect(push.solved).toBe(true);
  expect(game.undo().undone).toBe(true);
  expect(isSolved(game.state)).toBe(false);
});

test('tidy warehouse supports real cell clicks and owns touch gestures', async ({ page }) => {
  await page.goto('/games/tidy-warehouse/index.html');
  const board = page.locator('#board');
  await expect(board).toHaveCSS('touch-action', 'none');
  await page.locator('[data-key="1,2"]').click();
  await expect(page.locator('[data-key="1,2"]')).toHaveClass(/player/);
  await expect(page.locator('#move-count')).toContainText('步数 1');
});
