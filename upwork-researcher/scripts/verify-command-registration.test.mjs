// @vitest-environment node
/**
 * Tests for verify-command-registration.mjs (Story TD2-1)
 *
 * Test strategy:
 *   - AC 4.2: Run script against the real codebase → expect exit 0 (baseline)
 *   - AC 4.3: Inject a fake #[tauri::command] function → expect exit 1 + UNREGISTERED
 *   - AC 4.4: Inject a fake registration into invoke_handler! → expect exit 1 + ORPHANED
 *
 * The script is spawned as a child process with a custom CWD (temp directory)
 * so it can be run against controlled, minimal Rust file fixtures.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'verify-command-registration.mjs');

/**
 * Creates a minimal temp project fixture for the script to scan.
 *
 * @param {object} options
 * @param {string[]} options.registeredCommands - Command names to put in invoke_handler!
 * @param {Array<{file: string, commands: string[]}>} options.rustFiles - Rust files to create with #[tauri::command] fns
 * @returns {string} Path to the temp directory
 */
function createFixture({ registeredCommands = [], rustFiles = [] }) {
  const dir = join(tmpdir(), `vcr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const srcDir = join(dir, 'src-tauri', 'src');

  mkdirSync(srcDir, { recursive: true });

  // Build invoke_handler block
  const handlerEntries = registeredCommands.map((cmd) => `    ${cmd},`).join('\n');
  const libRsContent = `
// Minimal lib.rs fixture for testing
fn main() {}

.invoke_handler(tauri::generate_handler![
${handlerEntries}
])
`;
  writeFileSync(join(srcDir, 'lib.rs'), libRsContent);

  // Write additional .rs files
  for (const { file, commands } of rustFiles) {
    const filePath = join(srcDir, file);
    const fileDir = dirname(filePath);
    if (fileDir !== srcDir) {
      mkdirSync(fileDir, { recursive: true });
    }

    const fnBlocks = commands
      .map(
        (cmd) => `
#[tauri::command]
async fn ${cmd}() -> Result<String, String> {
    Ok("ok".to_string())
}
`
      )
      .join('\n');

    writeFileSync(join(srcDir, file), fnBlocks);
  }

  return dir;
}

/** Runs the verification script with a specific working directory. */
function runScript(cwd) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd,
    encoding: 'utf-8',
    timeout: 10_000,
  });
}

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  tempDirs.length = 0;
});

// ─── AC 4.2: Baseline — real codebase ────────────────────────────────────────

describe('verify-command-registration.mjs', () => {
  it('AC 4.2: exits 0 against the real codebase (clean baseline)', () => {
    const result = spawnSync('node', [SCRIPT_PATH], {
      cwd: join(process.cwd()),
      encoding: 'utf-8',
      timeout: 10_000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No mismatches found');
  });

  // ─── AC 4.3: Unregistered command detection ────────────────────────────────

  it('AC 4.3: exits 1 and reports UNREGISTERED COMMANDS when a #[tauri::command] fn is not in invoke_handler!', () => {
    const dir = createFixture({
      registeredCommands: ['legit_command'],
      rustFiles: [
        {
          file: 'commands.rs',
          commands: ['legit_command', 'unregistered_command'],
        },
      ],
    });
    tempDirs.push(dir);

    const result = runScript(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('UNREGISTERED COMMANDS');
    expect(result.stderr).toContain('unregistered_command');
    expect(result.stderr).not.toContain('ORPHANED REGISTRATIONS');
  });

  it('AC 4.3: exit 1 output includes the file path where the unregistered command is defined', () => {
    const dir = createFixture({
      registeredCommands: [],
      rustFiles: [
        {
          file: 'my_module.rs',
          commands: ['ghost_command'],
        },
      ],
    });
    tempDirs.push(dir);

    const result = runScript(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ghost_command');
    expect(result.stderr).toContain('my_module.rs');
  });

  // ─── AC 4.4: Orphaned registration detection ───────────────────────────────

  it('AC 4.4: exits 1 and reports ORPHANED REGISTRATIONS when invoke_handler! has a name with no matching fn', () => {
    const dir = createFixture({
      registeredCommands: ['real_command', 'orphaned_command'],
      rustFiles: [
        {
          file: 'commands.rs',
          commands: ['real_command'],
        },
      ],
    });
    tempDirs.push(dir);

    const result = runScript(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ORPHANED REGISTRATIONS');
    expect(result.stderr).toContain('orphaned_command');
    expect(result.stderr).not.toContain('UNREGISTERED COMMANDS');
  });

  // ─── Clean fixture ─────────────────────────────────────────────────────────

  it('exits 0 when registered commands and #[tauri::command] functions match exactly', () => {
    const dir = createFixture({
      registeredCommands: ['cmd_one', 'cmd_two'],
      rustFiles: [
        {
          file: 'commands.rs',
          commands: ['cmd_one', 'cmd_two'],
        },
      ],
    });
    tempDirs.push(dir);

    const result = runScript(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No mismatches found');
  });

  // ─── Module-qualified names ────────────────────────────────────────────────

  it('extracts function name from module-qualified invoke_handler! entries', () => {
    const dir = createFixture({
      registeredCommands: ['commands::proposals::get_history'],
      rustFiles: [
        {
          file: 'commands/proposals.rs',
          commands: ['get_history'],
        },
      ],
    });
    tempDirs.push(dir);

    const result = runScript(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No mismatches found');
  });

  // ─── Stacked attributes (#[tauri::command] + #[specta::specta]) ───────────

  it('detects commands with stacked attributes (#[specta::specta] between #[tauri::command] and fn)', () => {
    const dir = createFixture({
      registeredCommands: ['stacked_cmd'],
      rustFiles: [
        {
          file: 'stacked.rs',
          commands: [], // empty — we'll write the file manually below
        },
      ],
    });
    tempDirs.push(dir);

    // Overwrite with stacked-attribute content (createFixture doesn't support stacked attrs)
    writeFileSync(
      join(dir, 'src-tauri', 'src', 'stacked.rs'),
      `#[tauri::command]\n#[specta::specta]\npub async fn stacked_cmd() -> Result<String, String> {\n    Ok("ok".to_string())\n}\n`
    );

    const result = runScript(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No mismatches found');
  });

  // ─── Performance: completes under 5s on real codebase ─────────────────────

  it('AC 4.2: completes in under 5000ms against the real codebase', () => {
    const start = Date.now();
    const result = spawnSync('node', [SCRIPT_PATH], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      timeout: 10_000,
    });
    const elapsed = Date.now() - start;

    expect(result.status).toBe(0);
    expect(elapsed).toBeLessThan(5000);
  });
});
