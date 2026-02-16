// Story 8.6: Tests for useProposalsEditedCount hook

import { invoke } from "@tauri-apps/api/core";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useProposalsEditedCount } from "./useProposalsEditedCount";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("useProposalsEditedCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Subtask 5.4: Test database commands increment/retrieve count

  it("fetches count on mount", async () => {
    (invoke as any).mockResolvedValue(5);

    const { result } = renderHook(() => useProposalsEditedCount());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(invoke).toHaveBeenCalledWith("get_proposals_edited_count");
    expect(result.current.progress).toEqual({
      proposalsEditedCount: 5,
      status: "refining",
      progressPercent: 50,
    });
  });

  it("handles fetch error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (invoke as any).mockRejectedValue(new Error("Database error"));

    const { result } = renderHook(() => useProposalsEditedCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.progress).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to fetch proposals edited count:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("increments count via incrementCount", async () => {
    (invoke as any)
      .mockResolvedValueOnce(3) // Initial fetch
      .mockResolvedValueOnce(4); // After increment

    const { result } = renderHook(() => useProposalsEditedCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.progress?.proposalsEditedCount).toBe(3);

    // Call incrementCount
    await result.current.incrementCount();

    await waitFor(() => {
      expect(result.current.progress?.proposalsEditedCount).toBe(4);
    });

    expect(invoke).toHaveBeenCalledWith("increment_proposals_edited");
  });

  it("handles increment error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (invoke as any)
      .mockResolvedValueOnce(3) // Initial fetch
      .mockRejectedValueOnce(new Error("Increment failed"));

    const { result } = renderHook(() => useProposalsEditedCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.incrementCount();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to increment proposals edited count:",
      expect.any(Error),
    );

    // Progress should remain unchanged
    expect(result.current.progress?.proposalsEditedCount).toBe(3);

    consoleSpy.mockRestore();
  });

  it("refetch updates progress", async () => {
    (invoke as any)
      .mockResolvedValueOnce(5) // Initial fetch
      .mockResolvedValueOnce(8); // Refetch

    const { result } = renderHook(() => useProposalsEditedCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.progress?.proposalsEditedCount).toBe(5);

    // Call refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.progress?.proposalsEditedCount).toBe(8);
    });
  });
});
