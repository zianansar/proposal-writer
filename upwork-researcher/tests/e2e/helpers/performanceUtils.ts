/**
 * Performance measurement utilities for E2E tests
 *
 * Tracks timing metrics and validates against NFR thresholds:
 * - NFR-1: Cold start <2s
 * - NFR-4: UI response <100ms
 * - NFR-5: First token <1.5s
 * - NFR-6: Full generation <8s
 */

/**
 * Performance thresholds from PRD
 */
export const PERFORMANCE_THRESHOLDS = {
  COLD_START_MS: 2000, // NFR-1
  UI_RESPONSE_MS: 100, // NFR-4
  FIRST_TOKEN_MS: 1500, // NFR-5
  FULL_GENERATION_MS: 8000, // NFR-6
} as const;

/**
 * Performance metrics collected during test
 */
export interface PerformanceMetrics {
  coldStart?: number;
  firstToken?: number;
  fullGeneration?: number;
  clipboardCopy?: number;
  [key: string]: number | undefined;
}

/**
 * Timer for tracking elapsed time
 */
export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Mark a specific point in time
   */
  mark(label: string): void {
    const elapsed = Date.now() - this.startTime;
    this.marks.set(label, elapsed);
    console.log(`[Perf] ${label}: ${elapsed}ms`);
  }

  /**
   * Get elapsed time since start
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get time for a specific mark
   */
  getMark(label: string): number | undefined {
    return this.marks.get(label);
  }

  /**
   * Get all marks
   */
  getAllMarks(): Map<string, number> {
    return new Map(this.marks);
  }

  /**
   * Reset timer
   */
  reset(): void {
    this.startTime = Date.now();
    this.marks.clear();
  }
}

/**
 * Measure time for an async operation
 */
export async function measureAsync<T>(
  operation: () => Promise<T>,
  label: string
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await operation();
  const duration = Date.now() - start;

  console.log(`[Perf] ${label}: ${duration}ms`);

  return { result, duration };
}

/**
 * Assert performance threshold
 */
export function assertPerformanceThreshold(
  actualMs: number,
  thresholdMs: number,
  metricName: string
): void {
  if (actualMs > thresholdMs) {
    throw new Error(
      `Performance threshold exceeded for ${metricName}: ${actualMs}ms > ${thresholdMs}ms`
    );
  }

  console.log(`[Perf] ✓ ${metricName}: ${actualMs}ms (threshold: ${thresholdMs}ms)`);
}

/**
 * Log performance metrics summary
 */
export function logPerformanceSummary(metrics: PerformanceMetrics): void {
  console.log('\n=== Performance Summary ===');

  Object.entries(metrics).forEach(([key, value]) => {
    if (value !== undefined) {
      console.log(`  ${key}: ${value}ms`);
    }
  });

  console.log('==========================\n');
}

/**
 * Validate all metrics against thresholds
 */
export function validatePerformanceMetrics(metrics: PerformanceMetrics): {
  passed: boolean;
  failures: string[];
} {
  const failures: string[] = [];

  // NFR-1: Cold start
  if (metrics.coldStart !== undefined && metrics.coldStart > PERFORMANCE_THRESHOLDS.COLD_START_MS) {
    failures.push(
      `Cold start: ${metrics.coldStart}ms > ${PERFORMANCE_THRESHOLDS.COLD_START_MS}ms`
    );
  }

  // NFR-5: First token
  if (
    metrics.firstToken !== undefined &&
    metrics.firstToken > PERFORMANCE_THRESHOLDS.FIRST_TOKEN_MS
  ) {
    failures.push(
      `First token: ${metrics.firstToken}ms > ${PERFORMANCE_THRESHOLDS.FIRST_TOKEN_MS}ms`
    );
  }

  // NFR-6: Full generation
  if (
    metrics.fullGeneration !== undefined &&
    metrics.fullGeneration > PERFORMANCE_THRESHOLDS.FULL_GENERATION_MS
  ) {
    failures.push(
      `Full generation: ${metrics.fullGeneration}ms > ${PERFORMANCE_THRESHOLDS.FULL_GENERATION_MS}ms`
    );
  }

  // NFR-4: Clipboard copy
  if (
    metrics.clipboardCopy !== undefined &&
    metrics.clipboardCopy > PERFORMANCE_THRESHOLDS.UI_RESPONSE_MS
  ) {
    failures.push(
      `Clipboard copy: ${metrics.clipboardCopy}ms > ${PERFORMANCE_THRESHOLDS.UI_RESPONSE_MS}ms`
    );
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
