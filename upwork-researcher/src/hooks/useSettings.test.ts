import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useSettingsStore } from "../stores/useSettingsStore";

import { useSettings } from "./useSettings";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("useSettings", () => {
  beforeEach(() => {
    // Reset store to initial state with some settings
    useSettingsStore.setState({
      settings: {
        theme: "dark",
        safety_threshold: "180",
        onboarding_completed: "false",
      },
      isLoading: false,
      error: null,
      isInitialized: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("typed getters", () => {
    it("should return theme value", () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.theme).toBe("dark");
    });

    it("should return safety threshold as number", () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.safetyThreshold).toBe(180);
    });

    it("should return onboarding completed as boolean", () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.onboardingCompleted).toBe(false);
    });

    it("should return true for onboarding completed when set", () => {
      useSettingsStore.setState({
        settings: { onboarding_completed: "true" },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.onboardingCompleted).toBe(true);
    });
  });

  describe("typed setters", () => {
    it("should set theme", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setTheme("light");
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "theme",
        value: "light",
      });
    });

    it("should set safety threshold as string", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setSafetyThreshold(150);
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "safety_threshold",
        value: "150",
      });
    });

    it("should set onboarding completed as string boolean", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setOnboardingCompleted(true);
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "onboarding_completed",
        value: "true",
      });
    });
  });

  describe("generic access", () => {
    it("should get custom setting", () => {
      useSettingsStore.setState({
        settings: { custom_key: "custom_value" },
        isLoading: false,
        isInitialized: true,
      });

      const { result } = renderHook(() => useSettings());
      expect(result.current.getSetting("custom_key")).toBe("custom_value");
    });

    it("should return undefined for missing setting", () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.getSetting("nonexistent")).toBeUndefined();
    });

    it("should set custom setting", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setSetting("custom_key", "custom_value");
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "custom_key",
        value: "custom_value",
      });
    });
  });

  describe("state", () => {
    it("should expose isLoading", () => {
      useSettingsStore.setState({ isLoading: true });
      const { result } = renderHook(() => useSettings());
      expect(result.current.isLoading).toBe(true);
    });

    it("should expose error", () => {
      useSettingsStore.setState({ error: "Test error" });
      const { result } = renderHook(() => useSettings());
      expect(result.current.error).toBe("Test error");
    });

    it("should expose isInitialized", () => {
      useSettingsStore.setState({ isInitialized: true });
      const { result } = renderHook(() => useSettings());
      expect(result.current.isInitialized).toBe(true);
    });
  });
});
