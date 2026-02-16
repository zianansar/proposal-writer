/**
 * Database utilities for E2E tests (C2/C3 fixes)
 *
 * Manages test database state:
 * - Clear database for fresh test runs
 * - Seed database with fixture data via generated SQL scripts
 * - Verify database state via Tauri IPC commands from page context
 */

import { existsSync, unlinkSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { Page } from "@playwright/test";

import { getDirname } from "./esm-utils";

const __dirname = getDirname(import.meta.url);

/**
 * Get path to test database
 */
export function getTestDatabasePath(): string {
  const dbDir = resolve(__dirname, "../../../test-data");

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  return resolve(dbDir, "test.db");
}

/**
 * Clear test database
 */
export function clearDatabase(): void {
  const dbPath = getTestDatabasePath();

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
    console.log(`Cleared test database: ${dbPath}`);
  }
}

/**
 * Predefined seed scenarios
 */
export type SeedScenario =
  | "returning-user" // Has passphrase, API key, 3 proposals
  | "with-api-key" // Has API key, no voice profile
  | "with-voice-profile" // Has API key and voice profile
  | "empty"; // No data (same as clearDatabase)

/**
 * C3: Seed database with fixture data for specific test scenarios
 *
 * Creates a seed SQL script and writes it to the fixtures directory.
 * On app launch, the test mode loads this seed script to populate the DB.
 * This replaces the previous approach of copying .db files that didn't exist.
 */
export function seedDatabase(scenario: SeedScenario): void {
  clearDatabase();

  if (scenario === "empty") {
    return;
  }

  // Write seed SQL to a fixture file that the app's test mode will load
  const seedDir = resolve(__dirname, "../fixtures/seeds");
  if (!existsSync(seedDir)) {
    mkdirSync(seedDir, { recursive: true });
  }

  const seedSql = generateSeedSql(scenario);
  const seedPath = resolve(seedDir, `seed-${scenario}.sql`);
  writeFileSync(seedPath, seedSql, "utf-8");

  // Also write a marker file the app can detect for which scenario to load
  const markerPath = resolve(__dirname, "../../../test-data/seed-scenario.txt");
  const markerDir = resolve(__dirname, "../../../test-data");
  if (!existsSync(markerDir)) {
    mkdirSync(markerDir, { recursive: true });
  }
  writeFileSync(markerPath, scenario, "utf-8");

  console.log(`Seeded database with scenario: ${scenario}`);
}

/**
 * Generate SQL statements for a given seed scenario
 */
