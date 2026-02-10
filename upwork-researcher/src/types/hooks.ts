/**
 * Hook strategy types for Story 5.2
 *
 * Hook strategies guide the opening style of proposal generation.
 * Fetched from the database and displayed in a selectable card UI.
 */

/** Hook strategy from Rust backend (Story 5.1) */
export interface HookStrategy {
  id: number;
  name: string;
  description: string;
  /** JSON array as string - use parseExamples() to parse */
  examples_json: string;
  best_for: string;
  created_at: string;
}

/**
 * Parse examples_json string into array of example strings
 *
 * Story 5.2: AC-1 requires displaying ONE example from examples_json array.
 * This helper parses the JSON string and returns the array.
 *
 * @param json - JSON string from HookStrategy.examples_json
 * @returns Array of example strings (typically 2-3 items)
 * @throws Error if JSON is invalid
 */
export function parseExamples(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      if (import.meta.env.DEV) {
        console.error("examples_json is not an array:", json);
      }
      return [];
    }
    return parsed;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Failed to parse examples_json:", json, error);
    }
    return [];
  }
}

/**
 * Parsed hook strategy with first example extracted
 *
 * Story 5.2: AC-1 requires displaying only the FIRST example in card UI.
 * This type provides convenient access to that first example.
 */
export interface ParsedHookStrategy extends Omit<HookStrategy, 'examples_json'> {
  /** First example from examples_json array */
  firstExample: string;
  /** Full array of all examples (2-3 items) */
  allExamples: string[];
}

/**
 * Parse HookStrategy and extract first example for card display
 *
 * Story 5.2: Subtask 2.4
 * Converts raw HookStrategy (with examples_json string) to ParsedHookStrategy
 * with convenient access to first example for UI rendering.
 *
 * @param strategy - Raw hook strategy from database
 * @returns Parsed strategy with firstExample and allExamples
 */
export function parseHookStrategy(strategy: HookStrategy): ParsedHookStrategy {
  const allExamples = parseExamples(strategy.examples_json);
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    best_for: strategy.best_for,
    created_at: strategy.created_at,
    firstExample: allExamples[0] || "No example available",
    allExamples,
  };
}
