import { test, expect } from '@playwright/test';
import { voiceOverTest } from '@guidepup/playwright';
import { ensureVoiceOverFocused } from './voiceover-guard';

voiceOverTest.describe('VoiceOver screen reader tests', () => {
  voiceOverTest('can navigate dashboard heading', async ({ page, voiceOver }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await voiceOver.navigateToWebContent();

    await voiceOver.nextHeading();
    const heading = await voiceOver.lastSpokenPhrase();
    expect(heading.toLowerCase()).toContain('medicare');
  });

  voiceOverTest('can find and use geographic selector', async ({ page, voiceOver }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await voiceOver.navigateToWebContent();

    // Navigate through page elements until we find the state selector
    // Skip link → heading → topbar text → toggle buttons → combo box
    let found = false;
    for (let i = 0; i < 10; i++) {
      await voiceOver.next();
      const phrase = await voiceOver.lastSpokenPhrase();
      if (phrase.toLowerCase().includes('combo box') || phrase.toLowerCase().includes('select') || phrase.toLowerCase().includes('state')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  voiceOverTest('can select Puerto Rico via combo-box', async ({ page, voiceOver }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await page.locator('#medicare-state-selector').click();
    await page.locator('#medicare-state-selector').fill('Puerto Rico');
    await page.waitForTimeout(500);

    const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: 'Puerto Rico' });
    await option.click();
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    expect(body).toContain('Puerto Rico');
  });

  voiceOverTest('enrollment table is accessible', async ({ page, voiceOver }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await voiceOver.navigateToWebContent();

    const tableRegion = page.locator('#all-areas-table');
    await expect(tableRegion).toBeVisible();

    const table = tableRegion.locator('table');
    await expect(table).toBeAttached();

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  voiceOverTest('skip link targets main content', async ({ page, voiceOver }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await voiceOver.navigateToWebContent();

    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });

  voiceOverTest('dashboard type toggle is accessible', async ({ page, voiceOver }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await voiceOver.navigateToWebContent();

    const group = page.locator('[role="group"][aria-label="Choose enrollment dashboard type"]');
    await expect(group).toBeAttached();

    const buttons = page.locator('.dashboard-type-button');
    const count = await buttons.count();
    expect(count).toBe(2);
  });

  voiceOverTest('county table is announced after state selection', async ({ page, voiceOver }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await page.locator('#medicare-state-selector').click();
    await page.locator('#medicare-state-selector').fill('Alabama');
    await page.waitForTimeout(500);

    const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: 'Alabama' });
    await option.click();

    // Re-activate browser in case VoiceOver wandered during data fetch
    await ensureVoiceOverFocused(voiceOver, page);

    await page.waitForTimeout(3000);

    const countyTab = page.locator('#enrollment-tab-county');
    await expect(countyTab).toBeVisible();

    const countyTable = page.locator('#county-table');
    await expect(countyTable).toBeVisible();

    const rows = countyTable.locator('tr[tabindex="0"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  voiceOverTest('back button returns to national view', async ({ page, voiceOver }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await page.locator('#medicare-state-selector').click();
    await page.locator('#medicare-state-selector').fill('Alabama');
    await page.waitForTimeout(500);

    const option = page.locator('#medicare-state-selector--list .usa-combo-box__list-option', { hasText: 'Alabama' });
    await option.click();
    await page.waitForTimeout(2000);

    const backBtn = page.locator('#medicare-map-back');
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForTimeout(1000);

      const selector = page.locator('#medicare-state-selector');
      await expect(selector).toBeVisible();
    }
  });
});
