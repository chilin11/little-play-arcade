import { test, expect } from '@playwright/test';

const CATEGORY_COUNTS = {
  tops: 8,
  bottoms: 8,
  dresses: 6,
  shoes: 6,
  hats: 6,
  neck: 6,
  accessories: 8
};

const CATEGORY_FOR_SLOT = {
  top: 'tops',
  bottom: 'bottoms',
  dress: 'dresses',
  shoes: 'shoes',
  hat: 'hats',
  neck: 'neck',
  accessory: 'accessories'
};

const SLOT_LABELS = {
  top: '上衣',
  bottom: '下装',
  dress: '连衣裙',
  shoes: '鞋子',
  hat: '帽子',
  neck: '颈饰',
  accessory: '配饰'
};

async function openFromHall(page, { collectErrors = false } = {}) {
  const errors = [];
  if (collectErrors) {
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
  }
  await page.goto('/');
  await page.getByRole('link', { name: '开始玩魔法衣橱', exact: true }).first().click();
  await expect(page.locator('#player-status')).toContainText('已就绪');
  const game = page.frameLocator('#game-frame');
  await expect(game.locator('main')).toBeVisible();
  return { game, errors };
}

async function chooseItem(game, category, id) {
  await game.locator(`#tab-${category}`).click();
  const option = game.locator(`#item-${id}`);
  await expect(option).toHaveCount(1);
  await option.click();
}

async function stageLayers(game) {
  return game.locator('#wardrobe-stage svg.stage-look').evaluate(svg => (
    [...svg.querySelectorAll('use[data-layer]')].map(use => ({
      layer: use.dataset.layer,
      item: use.dataset.item
    }))
  ));
}

async function orderRequirements(game) {
  return game.locator('.order-requirement').evaluateAll(rows => rows.map(row => ({
    slot: row.dataset.slot,
    item: row.dataset.item
  })));
}

test('hall opens the real SVG wardrobe with seven catalog categories', async ({ page }) => {
  const { game, errors } = await openFromHall(page, { collectErrors: true });
  const stage = game.locator('#wardrobe-stage');
  const mainLook = stage.locator('svg.stage-look');

  await expect(mainLook).toBeVisible();
  await expect(mainLook).toHaveAttribute('viewBox', '0 0 320 400');
  for (const layer of ['character', 'top', 'bottom', 'shoes', 'hat', 'neck', 'accessory']) {
    await expect(mainLook.locator(`use[data-layer="${layer}"]`)).toHaveCount(1);
  }

  await expect(game.locator('.category-tab')).toHaveCount(7);
  for (const [category, count] of Object.entries(CATEGORY_COUNTS)) {
    await game.locator(`#tab-${category}`).click();
    await expect(game.locator('#wardrobe-options')).toHaveAttribute('data-category', category);
    await expect(game.locator('#wardrobe-options .option-button')).toHaveCount(count);
    await expect(game.locator('#wardrobe-options .wardrobe-item-preview')).toHaveCount(count);
    await expect(game.locator('#category-count')).toContainText(String(count));
  }
  expect(errors).toEqual([]);
});

test('dress selection replaces top and bottom while real shoe hat and neck layers update', async ({ page }) => {
  const { game } = await openFromHall(page);

  await chooseItem(game, 'tops', 'top-shirt');
  await chooseItem(game, 'bottoms', 'bottom-wide');
  let stage = game.locator('#wardrobe-stage');
  await expect(stage.locator('use[data-layer="top"][data-item="top-shirt"]')).toHaveCount(1);
  await expect(stage.locator('use[data-layer="bottom"][data-item="bottom-wide"]')).toHaveCount(1);

  await chooseItem(game, 'dresses', 'dress-garden');
  stage = game.locator('#wardrobe-stage');
  await expect(stage.locator('use[data-layer="dress"][data-item="dress-garden"]')).toHaveCount(1);
  await expect(stage.locator('use[data-layer="top"]')).toHaveCount(0);
  await expect(stage.locator('use[data-layer="bottom"]')).toHaveCount(0);
  await expect(stage).toHaveAttribute('data-top', '');
  await expect(stage).toHaveAttribute('data-bottom', '');

  for (const [category, id, layer] of [
    ['shoes', 'shoe-ballet', 'shoes'],
    ['hats', 'hat-beret', 'hat'],
    ['neck', 'neck-bowtie', 'neck']
  ]) {
    await chooseItem(game, category, id);
    await expect(stage.locator(`use[data-layer="${layer}"][data-item="${id}"]`)).toHaveCount(1);
  }
  expect(await stageLayers(game)).toEqual(expect.arrayContaining([
    { layer: 'dress', item: 'dress-garden' },
    { layer: 'shoes', item: 'shoe-ballet' },
    { layer: 'hat', item: 'hat-beret' },
    { layer: 'neck', item: 'neck-bowtie' }
  ]));
});

