#!/usr/bin/env node
/**
 * Command Registration Verification Script (Story TD2-1)
 *
 * Verifies that every #[tauri::command] function in the Rust source is
 * registered in the invoke_handler! macro in lib.rs, and vice versa.
 *
 * Exit 0 — sets match (clean baseline)
 * Exit 1 — mismatch detected (unregistered or orphaned commands)
 *
 * Usage:
 *   node scripts/verify-command-registration.mjs
 *
 * Working directory must be upwork-researcher/ so that both
 * scripts/ and src-tauri/src/ are accessible.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// The script must be run from upwork-researcher/ (CWD) — see pre-commit hook
const PROJECT_ROOT = process.cwd();
const SRC_TAURI_SRC = join(PROJECT_ROOT, 'src-tauri', 'src');
const LIB_RS = join(SRC_TAURI_SRC, 'lib.rs');

/**
 * Extracts all command names registered in the invoke_handler! macro in lib.rs.
 *
 * Handles:
 * - Direct names: `generate_proposal,`
 * - Module-qualified: `commands::proposals::get_proposal_history,` → `get_proposal_history`
 * - Comments: lines starting with `//` are skipped
 *
 * @returns {Set<string>} Set of registered command function names
 */
function extractRegisteredCommands() {
  const content = readFileSync(LIB_RS, 'utf-8');

  // Find the invoke_handler block
  const startMarker = 'tauri::generate_handler![';
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) {
    console.error('ERROR: Could not find tauri::generate_handler![ in lib.rs');
    process.exit(2);
  }

  // Find the matching closing bracket by tracking depth
  let depth = 1;
  let i = startIdx + startMarker.length;
  while (i < content.length && depth > 0) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') depth--;
    i++;
  }

  const handlerBlock = content.slice(startIdx + startMarker.length, i - 1);

  const registered = new Set();

  for (const rawLine of handlerBlock.split('\n')) {
    // Strip inline comments and surrounding whitespace/commas
    const commentIdx = rawLine.indexOf('//');
    const line = (commentIdx !== -1 ? rawLine.slice(0, commentIdx) : rawLine)
      .trim()
      .replace(/,$/, '')
      .trim();

    if (!line) continue;

    // Extract function name: last segment after :: (or the whole thing)
    const segments = line.split('::');
    const fnName = segments[segments.length - 1].trim();

    if (fnName && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fnName)) {
      registered.add(fnName);
    }
  }

  return registered;
}

/**
 * Recursively finds all .rs files under a directory.
 *
 * @param {string} dir - Directory to scan
 * @returns {string[]} Array of absolute file paths
 */
function findRustFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findRustFiles(fullPath));
    } else if (entry.endsWith('.rs')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extracts all function names decorated with #[tauri::command] across all .rs files.
 *
 * Handles:
 * - Standard: `#[tauri::command]` immediately before `pub fn` / `pub async fn`
 * - Stacked attrs: `#[tauri::command]` + `#[specta::specta]` + `pub fn`
 *
 * @returns {Map<string, string>} Map of function_name → file_path
 */
function extractCommandFunctions() {
  const rustFiles = findRustFiles(SRC_TAURI_SRC);
  const commands = new Map(); // name → file path

  for (const filePath of rustFiles) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (trimmed.startsWith('#[tauri::command')) {
        // Look ahead through stacked attributes and blank lines to find `pub fn` or `pub async fn`
        let j = i + 1;
        while (j < lines.length) {
          const next = lines[j].trim();

          // Skip stacked attributes (e.g. #[specta::specta], #[allow(...)])
          if (next.startsWith('#[')) {
            j++;
            continue;
          }

          // Found function declaration (pub or non-pub — both valid for #[tauri::command])
          const fnMatch = next.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[(<]/);
          if (fnMatch) {
            const fnName = fnMatch[1];
            const relPath = relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
            commands.set(fnName, relPath);
          }

          break; // Stop looking after first non-attribute line
        }
      }
    }
  }

  return commands;
}

/**
 * Main verification logic.
 */
function main() {
  const startTime = Date.now();

  console.log('🔍 Verifying Tauri command registration...\n');

  const registered = extractRegisteredCommands();
  const commandFunctions = extractCommandFunctions();

  const registeredNames = registered;
  const functionNames = new Set(commandFunctions.keys());

  // Compute mismatches
  const unregistered = [...functionNames].filter((name) => !registeredNames.has(name));
  const orphaned = [...registeredNames].filter((name) => !functionNames.has(name));

  const elapsed = Date.now() - startTime;

  console.log(`📊 Results:`);
  console.log(`   #[tauri::command] functions found: ${functionNames.size}`);
  console.log(`   Commands in invoke_handler!:       ${registeredNames.size}`);
  console.log(`   Elapsed: ${elapsed}ms\n`);

  let hasErrors = false;

  if (unregistered.length > 0) {
    hasErrors = true;
    console.error(`❌ UNREGISTERED COMMANDS: ${unregistered.join(', ')}`);
    console.error(
      '   These functions have #[tauri::command] but are NOT in invoke_handler!'
    );
    console.error('   Fix: Add them to the invoke_handler![ ... ] block in src-tauri/src/lib.rs\n');
    for (const name of unregistered) {
      console.error(`   - ${name}  (${commandFunctions.get(name)})`);
    }
    console.error('');
  }

  if (orphaned.length > 0) {
    hasErrors = true;
    console.error(`❌ ORPHANED REGISTRATIONS: ${orphaned.join(', ')}`);
    console.error(
      '   These names are in invoke_handler! but have no #[tauri::command] function'
    );
    console.error('   Fix: Remove them from invoke_handler![ ... ] or add the missing function\n');
    for (const name of orphaned) {
      console.error(`   - ${name}`);
    }
    console.error('');
  }

  if (!hasErrors) {
    console.log(`✅ All ${functionNames.size} commands are correctly registered. No mismatches found.`);
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
