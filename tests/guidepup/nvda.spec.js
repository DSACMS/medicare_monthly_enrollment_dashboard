import { test, expect } from '@playwright/test';
import { nvdaTest } from '@guidepup/playwright';

nvdaTest.describe('NVDA screen reader tests', () => {
  nvdaTest('can navigate dashboard heading', async ({ page, nvda }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await nvda.navigateToWebContent();

    await nvda.nextHeading();
    const heading = await nvda.lastSpokenPhrase();
    expect(heading.toLowerCase()).toContain('medicare');
  });

  nvdaTest('can find and use geographic selector', async ({ page, nvda }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await nvda.navigateToWebContent();

    const comboBox = page.locator('#medicare-state-selector');
    await comboBox.focus();

    const announcement = await nvda.lastSpokenPhrase();
    expect(announcement.toLowerCase()).toContain('state');
  });

  nvdaTest('can select Puerto Rico without map', async ({ page, nvda }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await page.locator('#medicare-state-selector').selectOption('Puerto Rico');
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    expect(body).toContain('Puerto Rico');
  });

  nvdaTest('enrollment table has proper headers', async ({ page, nvda }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await nvda.navigateToWebContent();

    const thCount = await page.locator('#all-areas-table th').count();
    expect(thCount).toBeGreaterThan(0);
  });

  nvdaTest('skip link targets main content', async ({ page, nvda }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await nvda.navigateToWebContent();

    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });

  nvdaTest('dashboard type toggle is accessible', async ({ page, nvda }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await nvda.navigateToWebContent();

    const group = page.locator('[role="group"][aria-label="Choose enrollment dashboard type"]');
    await expect(group).toBeAttached();

    const buttons = page.locator('.dashboard-type-button');
    const count = await buttons.count();
    expect(count).toBe(2);
  });
});
