/**
 * Playwright Global Setup
 *
 * Runs once before all tests:
 * - Install Playwright browsers if needed
 * - Set up test environment variables
 * - Prepare test database directory
 */

import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function globalSetup(): Promise<void> {
  console.log('\n=== E2E Test Global Setup ===\n');

  // 1. Ensure test-data directory exists
  const testDataDir = resolve(__dirname, '../../test-data');
  if (!existsSync(testDataDir)) {
    mkdirSync(testDataDir, { recursive: true });
    console.log('✓ Created test-data directory');
  }

  // 2. Verify environment variables
  if (!process.env.TEST_API_KEY && !process.env.CI) {
    console.warn(
      '⚠ TEST_API_KEY not set. Tests requiring API key will be skipped or use mocks.'
    );
  }

  // 3. Check if Tauri binary exists (for build-based tests)
  const platform = process.platform;
  let binaryPath = '';

  if (platform === 'darwin') {
    binaryPath = resolve(
      __dirname,
      '../../src-tauri/target/release/bundle/macos/Upwork Research Agent.app'
    );
  } else if (platform === 'win32') {
    binaryPath = resolve(__dirname, '../../src-tauri/target/release/upwork-research-agent.exe');
  } else {
    binaryPath = resolve(__dirname, '../../src-tauri/target/release/upwork-research-agent');
  }

  if (process.env.USE_BUILD === 'true' && !existsSync(binaryPath)) {
    console.warn('⚠ Tauri binary not found. Run `npm run tauri build` first.');
    console.warn(`  Expected: ${binaryPath}`);
  }

  // 4. Log test configuration
  console.log('Test configuration:');
  console.log(`  Platform: ${platform}`);
  console.log(`  CI: ${process.env.CI || 'false'}`);
  console.log(`  Use Build: ${process.env.USE_BUILD || 'false'}`);
  console.log(`  Workers: 1 (Tauri single-instance)`);

  console.log('\n=== Setup Complete ===\n');
}
