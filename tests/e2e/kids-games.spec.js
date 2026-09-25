import { test, expect } from '@playwright/test';

async function openGame(page, title) {
  await page.goto('/');
  await page.getByRole('link', { name: `开始玩${title}`, exact: true }).first().click();
  await expect(page.locator('#player-status')).toContainText('已就绪');
  return page.frameLocator('#game-frame');
}

test('memory garden opens from hall, matches a pair, restarts, and keeps a best record', async ({ page }) => {
  const game = await openGame(page, '花园翻翻乐');
  await expect(game.locator('.memory-card')).toHaveCount(12);
  const pair = await game.locator('.memory-card').evaluateAll(cards => {
    const groups = new Map();
    cards.forEach((card, index) => {
      const icon = card.querySelector('.card-front').textContent;
      groups.set(icon, [...(groups.get(icon) || []), index]);
    });
    return [...groups.values()][0];
  });
  await game.locator('.memory-card').nth(pair[0]).click();
  await game.locator('.memory-card').nth(pair[1]).click();
  await expect(game.locator('#matched-count')).toHaveText('1 / 6');
  await expect(game.locator('.memory-card.matched')).toHaveCount(2);
  await game.locator('#restart').click();
  await expect(game.locator('#matched-count')).toHaveText('0 / 6');
  await game.locator('#difficulty').selectOption('sprout');
  for (const indexes of await game.locator('.memory-card').evaluateAll(cards => {
    const groups = {};
    cards.forEach((card, index) => { const icon = card.querySelector('.card-front').textContent; (groups[icon] ||= []).push(index); });
    return Object.values(groups);
  })) {
    await game.locator('.memory-card').nth(indexes[0]).click();
    await game.locator('.memory-card').nth(indexes[1]).click();
  }
  await expect(game.locator('#win-dialog')).toBeVisible();
  expect(Number(await game.locator('#best').textContent().then(text => text.match(/\d+/)?.[0]))).toBeGreaterThan(0);
  expect(await game.locator('body').evaluate(() => localStorage.getItem('memory-garden-best-sprout'))).not.toBeNull();
});

test('memory garden restart cancels an old mismatch callback', async ({ page }) => {
  await page.goto('/games/memory-garden/');
  const cards = page.locator('.memory-card');
  const different = await cards.evaluateAll(items => {
    const first = items[0].querySelector('.card-front').textContent;
    return [0, items.findIndex(item => item.querySelector('.card-front').textContent !== first)];
  });
  await cards.nth(different[0]).click();
  await cards.nth(different[1]).click();
  await page.locator('#restart').click();
  await cards.nth(0).click();
  await page.waitForTimeout(800);
  await expect(cards.nth(0)).toHaveClass(/flipped/);
});

test('star basket opens from hall, catches a star, pauses, restarts, and reads high score', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('star-basket-best', '7'));
  const game = await openGame(page, '星星接接乐');
  await expect(game.locator('#best')).toHaveText('7');
  await game.locator('#start').click();
  await expect(game.locator('#pause')).toBeEnabled();
  await expect(game.locator('.prompt.star')).toBeVisible({ timeout: 8000 });
  await game.locator('.basket.active').click();
  await expect(game.locator('#score')).not.toHaveText('0');
  await game.locator('#pause').click();
  await expect(game.locator('#pause')).toContainText('继续');
  await game.locator('#pause').click();
  await game.locator('#restart').click();
  await expect(game.locator('#score')).toHaveText('0');
  await expect(game.locator('#time')).toHaveText('45 秒');
  expect(await game.locator('body').evaluate(() => localStorage.getItem('star-basket-best'))).toBe('7');
});

