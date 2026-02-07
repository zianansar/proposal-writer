import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useRehumanization } from "./useRehumanization";

const mockInvoke = vi.mocked(invoke);

describe("useRehumanization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Initial state --

  it("returns correct initial state", () => {
    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", undefined)
    );

    expect(result.current.attemptCount).toBe(0);
    expect(result.current.previousScore).toBeUndefined();
    expect(result.current.isRegenerating).toBe(false);
    expect(result.current.canRegenerate).toBe(true);
  });

  it("canRegenerate is false when starting at heavy intensity", () => {
    const { result } = renderHook(() =>
      useRehumanization("job text", "heavy", undefined)
    );

    expect(result.current.canRegenerate).toBe(false);
  });

  // -- Successful regeneration (score passes) --

  it("calls regenerate_with_humanization then analyze_perplexity on success", async () => {
    const onSuccess = vi.fn();

    mockInvoke
      .mockResolvedValueOnce({
        generated_text: "Regenerated proposal",
        new_intensity: "heavy",
        attempt_count: 1,
      })
      .mockResolvedValueOnce({
        score: 150.0,
        threshold: 180,
        flaggedSentences: [],
      });

    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", 190, { onSuccess })
    );

    await act(async () => {
      await result.current.handleRegenerate();
    });

    // Verify invoke calls
    expect(mockInvoke).toHaveBeenCalledWith("regenerate_with_humanization", {
      jobContent: "job text",
      currentIntensity: "medium",
      attemptCount: 0,
    });
    expect(mockInvoke).toHaveBeenCalledWith("analyze_perplexity", {
      text: "Regenerated proposal",
    });

    // Score < 180 → onSuccess called, attempts reset
    expect(onSuccess).toHaveBeenCalledWith("Regenerated proposal", {
      score: 150.0,
      threshold: 180,
      flaggedSentences: [],
    });
    expect(result.current.attemptCount).toBe(0);
    expect(result.current.isRegenerating).toBe(false);
  });

  // -- Regeneration still failing --

  it("calls onAnalysisComplete when score still above threshold", async () => {
    const onAnalysisComplete = vi.fn();

    mockInvoke
      .mockResolvedValueOnce({
        generated_text: "Still AI-sounding",
        new_intensity: "heavy",
        attempt_count: 1,
      })
      .mockResolvedValueOnce({
        score: 195.0,
        threshold: 180,
        flaggedSentences: [{ text: "flagged", suggestion: "fix it", index: 0 }],
      });

    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", 200, { onAnalysisComplete })
    );

    await act(async () => {
      await result.current.handleRegenerate();
    });

    expect(onAnalysisComplete).toHaveBeenCalledWith({
      score: 195.0,
      threshold: 180,
      flaggedSentences: [{ text: "flagged", suggestion: "fix it", index: 0 }],
    });
    expect(result.current.attemptCount).toBe(1);
    expect(result.current.isRegenerating).toBe(false);
  });

  // -- Previous score tracking --

  it("saves currentScore as previousScore before regeneration", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        generated_text: "text",
        new_intensity: "heavy",
        attempt_count: 1,
      })
      .mockResolvedValueOnce({
        score: 185.0,
        threshold: 180,
        flaggedSentences: [],
      });

    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", 200)
    );

    expect(result.current.previousScore).toBeUndefined();

    await act(async () => {
      await result.current.handleRegenerate();
    });

    expect(result.current.previousScore).toBe(200);
  });

  // -- Error handling --

  it("calls onFailure when invoke rejects", async () => {
    const onFailure = vi.fn();

    mockInvoke.mockRejectedValueOnce(new Error("API error"));

    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", 200, { onFailure })
    );

    await act(async () => {
      await result.current.handleRegenerate();
    });

    expect(onFailure).toHaveBeenCalledWith("API error");
    expect(result.current.isRegenerating).toBe(false);
  });

  it("calls onFailure with string error when non-Error thrown", async () => {
    const onFailure = vi.fn();

    mockInvoke.mockRejectedValueOnce("string error");

    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", 200, { onFailure })
    );

    await act(async () => {
      await result.current.handleRegenerate();
    });

    expect(onFailure).toHaveBeenCalledWith("string error");
  });

  // -- Max attempts enforcement --

  it("calls onFailure when max attempts reached", async () => {
    const onFailure = vi.fn();

    // Simulate 3 failed attempts by mocking sequential calls
    // Attempt 1
    mockInvoke
      .mockResolvedValueOnce({ generated_text: "t1", new_intensity: "heavy", attempt_count: 1 })
      .mockResolvedValueOnce({ score: 190, threshold: 180, flaggedSentences: [] });
    // Attempt 2
    mockInvoke
      .mockResolvedValueOnce({ generated_text: "t2", new_intensity: "heavy", attempt_count: 2 })
      .mockResolvedValueOnce({ score: 185, threshold: 180, flaggedSentences: [] });
    // Attempt 3
    mockInvoke
      .mockResolvedValueOnce({ generated_text: "t3", new_intensity: "heavy", attempt_count: 3 })
      .mockResolvedValueOnce({ score: 182, threshold: 180, flaggedSentences: [] });

    const { result } = renderHook(() =>
      useRehumanization("job text", "light", 200, { onFailure })
    );

    // Run 3 attempts
    await act(async () => { await result.current.handleRegenerate(); });
    await act(async () => { await result.current.handleRegenerate(); });
    await act(async () => { await result.current.handleRegenerate(); });

    expect(result.current.attemptCount).toBe(3);
    expect(result.current.canRegenerate).toBe(false);

    // 4th attempt should be blocked
    await act(async () => { await result.current.handleRegenerate(); });

    expect(onFailure).toHaveBeenCalledWith("Maximum regeneration attempts reached");
  });

  // -- H1 fix: effectiveIntensity escalation --

  it("tracks escalated intensity across attempts (H1 fix)", async () => {
    const onAnalysisComplete = vi.fn();

    // Attempt 1: light → medium
    mockInvoke
      .mockResolvedValueOnce({ generated_text: "t1", new_intensity: "medium", attempt_count: 1 })
      .mockResolvedValueOnce({ score: 190, threshold: 180, flaggedSentences: [] });

    const { result } = renderHook(() =>
      useRehumanization("job text", "light", 200, { onAnalysisComplete })
    );

    await act(async () => { await result.current.handleRegenerate(); });

    // Verify first call sent "light"
    expect(mockInvoke).toHaveBeenCalledWith("regenerate_with_humanization", {
      jobContent: "job text",
      currentIntensity: "light",
      attemptCount: 0,
    });

    // Attempt 2: should now send "medium" (escalated), not "light" (original)
    mockInvoke
      .mockResolvedValueOnce({ generated_text: "t2", new_intensity: "heavy", attempt_count: 2 })
      .mockResolvedValueOnce({ score: 185, threshold: 180, flaggedSentences: [] });

    await act(async () => { await result.current.handleRegenerate(); });

    expect(mockInvoke).toHaveBeenCalledWith("regenerate_with_humanization", {
      jobContent: "job text",
      currentIntensity: "medium",
      attemptCount: 1,
    });
  });

  it("canRegenerate becomes false after escalating to heavy", async () => {
    // Attempt escalates to heavy
    mockInvoke
      .mockResolvedValueOnce({ generated_text: "t1", new_intensity: "heavy", attempt_count: 1 })
      .mockResolvedValueOnce({ score: 190, threshold: 180, flaggedSentences: [] });

    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", 200)
    );

    expect(result.current.canRegenerate).toBe(true);

    await act(async () => { await result.current.handleRegenerate(); });

    expect(result.current.canRegenerate).toBe(false);
  });

  // -- resetAttempts --

  it("resetAttempts clears all state", async () => {
    mockInvoke
      .mockResolvedValueOnce({ generated_text: "t1", new_intensity: "heavy", attempt_count: 1 })
      .mockResolvedValueOnce({ score: 190, threshold: 180, flaggedSentences: [] });

    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", 200)
    );

    await act(async () => { await result.current.handleRegenerate(); });

    expect(result.current.attemptCount).toBe(1);
    expect(result.current.previousScore).toBe(200);

    act(() => { result.current.resetAttempts(); });

    expect(result.current.attemptCount).toBe(0);
    expect(result.current.previousScore).toBeUndefined();
    expect(result.current.canRegenerate).toBe(true);
  });

  // -- Loading state --

  it("sets isRegenerating during invoke call", async () => {
    let resolveInvoke: (value: unknown) => void;
    mockInvoke.mockImplementationOnce(
      () => new Promise((resolve) => { resolveInvoke = resolve; })
    );

    const { result } = renderHook(() =>
      useRehumanization("job text", "medium", 200)
    );

    expect(result.current.isRegenerating).toBe(false);

    // Start regeneration (don't await)
    let regeneratePromise: Promise<void>;
    act(() => {
      regeneratePromise = result.current.handleRegenerate();
    });

    expect(result.current.isRegenerating).toBe(true);

    // Resolve the invoke
    await act(async () => {
      resolveInvoke!({
        generated_text: "text",
        new_intensity: "heavy",
        attempt_count: 1,
      });
      // Mock the perplexity analysis call
      mockInvoke.mockResolvedValueOnce({
        score: 150,
        threshold: 180,
        flaggedSentences: [],
      });
      await regeneratePromise!;
    });

    expect(result.current.isRegenerating).toBe(false);
  });

  // -- Sync effectiveIntensity with settings changes --

  it("syncs effectiveIntensity when currentIntensity prop changes and attemptCount is 0", () => {
    const { result, rerender } = renderHook(
      ({ intensity }) => useRehumanization("job text", intensity, undefined),
      { initialProps: { intensity: "medium" as const } }
    );

    expect(result.current.canRegenerate).toBe(true);

    // Change to heavy — should sync since attemptCount is 0
    rerender({ intensity: "heavy" as const });

    expect(result.current.canRegenerate).toBe(false);
  });

  // M2 fix (Review 3): Test that intensity changes are ignored during active regeneration
  it("ignores currentIntensity prop changes when attemptCount > 0", async () => {
    // Attempt escalates to heavy
    mockInvoke
      .mockResolvedValueOnce({ generated_text: "t1", new_intensity: "heavy", attempt_count: 1 })
      .mockResolvedValueOnce({ score: 190, threshold: 180, flaggedSentences: [] });

    const { result, rerender } = renderHook(
      ({ intensity }) => useRehumanization("job text", intensity, 200),
      { initialProps: { intensity: "medium" as const } }
    );

    // Run one regeneration attempt
    await act(async () => { await result.current.handleRegenerate(); });

    expect(result.current.attemptCount).toBe(1);
    // After escalation, effectiveIntensity is "heavy"
    expect(result.current.canRegenerate).toBe(false);

    // Now change the settings store to "light" — should be IGNORED since attemptCount > 0
    rerender({ intensity: "light" as const });

    // canRegenerate should still be false (using escalated "heavy", not new "light")
    expect(result.current.canRegenerate).toBe(false);
  });
});
