// Timing measurement utilities for performance benchmarks

export interface TimingResult {
  name: string;
  durationMs: number;
  threshold: number;
  passed: boolean;
  iterations: number[];
}

/**
 * Measures execution time of an async function with multiple iterations
 * @param name - Human-readable name for the benchmark
 * @param fn - Async function to measure
 * @param threshold - Maximum allowed duration in milliseconds
 * @param iterations - Number of times to run (default: 5)
 * @returns TimingResult with median duration and pass/fail status
 */
export async function measureTiming(
  name: string,
  fn: () => Promise<void>,
  threshold: number,
  iterations: number = 5,
): Promise<TimingResult> {
  const timings: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings.push(end - start);
  }

  // Use median for robustness to outliers
  const sorted = [...timings].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const passed = median <= threshold;

  console.log(
    `[PERF] ${name}: ${median.toFixed(1)}ms ${passed ? "✓" : "✗"} (threshold: ${threshold}ms)`,
  );

  return {
    name,
    durationMs: median,
    threshold,
    passed,
    iterations: timings,
  };
}

/**
 * Asserts that a timing result passed its threshold
 * Throws detailed error if threshold was exceeded
 */
export function assertTiming(result: TimingResult): void {
  if (!result.passed) {
    throw new Error(
      `Performance threshold exceeded: ${result.name} took ${result.durationMs.toFixed(1)}ms (threshold: ${result.threshold}ms)`,
    );
  }
}
