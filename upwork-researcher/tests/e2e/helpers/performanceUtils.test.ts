/**
 * Tests for performance utilities
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  PerformanceTimer,
  measureAsync,
  assertPerformanceThreshold,
  validatePerformanceMetrics,
  PERFORMANCE_THRESHOLDS,
} from "./performanceUtils";

describe("PerformanceTimer", () => {
  let timer: PerformanceTimer;

  beforeEach(() => {
    timer = new PerformanceTimer();
  });

  it("should track elapsed time", () => {
    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it("should mark specific points in time", () => {
    timer.mark("test-mark");
    const mark = timer.getMark("test-mark");
    expect(mark).toBeDefined();
    expect(mark).toBeGreaterThanOrEqual(0);
  });

  it("should return undefined for non-existent marks", () => {
    const mark = timer.getMark("non-existent");
    expect(mark).toBeUndefined();
  });

  it("should get all marks", () => {
    timer.mark("mark1");
    timer.mark("mark2");
    const marks = timer.getAllMarks();
    expect(marks.size).toBe(2);
    expect(marks.has("mark1")).toBe(true);
    expect(marks.has("mark2")).toBe(true);
  });

  it("should reset timer and clear marks", () => {
    timer.mark("test");
    timer.reset();
    expect(timer.getMark("test")).toBeUndefined();
    expect(timer.getAllMarks().size).toBe(0);
  });
});

describe("measureAsync", () => {
  it("should measure async operation duration", async () => {
    const operation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return "result";
    };

    const { result, duration } = await measureAsync(operation, "test-operation");

    expect(result).toBe("result");
    expect(duration).toBeGreaterThanOrEqual(50);
    expect(duration).toBeLessThan(100); // Allow some margin
  });

  it("should handle operation errors", async () => {
    const operation = async () => {
      throw new Error("Test error");
    };

    await expect(measureAsync(operation, "failing-operation")).rejects.toThrow("Test error");
  });
});

describe("assertPerformanceThreshold", () => {
  it("should pass when under threshold", () => {
    expect(() => {
      assertPerformanceThreshold(50, 100, "test-metric");
    }).not.toThrow();
  });

  it("should throw when exceeding threshold", () => {
    expect(() => {
      assertPerformanceThreshold(150, 100, "test-metric");
    }).toThrow("Performance threshold exceeded");
  });

  it("should pass when equal to threshold", () => {
    expect(() => {
      assertPerformanceThreshold(100, 100, "test-metric");
    }).not.toThrow();
  });
});

describe("validatePerformanceMetrics", () => {
  it("should pass when all metrics under thresholds", () => {
    const metrics = {
      coldStart: 1500,
      firstToken: 1000,
      fullGeneration: 6000,
      clipboardCopy: 50,
    };

    const result = validatePerformanceMetrics(metrics);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("should fail when cold start exceeds threshold", () => {
    const metrics = {
      coldStart: 3000, // > 2000ms threshold
    };

    const result = validatePerformanceMetrics(metrics);

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("Cold start");
  });

  it("should fail when first token exceeds threshold", () => {
    const metrics = {
      firstToken: 2000, // > 1500ms threshold
    };

    const result = validatePerformanceMetrics(metrics);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain("First token: 2000ms > 1500ms");
  });

  it("should fail when full generation exceeds threshold", () => {
    const metrics = {
      fullGeneration: 10000, // > 8000ms threshold
    };

    const result = validatePerformanceMetrics(metrics);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain("Full generation: 10000ms > 8000ms");
  });

  it("should fail when clipboard copy exceeds threshold", () => {
    const metrics = {
      clipboardCopy: 150, // > 100ms threshold
    };

    const result = validatePerformanceMetrics(metrics);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain("Clipboard copy: 150ms > 100ms");
  });

  it("should report multiple failures", () => {
    const metrics = {
      coldStart: 3000,
      firstToken: 2000,
      fullGeneration: 10000,
    };

    const result = validatePerformanceMetrics(metrics);

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(3);
  });

  it("should pass with partial metrics", () => {
    const metrics = {
      coldStart: 1500, // Under threshold
      // Other metrics undefined
    };

    const result = validatePerformanceMetrics(metrics);

    expect(result.passed).toBe(true);
  });
});

describe("PERFORMANCE_THRESHOLDS", () => {
  it("should have correct NFR values", () => {
    expect(PERFORMANCE_THRESHOLDS.COLD_START_MS).toBe(2000);
    expect(PERFORMANCE_THRESHOLDS.UI_RESPONSE_MS).toBe(100);
    expect(PERFORMANCE_THRESHOLDS.FIRST_TOKEN_MS).toBe(1500);
    expect(PERFORMANCE_THRESHOLDS.FULL_GENERATION_MS).toBe(8000);
  });
});
