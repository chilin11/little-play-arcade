import { test, expect } from '@playwright/test';
import { LEVELS, PatternTrain } from '../../public/games/pattern-train/game.js';

test('pattern train data has nine unique stations and deterministic answers', () => {
  expect(LEVELS).toHaveLength(9);
  expect(LEVELS.slice(0, 3).every(level => level.template === 'AB')).toBe(true);
  expect(LEVELS.slice(3, 6).every(level => level.template === 'AAB')).toBe(true);
  expect(LEVELS.slice(6).every(level => level.template === 'ABC')).toBe(true);
  expect(new Set(LEVELS.map(level => JSON.stringify(level.mapping))).size).toBe(9);
  for (const level of LEVELS) {
    expect(level.sequence).toHaveLength(6);
    expect(level.choices).toContain(level.answer);
    expect(new Set(level.choices).size).toBe(3);
    const game = new PatternTrain(level.index, () => 0.5);
    const wrong = level.choices.find(symbol => symbol !== level.answer);
    expect(game.choose(wrong)).toMatchObject({ ok: false, reason: 'wrong' });
    expect(game.solved).toBe(false);
    expect(game.choose(level.answer)).toMatchObject({ ok: true, symbol: level.answer });
    expect(game.choose(level.answer)).toMatchObject({ ok: false, reason: 'solved' });
    expect(game.hint().groups.length).toBe(level.template === 'AB' ? 3 : 2);
  }
});

test('pattern train reset keeps the station but clears the answer and hint', () => {
  const game = new PatternTrain(8);
  game.hint();
  game.choose(game.answer);
  game.reset();
  expect(game.levelIndex).toBe(8);
  expect(game.solved).toBe(false);
  expect(game.selected).toBeNull();
  expect(game.hintShown).toBe(false);
});

test('pattern train authored sequences, blank positions and hint groups match every template', () => {
  const expectedBlanks = [5, 5, 5, 5, 5, 5, 3, 4, 5];
  for (const [index, level] of LEVELS.entries()) {
    const { A, B, C } = level.mapping;
    const expected = level.template === 'AB'
      ? [A, B, A, B, A, B]
      : level.template === 'AAB'
        ? [A, A, B, A, A, B]
        : [A, B, C, A, B, C];
    expect(level.sequence).toEqual(expected);
    expect(level.blankIndex).toBe(expectedBlanks[index]);
    expect(level.answer).toBe(expected[level.blankIndex]);
    expect(level.groups.flat()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(level.groups.every(group => group.length === (level.template === 'AB' ? 2 : 3))).toBe(true);
  }
});
