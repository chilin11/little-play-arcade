import { test, expect } from '@playwright/test';
import { STORAGE_KEY, BEST_KEY, mergeLine, moveBoard, spawnTile, advanceBoard, canMove, parseSaved, validateSnapshot } from '../../public/games/2048/game.js';

const URL = '/games/2048/';
const boardWith = row => [...row, ...Array(16 - row.length).fill(0)];
const initial = boardWith([2, 2, 4, 4]);
const dead = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
const snapshot = (board, score = 0, continued = false) => ({ board, score, continued });
const values = page => page.locator('#board .tile').evaluateAll(cells => cells.map(cell => Number(cell.dataset.value)));
async function seed(page, board = initial, score = 0, continued = false, previous = null) {
  await page.goto(URL);
  await page.evaluate(({ key, bestKey, state, previous }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, state, previous }));
    localStorage.setItem(bestKey, String(state.score));
  }, { key: STORAGE_KEY, bestKey: BEST_KEY, state: snapshot(board, score, continued), previous });
  await page.reload();
  await expect(page.locator('.tile')).toHaveCount(16);
}

test('2048 pure rules: single merges, all directions, immutable input and exact gains', () => {
  for (const [input, output, score] of [
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 4, 0], [4, 4, 0, 0], 4],
    [[4, 4, 8, 8], [8, 16, 0, 0], 24],
    [[2, 0, 2, 2], [4, 2, 0, 0], 4],
    [[0, 0, 0, 0], [0, 0, 0, 0], 0],
    [[1024, 1024, 2048, 2048], [2048, 4096, 0, 0], 6144]
  ]) expect(mergeLine(input)).toEqual({ line: output, score });
  const board = Object.freeze(initial.slice());
  expect(moveBoard(board, 'left')).toEqual({ board: boardWith([4, 8, 0, 0]), score: 12, changed: true });
  expect(moveBoard(board, 'right')).toEqual({ board: boardWith([0, 0, 4, 8]), score: 12, changed: true });
  const vertical = [2, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0];
  expect(moveBoard(vertical, 'up').board).toEqual([4, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  expect(moveBoard(vertical, 'down').board).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 8, 0, 0, 0]);
  expect(board).toEqual(initial);
  expect(canMove(dead)).toBe(false);
  expect(canMove([...dead.slice(0, 15), 4])).toBe(true);
  expect(canMove(boardWith([2]))).toBe(true);
  expect(() => moveBoard(board, 'invalid')).toThrow(RangeError);
});

test('2048 spawning: 90/10 boundary, one new tile only on changes, no-op does not consume randomness', () => {
  const board = boardWith([2, 4]);
  const failRandom = () => { throw new Error('No-op must not spawn'); };
  expect(advanceBoard(board, 'left', failRandom)).toEqual({ board, score: 0, changed: false, index: -1 });
  expect(spawnTile(dead, failRandom)).toEqual({ board: dead, index: -1 });
  for (const [chance, tile] of [[0, 2], [0.899999, 2], [0.9, 4], [0.999999, 4]]) {
    const randomValues = [0.999999, chance];
    const spawned = spawnTile(board, () => randomValues.shift());
    expect(spawned.index).toBe(15);
    expect(spawned.board[15]).toBe(tile);
    expect(spawned.board.filter(Boolean)).toHaveLength(3);
  }
  const result = advanceBoard(initial, 'left', () => 0);
  expect(result).toEqual({ board: boardWith([4, 8, 2]), score: 12, changed: true, index: 2 });
  expect(initial).toEqual(boardWith([2, 2, 4, 4]));
});

test('2048 persisted data validation rejects malformed boards and scores', () => {
  const state = snapshot(initial);
  expect(parseSaved(JSON.stringify({ version: 1, state, previous: state }))).toEqual({ state, previous: state });
  for (const raw of ['no json', 'null', '{}', JSON.stringify({ version: 2, state })]) expect(parseSaved(raw)).toBeNull();
  for (const invalid of [
    { ...state, board: [2, 2] }, { ...state, board: Array(16).fill(0) },
    { ...state, board: boardWith([3]) }, { ...state, board: boardWith([-2]) },
    { ...state, board: boardWith(['2']) }, { ...state, board: boardWith([Infinity]) },
    { ...state, score: -1 }, { ...state, score: 1.5 }, { ...state, score: '4' },
    { ...state, continued: true }, { ...state, continued: 'false' }
  ]) expect(validateSnapshot(invalid)).toBeNull();
  expect(parseSaved(JSON.stringify({ version: 1, state, previous: { board: [] } }))).toEqual({ state, previous: null });
});

