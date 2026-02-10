// Baseline management for regression detection

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { BENCHMARK_CONFIG } from './config';

const BASELINE_PATH = resolve(__dirname, 'baseline.json');

export interface Baseline {
  version: string;
  updatedAt: string;
  results: Record<string, number>;
}

/**
 * Loads baseline values from baseline.json
 * Returns empty baseline if file doesn't exist
 */
export function loadBaseline(): Baseline {
  if (!existsSync(BASELINE_PATH)) {
    return {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      results: {},
    };
  }

  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
  } catch (error) {
    console.warn('[PERF] Failed to load baseline, using empty baseline:', error);
    return {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      results: {},
    };
  }
}

/**
 * Checks if current timing represents a performance regression
 * Throws error with detailed message if regression detected
 */
export function checkRegression(name: string, current: number): void {
  const baseline = loadBaseline();
  const expected = baseline.results[name];

  if (expected === undefined) {
    console.log(`[PERF] No baseline for ${name}, skipping regression check`);
    return;
  }

  const tolerance = expected * BENCHMARK_CONFIG.REGRESSION_TOLERANCE;
  const threshold = expected + tolerance;

  if (current > threshold) {
    throw new Error(
      `Regression detected: ${name} took ${current.toFixed(1)}ms ` +
      `(was ${expected.toFixed(1)}ms, threshold ${threshold.toFixed(1)}ms with ${BENCHMARK_CONFIG.REGRESSION_TOLERANCE * 100}% tolerance)`
    );
  }

  console.log(
    `[PERF] ${name}: ${current.toFixed(1)}ms vs baseline ${expected.toFixed(1)}ms (threshold ${threshold.toFixed(1)}ms) ✓`
  );
}

/**
 * Updates baseline values with new results
 * Should only be called intentionally, not automatically
 */
export function updateBaseline(results: Record<string, number>): void {
  const baseline: Baseline = {
    version: process.env.npm_package_version ?? '0.0.0',
    updatedAt: new Date().toISOString(),
    results,
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`[PERF] Baseline updated at ${baseline.updatedAt}`);
  console.log('[PERF] Updated values:', results);
}
