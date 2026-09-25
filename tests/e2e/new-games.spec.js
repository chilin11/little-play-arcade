import { test, expect } from '@playwright/test';

const newGames = [
  { id: '2048', title: '2048' },
  { id: 'minesweeper', title: '扫雷' },
  { id: 'chess', title: '国际象棋' },
  { id: 'forest-post', title: '森林邮差' },
  { id: 'memory-garden', title: '花园翻翻乐' },
  { id: 'star-basket', title: '星星接接乐' },
  { id: 'magic-wardrobe', title: '魔法衣橱' },
  { id: 'pattern-train', title: '花花小火车' },
  { id: 'picnic-count', title: '野餐分分乐' },
  { id: 'star-circuit', title: '星路接线室' },
  { id: 'tidy-warehouse', title: '仓库小管家' }
];

test('new puzzle games appear in category, search, newest sort and favorites', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-total')).toHaveText('13');
  await page.getByRole('button', { name: '休闲益智', exact: true }).click();
  await expect(page.locator('.game-card h3')).toHaveText(['2048', '扫雷']);
  await page.getByRole('button', { name: '全部游戏', exact: true }).click();
  for (const { title } of newGames) {
    await page.getByRole('button', { name: `收藏${title}`, exact: true }).click();
  }
  await page.locator('#nav-favorites').click();
  await expect(page.locator('.game-card')).toHaveCount(newGames.length);
  await page.reload();
  await page.locator('#nav-favorites').click();
  await expect(page.locator('.game-card')).toHaveCount(newGames.length);
  await page.getByRole('searchbox').fill('推理');
  await expect(page.locator('.game-card h3')).toHaveText('扫雷');
  await page.getByRole('link', { name: '发现游戏', exact: true }).click();
  await page.locator('#sort').selectOption('newest');
  await expect(page.locator('.game-card h3').nth(0)).toHaveText('星路接线室');
  await expect(page.locator('.game-card h3').nth(1)).toHaveText('仓库小管家');
});

for (const { id, title } of newGames) {
  test(`${id} opens from the hall under CSP and appears in recent games`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/');
    await page.getByRole('link', { name: `开始玩${title}`, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`play\\.html\\?game=${id}$`));
    await expect(page.locator('#player-status')).toContainText('已就绪');
    await expect(page.locator('#game-frame')).toHaveAttribute('src', new RegExp(`/games/${id}/index\\.html$`));
    await expect(page.frameLocator('#game-frame').locator('main')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('#recent-games')).toContainText(title);
    expect(errors).toEqual([]);
  });
}
