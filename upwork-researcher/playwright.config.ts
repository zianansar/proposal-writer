import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for Tauri E2E tests
 *
 * Tauri v2 E2E testing approach:
 * - Build app in test mode with tauri build
 * - Launch built binary
 * - Connect Playwright to the WebView
 *
 * Note: Tauri apps use native WebViews, not browser engines.
 * macOS: WebKit (WKWebView)
 * Windows: Edge WebView2
 * Linux: WebKitGTK
 */

export default defineConfig({
  testDir: "./tests/e2e",

  // Run tests sequentially - Tauri app can only have one instance
  fullyParallel: false,

  // Fail build on CI if .only is left in test files
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI for flakiness detection
  retries: process.env.CI ? 2 : 0,

  // Single worker since Tauri app is single-instance
  workers: 1,

  // Test reporters
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],

  // Global timeout for each test (2 minutes)
  timeout: 120_000,

  // Timeout for assertions (10 seconds)
  expect: {
    timeout: 10_000,
  },

  use: {
    // Capture trace on first retry for debugging
    trace: "on-first-retry",

    // Capture video on failure
    video: "retain-on-failure",

    // Capture screenshot on failure
    screenshot: "only-on-failure",

    // Base URL (will be overridden by Tauri test context)
    baseURL: "tauri://localhost",

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Additional context options
    ignoreHTTPSErrors: true,
  },

  // Test projects (single project for Tauri app)
  projects: [
    {
      name: "tauri-e2e",
      testMatch: /.*\.spec\.ts$/,
    },
  ],

  // Output folders
  outputDir: "test-results",

  // Global setup/teardown
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
});