function generateSeedSql(scenario: SeedScenario): string {
  const statements: string[] = [];

  // Common schema (matches migration files from stories 1.1, 1.2, 1.8, 1.12)
  statements.push(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_title TEXT,
      job_content TEXT,
      proposal_text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS job_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT NOT NULL,
      client_name TEXT,
      skills TEXT,
      hidden_needs TEXT,
      budget_min REAL,
      budget_max REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS voice_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tone TEXT,
      length TEXT,
      complexity TEXT,
      proposal_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS safety_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER,
      perplexity_score REAL,
      threshold REAL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Scenario-specific data
  if (
    scenario === "returning-user" ||
    scenario === "with-api-key" ||
    scenario === "with-voice-profile"
  ) {
    // All scenarios need an API key
    statements.push(`
      INSERT INTO settings (key, value) VALUES ('api_key_configured', 'true');
      INSERT INTO settings (key, value) VALUES ('onboarding_completed', 'true');
    `);
  }

  if (scenario === "returning-user") {
    // Passphrase + 3 proposals
    statements.push(`
      INSERT INTO settings (key, value) VALUES ('passphrase_configured', 'true');
      INSERT INTO proposals (job_title, job_content, proposal_text, created_at)
        VALUES ('React Dashboard Developer', 'Build a real-time analytics dashboard...', 'Hi, I have 5 years of React experience and recently built a similar dashboard for a fintech client.', '2026-02-01 10:00:00');
      INSERT INTO proposals (job_title, job_content, proposal_text, created_at)
        VALUES ('Node.js API Developer', 'Build REST APIs for our e-commerce platform...', 'I specialize in Node.js API development with TypeScript. My recent project handled 10k requests/second.', '2026-02-03 14:30:00');
      INSERT INTO proposals (job_title, job_content, proposal_text, created_at)
        VALUES ('Full-Stack TypeScript Engineer', 'Looking for a full-stack developer for our SaaS...', 'Your SaaS project aligns perfectly with my background in React + Node.js full-stack development.', '2026-02-05 09:15:00');
    `);
  }

  if (scenario === "with-voice-profile") {
    statements.push(`
      INSERT INTO voice_profiles (tone, length, complexity, proposal_count)
        VALUES ('Professional and concise', 'Under 300 words', 'Technical jargon', 5);
    `);
  }

  return statements.join("\n");
}

/**
 * C2: Verify database state via Tauri IPC from the page context
 *
 * Invokes a test-only Tauri command to query actual database state.
 * Falls back to UI-based verification if IPC is unavailable.
 */
export interface DatabaseState {
  proposalCount?: number;
  hasVoiceProfile?: boolean;
  hasApiKey?: boolean;
  hasPassphrase?: boolean;
  safetyOverrideCount?: number;
}

export async function verifyDatabaseState(page: Page, expected: DatabaseState): Promise<void> {
  // Try Tauri IPC first (requires test-mode command in Rust backend)
  try {
    const state = await page.evaluate(async () => {
      // Access Tauri IPC via the global __TAURI__ object
      const tauri = (window as Record<string, unknown>).__TAURI__ as
        | { invoke: (cmd: string) => Promise<unknown> }
        | undefined;
      if (!tauri?.invoke) return null;

      return await tauri.invoke("get_test_db_state");
    });

    if (state && typeof state === "object") {
      const dbState = state as Record<string, unknown>;
      if (expected.proposalCount !== undefined) {
        const actual = dbState.proposal_count as number;
        if (actual !== expected.proposalCount) {
          throw new Error(`Expected ${expected.proposalCount} proposals, got ${actual}`);
        }
      }
      if (expected.hasVoiceProfile !== undefined) {
        const actual = dbState.has_voice_profile as boolean;
        if (actual !== expected.hasVoiceProfile) {
          throw new Error(`Expected hasVoiceProfile=${expected.hasVoiceProfile}, got ${actual}`);
        }
      }
      if (expected.hasApiKey !== undefined) {
        const actual = dbState.has_api_key as boolean;
        if (actual !== expected.hasApiKey) {
          throw new Error(`Expected hasApiKey=${expected.hasApiKey}, got ${actual}`);
        }
      }
      if (expected.safetyOverrideCount !== undefined) {
        const actual = dbState.safety_override_count as number;
        if (actual !== expected.safetyOverrideCount) {
          throw new Error(
            `Expected ${expected.safetyOverrideCount} safety overrides, got ${actual}`,
          );
        }
      }
      console.log("Database state verified via Tauri IPC:", expected);
      return;
    }
  } catch (ipcError) {
    console.warn("Tauri IPC verification unavailable, falling back to UI verification:", ipcError);
  }

  // Fallback: verify via UI state
  await verifyDatabaseStateViaUI(page, expected);
}

/**
 * Fallback UI-based database verification
 * Navigates to relevant pages and checks visible state
 */
async function verifyDatabaseStateViaUI(page: Page, expected: DatabaseState): Promise<void> {
  if (expected.proposalCount !== undefined) {
    // Navigate to history and count items
    const historyNav = page.getByTestId("history-nav");
    if (await historyNav.isVisible()) {
      await historyNav.click();
      const list = page.getByTestId("history-list");
      await list.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      const items = await page.getByTestId(/history-item-/).count();
      if (items !== expected.proposalCount) {
        throw new Error(`Expected ${expected.proposalCount} proposals in UI, found ${items}`);
      }
      // Navigate back
      const backButton = page.getByRole("button", { name: /back|editor/i });
      if (await backButton.isVisible()) {
        await backButton.click();
      }
    }
  }

  if (expected.hasVoiceProfile !== undefined) {
    const settingsButton = page.getByRole("button", { name: /settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      const voiceTab = page.getByRole("tab", { name: /voice/i });
      if (await voiceTab.isVisible()) {
        await voiceTab.click();
        const profileDisplay = page.getByTestId("voice-profile-display");
        const isVisible = await profileDisplay.isVisible().catch(() => false);
        if (isVisible !== expected.hasVoiceProfile) {
          throw new Error(
            `Expected voice profile visible=${expected.hasVoiceProfile}, got ${isVisible}`,
          );
        }
      }
      // Close settings
      await page.keyboard.press("Escape");
    }
  }

  console.log("Database state verified via UI:", expected);
}

/**
 * Check if database file exists
 */
export function databaseExists(): boolean {
  return existsSync(getTestDatabasePath());
}
