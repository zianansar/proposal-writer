/**
 * Hook for accessing and modifying app settings.
 *
 * Provides typed getters and setters for known settings.
 * Wraps useSettingsStore with a more convenient API.
 */

import { useCallback } from "react";
import {
  useSettingsStore,
  getTheme,
  getSafetyThreshold,
  getOnboardingCompleted,
} from "../stores/useSettingsStore";

/**
 * Hook for accessing app settings with typed getters and setters.
 *
 * @example
 * const { theme, setTheme, safetyThreshold, setSafetyThreshold } = useSettings();
 */
export function useSettings() {
  const { settings, setSetting, isLoading, error, isInitialized } =
    useSettingsStore();

  // Typed getters using selectors
  const theme = useSettingsStore(getTheme);
  const safetyThreshold = useSettingsStore(getSafetyThreshold);
  const onboardingCompleted = useSettingsStore(getOnboardingCompleted);

  // Typed setters
  const setTheme = useCallback(
    async (value: "dark" | "light") => {
      await setSetting("theme", value);
    },
    [setSetting]
  );

  const setSafetyThreshold = useCallback(
    async (value: number) => {
      await setSetting("safety_threshold", String(value));
    },
    [setSetting]
  );

  const setOnboardingCompleted = useCallback(
    async (value: boolean) => {
      await setSetting("onboarding_completed", String(value));
    },
    [setSetting]
  );

  // Generic getter for custom settings
  const getSetting = useCallback(
    (key: string): string | undefined => {
      return settings[key];
    },
    [settings]
  );

  // Generic setter for custom settings
  const setCustomSetting = useCallback(
    async (key: string, value: string) => {
      await setSetting(key, value);
    },
    [setSetting]
  );

  return {
    // State
    isLoading,
    error,
    isInitialized,

    // Typed settings
    theme,
    setTheme,
    safetyThreshold,
    setSafetyThreshold,
    onboardingCompleted,
    setOnboardingCompleted,

    // Generic access
    getSetting,
    setSetting: setCustomSetting,
  };
}
