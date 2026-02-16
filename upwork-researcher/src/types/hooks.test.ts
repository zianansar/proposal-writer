import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { parseExamples, parseHookStrategy, HookStrategy } from "./hooks";

describe("hooks types", () => {
  // M3 Code Review Fix: Mock console.error to silence expected error logs
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  describe("parseExamples", () => {
    it("should parse valid JSON array", () => {
      // Story 5.2: Subtask 2.3
      const json = '["Example 1", "Example 2", "Example 3"]';
      const result = parseExamples(json);

      expect(result).toEqual(["Example 1", "Example 2", "Example 3"]);
      expect(result.length).toBe(3);
    });

    it("should return empty array for invalid JSON", () => {
      // Story 5.2: Subtask 2.3 - Error handling
      const json = "not valid json";
      const result = parseExamples(json);

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled(); // Verify error was logged
    });

    it("should return empty array if JSON is not an array", () => {
      // Story 5.2: Subtask 2.3 - Type validation
      const json = '{"not": "an array"}';
      const result = parseExamples(json);

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled(); // Verify error was logged
    });

    it("should handle empty array", () => {
      // Edge case: empty examples_json
      const json = "[]";
      const result = parseExamples(json);

      expect(result).toEqual([]);
    });
  });

  describe("parseHookStrategy", () => {
    const mockStrategy: HookStrategy = {
      id: 1,
      name: "Social Proof",
      description: "Lead with relevant experience",
      examples_json: '["Example 1", "Example 2"]',
      best_for: "Experienced freelancers",
      created_at: "2026-02-09T00:00:00Z",
    };

    it("should parse strategy and extract first example", () => {
      // Story 5.2: Subtask 2.4
      const result = parseHookStrategy(mockStrategy);

      expect(result.id).toBe(1);
      expect(result.name).toBe("Social Proof");
      expect(result.description).toBe("Lead with relevant experience");
      expect(result.best_for).toBe("Experienced freelancers");
      expect(result.created_at).toBe("2026-02-09T00:00:00Z");
      expect(result.firstExample).toBe("Example 1");
      expect(result.allExamples).toEqual(["Example 1", "Example 2"]);
    });

    it("should handle strategy with no examples", () => {
      // Story 5.2: Subtask 2.4 - Error handling
      const emptyStrategy: HookStrategy = {
        ...mockStrategy,
        examples_json: "[]",
      };

      const result = parseHookStrategy(emptyStrategy);

      expect(result.firstExample).toBe("No example available");
      expect(result.allExamples).toEqual([]);
    });

    it("should handle strategy with invalid examples_json", () => {
      // Story 5.2: Subtask 2.4 - Error handling
      const invalidStrategy: HookStrategy = {
        ...mockStrategy,
        examples_json: "invalid json",
      };

      const result = parseHookStrategy(invalidStrategy);

      expect(result.firstExample).toBe("No example available");
      expect(result.allExamples).toEqual([]);
    });

    it("should handle strategy with single example", () => {
      // Edge case: only one example
      const singleStrategy: HookStrategy = {
        ...mockStrategy,
        examples_json: '["Only Example"]',
      };

      const result = parseHookStrategy(singleStrategy);

      expect(result.firstExample).toBe("Only Example");
      expect(result.allExamples).toEqual(["Only Example"]);
    });

    it("should handle strategy with three examples", () => {
      // Story 5.1: AC-3 specifies 2-3 examples
      const threeExamplesStrategy: HookStrategy = {
        ...mockStrategy,
        examples_json: '["Ex 1", "Ex 2", "Ex 3"]',
      };

      const result = parseHookStrategy(threeExamplesStrategy);

      expect(result.firstExample).toBe("Ex 1");
      expect(result.allExamples).toEqual(["Ex 1", "Ex 2", "Ex 3"]);
      expect(result.allExamples.length).toBe(3);
    });
  });
});
