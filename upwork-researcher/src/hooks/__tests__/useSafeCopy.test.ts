import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useSafeCopy } from "../useSafeCopy";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockWriteText = vi.mocked(writeText);
const mockInvoke = vi.mocked(invoke);

describe("useSafeCopy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default: safe perplexity score (below threshold)
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 120.0,
          threshold: 180,
          flaggedSentences: [],
        });
      }
      return Promise.resolve(null);
    });

    mockWriteText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("triggerCopy", () => {
    it("copies text when analysis score is below threshold", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(mockInvoke).toHaveBeenCalledWith("get_safety_threshold");
      expect(mockInvoke).toHaveBeenCalledWith("analyze_perplexity", {
        text: "Test proposal",
        threshold: 180,
      });
      expect(mockWriteText).toHaveBeenCalledWith("Test proposal");
      expect(result.current.state.copied).toBe(true);
      expect(result.current.state.showWarningModal).toBe(false);
    });

    it("sets copied=false after 2 seconds", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(result.current.state.copied).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.state.copied).toBe(false);
    });

    it("shows warning modal when score >= threshold", async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === "get_safety_threshold") {
          return Promise.resolve(180);
        }
        if (command === "analyze_perplexity") {
          return Promise.resolve({
            score: 195.5,
            threshold: 180,
            flaggedSentences: [
              {
                text: "I am delighted to delve.",
                suggestion: "Replace with 'excited to work on'",
                index: 0,
              },
            ],
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(result.current.state.showWarningModal).toBe(true);
      expect(result.current.state.analysisResult).toEqual({
        score: 195.5,
        threshold: 180,
        flaggedSentences: [
          {
            text: "I am delighted to delve.",
            suggestion: "Replace with 'excited to work on'",
            index: 0,
          },
        ],
      });
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    it("copies text on analysis failure (graceful degradation)", async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === "get_safety_threshold") {
          return Promise.resolve(180);
        }
        if (command === "analyze_perplexity") {
          return Promise.reject(new Error("API timeout"));
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(mockWriteText).toHaveBeenCalledWith("Test proposal");
      expect(result.current.state.copied).toBe(true);
    });

    it("uses default threshold 180 when get_safety_threshold fails", async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === "get_safety_threshold") {
          return Promise.reject(new Error("Database error"));
        }
        if (command === "analyze_perplexity") {
          return Promise.resolve({
            score: 120,
            threshold: 180,
            flaggedSentences: [],
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(mockInvoke).toHaveBeenCalledWith("analyze_perplexity", {
        text: "Test proposal",
        threshold: 180,
      });
    });

    it("does nothing when text is empty", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("");
      });

      expect(mockInvoke).not.toHaveBeenCalled();
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    it("sets error when clipboard write fails", async () => {
      mockWriteText.mockRejectedValueOnce(new Error("Clipboard denied"));

      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(result.current.state.error).toBe("Failed to copy to clipboard");
    });
  });

  describe("dismissWarning", () => {
    it("closes warning modal and clears analysis result", async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === "get_safety_threshold") {
          return Promise.resolve(180);
        }
        if (command === "analyze_perplexity") {
          return Promise.resolve({
            score: 200,
            threshold: 180,
            flaggedSentences: [],
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(result.current.state.showWarningModal).toBe(true);

      act(() => {
        result.current.actions.dismissWarning();
      });

      expect(result.current.state.showWarningModal).toBe(false);
      expect(result.current.state.analysisResult).toBe(null);
    });
  });

  describe("override flow", () => {
    beforeEach(() => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === "get_safety_threshold") {
          return Promise.resolve(180);
        }
        if (command === "analyze_perplexity") {
          return Promise.resolve({
            score: 200,
            threshold: 180,
            flaggedSentences: [{ text: "Risky", suggestion: "Fix", index: 0 }],
          });
        }
        if (command === "record_safety_override") {
          return Promise.resolve(1);
        }
        return Promise.resolve(null);
      });
    });

    it("showOverrideDialog hides warning modal and shows override confirm", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(result.current.state.showWarningModal).toBe(true);

      act(() => {
        result.current.actions.showOverrideDialog();
      });

      expect(result.current.state.showWarningModal).toBe(false);
      expect(result.current.state.showOverrideConfirm).toBe(true);
    });

    it("cancelOverride returns to warning modal", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      act(() => {
        result.current.actions.showOverrideDialog();
      });

      expect(result.current.state.showOverrideConfirm).toBe(true);

      act(() => {
        result.current.actions.cancelOverride();
      });

      expect(result.current.state.showOverrideConfirm).toBe(false);
      expect(result.current.state.showWarningModal).toBe(true);
    });

    it("confirmOverride copies text and records override", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      act(() => {
        result.current.actions.showOverrideDialog();
      });

      await act(async () => {
        await result.current.actions.confirmOverride("Test proposal", 42);
      });

      expect(mockWriteText).toHaveBeenCalledWith("Test proposal");
      expect(mockInvoke).toHaveBeenCalledWith("record_safety_override", {
        proposalId: 42,
        aiScore: 200,
        threshold: 180,
      });
      expect(result.current.state.copied).toBe(true);
      expect(result.current.state.showOverrideConfirm).toBe(false);
    });

    it("confirmOverride queues pending override when proposalId is null", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      act(() => {
        result.current.actions.showOverrideDialog();
      });

      await act(async () => {
        await result.current.actions.confirmOverride("Test proposal", null);
      });

      expect(mockWriteText).toHaveBeenCalledWith("Test proposal");
      // record_safety_override should not be called yet
      expect(mockInvoke).not.toHaveBeenCalledWith("record_safety_override", expect.anything());
      expect(result.current.state.copied).toBe(true);
      // Pending override should be stored
      expect(result.current.state.pendingOverride).toEqual({
        aiScore: 200,
        threshold: 180,
      });
    });

    it("flushPendingOverride records the queued override", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      act(() => {
        result.current.actions.showOverrideDialog();
      });

      await act(async () => {
        await result.current.actions.confirmOverride("Test proposal", null);
      });

      expect(result.current.state.pendingOverride).not.toBe(null);

      await act(async () => {
        await result.current.actions.flushPendingOverride(99);
      });

      expect(mockInvoke).toHaveBeenCalledWith("record_safety_override", {
        proposalId: 99,
        aiScore: 200,
        threshold: 180,
      });
      expect(result.current.state.pendingOverride).toBe(null);
    });

    it("flushPendingOverride does nothing when no pending override", async () => {
      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.flushPendingOverride(99);
      });

      expect(mockInvoke).not.toHaveBeenCalledWith("record_safety_override", expect.anything());
    });
  });

  describe("reset", () => {
    it("clears all state", async () => {
      mockInvoke.mockImplementation((command: string) => {
        if (command === "get_safety_threshold") {
          return Promise.resolve(180);
        }
        if (command === "analyze_perplexity") {
          return Promise.resolve({
            score: 200,
            threshold: 180,
            flaggedSentences: [],
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSafeCopy());

      await act(async () => {
        await result.current.actions.triggerCopy("Test proposal");
      });

      expect(result.current.state.showWarningModal).toBe(true);

      act(() => {
        result.current.actions.reset();
      });

      expect(result.current.state.analyzing).toBe(false);
      expect(result.current.state.copied).toBe(false);
      expect(result.current.state.error).toBe(null);
      expect(result.current.state.showWarningModal).toBe(false);
      expect(result.current.state.showOverrideConfirm).toBe(false);
      expect(result.current.state.analysisResult).toBe(null);
      expect(result.current.state.pendingOverride).toBe(null);
    });
  });
});
