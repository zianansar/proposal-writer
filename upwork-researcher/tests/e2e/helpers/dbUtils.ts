/**
 * Database utilities for E2E tests
 *
 * Manages test database state:
 * - Clear database for fresh test runs
 * - Seed database with fixture data
 * - Verify database state after operations
 */

import { resolve, dirname } from 'path';
import { existsSync, unlinkSync, copyFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get path to test database
 * Uses separate test DB to avoid corrupting dev data
 */
export function getTestDatabasePath(): string {
  const dbDir = resolve(__dirname, '../../../test-data');

  // Ensure test-data directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  return resolve(dbDir, 'test.db');
}

/**
 * Clear test database
 * Removes DB file to force fresh state
 */
export function clearDatabase(): void {
  const dbPath = getTestDatabasePath();

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
    console.log(`Cleared test database: ${dbPath}`);
  }
}

/**
 * Seed database with fixture data for specific test scenarios
 */
export function seedDatabase(scenario: SeedScenario): void {
  clearDatabase();

  const seedFile = resolve(__dirname, `../fixtures/seeds/seed-${scenario}.db`);

  if (!existsSync(seedFile)) {
    console.warn(`Seed file not found: ${seedFile}. Creating empty database instead.`);
    return;
  }

  const dbPath = getTestDatabasePath();
  copyFileSync(seedFile, dbPath);

  console.log(`Seeded database with scenario: ${scenario}`);
}

/**
 * Predefined seed scenarios
 */
export type SeedScenario =
  | 'returning-user' // Has passphrase, API key, 3 proposals
  | 'with-api-key' // Has API key, no voice profile
  | 'with-voice-profile' // Has API key and voice profile
  | 'empty'; // No data (same as clearDatabase)

/**
 * Verify database state matches expected conditions
 *
 * Note: This requires either:
 * 1. Direct SQLite access (would need sqlite3 package)
 * 2. Exposing Tauri commands for test queries
 * 3. Verifying via UI (less reliable)
 *
 * For now, returns a placeholder. Can be implemented based on chosen approach.
 */
export interface DatabaseState {
  proposalCount?: number;
  hasVoiceProfile?: boolean;
  hasApiKey?: boolean;
  hasPassphrase?: boolean;
  safetyOverrideCount?: number;
}

export async function verifyDatabaseState(
  expected: DatabaseState
): Promise<void> {
  // TODO: Implement actual database verification
  // Options:
  // 1. Add Tauri command: get_test_db_state() that returns counts
  // 2. Use sqlite3 package to query directly
  // 3. Verify indirectly through UI state

  console.log('Database state verification:', expected);

  // Placeholder - would throw if verification fails
  return Promise.resolve();
}

/**
 * Get database statistics for debugging
 */
export async function getDatabaseStats(): Promise<{
  proposals: number;
  settings: number;
  voiceProfiles: number;
}> {
  // TODO: Implement via Tauri command or direct query
  return {
    proposals: 0,
    settings: 0,
    voiceProfiles: 0,
  };
}

/**
 * Check if database file exists
 */
export function databaseExists(): boolean {
  return existsSync(getTestDatabasePath());
}
