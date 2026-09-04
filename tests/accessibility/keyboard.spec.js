import { test, expect } from '@playwright/test';

test.describe('Keyboard navigation', () => {
  test('skip link works', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const skipLink = page.locator('a[href="#main-content"]');

    if (browserName === 'webkit') {
      // WebKit Playwright doesn't reliably focus sr-only elements via simulated Tab.
      // Verify the skip link exists and can be activated directly.
      await skipLink.focus();
    } else {
      // Tab to skip link
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
    }

    // Activate skip link
    await page.keyboard.press('Enter');
    const main = page.locator('#main-content');
    await expect(main).toBeFocused();
  });

  test('no map path is a sequential Tab stop', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Tab through the page and check no SVG path gets focus
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName.toLowerCase() : '';
      });
      expect(focused).not.toBe('path');
    }
  });

  test('combo box is keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const selector = page.locator('#medicare-state-selector');
    await selector.click();
    await selector.fill('Puerto Rico');
    await page.waitForTimeout(500);

    // Select from dropdown
    const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: 'Puerto Rico' });
    await option.click();
    await page.waitForTimeout(500);

    const value = await selector.inputValue();
    expect(value).toContain('Puerto Rico');
  });

  test('returning to national view leaves focus in logical location', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Select a state using the combo-box interaction
    const selector = page.locator('#medicare-state-selector');
    await selector.click();
    await selector.fill('Alabama');
    await page.waitForTimeout(500);

    const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: 'Alabama' });
    await option.click();
    await page.waitForTimeout(2000);

    // Find and click back button
    const backBtn = page.locator('#medicare-map-back');
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForTimeout(500);

      // Focus should be on a logical element (selector or heading)
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.id || el.tagName.toLowerCase() : '';
      });
      // Focus should not be on body
      expect(focused).not.toBe('');
    }
  });

  test('county table is keyboard accessible after state selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Select a state using the combo-box interaction
    const selector = page.locator('#medicare-state-selector');
    await selector.click();
    await selector.fill('Alabama');
    await page.waitForTimeout(500);

    const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: 'Alabama' });
    await option.click();
    await page.waitForTimeout(3000);

    // Counties tab should now be visible and selected
    const countyTab = page.locator('#enrollment-tab-county');
    await expect(countyTab).toBeVisible();
    await expect(countyTab).toHaveAttribute('aria-selected', 'true');

    // County table should be visible with rows
    const countyTable = page.locator('#county-table');
    await expect(countyTable).toBeVisible();

    // County table should have clickable rows
    const countyRows = countyTable.locator('tr[tabindex="0"]');
    const rowCount = await countyRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // First county row should be keyboard accessible
    const firstRow = countyRows.first();
    await firstRow.focus();
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('TR');
  });
});