test('a wish order gives a specific wrong-category hint before completing visible requirements', async ({ page }) => {
  const { game } = await openFromHall(page);
  const rows = await orderRequirements(game);
  const target = rows.find(row => row.slot !== 'character');
  const category = CATEGORY_FOR_SLOT[target.slot];

  await game.locator(`#tab-${category}`).click();
  const wrong = await game.locator('#wardrobe-options .option-button').evaluateAll(
    (buttons, requiredId) => buttons.map(button => button.dataset.item).find(id => id !== requiredId),
    target.item
  );
  expect(wrong).toBeTruthy();
  await game.locator(`#item-${wrong}`).click();
  await game.locator('#check-order').click();
  await expect(game.locator('#feedback')).toContainText('还需调整');
  await expect(game.locator('#feedback')).toContainText(SLOT_LABELS[target.slot]);
  await expect(game.locator('#check-order')).toBeVisible();

  for (const row of rows) {
    if (row.slot === 'character') continue;
    await chooseItem(game, CATEGORY_FOR_SLOT[row.slot], row.item);
  }
  await game.locator('#check-order').click();
  await expect(game.locator('#feedback')).toContainText('订单完成');
  await expect(game.locator('#design-status')).toContainText('贴纸 1');
  await expect(game.locator('#next-order')).toBeVisible();
  await expect(game.locator('#check-order')).toBeHidden();
  await expect(game.locator('.order-requirement.matched')).toHaveCount(rows.length);
});

test('free mode keeps its character, random look and reset separate from the wish order', async ({ page }) => {
  const { game } = await openFromHall(page);
  const wishCharacter = await game.locator('#order-card').getAttribute('data-character');

  await game.locator('#mode-free').click();
  await expect(game.locator('#mode-free')).toHaveAttribute('aria-pressed', 'true');
  await expect(game.locator('#order-card')).toBeHidden();
  await expect(game.locator('#character-picker')).toBeVisible();
  await game.locator('#character-picker button[data-character="character-cat"]').click();
  await expect(game.locator('#wardrobe-stage')).toHaveAttribute('data-character', 'character-cat');

  await game.locator('#random-inspiration').click();
  await expect(game.locator('#message')).toContainText('随机整套');
  const randomLayers = await stageLayers(game);
  expect(randomLayers.find(layer => layer.layer === 'character')?.item).toMatch(/^character-/);
  expect(randomLayers.find(layer => layer.layer === 'shoes')?.item).toMatch(/^shoe-/);
  expect(randomLayers.find(layer => layer.layer === 'hat')?.item).toMatch(/^hat-/);
  expect(randomLayers.find(layer => layer.layer === 'neck')?.item).toMatch(/^neck-/);
  expect(randomLayers.find(layer => layer.layer === 'accessory')?.item).toMatch(/^acc-/);
  expect(randomLayers.some(layer => layer.layer === 'dress') || randomLayers.some(layer => layer.layer === 'top')).toBe(true);

  await game.locator('#reset-look').click();
  await expect(game.locator('#wardrobe-stage')).toHaveAttribute('data-character', 'character-rabbit');
  await expect(game.locator('#wardrobe-stage')).toHaveAttribute('data-top', 'top-tshirt');
  await expect(game.locator('#wardrobe-stage')).toHaveAttribute('data-bottom', 'bottom-pleated');
  await expect(game.locator('#wardrobe-stage')).toHaveAttribute('data-dress', '');

  await game.locator('#mode-wish').click();
  await expect(game.locator('#mode-wish')).toHaveAttribute('aria-pressed', 'true');
  await expect(game.locator('#order-card')).toBeVisible();
  await expect(game.locator('#character-picker')).toBeHidden();
  await expect(game.locator('#order-card')).toHaveAttribute('data-character', wishCharacter);
  await expect(game.locator('#wardrobe-stage')).toHaveAttribute('data-character', wishCharacter);
});

