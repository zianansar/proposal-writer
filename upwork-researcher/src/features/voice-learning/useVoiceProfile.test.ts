import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { VoiceProfile } from "./types";
import { useVoiceProfile } from "./useVoiceProfile";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockProfile: VoiceProfile = {
  tone_score: 6,
  avg_sentence_length: 15,
  vocabulary_complexity: 8,
  structure_preference: {
    paragraphs_pct: 60,
    bullets_pct: 40,
  },
  technical_depth: 8,
  common_phrases: [
    "I've worked with React for 5 years",
    "My approach to this would be",
    "I can deliver within your timeline",
  ],
  sample_count: 5,
  calibration_source: "GoldenSet",
};

describe("useVoiceProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads profile from database on mount", async () => {
    vi.mocked(invoke).mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useVoiceProfile());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.error).toBe(null);
    expect(invoke).toHaveBeenCalledWith("get_voice_profile");
  });

  it("handles null profile (no calibration yet)", async () => {
    vi.mocked(invoke).mockResolvedValue(null);

    const { result } = renderHook(() => useVoiceProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it("handles errors gracefully", async () => {
    const errorMessage = "Database connection failed";
    vi.mocked(invoke).mockRejectedValue(errorMessage);

    const { result } = renderHook(() => useVoiceProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBe(null);
    expect(result.current.error).toBe(errorMessage);
  });

  it("refetch reloads profile data", async () => {
    vi.mocked(invoke).mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useVoiceProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear mock and set new return value
    vi.mocked(invoke).mockClear();
    const updatedProfile = { ...mockProfile, sample_count: 10 };
    vi.mocked(invoke).mockResolvedValue(updatedProfile);

    // Call refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.profile?.sample_count).toBe(10);
    });

    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("sets loading to false after refetch completes", async () => {
    vi.mocked(invoke).mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useVoiceProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Trigger refetch
    await result.current.refetch();

    // Loading should be false after refetch completes
    expect(result.current.loading).toBe(false);
  });

  it("clears error on successful refetch", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("Initial error");

    const { result } = renderHook(() => useVoiceProfile());

    await waitFor(() => {
      expect(result.current.error).toBe("Initial error");
    });

    vi.mocked(invoke).mockResolvedValue(mockProfile);
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.error).toBe(null);
      expect(result.current.profile).toEqual(mockProfile);
    });
  });
});
