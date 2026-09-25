import { test, expect } from '@playwright/test';
import { ChessGame, INITIAL_BOARD, PIECES, isSquareAttacked } from '../../public/games/chess/game.js';

const emptyBoard = () => Array(64).fill(null);
const setup = (pieces, options = {}) => {
  const board = emptyBoard();
  for (const [square, piece] of Object.entries(pieces)) board[Number(square)] = piece;
  return new ChessGame({ board, castling: { wK:false,wQ:false,bK:false,bQ:false }, ...options });
};

test('chess core: initial position, turns, checkmate and undo', () => {
  const game = new ChessGame();
  expect(game.board).toEqual(INITIAL_BOARD);
  expect(game.legalMoves()).toHaveLength(20);
  expect(game.move(52, 36)).toBe(true); // e2-e4
  expect(game.turn).toBe('b');
  expect(game.move(51, 35)).toBe(false); // White cannot move twice.
  expect(game.undo()).toBe(true);
  expect(game.board).toEqual(INITIAL_BOARD);
  expect(game.turn).toBe('w');

  const mate = new ChessGame();
  for (const [from, to] of [[53,45],[12,28],[54,38],[3,39]]) expect(mate.move(from,to)).toBe(true);
  expect(mate.result).toEqual({ finished:true, type:'checkmate', check:true, winner:'b' });
  expect(mate.moveLog.at(-1)).toBe('Qd8–h4#');
  expect(mate.legalMoves()).toHaveLength(0);
  expect(mate.undo()).toBe(true);
  expect(mate.result.finished).toBe(false);
});

test('chess core: king safety, attacks, castling, en passant and promotion', () => {
  const pinned = setup({ 4:'bk', 12:'br', 52:'wr', 60:'wk' }, { turn:'w' });
  expect(isSquareAttacked(pinned.board, 60, 'b')).toBe(false);
  expect(pinned.legalMoves(52).some(move => move.to === 51)).toBe(false); // Rook cannot expose its king.

  const castle = setup({ 4:'bk', 60:'wk', 63:'wr' }, { turn:'w', castling:{wK:true,wQ:false,bK:false,bQ:false} });
  expect(castle.legalMoves(60).some(move => move.to === 62 && move.castle === 'K')).toBe(true);
  expect(castle.move(60,62)).toBe(true);
  expect(castle.board[62]).toBe('wk');
  expect(castle.board[61]).toBe('wr');
  expect(castle.moveLog).toEqual(['O-O']);
  const attackedCastle = setup({ 4:'bk', 5:'br', 60:'wk', 63:'wr' }, { turn:'w', castling:{wK:true,wQ:false,bK:false,bQ:false} });
  expect(attackedCastle.legalMoves(60).some(move => move.castle)).toBe(false);

  const passant = setup({ 4:'bk', 11:'bp', 28:'wp', 60:'wk' }, { turn:'b' });
  expect(passant.move(11,27)).toBe(true);
  const ep = passant.legalMoves(28).find(move => move.to === 19);
  expect(ep?.enPassant).toBe(true);
  expect(passant.move(28,19)).toBe(true);
  expect(passant.board[27]).toBeNull();
  expect(passant.captured.w).toEqual(['bp']);

  const promotion = setup({ 4:'bk', 8:'wp', 60:'wk' }, { turn:'w' });
  expect(promotion.legalMoves(8).filter(move => move.to === 0).map(move => move.promotion)).toEqual(['q','r','b','n']);
  expect(promotion.move(8,0)).toBe(false);
  expect(promotion.move(8,0,'q')).toBe(true);
  expect(promotion.board[0]).toBe('wq');
  expect(PIECES[promotion.board[0]]).toBe('♕');
});

test('chess core: stalemate and automatic common draws', () => {
  const stalemate = setup({ 0:'bk', 17:'wq', 18:'wk' }, { turn:'b' });
  expect(stalemate.result.type).toBe('stalemate');
  expect(stalemate.result.check).toBe(false);
  const bareKings = setup({ 4:'bk', 60:'wk' }, { turn:'w' });
  expect(bareKings.result.type).toBe('insufficient');
  const fifty = setup({ 4:'bk', 56:'wr', 60:'wk' }, { turn:'w', halfmove:99 });
  expect(fifty.move(56,48)).toBe(true);
  expect(fifty.result.type).toBe('fifty');
  const repeat = new ChessGame();
  for (let cycle=0;cycle<2;cycle++) for (const [from,to] of [[62,45],[6,21],[45,62],[21,6]]) expect(repeat.move(from,to)).toBe(true);
  expect(repeat.result.type).toBe('repetition');
});

test('chess board keeps all 64 squares equal at narrow and wide sizes', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/games/chess/');
    const geometry = await page.locator('.square').evaluateAll(squares => squares.map(square => {
      const rect = square.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    expect(geometry).toHaveLength(64);
    const first = geometry[0];
    for (const square of geometry) {
      expect(Math.abs(square.width - square.height)).toBeLessThanOrEqual(0.6);
      expect(Math.abs(square.width - first.width)).toBeLessThanOrEqual(0.6);
      expect(Math.abs(square.height - first.height)).toBeLessThanOrEqual(0.6);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('chess UI supports legal moves, undo, rotation and keyboard', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto('/games/chess/');
  await expect(page.locator('.square')).toHaveCount(64);
  await page.locator('[data-square="52"]').click();
  await expect(page.locator('.square.legal')).toHaveCount(2);
  await page.locator('[data-square="36"]').click();
  await expect(page.locator('[data-square="36"] .piece')).toHaveText('♙');
  await expect(page.locator('#status-title')).toHaveText('轮到黑方');
  await expect(page.locator('#move-list li')).toHaveText('e2–e4');
  await page.locator('#undo').click();
  await expect(page.locator('[data-square="52"] .piece')).toHaveText('♙');
  const firstBefore=await page.locator('.square').first().getAttribute('data-square');
  await page.locator('#flip').click();
  expect(await page.locator('.square').first().getAttribute('data-square')).not.toBe(firstBefore);
  await page.locator('[data-square="52"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-square="36"] .piece')).toHaveText('♙');
  expect(errors).toEqual([]);
});
