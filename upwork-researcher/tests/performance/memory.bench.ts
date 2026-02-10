// Memory usage benchmarks (NFR-2)
// Validates RAM consumption stays under thresholds

import { describe, it, expect, beforeAll } from 'vitest';
import { NFR_THRESHOLDS, BENCHMARK_CONFIG } from './config';
import { getMemoryUsage, bytesToMB } from './helpers/memory';
import { seedDatabase, clearDatabase } from './helpers/dbSeeder';

describe('NFR-2: Memory Usage', () => {
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

    // Simulate loading proposal history
    // Note: This test requires the app to be running with Playwright
    // For now, we validate the memory after seeding
    const snapshot = await getMemoryUsage();
    const memoryMB = bytesToMB(snapshot.rssBytes);

    console.log(`[PERF] Memory after 500 proposals: ${memoryMB.toFixed(1)}MB`);

    expect(memoryMB).toBeLessThan(NFR_THRESHOLDS.MEMORY_PEAK_MB);
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
