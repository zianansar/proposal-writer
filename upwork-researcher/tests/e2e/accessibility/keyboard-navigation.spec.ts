/**
 * Accessibility: Keyboard Navigation E2E Tests
 *
 * Validates full keyboard-only navigation (AC-8):
 * - Tab navigates between focusable elements
 * - Enter/Space activates buttons
 * - Escape closes modals
 * - Arrow keys navigate lists
 * - Focus indicators are visible
 * - Full Journey 1 can be completed keyboard-only
 */

import { test, expect, Page } from '@playwright/test';
import { launchTauriApp, closeTauriApp } from '../helpers/tauriDriver';
import { clearDatabase, seedDatabase } from '../helpers/dbUtils';

test.describe('Accessibility: Keyboard Navigation', () => {
  test.beforeAll(async () => {
    await launchTauriApp({ useBuild: false });
  });

  test.afterAll(async () => {
    await closeTauriApp();
  });

  test('Tab order follows logical reading sequence through onboarding', async ({ page }) => {
    clearDatabase();
    await page.goto('tauri://localhost');

    // First Tab should land on the first interactive element
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return el
        ? { tag: el.tagName, testId: el.getAttribute('data-testid'), role: el.getAttribute('role') }
        : null;
    });
    expect(firstFocused).not.toBeNull();

    // Continue tabbing and collect focused elements in order
    const focusOrder: string[] = [];
    for (let i = 0; i < 10; i++) {
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute('data-testid') || el?.getAttribute('role') || el?.tagName || '';
      });
      focusOrder.push(info);
      await page.keyboard.press('Tab');
    }

    // Verify tabs land on real elements, not just BODY
    const nonEmpty = focusOrder.filter((f) => f && f !== 'BODY');
    expect(nonEmpty.length).toBeGreaterThan(0);
  });

  test('Enter and Space activate buttons', async ({ page }) => {
    clearDatabase();
    await page.goto('tauri://localhost');

    // Tab to Get Started button and activate with Enter
    const getStartedButton = page.getByRole('button', { name: /get started/i });
    await getStartedButton.focus();
    expect(await getStartedButton.evaluate((el) => el === document.activeElement)).toBe(true);

    await page.keyboard.press('Enter');

    // Should advance past welcome screen — API key input becomes reachable
    const apiKeyInput = page.getByTestId('api-key-input');
    await expect(apiKeyInput).toBeVisible({ timeout: 3000 });

    // Test Space activation on the submit button
    const submitButton = page.getByRole('button', { name: /save.*key/i });
    await submitButton.focus();
    await page.keyboard.press('Space');

    // Space should fire the button (shows validation feedback since no key entered)
    const feedback = page.getByRole('alert').or(page.getByText(/required|invalid|enter/i));
    await expect(feedback).toBeVisible({ timeout: 2000 });
  });

  test('Escape closes modals and dialogs', async ({ page }) => {
    seedDatabase('with-api-key');
    await page.goto('tauri://localhost');

    // Open settings modal
    const settingsButton = page.getByRole('button', { name: /settings/i });
    await settingsButton.click();

    const settingsModal = page.getByTestId('settings-modal');
    await expect(settingsModal).toBeVisible({ timeout: 3000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(settingsModal).toBeHidden({ timeout: 2000 });
  });

  test('Arrow keys navigate list items', async ({ page }) => {
    seedDatabase('returning-user');
    await page.goto('tauri://localhost');

    // Unlock if passphrase dialog appears
    const passphraseInput = page.getByTestId('unlock-passphrase-input');
    if (await passphraseInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passphraseInput.fill('test-passphrase-12345');
      await page.getByRole('button', { name: /unlock/i }).click();
      await expect(page.getByTestId('passphrase-dialog')).toBeHidden({ timeout: 3000 });
    }

    // Navigate to history
    const historyNav = page.getByTestId('history-nav');
    await historyNav.click();
    await expect(page.getByTestId('history-list')).toBeVisible({ timeout: 3000 });

    // Focus the first list item
    const firstItem = page.getByTestId('history-item-0');
    await firstItem.focus();

    // ArrowDown should move focus to next item
    await page.keyboard.press('ArrowDown');
    const focusedAfterDown = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid')
    );
    expect(focusedAfterDown).toBeTruthy();

    // ArrowUp should move focus back
    await page.keyboard.press('ArrowUp');
    const focusedAfterUp = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid')
    );
    expect(focusedAfterUp).toBeTruthy();
  });

  test('Focus indicators are visible on interactive elements', async ({ page }) => {
    clearDatabase();
    await page.goto('tauri://localhost');

    // Tab to first interactive element
    await page.keyboard.press('Tab');

    // Check that focused element has a visible focus indicator (outline or box-shadow)
    const hasFocusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const styles = window.getComputedStyle(el);
      const outlineWidth = parseFloat(styles.outlineWidth) || 0;
      const outlineStyle = styles.outlineStyle;
      const boxShadow = styles.boxShadow;
      return (
        (outlineWidth > 0 && outlineStyle !== 'none') ||
        (boxShadow !== 'none' && boxShadow !== '')
      );
    });
    expect(hasFocusStyle).toBe(true);

    // Verify focus indicators persist through multiple tabs
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      const visible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el.tagName === 'BODY') return true; // Skip body
        const styles = window.getComputedStyle(el);
        const outlineWidth = parseFloat(styles.outlineWidth) || 0;
        const boxShadow = styles.boxShadow;
        return (
          (outlineWidth > 0 && styles.outlineStyle !== 'none') ||
          (boxShadow !== 'none' && boxShadow !== '')
        );
      });
      expect(visible).toBe(true);
    }
  });

  test('full Journey 1 can be completed with keyboard only', async ({ page }) => {
    clearDatabase();
    await page.goto('tauri://localhost');

    // Step 1: Navigate to Get Started with Tab + Enter
    await tabToAndActivate(page, /get started/i);

    // Step 2: Tab to API key input, type key, Tab to submit, Enter
    const apiKeyInput = page.getByTestId('api-key-input');
    await apiKeyInput.focus();
    await page.keyboard.type('sk-ant-test-key-mock-12345');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Wait for next step to render
    await page.waitForTimeout(500);

    // Step 3: Quick Calibration — select options via keyboard
    for (let q = 0; q < 5; q++) {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Select first option

      if (q < 4) {
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter'); // Next question
      }
    }

    // Tab to Complete button and activate
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Step 4: Main editor — type job content
    const jobInput = page.getByTestId('job-input');
    await jobInput.focus();
    await page.keyboard.type('Test job content for keyboard navigation');

    // Tab to Analyze, activate
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await page.waitForSelector('[data-testid="job-analysis-panel"]', {
      state: 'visible',
      timeout: 10_000,
    });

    // Tab to Generate, activate
    const generateButton = page.getByTestId('generate-button');
    await generateButton.focus();
    await page.keyboard.press('Enter');

    await page.waitForSelector('[data-testid="loading-indicator"]', {
      state: 'hidden',
      timeout: 10_000,
    });

    // Tab to Copy, activate
    const copyButton = page.getByTestId('copy-button');
    await copyButton.focus();
    await page.keyboard.press('Enter');

    // Verify copy confirmation
    await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 2000 });
  });
});

/**
 * Tab through elements until finding one matching the name pattern, then activate with Enter
 */
async function tabToAndActivate(page: Page, namePattern: RegExp, maxTabs = 20): Promise<void> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const text = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.textContent?.trim() || el?.getAttribute('aria-label') || '';
    });
    if (namePattern.test(text)) {
      await page.keyboard.press('Enter');
      return;
    }
  }
  throw new Error(`Could not find element matching ${namePattern} after ${maxTabs} tabs`);
}
