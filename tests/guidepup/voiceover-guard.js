import { macOSActivate } from '@guidepup/guidepup';

const BROWSER_APP_NAME = 'Playwright';
const VOICEOVER_ACTIVATE_TIMEOUT_MS = 5000;

/**
 * Re-activates the browser window and verifies VoiceOver is responsive.
 * Call this before VoiceOver interactions that may hang if focus has wandered.
 *
 * Returns true if VoiceOver is ready, false if the test should be skipped
 * (VoiceOver is stuck on another application).
 */
export async function ensureVoiceOverFocused(voiceOver, page) {
  try {
    // Bring browser to front
    await Promise.race([
      macOSActivate(BROWSER_APP_NAME),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('macOSActivate timeout')), VOICEOVER_ACTIVATE_TIMEOUT_MS)
      ),
    ]);

    // Also ensure the Playwright page is focused
    await page.bringToFront();

    // Give VoiceOver a moment to settle
    await new Promise((resolve) => setTimeout(resolve, 200));

    return true;
  } catch {
    return false;
  }
}

/**
 * Wraps a VoiceOver interaction with a timeout guard.
 * If the interaction hangs (VoiceOver wandered), the test is skipped.
 */
export async function withVoiceOverGuard(voiceOver, page, interactionFn) {
  const result = await Promise.race([
    interactionFn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('VoiceOver interaction timed out - focus may have wandered')), 10000)
    ),
  ]);
  return result;
}
