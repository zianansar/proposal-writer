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

  // CR R1 M-1: Tests for auto-update accessors (Story 9.7)
  describe("auto-update typed getters", () => {
    it("should return autoUpdateEnabled as boolean (default true)", () => {
      useSettingsStore.setState({
        settings: { auto_update_enabled: "true" },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.autoUpdateEnabled).toBe(true);
    });

    it("should return autoUpdateEnabled false when disabled", () => {
      useSettingsStore.setState({
        settings: { auto_update_enabled: "false" },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.autoUpdateEnabled).toBe(false);
    });

    it("should return skippedVersion string", () => {
      useSettingsStore.setState({
        settings: { skipped_version: "1.2.0" },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.skippedVersion).toBe("1.2.0");
    });

    it("should return lastUpdateCheck string", () => {
      useSettingsStore.setState({
        settings: { last_update_check: "2026-02-16T10:00:00Z" },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.lastUpdateCheck).toBe("2026-02-16T10:00:00Z");
    });
  });

  describe("auto-update typed setters", () => {
    it("should set autoUpdateEnabled as string boolean", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setAutoUpdateEnabled(false);
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "auto_update_enabled",
        value: "false",
      });
    });

    it("should set skippedVersion", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setSkippedVersion("2.0.0");
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "skipped_version",
        value: "2.0.0",
      });
    });

    it("should set lastUpdateCheck", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setLastUpdateCheck("2026-02-16T12:00:00Z");
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "last_update_check",
        value: "2026-02-16T12:00:00Z",
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

  // Story 10.5: Remote config settings
  describe("remote config typed getters (Story 10.5 Task 4)", () => {
    it("should return lastConfigChecked string", () => {
      useSettingsStore.setState({
        settings: { last_config_checked: "2026-02-17T10:00:00Z" },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.lastConfigChecked).toBe("2026-02-17T10:00:00Z");
    });

    it("should return empty string for lastConfigChecked when not set", () => {
      useSettingsStore.setState({
        settings: {},
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.lastConfigChecked).toBe("");
    });

    it("should return configSource as 'defaults' when not set", () => {
      useSettingsStore.setState({
        settings: {},
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.configSource).toBe("defaults");
    });

    it("should return configSource as 'remote' when set", () => {
      useSettingsStore.setState({
        settings: { config_source: "remote" },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.configSource).toBe("remote");
    });

    it("should return configSource as 'cached' when set", () => {
      useSettingsStore.setState({
        settings: { config_source: "cached" },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.configSource).toBe("cached");
    });

    it("should parse newStrategiesFirstSeen JSON correctly", () => {
      useSettingsStore.setState({
        settings: {
          new_strategies_first_seen: JSON.stringify({ "hook-1": "2026-02-17T10:00:00Z" }),
        },
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.newStrategiesFirstSeen).toEqual({ "hook-1": "2026-02-17T10:00:00Z" });
    });

    it("should return empty object for newStrategiesFirstSeen when not set", () => {
      useSettingsStore.setState({
        settings: {},
        isLoading: false,
        isInitialized: true,
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.newStrategiesFirstSeen).toEqual({});
    });
  });

  describe("remote config typed setters (Story 10.5 Task 4)", () => {
    it("should set lastConfigChecked", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setLastConfigChecked("2026-02-17T12:00:00Z");
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "last_config_checked",
        value: "2026-02-17T12:00:00Z",
      });
    });

    it("should set configSource", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.setConfigSource("remote");
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "config_source",
        value: "remote",
      });
    });

    it("should set newStrategiesFirstSeen as JSON string", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useSettings());
      const map = { "strategy-a": "2026-02-17T10:00:00Z" };

      await act(async () => {
        await result.current.setNewStrategiesFirstSeen(map);
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "new_strategies_first_seen",
        value: JSON.stringify(map),
      });
    });

    it("should set newStrategiesDismissed as JSON string", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useSettings());
      const map = { "strategy-a": true };

      await act(async () => {
        await result.current.setNewStrategiesDismissed(map);
      });

      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "new_strategies_dismissed",
        value: JSON.stringify(map),
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
