/**
 * Playwright Global Teardown
 *
 * Runs once after all tests complete:
 * - Clean up any lingering processes
 * - Archive test artifacts
 * - Log test summary
 */

import { closeTauriApp, isAppRunning } from './helpers/tauriDriver';

export default async function globalTeardown(): Promise<void> {
  console.log('\n=== E2E Test Global Teardown ===\n');

  // 1. Ensure Tauri app is closed
  if (isAppRunning()) {
    console.log('⚠ Tauri app still running. Closing...');
    await closeTauriApp();
  }

  // 2. Log completion
  console.log('✓ Cleanup complete');

  console.log('\n=== Teardown Complete ===\n');
}