test('star basket writes a newly earned high score when the round finishes', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto('/games/star-basket/');
  await page.locator('#start').click();
  for (let caught = 0; caught < 2; caught++) {
    await page.clock.runFor(1000);
    if (await page.locator('.prompt.star').count()) await page.locator('.basket.active').click();
    else caught -= 1;
  }
  await page.clock.runFor(46000);
  await expect(page.locator('#start')).toContainText('再接');
  const score = Number(await page.locator('#score').textContent());
  expect(score).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('star-basket-best'))).toBe(String(score));
});

test('pattern train follows nine unique pattern stations, supports wrong answers, hints, retry and keyboard', async ({ page }) => {
  const game = await openGame(page, '花花小火车');
  await expect(game.locator('.wagon')).toHaveCount(6);
  await expect(game.locator('.choice-button')).toHaveCount(3);
  await expect(game.locator('#progress button')).toHaveCount(9);
  await expect(game.locator('#progress button:disabled')).toHaveCount(8);
  const labels = await game.locator('.wagon').evaluateAll(wagons => wagons.map(wagon => wagon.getAttribute('aria-label')));
  const blank = labels.findIndex(label => label.includes('空着'));
  const symbols = { 叶子: 'leaf', 花朵: 'flower', 蘑菇: 'mushroom', 浆果: 'berry' };
  const match = label => symbols[label.match(/叶子|花朵|蘑菇|浆果/)[0]];
  const answer = match(labels[blank - 2]);
  const wrong = await game.locator('.choice-button').evaluateAll((buttons, correct) => buttons.map(button => button.dataset.symbol).find(symbol => symbol !== correct), answer);
  await game.locator(`.choice-button[data-symbol="${wrong}"]`).click();
  await expect(game.locator('#feedback')).toContainText('再看看');
  await game.locator('#hint').click();
  await expect(game.locator('.group-bracket')).toHaveCount(3);
  await game.locator(`.choice-button[data-symbol="${answer}"]`).click();
  await expect(game.locator('#win-dialog')).toBeVisible();
  await expect(game.locator('#win-title')).toHaveText('找到规律啦！');
  await game.locator('#next-level').click();
  await expect(game.locator('#level-name')).toHaveText('第 2 站');
});
test('picnic count checks fruit type before quantity, supports LIFO return and keyboard', async ({ page }) => {
  const game = await openGame(page, '野餐分分乐');
  await expect(game.locator('#progress button')).toHaveCount(8);
  await expect(game.locator('#progress button:disabled')).toHaveCount(7);
  await game.locator('#choose-pear').press('Enter');
  await game.locator('#rabbit-add').click();
  await game.locator('#choose-apple').click();
  await game.locator('#rabbit-add').click();
  await game.locator('#rabbit-remove').click();
  await expect(game.locator('#rabbit-plate .fruit-item')).toHaveCount(1);
  await expect(game.locator('#rabbit-plate use')).toHaveAttribute('href', /#pear$/);
  await game.locator('#bear-add').click();
  await game.locator('#check').click();
  await expect(game.locator('#feedback')).toContainText('小兔');
  await expect(game.locator('#feedback')).toContainText('苹果');
  await game.locator('#restart').click();
  await expect(game.locator('.fruit-item')).toHaveCount(0);
  await game.locator('#choose-apple').click();
  await game.locator('#rabbit-add').click();
  await game.locator('#bear-add').click();
  await game.locator('#bear-add').click();
  await game.locator('#check').click();
  await expect(game.locator('#win-dialog')).toBeVisible();
  await expect(game.locator('#feedback')).toContainText('刚刚好');
  await game.locator('#next-level').click();
  await expect(game.locator('#level-name')).toHaveText('第 2 次野餐');
});

test('new kids games persist full unlock progress and keep completed levels accessible', async ({ page }) => {
  await page.goto('/play.html?game=pattern-train');
  await expect(page.locator('#player-status')).toContainText('已就绪');
  let game = page.frameLocator('#game-frame');
  const trainAnswers = ['flower', 'berry', 'mushroom', 'berry', 'leaf', 'mushroom', 'leaf', 'leaf', 'leaf'];
  const trainBlanks = [5, 5, 5, 5, 5, 5, 3, 4, 5];
  for (let level = 0; level < trainAnswers.length; level += 1) {
    const labels = await game.locator('.wagon').evaluateAll(wagons => wagons.map(wagon => wagon.getAttribute('aria-label')));
    expect(labels.findIndex(label => label.includes('空着'))).toBe(trainBlanks[level]);
    const answerIndex = await game.locator('.choice-button').evaluateAll((buttons, answer) => buttons.findIndex(button => button.dataset.symbol === answer), trainAnswers[level]);
    expect(answerIndex).toBeGreaterThanOrEqual(0);
    await game.locator('.choice-button').first().press(String(answerIndex + 1));
    await expect(game.locator('#win-dialog')).toBeVisible();
    await game.locator('#next-level').click();
  }
  expect(await game.locator('body').evaluate(() => localStorage.getItem('little-play:pattern-train:v1'))).toBe('8');
  await page.reload();
  await expect(page.locator('#player-status')).toContainText('已就绪');
  game = page.frameLocator('#game-frame');
  await expect(game.locator('#progress button:disabled')).toHaveCount(0);
  await game.locator('#progress button').nth(8).click();
  await expect(game.locator('#level-name')).toHaveText('第 9 站');
  await game.locator('#progress button').first().click();
  await expect(game.locator('#level-name')).toHaveText('第 1 站');
  await expect(game.locator('.choice-button:enabled')).toHaveCount(3);

  await page.goto('/play.html?game=picnic-count');
  await expect(page.locator('#player-status')).toContainText('已就绪');
  game = page.frameLocator('#game-frame');
  const picnicTargets = [
    ['apple', 1, 'apple', 2], ['apple', 2, 'apple', 3], ['pear', 1, 'pear', 3], ['apple', 3, 'pear', 2],
    ['pear', 4, 'apple', 2], ['apple', 4, 'pear', 3], ['pear', 5, 'apple', 3], ['apple', 5, 'pear', 5]
  ];
  for (const [rabbitFruit, rabbitCount, bearFruit, bearCount] of picnicTargets) {
    await game.locator(`#choose-${rabbitFruit}`).click();
    for (let count = 0; count < rabbitCount; count += 1) await game.locator('#rabbit-add').click();
    await game.locator(`#choose-${bearFruit}`).click();
    for (let count = 0; count < bearCount; count += 1) await game.locator('#bear-add').click();
    await game.locator('#check').click();
    await expect(game.locator('#win-dialog')).toBeVisible();
    await game.locator('#next-level').click();
  }
  expect(await game.locator('body').evaluate(() => localStorage.getItem('little-play:picnic-count:v1'))).toBe('7');
  await page.reload();
  await expect(page.locator('#player-status')).toContainText('已就绪');
  game = page.frameLocator('#game-frame');
  await expect(game.locator('#progress button:disabled')).toHaveCount(0);
  await game.locator('#progress button').nth(7).click();
  await expect(game.locator('#level-name')).toHaveText('第 8 次野餐');
  await game.locator('#progress button').first().click();
  await expect(game.locator('#level-name')).toHaveText('第 1 次野餐');
  await expect(game.locator('#check')).toBeEnabled();
});

test('kids games remain usable without storage and do not overflow a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
  for (const id of ['memory-garden', 'star-basket', 'pattern-train', 'picnic-count']) {
    await page.goto(`/play.html?game=${id}`);
    await expect(page.locator('#player-status')).toContainText('已就绪');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const game = page.frameLocator('#game-frame');
    expect(await game.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (id === 'memory-garden') await game.locator('.memory-card').first().click();
    else if (id === 'star-basket') await game.locator('#start').click();
    else if (id === 'pattern-train') await game.locator('.choice-button').first().click();
    else await game.locator('#choose-apple').click();
  }
});
