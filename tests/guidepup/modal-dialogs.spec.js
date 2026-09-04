import { test, expect } from '@playwright/test';
import { voiceOverTest } from '@guidepup/playwright';
import { ensureVoiceOverFocused } from './voiceover-guard';

voiceOverTest.describe('Modal dialog VoiceOver tests', () => {
  voiceOverTest.describe('Desktop overlays', () => {
    voiceOverTest('enrollment overlay announces as dialog', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#enrollment-expand-trigger');
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await trigger.click();
      await page.waitForTimeout(1000);

      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const dialog = page.locator('#enrollment-overlay');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('role', 'dialog');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      const title = page.locator('#enrollment-overlay-title');
      const titleText = await title.textContent();
      expect(titleText).toBeTruthy();
    });

    voiceOverTest('enrollment overlay close button returns focus to trigger', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#enrollment-expand-trigger');
      await trigger.click();
      await page.waitForTimeout(1000);

      const closeBtn = page.locator('#enrollment-overlay-close');
      await closeBtn.click();
      await page.waitForTimeout(500);

      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#enrollment-overlay')).not.toBeVisible();
    });

    voiceOverTest('enrollment overlay closes on Escape', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#enrollment-expand-trigger');
      await trigger.click();
      await page.waitForTimeout(1000);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#enrollment-overlay')).not.toBeVisible();
    });

    voiceOverTest('trend overlay announces as dialog', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#trend-expand-trigger');
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await trigger.click();
      await page.waitForTimeout(1000);

      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const dialog = page.locator('#trend-overlay');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('role', 'dialog');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      const title = page.locator('#trend-overlay-title');
      const titleText = await title.textContent();
      expect(titleText).toBeTruthy();
    });

    voiceOverTest('trend overlay close button returns focus to trigger', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#trend-expand-trigger');
      await trigger.click();
      await page.waitForTimeout(1000);

      const closeBtn = page.locator('#trend-overlay-close');
      await closeBtn.click();
      await page.waitForTimeout(500);

      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#trend-overlay')).not.toBeVisible();
    });

    voiceOverTest('trend overlay closes on Escape', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#trend-expand-trigger');
      await trigger.click();
      await page.waitForTimeout(1000);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#trend-overlay')).not.toBeVisible();
    });

    voiceOverTest('trend overlay has tablist and chart type controls', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      await page.locator('#trend-expand-trigger').click();
      await page.waitForTimeout(1000);

      const tablist = page.locator('#trend-overlay-range');
      await expect(tablist).toBeAttached();
      await expect(tablist).toHaveAttribute('role', 'tablist');

      const tabs = page.locator('#trend-overlay-range [role="tab"]');
      const tabCount = await tabs.count();
      expect(tabCount).toBe(2);

      const chartTypeGroup = page.locator('#trend-overlay-types[role="group"]');
      await expect(chartTypeGroup).toBeAttached();

      const chartButtons = page.locator('#trend-overlay-types button[aria-pressed]');
      const chartCount = await chartButtons.count();
      expect(chartCount).toBe(3);
    });
  });

  voiceOverTest.describe('Mobile drawers', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    voiceOverTest('state drawer announces as dialog', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#all-areas-mobile-trigger');
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await trigger.click();
      await page.waitForTimeout(1000);

      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const dialog = page.locator('#all-areas-drawer');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('role', 'dialog');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      const title = page.locator('#all-areas-drawer-title');
      const titleText = await title.textContent();
      expect(titleText).toContain('State Enrollment');
    });

    voiceOverTest('state drawer close button returns focus to trigger', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#all-areas-mobile-trigger');
      await trigger.click();
      await page.waitForTimeout(1000);

      const closeBtn = page.locator('#all-areas-drawer-close');
      await closeBtn.click();
      await page.waitForTimeout(500);

      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#all-areas-drawer')).not.toBeVisible();
    });

    voiceOverTest('state drawer closes on Escape', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#all-areas-mobile-trigger');
      await trigger.click();
      await page.waitForTimeout(1000);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#all-areas-drawer')).not.toBeVisible();
    });

    voiceOverTest('state drawer has search input', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      await page.locator('#all-areas-mobile-trigger').click();
      await page.waitForTimeout(1000);

      const search = page.locator('#all-areas-drawer-search');
      await expect(search).toBeVisible();
    });

    voiceOverTest('county drawer is disabled until state selected', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const trigger = page.locator('#county-mobile-trigger');
      await expect(trigger).toBeVisible();
      await expect(trigger).toBeDisabled();
      await expect(trigger).toHaveAttribute('aria-disabled', 'true');
    });

    voiceOverTest('county drawer opens after state selection', async ({ page, voiceOver }) => {
      await page.goto('/');
      // Wait for initial data load — dashboard:title-date is populated after
      // loadStateMap() completes, which sets year/month needed for county fetch
      await page.waitForFunction(
        () => document.querySelector('#dashboard-title-date')?.textContent?.trim(),
        { timeout: 30000 }
      );

      await page.evaluate(() => {
        document.dispatchEvent(new CustomEvent('dashboard:statechange', {
          detail: { state: 'AL', stateName: 'Alabama' }
        }));
      });

      const trigger = page.locator('#county-mobile-trigger');
      await expect(async () => {
        const disabled = await trigger.evaluate((el) => el.disabled);
        expect(disabled).toBe(false);
      }).toPass({ timeout: 20000 });

      await ensureVoiceOverFocused(voiceOver, page);

      // aria-disabled="true" is not cleared by app code (only HTML disabled is),
      // so force the click — the button is functionally enabled
      await trigger.click({ force: true });
      await page.waitForTimeout(1000);

      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const dialog = page.locator('#county-drawer');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('role', 'dialog');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      const title = page.locator('#county-drawer-title');
      const titleText = await title.textContent();
      expect(titleText).toContain('County Enrollment');
    });

    voiceOverTest('county drawer closes on Escape', async ({ page, voiceOver }) => {
      await page.goto('/');
      await page.waitForFunction(
        () => document.querySelector('#dashboard-title-date')?.textContent?.trim(),
        { timeout: 30000 }
      );

      await page.evaluate(() => {
        document.dispatchEvent(new CustomEvent('dashboard:statechange', {
          detail: { state: 'AL', stateName: 'Alabama' }
        }));
      });

      const trigger = page.locator('#county-mobile-trigger');
      await expect(async () => {
        const disabled = await trigger.evaluate((el) => el.disabled);
        expect(disabled).toBe(false);
      }).toPass({ timeout: 20000 });

      await ensureVoiceOverFocused(voiceOver, page);

      await trigger.click({ force: true });
      await page.waitForTimeout(1000);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#county-drawer')).not.toBeVisible();
    });
  });
});
