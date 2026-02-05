import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

/** Setting entry from database */
interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

interface SettingsState {
  /** All settings as a key-value map */
  settings: Record<string, string>;
  /** Whether settings are currently loading */
  isLoading: boolean;
  /** Error message if settings failed to load */
  error: string | null;
  /** Whether initial load has completed */
  isInitialized: boolean;
}

interface SettingsActions {
  /** Load all settings from database */
  loadSettings: () => Promise<void>;
  /** Set a setting value (optimistic update + persist) */
  setSetting: (key: string, value: string) => Promise<void>;
  /** Get a setting value */
  getSetting: (key: string) => string | undefined;
}

const initialState: SettingsState = {
  settings: {},
  isLoading: true,
  error: null,
  isInitialized: false,
};

export const useSettingsStore = create<SettingsState & SettingsActions>(
  (set, get) => ({
    ...initialState,

    loadSettings: async () => {
      set({ isLoading: true, error: null });

      try {
        const settings = await invoke<Setting[]>("get_all_settings");

        // Convert array to map
        const settingsMap: Record<string, string> = {};
        for (const setting of settings) {
          settingsMap[setting.key] = setting.value;
        }

        set({
          settings: settingsMap,
          isLoading: false,
          isInitialized: true,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        set({
          error: errorMessage,
          isLoading: false,
          isInitialized: true,
        });
      }
    },

    setSetting: async (key: string, value: string) => {
      const previousValue = get().settings[key];

      // Optimistic update and clear any previous error
      set((state) => ({
        settings: { ...state.settings, [key]: value },
        error: null,
      }));

      try {
        await invoke("set_setting", { key, value });
      } catch (err) {
        // Revert on error
        set((state) => ({
          settings: { ...state.settings, [key]: previousValue },
          error: err instanceof Error ? err.message : String(err),
        }));
        throw err; // Re-throw so caller knows it failed
      }
    },

    getSetting: (key: string) => {
      return get().settings[key];
    },
  })
);

// Selector helpers for typed access
export const getTheme = (state: SettingsState): "dark" | "light" => {
  const theme = state.settings.theme;
  return theme === "light" ? "light" : "dark";
};

export const getSafetyThreshold = (state: SettingsState): number => {
  const value = state.settings.safety_threshold;
  if (!value) return 180; // Default 180
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 180 : parsed;
};

export const getOnboardingCompleted = (state: SettingsState): boolean => {
  return state.settings.onboarding_completed === "true";
};

/** Humanization intensity (Story 3.3). Defaults to "medium". */
export type HumanizationIntensity = "off" | "light" | "medium" | "heavy";

export const getHumanizationIntensity = (state: SettingsState): HumanizationIntensity => {
  const value = state.settings.humanization_intensity;
  if (value === "off" || value === "light" || value === "medium" || value === "heavy") {
    return value;
  }
  return "medium"; // Default (AC6)
};
