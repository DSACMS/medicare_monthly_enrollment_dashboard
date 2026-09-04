import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function selectComboBoxOption(page, optionText) {
  const selector = page.locator('#medicare-state-selector');
  await selector.click();
  await selector.fill(optionText);
  await page.waitForTimeout(500);

  const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: optionText });
  await option.click();
  await page.waitForTimeout(500);
}

test.describe('Accessibility scans', () => {
  test('initial national dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('hospital/medical view is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Hospital view should be the default
    const hospitalBtn = page.locator('[data-dashboard-type="hospital"]');
    if (await hospitalBtn.isVisible()) {
      await hospitalBtn.click();
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('prescription drug view is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const drugBtn = page.locator('[data-dashboard-type="drug"]');
    if (await drugBtn.isVisible()) {
      await drugBtn.click();
      await page.waitForTimeout(500);
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Alabama selected state is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await selectComboBoxOption(page, 'Alabama');
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Puerto Rico territory is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await selectComboBoxOption(page, 'Puerto Rico');
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Guam territory is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await selectComboBoxOption(page, 'Guam');
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('District of Columbia is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await selectComboBoxOption(page, 'District of Columbia');
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('400% zoom reflow is accessible', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 256 });
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('forced colors mode is accessible', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/');
    await expect(page.locator('.dashboard-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
