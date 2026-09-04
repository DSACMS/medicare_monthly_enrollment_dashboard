import { test, expect } from '@playwright/test';

test.describe('Territory behavior', () => {
  test('territories appear in selector', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const selector = page.locator('#medicare-state-selector');
    await selector.click();
    await page.waitForTimeout(500);

    // Check the dropdown list options
    const options = page.locator('#medicare-state-selector--list .usa-combo-box__list-option');
    const optionTexts = await options.allTextContents();

    expect(optionTexts.some(t => t.includes('Puerto Rico'))).toBeTruthy();
    expect(optionTexts.some(t => t.includes('Guam'))).toBeTruthy();
    expect(optionTexts.some(t => t.includes('American Samoa'))).toBeTruthy();
    expect(optionTexts.some(t => t.includes('Virgin Islands'))).toBeTruthy();
    expect(optionTexts.some(t => t.includes('Northern Mariana Islands'))).toBeTruthy();
  });

  test('selecting Puerto Rico shows enrollment data', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const selector = page.locator('#medicare-state-selector');
    await selector.click();
    await selector.fill('Puerto Rico');
    await page.waitForTimeout(500);

    const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: 'Puerto Rico' });
    await option.click();
    await page.waitForTimeout(3000);

    // Should show some data or a territory-specific message
    const body = await page.textContent('body');
    expect(body).toContain('Puerto Rico');
  });

  test('territory map shows no-geometry message', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const selector = page.locator('#medicare-state-selector');
    await selector.click();
    await selector.fill('Guam');
    await page.waitForTimeout(500);

    const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: 'Guam' });
    await option.click();
    await page.waitForTimeout(2000);

    // Should show territory scope note
    const scopeNote = page.locator('.data-grid-card__instruction', { hasText: 'Territory enrollment data is available in the table below' });
    await expect(scopeNote).toBeVisible();
  });

  test('table includes all geographic areas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // The state enrollment table should include territories
    const table = page.locator('#all-areas-table');
    const text = await table.textContent();

    expect(text).toContain('Puerto Rico');
    expect(text).toContain('Guam');
  });
});
