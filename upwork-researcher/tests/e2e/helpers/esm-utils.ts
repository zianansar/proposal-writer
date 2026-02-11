/**
 * ES Module utilities for E2E tests
 *
 * Provides shared polyfills for ESM compatibility.
 * Replaces duplicate __dirname polyfills across test files.
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Get __dirname equivalent for ES modules
 * @param importMetaUrl - Pass `import.meta.url` from the calling module
 */
export function getDirname(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}
