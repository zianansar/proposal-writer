import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSettingsStore, getTheme, getSafetyThreshold, getOnboardingCompleted } from "./useSettingsStore";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("useSettingsStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useSettingsStore.setState({
      settings: {},
      isLoading: true,
      error: null,
      isInitialized: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("loadSettings", () => {
    it("should load settings from database", async () => {
      const mockSettings = [
        { key: "theme", value: "dark", updated_at: "2026-02-04" },
        { key: "api_provider", value: "anthropic", updated_at: "2026-02-04" },
      ];
      mockInvoke.mockResolvedValueOnce(mockSettings);

      await useSettingsStore.getState().loadSettings();

      expect(mockInvoke).toHaveBeenCalledWith("get_all_settings");
      expect(useSettingsStore.getState().settings).toEqual({
        theme: "dark",
        api_provider: "anthropic",
      });
      expect(useSettingsStore.getState().isLoading).toBe(false);
      expect(useSettingsStore.getState().isInitialized).toBe(true);
      expect(useSettingsStore.getState().error).toBeNull();
    });

    it("should handle load error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Database error"));

      await useSettingsStore.getState().loadSettings();

      expect(useSettingsStore.getState().error).toBe("Database error");
      expect(useSettingsStore.getState().isLoading).toBe(false);
      expect(useSettingsStore.getState().isInitialized).toBe(true);
    });

    it("should set isLoading while loading", async () => {
      let resolvePromise: (value: unknown[]) => void;
      const loadPromise = new Promise<unknown[]>((resolve) => {
        resolvePromise = resolve;
      });
      mockInvoke.mockReturnValueOnce(loadPromise);

      // Start loading
      const loadSettingsPromise = useSettingsStore.getState().loadSettings();
      expect(useSettingsStore.getState().isLoading).toBe(true);

      // Resolve the load
      resolvePromise!([]);
      await loadSettingsPromise;

      expect(useSettingsStore.getState().isLoading).toBe(false);
    });
  });

  describe("setSetting", () => {
    it("should update setting optimistically", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      // Set initial state
      useSettingsStore.setState({
        settings: { theme: "dark" },
        isLoading: false,
        isInitialized: true,
      });

      // Update setting
      await useSettingsStore.getState().setSetting("theme", "light");

      expect(useSettingsStore.getState().settings.theme).toBe("light");
      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "theme",
        value: "light",
      });
    });

    it("should revert on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Save failed"));

      // Set initial state
      useSettingsStore.setState({
        settings: { theme: "dark" },
        isLoading: false,
        isInitialized: true,
      });

      // Attempt update
      await expect(
        useSettingsStore.getState().setSetting("theme", "light")
      ).rejects.toThrow("Save failed");

      // Should revert to original value
      expect(useSettingsStore.getState().settings.theme).toBe("dark");
      expect(useSettingsStore.getState().error).toBe("Save failed");
    });

    it("should add new setting", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      // Set initial state with no settings
      useSettingsStore.setState({
        settings: {},
        isLoading: false,
        isInitialized: true,
      });

      await useSettingsStore.getState().setSetting("new_key", "new_value");

      expect(useSettingsStore.getState().settings.new_key).toBe("new_value");
    });

    it("should clear previous error on new setSetting attempt", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      // Set initial state with an existing error
      useSettingsStore.setState({
        settings: { theme: "dark" },
        isLoading: false,
        isInitialized: true,
        error: "Previous error",
      });

      await useSettingsStore.getState().setSetting("theme", "light");

      expect(useSettingsStore.getState().error).toBeNull();
    });
  });

  describe("getSetting", () => {
    it("should return setting value", () => {
      useSettingsStore.setState({
        settings: { theme: "dark" },
        isLoading: false,
        isInitialized: true,
      });

      const value = useSettingsStore.getState().getSetting("theme");
      expect(value).toBe("dark");
    });

    it("should return undefined for missing setting", () => {
      useSettingsStore.setState({
        settings: {},
        isLoading: false,
        isInitialized: true,
      });

      const value = useSettingsStore.getState().getSetting("missing");
      expect(value).toBeUndefined();
    });
  });

  describe("performance", () => {
    it("should complete setSetting in <50ms (NFR-4)", async () => {
      // Mock invoke to simulate realistic DB latency (~5ms)
      mockInvoke.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5))
      );

      useSettingsStore.setState({
        settings: { theme: "dark" },
        isLoading: false,
        isInitialized: true,
      });

      const startTime = performance.now();
      await useSettingsStore.getState().setSetting("theme", "light");
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50);
    });
  });

  describe("selectors", () => {
    it("getTheme should return dark by default", () => {
      const state = { settings: {}, isLoading: false, error: null, isInitialized: true };
      expect(getTheme(state)).toBe("dark");
    });

    it("getTheme should return light when set", () => {
      const state = { settings: { theme: "light" }, isLoading: false, error: null, isInitialized: true };
      expect(getTheme(state)).toBe("light");
    });

    it("getSafetyThreshold should return 180 by default", () => {
      const state = { settings: {}, isLoading: false, error: null, isInitialized: true };
      expect(getSafetyThreshold(state)).toBe(180);
    });

    it("getSafetyThreshold should parse stored value", () => {
      const state = { settings: { safety_threshold: "150" }, isLoading: false, error: null, isInitialized: true };
      expect(getSafetyThreshold(state)).toBe(150);
    });

    it("getSafetyThreshold should return default for invalid value", () => {
      const state = { settings: { safety_threshold: "invalid" }, isLoading: false, error: null, isInitialized: true };
      expect(getSafetyThreshold(state)).toBe(180); // Default, not NaN
    });

    it("getOnboardingCompleted should return false by default", () => {
      const state = { settings: {}, isLoading: false, error: null, isInitialized: true };
      expect(getOnboardingCompleted(state)).toBe(false);
    });

    it("getOnboardingCompleted should return true when set", () => {
      const state = { settings: { onboarding_completed: "true" }, isLoading: false, error: null, isInitialized: true };
      expect(getOnboardingCompleted(state)).toBe(true);
    });
  });
});
