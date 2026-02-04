import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationStore, getStreamedText } from "./useGenerationStore";

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
      useGenerationStore.getState().setComplete("Full text");
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
});