test('saved works keep complete SVG state, deduplicate, and persist in v2 storage', async ({ page }) => {
  const { game } = await openFromHall(page);
  await game.locator('#mode-free').click();
  await game.locator('#character-picker button[data-character="character-deer"]').click();
  await chooseItem(game, 'tops', 'top-shirt');
  await chooseItem(game, 'bottoms', 'bottom-wide');
  await chooseItem(game, 'shoes', 'shoe-canvas');
  await chooseItem(game, 'hats', 'hat-beret');
  await chooseItem(game, 'neck', 'neck-bowtie');
  await chooseItem(game, 'accessories', 'acc-glasses');

  const expected = {
    character: 'character-deer',
    top: 'top-shirt',
    bottom: 'bottom-wide',
    dress: '',
    shoes: 'shoe-canvas',
    hat: 'hat-beret',
    neck: 'neck-bowtie',
    accessory: 'acc-glasses'
  };
  await game.locator('#save-design').click();
  await game.locator('#save-design').click();
  await expect(game.locator('#saved-count')).toHaveText('1');
  await expect(game.locator('.work-card')).toHaveCount(1);
  await expect(game.locator('#message')).toContainText('已经在作品册里');

  const card = game.locator('.work-card').first();
  for (const [key, value] of Object.entries(expected)) await expect(card).toHaveAttribute(`data-${key}`, value);
  const thumbnail = card.locator('svg.wardrobe-look');
  await expect(thumbnail).toHaveCount(1);
  await expect(thumbnail).toHaveAttribute('viewBox', '0 0 320 400');
  for (const [layer, item] of Object.entries({
    scene: 'scene-studio',
    character: expected.character,
    bottom: expected.bottom,
    top: expected.top,
    shoes: expected.shoes,
    neck: expected.neck,
    hat: expected.hat,
    accessory: expected.accessory
  })) {
    await expect(thumbnail.locator(`use[data-layer="${layer}"][data-item="${item}"]`)).toHaveCount(1);
  }

  const stored = await game.locator('body').evaluate(() => JSON.parse(localStorage.getItem('magic-wardrobe-v2')));
  expect(stored.version).toBe(2);
  expect(stored.works).toHaveLength(1);
  expect(stored.works[0]).toMatchObject({ ...expected, dress: null });

  await page.reload();
  const refreshed = page.frameLocator('#game-frame');
  await expect(refreshed.locator('#saved-count')).toHaveText('1');
  await expect(refreshed.locator('.work-card')).toHaveCount(1);
  const refreshedCard = refreshed.locator('.work-card').first();
  for (const [key, value] of Object.entries(expected)) await expect(refreshedCard).toHaveAttribute(`data-${key}`, value);
  await expect(refreshedCard.locator('svg.wardrobe-look use[data-layer="top"][data-item="top-shirt"]')).toHaveCount(1);
  await expect(refreshedCard.locator('svg.wardrobe-look use[data-layer="bottom"][data-item="bottom-wide"]')).toHaveCount(1);
});

test('storage denial still leaves the wardrobe playable and temporarily collectible', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Denied', 'SecurityError');
      }
    });
  });
  const { game } = await openFromHall(page);
  await expect(game.locator('#save-note')).toContainText('照样可以玩');
  await game.locator('#mode-free').click();
  await expect(game.locator('#character-picker')).toBeVisible();
  await game.locator('#random-inspiration').click();
  await expect(game.locator('#wardrobe-stage svg.stage-look')).toBeVisible();
  await game.locator('#save-design').click();
  await expect(game.locator('#saved-count')).toHaveText('1');
  await expect(game.locator('.work-card svg.wardrobe-look')).toHaveCount(1);
});

test('keyboard pressed states and 320px outer and iframe layouts stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const { game } = await openFromHall(page);

  const top = game.locator('#item-top-shirt');
  await top.press('Enter');
  await expect(top).toHaveAttribute('aria-pressed', 'true');
  await expect(game.locator('#wardrobe-stage use[data-layer="top"][data-item="top-shirt"]')).toHaveCount(1);

  const shoesTab = game.locator('#tab-shoes');
  await shoesTab.press('Enter');
  await expect(shoesTab).toHaveAttribute('aria-selected', 'true');
  const shoes = game.locator('#item-shoe-ballet');
  await shoes.press('Space');
  await expect(shoes).toHaveAttribute('aria-pressed', 'true');
  await expect(game.locator('#wardrobe-stage use[data-layer="shoes"][data-item="shoe-ballet"]')).toHaveCount(1);

  await game.locator('#mode-free').press('Enter');
  await expect(game.locator('#mode-free')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const frame = page.frames().find(candidate => candidate.url().includes('/games/magic-wardrobe/'));
  expect(frame).toBeTruthy();
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
});
