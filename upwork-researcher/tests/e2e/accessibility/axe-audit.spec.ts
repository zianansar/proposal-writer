/**
 * Accessibility: axe-core Audit Tests
 *
 * Runs automated accessibility audits using axe-core:
 * - WCAG 2.1 Level A/AA compliance
 * - No critical or serious violations
 * - Color contrast validation
 *
 * Acceptance Criteria: AC-8
 * - axe-core passes with no critical violations
 * - WCAG AA color contrast verified
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { launchTauriApp, closeTauriApp } from '../helpers/tauriDriver';
import { clearDatabase, seedDatabase } from '../helpers/dbUtils';

test.describe('Accessibility: axe-core Audits', () => {
  test.beforeAll(async () => {
    await launchTauriApp({ useBuild: false });
  });

  test.afterAll(async () => {
    await closeTauriApp();
  });

  test('onboarding screen has no accessibility violations', async ({ page }) => {
    clearDatabase();
    await page.goto('tauri://localhost');

    const accessibilityResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalViolations = accessibilityResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
    console.log(`✓ No critical violations (${accessibilityResults.violations.length} total)`);
  });

  test('main editor has no accessibility violations', async ({ page }) => {
    seedDatabase('with-api-key');
    await page.goto('tauri://localhost');

    const accessibilityResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = accessibilityResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('settings modal has no accessibility violations', async ({ page }) => {
    seedDatabase('with-api-key');
    await page.goto('tauri://localhost');

    // Open settings modal
    await page.getByRole('button', { name: /settings/i }).click();

    const accessibilityResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = accessibilityResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('color contrast meets WCAG AA standards', async ({ page }) => {
    clearDatabase();
    await page.goto('tauri://localhost');

    // M1 FIX: Use .withRules() for rule filtering, not .include() which takes CSS selectors
    const contrastResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .analyze();

    expect(contrastResults.violations).toHaveLength(0);
    console.log('✓ Color contrast meets WCAG AA standards');
  });

  test('all images have alt text', async ({ page }) => {
    seedDatabase('with-api-key');
    await page.goto('tauri://localhost');

    // M1 FIX: Use .withRules() instead of .include() for rule-based filtering
    const imageResults = await new AxeBuilder({ page })
      .withRules(['image-alt'])
      .analyze();

    expect(imageResults.violations).toHaveLength(0);
    console.log('✓ All images have appropriate alt text');
  });

  test('form labels are properly associated', async ({ page }) => {
    clearDatabase();
    await page.goto('tauri://localhost');

    // M1 FIX: Use .withRules() instead of .include() for rule-based filtering
    const labelResults = await new AxeBuilder({ page })
      .withRules(['label'])
      .analyze();

    expect(labelResults.violations).toHaveLength(0);
    console.log('✓ Form labels properly associated');
  });
});
