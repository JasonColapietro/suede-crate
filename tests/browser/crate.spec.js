import { test, expect } from '@playwright/test';
test('search, disambiguate, discover, follow, exclude, refine, export and reset', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Build my crate' })).toBeDisabled();
  await page.getByLabel('Artist or band').fill('Example'); await page.getByRole('button', { name: 'Find artist' }).click();
  await page.getByRole('button', { name: 'Add Example Starting Artist', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Example Starting Artist' })).toBeVisible();
  await page.getByRole('button', { name: 'Build my crate' }).click();
  await expect(page.getByRole('heading', { name: 'Example Discovery A', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Example Film' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Example Book' })).toBeVisible();
  await expect(page.locator('#artists img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Example Discovery A to starting artists' }).click();
  await expect(page.locator('#stale-note')).toBeVisible();
  await page.getByRole('button', { name: 'Exclude Example Discovery B' }).click();
  await page.getByRole('radio', { name: /Deeper cuts/ }).check();
  const requestPromise = page.waitForRequest(req => req.url().endsWith('/api/crate'));
  await page.getByRole('button', { name: 'Build my crate' }).click();
  const request = await requestPromise;
  expect(request.postDataJSON().seedIds).toHaveLength(2); expect(request.postDataJSON().excludedIds).toHaveLength(1); expect(request.postDataJSON().discovery).toBe('deep');
  await expect(page.locator('#stale-note')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Example Discovery A', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Example Discovery B', exact: true })).toHaveCount(0);
  await page.getByText('See how this crate was built').click();
  await expect(page.locator('#evidence')).toContainText('popularity capped at 0.65');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save listening notes' }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('suede-crate-listening-notes.md');
  await page.getByRole('button', { name: 'Start over' }).click(); await expect(page.locator('#crate')).toBeHidden();
  await expect(page.getByLabel('Artist or band')).toBeFocused(); expect(errors).toEqual([]);
});
test('missing credentials remain visibly unavailable and never display fabricated results', async ({ page }) => {
  await page.goto('http://127.0.0.1:3478');
  await expect(page.locator('#connection-note')).toContainText('waiting for Qloo API access');
  await page.getByRole('button', { name: 'Nirvana', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('waiting for Qloo API access');
  await expect(page.locator('#search-results li')).toHaveCount(0); await expect(page.locator('#crate')).toBeHidden();
});
test('empty results, keyboard operation and narrow layouts', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Artist or band').fill('No Match'); await page.getByLabel('Artist or band').press('Enter');
  await expect(page.locator('#search-status')).toContainText('No artist matched');
  await page.getByLabel('Artist or band').fill('Example'); await page.getByLabel('Artist or band').press('Enter');
  const add = page.getByRole('button', { name: 'Add Example Starting Artist', exact: true }); await expect(add).toBeVisible(); await add.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Build my crate' }).click(); await expect(page.locator('#crate')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); expect(overflow).toBe(false);
  const scene = page.locator('.record-scene');
  if (await scene.isVisible()) {
    const sceneBox = await scene.boundingBox(), benchBox = await page.locator('#workbench').boundingBox();
    expect(sceneBox.y + sceneBox.height).toBeLessThanOrEqual(benchBox.y);
  }
  await page.screenshot({ path: `artifacts/${test.info().project.name}-synthetic-crate.png`, fullPage: true });
});
test('editing search cancels an earlier response and clears stale matches', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Artist or band').fill('Slow Artist'); await page.getByLabel('Artist or band').press('Enter');
  await page.getByLabel('Artist or band').fill('No Match'); await page.getByLabel('Artist or band').press('Enter');
  await expect(page.locator('#search-status')).toContainText('No artist matched'); await page.waitForTimeout(700); await expect(page.locator('#search-results li')).toHaveCount(0);
});
