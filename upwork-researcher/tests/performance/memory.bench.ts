// Memory usage benchmarks (NFR-2)
// Validates RAM consumption stays under thresholds
//
// NOTE: These tests require the actual Tauri runtime to be running because
// they call Rust commands (get_memory_usage) via invoke(). They also need
// the full app UI for interactions like loading proposal history and scrolling.
// Skipped until Story 8.9 (E2E Test Suite) provides the Playwright + Tauri
// integration harness needed to run these benchmarks against a live app.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NFR_THRESHOLDS, BENCHMARK_CONFIG } from './config';
import { getMemoryUsage, bytesToMB } from './helpers/memory';
import { seedDatabase, clearDatabase } from './helpers/dbSeeder';

// Mock @tauri-apps/api/core since invoke() is not available in Vitest/Node.
// These benchmarks need the actual Tauri runtime to produce meaningful results.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockRejectedValue(
    new Error('Tauri invoke() not available in Vitest - requires Tauri runtime')
  ),
}));

describe.skip('NFR-2: Memory Usage', () => {
  // Skipped: Requires Tauri runtime + running app for meaningful memory measurement.
  // The memory helpers (getMemoryUsage) call invoke('get_memory_usage') which needs
  // the Rust backend. The interaction tests need Playwright for UI operations.

  beforeAll(async () => {
    await clearDatabase();
  });

  it('stays under 200MB at idle', async () => {
    const snapshot = await getMemoryUsage();
    const memoryMB = bytesToMB(snapshot.rssBytes);

    console.log(`[PERF] Idle Memory: ${memoryMB.toFixed(1)}MB`);

    expect(memoryMB).toBeLessThan(NFR_THRESHOLDS.MEMORY_IDLE_MB);
  });

  it('stays under 300MB after loading 500 proposals', async () => {
    await seedDatabase({ proposals: BENCHMARK_CONFIG.SEED_PROPOSAL_COUNT });

    // TODO: Requires Playwright integration from Story 8.9
    // Need to navigate to proposal history view to trigger data loading.
    // Implementation: await page.goto('/history') or equivalent navigation
    // that triggers the loadProposalHistory Tauri command.

    const snapshot = await getMemoryUsage();
    const memoryMB = bytesToMB(snapshot.rssBytes);

    console.log(`[PERF] Memory after 500 proposals: ${memoryMB.toFixed(1)}MB`);

    expect(memoryMB).toBeLessThan(NFR_THRESHOLDS.MEMORY_PEAK_MB);
  });

  it('does not leak memory during scrolling', async () => {
    // TODO: Requires Playwright integration from Story 8.9
    // Need scrollToBottom() and scrollToTop() helpers that interact with
    // the actual app UI via Playwright. These should scroll the proposal
    // history list and be implemented as part of the E2E test utilities.
    //
    // Example implementation when Playwright is available:
    //   async function scrollToBottom() {
    //     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    //     await page.waitForTimeout(100);
    //   }
    //   async function scrollToTop() {
    //     await page.evaluate(() => window.scrollTo(0, 0));
    //     await page.waitForTimeout(100);
    //   }

    // Placeholder: measureMemoryDelta needs real app interaction
    console.log('[PERF] Memory leak test requires Playwright E2E harness (Story 8.9)');
    expect(true).toBe(true); // Placeholder assertion
  });

  it('measures baseline memory usage', async () => {
    const snapshot = await getMemoryUsage();
    const memoryMB = bytesToMB(snapshot.rssBytes);

    // Document baseline memory for monitoring
    console.log(`[PERF] Current RSS: ${memoryMB.toFixed(1)}MB`);
    console.log(`[PERF] JS Heap: ${bytesToMB(snapshot.heapUsedBytes).toFixed(1)}MB`);

    // Memory should be reasonable
    expect(memoryMB).toBeGreaterThan(0);
    expect(memoryMB).toBeLessThan(1000); // Sanity check
  });
});
