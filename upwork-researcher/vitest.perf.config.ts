import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for performance benchmarks
 * Separate from unit tests to avoid running expensive benchmarks in regular test runs
 */
export default defineConfig({
  test: {
    include: ['tests/performance/**/*.bench.ts'],
    exclude: ['tests/performance/helpers/**'],
    testTimeout: 120_000, // 2 minutes per test (for multiple iterations)
    hookTimeout: 30_000, // 30 seconds for setup/teardown
    reporters: ['verbose', 'json'],
    outputFile: 'test-results/perf-results.json',
  },
});