test('2048 keyboard, score, best, resume and one-step undo', async ({ page }) => {
  await seed(page);
  await page.locator('#board').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#score')).toHaveText('12');
  await expect(page.locator('#best')).toHaveText('12');
  const moved = await values(page);
  expect(moved.slice(0, 2)).toEqual([4, 8]);
  expect(moved.filter(Boolean)).toHaveLength(3);
  await page.reload();
  expect(await values(page)).toEqual(moved);
  await expect(page.locator('#score')).toHaveText('12');
  await page.locator('#undo').click();
  expect(await values(page)).toEqual(initial);
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('12');
  await expect(page.locator('#undo')).toBeDisabled();
  await page.reload();
  expect(await values(page)).toEqual(initial);
  await expect(page.locator('#best')).toHaveText('12');
  await page.keyboard.press('d');
  await expect(page.locator('#score')).toHaveText('12');
  expect((await values(page)).slice(2, 4)).toEqual([4, 8]);
});

test('2048 no-op preserves board, score and existing undo', async ({ page }) => {
  const board = boardWith([2, 4, 8]);
  await seed(page, board, 20, false, snapshot(initial, 8));
  const stored = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.locator('#move-left').click();
  expect(await values(page)).toEqual(board);
  await expect(page.locator('#score')).toHaveText('20');
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(stored);
  await page.locator('#undo').click();
  expect(await values(page)).toEqual(initial);
  await expect(page.locator('#score')).toHaveText('8');
  await expect(page.locator('#best')).toHaveText('20');
});

test('2048 restart requires confirmation and keeps best', async ({ page }) => {
  await seed(page, initial, 128);
  await page.locator('#restart').click();
  await expect(page.locator('#restart-dialog')).toBeVisible();
  await expect(page.locator('#cancel-restart')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  expect(await values(page)).toEqual(initial);
  await page.locator('#cancel-restart').click();
  expect(await values(page)).toEqual(initial);
  await page.locator('#restart').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#restart-dialog')).toBeHidden();
  await page.locator('#restart').click();
  await page.locator('#confirm-restart').click();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('128');
  await expect(page.locator('#undo')).toBeDisabled();
  expect((await values(page)).filter(Boolean)).toHaveLength(2);
  await expect(page.locator('#board')).toBeFocused();
});

test('2048 visible buttons and real touch swipe; tap and cancelled gesture do not move', async ({ page, context }) => {
  await seed(page);
  await page.locator('#move-right').click();
  await expect(page.locator('#score')).toHaveText('12');
  await page.locator('#undo').click();
  await page.locator('#board').scrollIntoViewIfNeeded();
  const box = await page.locator('#board').boundingBox();
  const x = Math.round(box.x + box.width * 0.8);
  const y = Math.round(box.y + box.height * 0.5);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const point = x => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await values(page)).toEqual(initial);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x - 70) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await values(page)).toEqual(initial);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x - 90) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#score')).toHaveText('12');
  expect((await values(page)).slice(0, 2)).toEqual([4, 8]);
  await page.locator('#undo').click();
  await page.locator('#move-down').click();
  expect((await values(page)).slice(12)).toEqual([2, 2, 4, 4]);
  await page.locator('#undo').click();
  await page.locator('#move-up').click();
  expect(await values(page)).toEqual(initial);
  await cdp.detach();
});

