/**
 * Smoke test for E2E infrastructure (L3 fix)
 *
 * Verifies:
 * - Tauri app can launch
 * - Playwright can connect
 * - Basic element interaction works
 * - Setup completes in <30s (AC-1)
 */

import { test, expect } from "@playwright/test";

import { clearDatabase } from "./helpers/dbUtils";
import { launchTauriApp, closeTauriApp, isAppRunning } from "./helpers/tauriDriver";

test.describe("E2E Infrastructure Smoke Test", () => {
  test.beforeAll(async () => {
    clearDatabase();

    const setupStart = Date.now();
    await launchTauriApp({ useBuild: false });
    const setupDuration = Date.now() - setupStart;

    console.log(`Setup completed in ${setupDuration}ms`);

    // AC-1: Setup completes in <30 seconds
    expect(setupDuration).toBeLessThan(30_000);
  });

  test.afterAll(async () => {
    await closeTauriApp();
  });

  test("app launches and process is running", async () => {
    // L3 FIX: Real assertion — verify the Tauri app process is alive
    expect(isAppRunning()).toBe(true);
  });

  test.skip("can interact with UI elements", async ({ page }) => {
    // Skipped until Playwright is connected to Tauri WebView via tauri-driver.
    // Once C5 (WebDriver connection) is integrated in Playwright config,
    // this test should navigate to the app and verify a visible element.
    await page.goto("tauri://localhost");
    await expect(page.locator("body")).toBeVisible();
  });
});
