import { test, expect } from '@playwright/test';
import { LEVELS, PicnicCount } from '../../public/games/picnic-count/game.js';

test('picnic count data contains the eight authored fruit and quantity challenges', () => {
  expect(LEVELS).toHaveLength(8);
  expect(LEVELS.map(level => `${level.rabbit.fruit}:${level.rabbit.count};${level.bear.fruit}:${level.bear.count}`)).toEqual([
    'apple:1;apple:2', 'apple:2;apple:3', 'pear:1;pear:3', 'apple:3;pear:2',
    'pear:4;apple:2', 'apple:4;pear:3', 'pear:5;apple:3', 'apple:5;pear:5'
  ]);
});

test('picnic count model supports type-first checks, one-by-one changes, LIFO and reset', () => {
  const game = new PicnicCount(0);
  expect(game.add('rabbit')).toMatchObject({ ok: false, reason: 'no-fruit' });
  game.selectFruit('pear');
  game.add('rabbit');
  game.selectFruit('apple');
  game.add('rabbit');
  expect(game.remove('rabbit')).toMatchObject({ ok: true, fruit: 'apple', count: 1 });
  expect(game.check().issues[0]).toMatchObject({ friend: 'rabbit', typeCorrect: false });
  game.reset();
  expect(game.plates).toEqual({ rabbit: [], bear: [] });
  expect(game.remove('rabbit')).toMatchObject({ ok: false, reason: 'empty' });

  game.selectFruit('apple');
  game.add('rabbit');
  game.add('bear');
  game.add('bear');
  expect(game.check().solved).toBe(true);
  expect(game.solved).toBe(true);
  expect(game.add('bear')).toMatchObject({ ok: false, reason: 'solved' });
});

test('picnic count completes the final level and rejects a bad quantity', () => {
  const game = new PicnicCount(7);
  game.selectFruit('apple');
  for (let index = 0; index < 5; index += 1) game.add('rabbit');
  game.selectFruit('pear');
  for (let index = 0; index < 4; index += 1) game.add('bear');
  expect(game.check().solved).toBe(false);
  expect(game.check().issues.find(issue => issue.friend === 'bear')).toMatchObject({ expectedCount: 5 });
  game.add('bear');
  expect(game.check().solved).toBe(true);
});

test('picnic count can complete every authored level and enforces plate limits', () => {
  for (const [index, level] of LEVELS.entries()) {
    const game = new PicnicCount(index);
    for (const friend of ['rabbit', 'bear']) {
      game.selectFruit(level[friend].fruit);
      for (let count = 0; count < level[friend].count; count += 1) {
        expect(game.add(friend)).toMatchObject({ ok: true });
      }
    }
    expect(game.check()).toMatchObject({ solved: true, issues: [] });
  }

  const full = new PicnicCount(0);
  full.selectFruit('apple');
  for (let count = 0; count < 5; count += 1) expect(full.add('rabbit')).toMatchObject({ ok: true });
  expect(full.add('rabbit')).toMatchObject({ ok: false, reason: 'full' });
  expect(full.plates.rabbit).toHaveLength(5);
});
