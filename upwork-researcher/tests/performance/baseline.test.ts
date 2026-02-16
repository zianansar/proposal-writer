// Tests for baseline regression detection

import * as fs from "fs";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { checkRegression } from "./baseline";

describe("baseline utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: loadBaseline and updateBaseline test file I/O which is tested manually
  // Focus on testing the regression detection logic

  describe("checkRegression", () => {
    it("does not throw when no baseline exists for metric", () => {
      // Current baseline.json has empty results, so this should not throw
      expect(() => checkRegression("New Test", 500)).not.toThrow();
    });

    it("regression check requires baseline values", () => {
      // Testing with actual baseline.json (empty results)
      // No assertions will be made since no baseline exists
      const consoleSpy = vi.spyOn(console, "log");

      checkRegression("Nonexistent Metric", 1000);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No baseline for Nonexistent Metric"),
      );

      consoleSpy.mockRestore();
    });
  });

  // updateBaseline is tested manually via npm run test:perf:update-baseline
});
