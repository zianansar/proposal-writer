import { describe, it, expect, beforeEach } from "vitest";

import { useGenerationStore, getStreamedText, getStages } from "./useGenerationStore";

describe("useGenerationStore", () => {
  beforeEach(() => {
    // Reset store before each test
    useGenerationStore.getState().reset();
  });

  describe("initial state", () => {
    it("has empty tokens array", () => {
      expect(useGenerationStore.getState().tokens).toEqual([]);
    });

    it("is not streaming", () => {
      expect(useGenerationStore.getState().isStreaming).toBe(false);
    });

    it("has no error", () => {
      expect(useGenerationStore.getState().error).toBeNull();
    });

    it("has no full text", () => {
      expect(useGenerationStore.getState().fullText).toBeNull();
    });

    it("is not saved", () => {
      expect(useGenerationStore.getState().isSaved).toBe(false);
    });

    it("has no saved id", () => {
      expect(useGenerationStore.getState().savedId).toBeNull();
    });

    // Story 4a.9 H3: Initial state test
    it("has generationWasTruncated as false", () => {
      expect(useGenerationStore.getState().generationWasTruncated).toBe(false);
    });
  });

  describe("appendTokens", () => {
    it("appends single token batch", () => {
      useGenerationStore.getState().appendTokens(["Hello"]);
      expect(useGenerationStore.getState().tokens).toEqual(["Hello"]);
    });

    it("appends multiple tokens in a batch", () => {
      useGenerationStore.getState().appendTokens(["Hello", " ", "world"]);
      expect(useGenerationStore.getState().tokens).toEqual(["Hello", " ", "world"]);
    });

    it("accumulates tokens across multiple appends", () => {
      useGenerationStore.getState().appendTokens(["First"]);
      useGenerationStore.getState().appendTokens([" batch"]);
      useGenerationStore.getState().appendTokens(["!"]);
      expect(useGenerationStore.getState().tokens).toEqual(["First", " batch", "!"]);
    });
  });

  describe("setStreaming", () => {
    it("sets streaming to true", () => {
      useGenerationStore.getState().setStreaming(true);
      expect(useGenerationStore.getState().isStreaming).toBe(true);
    });

    it("sets streaming to false", () => {
      useGenerationStore.getState().setStreaming(true);
      useGenerationStore.getState().setStreaming(false);
      expect(useGenerationStore.getState().isStreaming).toBe(false);
    });

    it("clears error when starting new stream", () => {
      useGenerationStore.getState().setError("Previous error");
      useGenerationStore.getState().setStreaming(true);
      expect(useGenerationStore.getState().error).toBeNull();
    });
  });

  describe("setError", () => {
    it("sets error message", () => {
      useGenerationStore.getState().setError("API error occurred");
      expect(useGenerationStore.getState().error).toBe("API error occurred");
    });

    it("sets streaming to false", () => {
      useGenerationStore.getState().setStreaming(true);
      useGenerationStore.getState().setError("Error");
      expect(useGenerationStore.getState().isStreaming).toBe(false);
    });

    it("preserves tokens (partial result)", () => {
      useGenerationStore.getState().appendTokens(["Partial", " content"]);
      useGenerationStore.getState().setError("Mid-stream error");
      expect(useGenerationStore.getState().tokens).toEqual(["Partial", " content"]);
    });
  });

  describe("setComplete", () => {
    it("sets full text", () => {
      useGenerationStore.getState().setComplete("Complete proposal");
      expect(useGenerationStore.getState().fullText).toBe("Complete proposal");
    });

    it("sets streaming to false", () => {
      useGenerationStore.getState().setStreaming(true);
      useGenerationStore.getState().setComplete("Done");
      expect(useGenerationStore.getState().isStreaming).toBe(false);
    });

    // Story 4a.9 H3: Truncation flag tests
    it("sets generationWasTruncated to false by default", () => {
      useGenerationStore.getState().setComplete("Complete proposal");
      expect(useGenerationStore.getState().generationWasTruncated).toBe(false);
    });

    it("sets generationWasTruncated to true when passed", () => {
      useGenerationStore.getState().setComplete("Complete proposal", true);
      expect(useGenerationStore.getState().generationWasTruncated).toBe(true);
    });

    it("sets generationWasTruncated to false when explicitly passed", () => {
      // First set it to true
      useGenerationStore.getState().setComplete("First", true);
      expect(useGenerationStore.getState().generationWasTruncated).toBe(true);

      // Then set it to false explicitly
      useGenerationStore.getState().setComplete("Second", false);
      expect(useGenerationStore.getState().generationWasTruncated).toBe(false);
    });
  });

  describe("setSaved", () => {
    it("sets isSaved to true and stores id", () => {
      useGenerationStore.getState().setSaved(42);
      expect(useGenerationStore.getState().isSaved).toBe(true);
      expect(useGenerationStore.getState().savedId).toBe(42);
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", () => {
      // Set up some state
      useGenerationStore.getState().appendTokens(["Some", " tokens"]);
      useGenerationStore.getState().setStreaming(true);
      useGenerationStore.getState().setError("An error");
      useGenerationStore.getState().setComplete("Full text", true); // With truncation
      useGenerationStore.getState().setSaved(123);

      // Reset
      useGenerationStore.getState().reset();

      const state = useGenerationStore.getState();
      expect(state.tokens).toEqual([]);
      expect(state.isStreaming).toBe(false);
      expect(state.error).toBeNull();
      expect(state.fullText).toBeNull();
      expect(state.isSaved).toBe(false);
      expect(state.savedId).toBeNull();
      expect(state.generationWasTruncated).toBe(false); // Story 4a.9 H3
    });
  });

  describe("getStreamedText selector", () => {
    it("returns empty string for no tokens", () => {
      expect(getStreamedText(useGenerationStore.getState())).toBe("");
    });

    it("concatenates all tokens", () => {
      useGenerationStore.getState().appendTokens(["Hello", " ", "world", "!"]);
      expect(getStreamedText(useGenerationStore.getState())).toBe("Hello world!");
    });
  });

  // =========================================================================
  // Story 3.8: Cooldown state tests
  // =========================================================================

  describe("cooldown state (Story 3.8)", () => {
    it("has no cooldown initially", () => {
      expect(useGenerationStore.getState().cooldownEnd).toBeNull();
      expect(useGenerationStore.getState().cooldownRemaining).toBe(0);
    });

    // Story 3.8, Task 7.10: Test setCooldown sets correct cooldownEnd timestamp
    it("setCooldown sets cooldownEnd and cooldownRemaining", () => {
      const now = Date.now();
      useGenerationStore.getState().setCooldown(120000); // 2 minutes

      const state = useGenerationStore.getState();
      expect(state.cooldownEnd).toBeGreaterThanOrEqual(now + 120000);
      expect(state.cooldownEnd).toBeLessThanOrEqual(now + 121000); // Allow 1s tolerance
      expect(state.cooldownRemaining).toBe(120);
    });

    it("clearCooldown resets cooldown state", () => {
      useGenerationStore.getState().setCooldown(60000);
      useGenerationStore.getState().clearCooldown();

      expect(useGenerationStore.getState().cooldownEnd).toBeNull();
      expect(useGenerationStore.getState().cooldownRemaining).toBe(0);
    });

    // Story 3.8, Task 7.11: Test tickCooldown decrements cooldownRemaining
    it("tickCooldown decrements cooldownRemaining", () => {
      // Set cooldown to 30 seconds from now
      const thirtySecondsFromNow = Date.now() + 30000;
      useGenerationStore.setState({ cooldownEnd: thirtySecondsFromNow, cooldownRemaining: 30 });

      // Tick should recalculate based on current time
      useGenerationStore.getState().tickCooldown();

      // Should be approximately 30 seconds (within 1 second)
      const remaining = useGenerationStore.getState().cooldownRemaining;
      expect(remaining).toBeGreaterThanOrEqual(29);
      expect(remaining).toBeLessThanOrEqual(30);
    });

    it("tickCooldown returns 0 when cooldown expired", () => {
      // Set cooldownEnd to 1 second ago (expired)
      const oneSecondAgo = Date.now() - 1000;
      useGenerationStore.setState({ cooldownEnd: oneSecondAgo, cooldownRemaining: 10 });

      useGenerationStore.getState().tickCooldown();

      expect(useGenerationStore.getState().cooldownRemaining).toBe(0);
    });

    it("tickCooldown returns 0 when no cooldown active", () => {
      useGenerationStore.setState({ cooldownEnd: null, cooldownRemaining: 0 });

      useGenerationStore.getState().tickCooldown();

      expect(useGenerationStore.getState().cooldownRemaining).toBe(0);
    });

    it("reset clears cooldown state", () => {
      useGenerationStore.getState().setCooldown(60000);
      useGenerationStore.getState().reset();

      expect(useGenerationStore.getState().cooldownEnd).toBeNull();
      expect(useGenerationStore.getState().cooldownRemaining).toBe(0);
    });
  });

  // Story 8.4: Stage tracking tests
  describe("stage tracking", () => {
    it("initial state has no current stage", () => {
      expect(useGenerationStore.getState().currentStage).toBeNull();
    });

    it("initial state has empty stage history", () => {
      expect(useGenerationStore.getState().stageHistory).toEqual([]);
    });

    it("setStage creates new record for new stage", () => {
      useGenerationStore.getState().setStage("preparing", "active");

      const state = useGenerationStore.getState();
      expect(state.currentStage).toBe("preparing");
      expect(state.stageHistory).toHaveLength(1);
      expect(state.stageHistory[0].id).toBe("preparing");
      expect(state.stageHistory[0].status).toBe("active");
      expect(state.stageHistory[0].startedAt).toBeGreaterThan(0);
    });

    it("setStage completes previous active stage when new stage starts", () => {
      useGenerationStore.getState().setStage("preparing", "active");

      // Small delay to ensure different timestamps
      const prepareStartTime = useGenerationStore.getState().stageHistory[0].startedAt;

      // Start next stage
      useGenerationStore.getState().setStage("generating", "active");

      const state = useGenerationStore.getState();
      expect(state.currentStage).toBe("generating");
      expect(state.stageHistory).toHaveLength(2);

      // Previous stage should be marked complete
      expect(state.stageHistory[0].status).toBe("complete");
      expect(state.stageHistory[0].completedAt).toBeGreaterThanOrEqual(prepareStartTime);
      expect(state.stageHistory[0].durationMs).toBeGreaterThanOrEqual(0);

      // New stage should be active
      expect(state.stageHistory[1].id).toBe("generating");
      expect(state.stageHistory[1].status).toBe("active");
    });

    it("setStage calculates duration when stage completes", () => {
      useGenerationStore.getState().setStage("preparing", "active");
      const startTime = useGenerationStore.getState().stageHistory[0].startedAt;

      // Complete the stage
      useGenerationStore.getState().setStage("preparing", "complete");

      const state = useGenerationStore.getState();
      expect(state.currentStage).toBeNull();
      expect(state.stageHistory[0].status).toBe("complete");
      expect(state.stageHistory[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(state.stageHistory[0].completedAt).toBeGreaterThanOrEqual(startTime);
    });

    it("setStage handles error status with message", () => {
      useGenerationStore.getState().setStage("generating", "active");
      useGenerationStore.getState().setStage("generating", "error", "API timeout");

      const state = useGenerationStore.getState();
      expect(state.currentStage).toBeNull();
      expect(state.stageHistory[0].status).toBe("error");
      expect(state.stageHistory[0].error).toBe("API timeout");
    });

    it("reset clears stage state", () => {
      useGenerationStore.getState().setStage("preparing", "active");
      useGenerationStore.getState().setStage("generating", "active");
      useGenerationStore.getState().reset();

      const state = useGenerationStore.getState();
      expect(state.currentStage).toBeNull();
      expect(state.stageHistory).toEqual([]);
    });

    it("getStages returns pipeline stages with status", () => {
      useGenerationStore.getState().setStage("preparing", "active");
      useGenerationStore.getState().setStage("generating", "active");

      const state = useGenerationStore.getState();
      const stages = getStages(state);

      expect(stages).toHaveLength(2);
      expect(stages[0].id).toBe("preparing");
      expect(stages[0].status).toBe("complete");
      expect(stages[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(stages[1].id).toBe("generating");
      expect(stages[1].status).toBe("active");
    });
  });
});
