/**
 * Playwright Global Setup
 *
 * Runs once before all tests:
 * - Prepare test database directory
 * - Start mock API server for deterministic responses
 * - Verify environment variables
 * - Log test configuration
 */

import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getDirname } from './helpers/esm-utils';
import { startMockApiServer } from './helpers/mockApiServer';

const __dirname = getDirname(import.meta.url);

export default async function globalSetup(): Promise<void> {
  console.log('\n=== E2E Test Global Setup ===\n');

  // 1. Ensure test-data directory exists
  const testDataDir = resolve(__dirname, '../../test-data');
  if (!existsSync(testDataDir)) {
    mkdirSync(testDataDir, { recursive: true });
    console.log('Created test-data directory');
  }

  // 2. Start mock API server (C4: intercepts Rust-side API calls)
  await startMockApiServer('standard');

  // 3. Verify environment variables
  if (!process.env.TEST_API_KEY && !process.env.CI) {
    console.warn(
      'TEST_API_KEY not set. Tests requiring API key will use mocks.'
    );
  }

  // 4. Check if Tauri binary exists (for build-based tests)
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
    console.warn('Tauri binary not found. Run `npm run tauri build` first.');
    console.warn(`  Expected: ${binaryPath}`);
  }

  // 5. Log test configuration
  console.log('Test configuration:');
  console.log(`  Platform: ${platform}`);
  console.log(`  CI: ${process.env.CI || 'false'}`);
  console.log(`  Use Build: ${process.env.USE_BUILD || 'false'}`);
  console.log(`  Workers: 1 (Tauri single-instance)`);

  console.log('\n=== Setup Complete ===\n');
}
