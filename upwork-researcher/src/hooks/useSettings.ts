/**
 * Hook for accessing and modifying app settings.
 *
 * Provides typed getters and setters for known settings.
 * Wraps useSettingsStore with a more convenient API.
 */

import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  useSettingsStore,
  getTheme,
  getSafetyThreshold,
  getOnboardingCompleted,
  getAutoUpdateEnabled,
  getSkippedVersion,
  getLastUpdateCheck,
  getLastConfigChecked,
  getLastConfigVersion,
  getConfigSource,
  getNewStrategiesFirstSeen,
  getNewStrategiesDismissed,
  type ConfigSource,
} from "../stores/useSettingsStore";

/**
 * Hook for accessing app settings with typed getters and setters.
 *
 * @example
 * const { theme, setTheme, safetyThreshold, setSafetyThreshold } = useSettings();
 */
export function useSettings() {
  const { settings, setSetting, isLoading, error, isInitialized } = useSettingsStore();

  // Typed getters using selectors
  const theme = useSettingsStore(getTheme);
  const safetyThreshold = useSettingsStore(getSafetyThreshold);
  const onboardingCompleted = useSettingsStore(getOnboardingCompleted);
  const autoUpdateEnabled = useSettingsStore(getAutoUpdateEnabled);
  const skippedVersion = useSettingsStore(getSkippedVersion);
  const lastUpdateCheck = useSettingsStore(getLastUpdateCheck);

  // Story 10.5: Remote config settings getters
  const lastConfigChecked = useSettingsStore(getLastConfigChecked);
  const lastConfigVersion = useSettingsStore(getLastConfigVersion);
  const configSource = useSettingsStore(getConfigSource);
  // useShallow prevents infinite re-renders from new object references on each call
  const newStrategiesFirstSeen = useSettingsStore(useShallow(getNewStrategiesFirstSeen));
  const newStrategiesDismissed = useSettingsStore(useShallow(getNewStrategiesDismissed));

  // Typed setters
  const setTheme = useCallback(
    async (value: "dark" | "light") => {
      await setSetting("theme", value);
    },
    [setSetting],
  );

  const setSafetyThreshold = useCallback(
    async (value: number) => {
      await setSetting("safety_threshold", String(value));
    },
    [setSetting],
  );

  const setOnboardingCompleted = useCallback(
    async (value: boolean) => {
      await setSetting("onboarding_completed", String(value));
    },
    [setSetting],
  );

  const setAutoUpdateEnabled = useCallback(
    async (value: boolean) => {
      await setSetting("auto_update_enabled", String(value));
    },
    [setSetting],
  );

  const setSkippedVersion = useCallback(
    async (value: string) => {
      await setSetting("skipped_version", value);
    },
    [setSetting],
  );

  const setLastUpdateCheck = useCallback(
    async (value: string) => {
      await setSetting("last_update_check", value);
    },
    [setSetting],
  );

  // Story 10.5: Remote config settings setters
  const setLastConfigChecked = useCallback(
    async (value: string) => {
      await setSetting("last_config_checked", value);
    },
    [setSetting],
  );

  const setLastConfigVersion = useCallback(
    async (value: string) => {
      await setSetting("last_config_version", value);
    },
    [setSetting],
  );

  const setConfigSource = useCallback(
    async (value: ConfigSource) => {
      await setSetting("config_source", value);
    },
    [setSetting],
  );

  const setNewStrategiesFirstSeen = useCallback(
    async (value: Record<string, string>) => {
      await setSetting("new_strategies_first_seen", JSON.stringify(value));
    },
    [setSetting],
  );

  const setNewStrategiesDismissed = useCallback(
    async (value: Record<string, boolean>) => {
      await setSetting("new_strategies_dismissed", JSON.stringify(value));
    },
    [setSetting],
  );

  // Generic getter for custom settings
  const getSetting = useCallback(
    (key: string): string | undefined => {
      return settings[key];
    },
    [settings],
  );

  // Generic setter for custom settings
  const setCustomSetting = useCallback(
    async (key: string, value: string) => {
      await setSetting(key, value);
    },
    [setSetting],
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
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    skippedVersion,
    setSkippedVersion,
    lastUpdateCheck,
    setLastUpdateCheck,

    // Story 10.5: Remote config settings
    lastConfigChecked,
    setLastConfigChecked,
    lastConfigVersion,
    setLastConfigVersion,
    configSource,
    setConfigSource,
    newStrategiesFirstSeen,
    setNewStrategiesFirstSeen,
    newStrategiesDismissed,
    setNewStrategiesDismissed,

    // Generic access
    getSetting,
    setSetting: setCustomSetting,
  };
}