test('2048 win pauses play, continues beyond goal, persists acknowledgement and can undo', async ({ page }) => {
  const board = boardWith([1024, 1024, 2048]);
  await seed(page, board, 10, true);
  // Use a pre-win board for the actual threshold transition.
  await seed(page, boardWith([1024, 1024]), 10);
  await page.locator('#move-left').click();
  await expect(page.locator('#result-title')).toHaveText('你好，2048！');
  await expect(page.locator('#score')).toHaveText('2058');
  const wonBoard = await values(page);
  await page.keyboard.press('ArrowDown');
  expect(await values(page)).toEqual(wonBoard);
  await page.locator('#continue').click();
  await expect(page.locator('#result-dialog')).toBeHidden();
  await page.reload();
  await expect(page.locator('#result-dialog')).toBeHidden();
  await page.locator('#undo').click();
  expect(await values(page)).toEqual(boardWith([1024, 1024]));
  await expect(page.locator('#best')).toHaveText('2058');
  await seed(page, boardWith([2048, 2048]), 4096, true);
  await page.locator('#move-left').click();
  await expect(page.locator('.tile[data-value="4096"]')).toHaveCount(1);
  await expect(page.locator('#score')).toHaveText('8192');
  await expect(page.locator('#result-dialog')).toBeHidden();
});

test('2048 game over supports undo and retry', async ({ page }) => {
  await seed(page, dead, 256, false, snapshot(initial, 12));
  await expect(page.locator('#result-dialog')).toBeVisible();
  await expect(page.locator('#result-description')).toContainText('没有可以移动');
  await expect(page.locator('#continue')).toBeHidden();
  await page.locator('#result-undo').click();
  expect(await values(page)).toEqual(initial);
  await expect(page.locator('#best')).toHaveText('256');
  await seed(page, dead, 256);
  await page.locator('#retry').click();
  await expect(page.locator('#result-dialog')).toBeHidden();
  expect((await values(page)).filter(Boolean)).toHaveLength(2);
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('256');
});

for (const denial of ['getter', 'write']) {
  test(`2048 storage ${denial} denial remains playable under strict CSP`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/games/2048/', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'self'" } });
    });
    await page.addInitScript(mode => {
      if (mode === 'getter') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
      else Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    }, denial);
    await page.goto(URL);
    await expect(page.locator('#save-note')).toContainText('浏览器存储不可用');
    const before = await values(page);
    const direction = ['left', 'right', 'up', 'down'].find(direction => moveBoard(before, direction).changed);
    await page.locator(`#move-${direction}`).click();
    await expect(page.locator('#undo')).toBeEnabled();
    await page.locator('#undo').click();
    expect(await values(page)).toEqual(before);
    await page.locator('#restart').click();
    await page.locator('#confirm-restart').click();
    expect((await values(page)).filter(Boolean)).toHaveLength(2);
    expect(errors).toEqual([]);
  });
}

test('2048 corrupt save resets safely and malformed best is ignored', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(({ key, bestKey }) => {
    localStorage.setItem(key, '{broken');
    localStorage.setItem(bestKey, '-999');
  }, { key: STORAGE_KEY, bestKey: BEST_KEY });
  await page.reload();
  expect((await values(page)).filter(Boolean)).toHaveLength(2);
  await expect(page.locator('#best')).toHaveText('0');
  await expect(page.locator('#undo')).toBeDisabled();
});

test('2048 fits 320px iframe, long scores, dialogs and reduced motion; hall link targets top', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, boardWith([131072, 65536, 32768]), 999999999999, true);
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'test-frame';
    iframe.width = '320';
    iframe.height = '640';
    iframe.src = '/games/2048/';
    document.body.replaceChildren(iframe);
  });
  const frame = page.frameLocator('#test-frame');
  await expect(frame.locator('.tile')).toHaveCount(16);
  const noOverflow = () => frame.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth);
  expect(await noOverflow()).toBe(true);
  expect(await frame.locator('.tile').evaluateAll(cells => cells.every(cell => cell.scrollWidth <= cell.clientWidth))).toBe(true);
  await expect(frame.locator('.hall-link')).toHaveAttribute('href', '../../index.html');
  await expect(frame.locator('.hall-link')).toHaveAttribute('target', '_top');
  await frame.locator('#restart').click();
  expect(await noOverflow()).toBe(true);
  const fits = await frame.locator('#restart-dialog').evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= document.documentElement.clientWidth;
  });
  expect(fits).toBe(true);
  await frame.locator('#cancel-restart').click();
  await frame.locator('#move-down').click();
  await expect(frame.locator('.tile.new')).toHaveCSS('animation-name', 'none');
  await frame.locator('.hall-link').click();
  await expect(page).toHaveURL(/\/index\.html$/);
});
