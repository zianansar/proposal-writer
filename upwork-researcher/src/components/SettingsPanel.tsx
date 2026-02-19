import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { useState, useEffect, useRef, useCallback } from "react";

import { DatabaseExportButton } from "../features/proposal-history/DatabaseExportButton";
import { ImportArchiveDialog } from "../features/proposal-history/ImportArchiveDialog";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import {
  useSettingsStore,
  getHumanizationIntensity,
  type HumanizationIntensity,
} from "../stores/useSettingsStore";
import { useSettings } from "../hooks/useSettings";
import type { UpdateInfo } from "../hooks/useUpdater";
import { formatRelativeTime } from "../utils/dateUtils";

import UserSkillsConfig from "./UserSkillsConfig";
import { VoiceSettings } from "./VoiceSettings";

/** Story 4b.4: Rate configuration for budget alignment */
interface RateConfig {
  hourly_rate: number | null;
  project_rate_min: number | null;
}

const INTENSITY_OPTIONS: {
  value: HumanizationIntensity;
  label: string;
  description: string;
  badge?: string;
}[] = [
  { value: "off", label: "Off", description: "No humanization — pure AI output" },
  { value: "light", label: "Light", description: "Subtle: ~0.5-1 touches per 100 words" },
  {
    value: "medium",
    label: "Medium",
    description: "Balanced: ~1-2 touches per 100 words",
    badge: "Recommended",
  },
  { value: "heavy", label: "Heavy", description: "Casual: ~2-3 touches per 100 words" },
];

/** CR R1 H-1: Props injected from App.tsx to avoid redundant useUpdater instance */
interface SettingsPanelProps {
  checkForUpdate: () => Promise<UpdateInfo | null>;
  isChecking: boolean;
}

function SettingsPanel({ checkForUpdate, isChecking }: SettingsPanelProps) {
  const queryClient = useQueryClient();
  const { getSetting, setSetting } = useSettingsStore();
  const humanizationIntensity = useSettingsStore(getHumanizationIntensity);
  const { setShowOnboarding } = useOnboardingStore();
  const [logLevel, setLogLevel] = useState("INFO");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isResettingOnboarding, setIsResettingOnboarding] = useState(false);
  const [intensitySaving, setIntensitySaving] = useState(false);
  const [intensityMessage, setIntensityMessage] = useState<string | null>(null);

  // Story 8.14: Crash reporting opt-in state
  // TODO: crash_reporting_enabled setting is persisted but currently has no backend consumer.
  // When crash reporting (e.g., Sentry) is integrated, read this setting to enable/disable.
  const [crashReportingEnabled, setCrashReportingEnabled] = useState(false);
  const [crashReportingSaving, setCrashReportingSaving] = useState(false);
  const [crashReportingError, setCrashReportingError] = useState<string | null>(null);

  // Story 3.5: Safety threshold state
  const [threshold, setThreshold] = useState(180);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdMessage, setThresholdMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Story 4b.4: Rate configuration state
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [projectRateMin, setProjectRateMin] = useState<string>("");
  const [rateSaving, setRateSaving] = useState<"hourly" | "project" | null>(null);
  const [rateMessage, setRateMessage] = useState<string | null>(null);
  const hourlyTimeoutRef = useRef<number | null>(null);
  const projectTimeoutRef = useRef<number | null>(null);

  // Story 7.7: Import archive dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Story 9.7: Auto-update settings state (CR R1 H-1: checkForUpdate/isChecking via props)
  const {
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    setLastUpdateCheck,
    lastUpdateCheck,
    // Story 10.5: Remote config settings
    lastConfigChecked,
    lastConfigVersion,
    configSource,
    setLastConfigChecked,
    setLastConfigVersion,
    setConfigSource,
  } = useSettings();
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // Story 10.5 Task 3: Remote config check state
  const [isCheckingConfig, setIsCheckingConfig] = useState(false);
  const [configCheckMessage, setConfigCheckMessage] = useState<string | null>(null);

  // Story 9.9 Task 5.4: Skip list reset state
  const [skippedVersions, setSkippedVersions] = useState<string[]>([]);
  const [clearingSkipList, setClearingSkipList] = useState(false);
  const [skipListMessage, setSkipListMessage] = useState<string | null>(null);

  // Story 9.7 Task 4.2: Load app version on mount
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const version = await getVersion();
        setCurrentVersion(version);
      } catch (err) {
        console.error("Failed to load app version:", err);
      }
    };
    loadVersion();
  }, []);

  useEffect(() => {
    // Load current log level from settings
    const currentLevel = getSetting("log_level") || "INFO";
    setLogLevel(currentLevel);
  }, [getSetting]);

  // Story 8.14: Load crash reporting setting on mount
  // NOTE: Could be batched with other settings loads for fewer round-trips
  useEffect(() => {
    const loadCrashReporting = async () => {
      try {
        const value = await invoke<string | null>("get_setting", {
          key: "crash_reporting_enabled",
        });
        setCrashReportingEnabled(value === "true");
      } catch (err) {
        console.error("Failed to load crash reporting setting:", err);
        // Keep default false on error
      }
    };
    loadCrashReporting();
  }, []);

  // Story 3.5: Load safety threshold on mount
  useEffect(() => {
    const loadThreshold = async () => {
      try {
        const value = await invoke<number>("get_safety_threshold");
        setThreshold(value);
      } catch (err) {
        console.error("Failed to load threshold:", err);
        // Keep default 180 on error
      }
    };
    loadThreshold();
  }, []);

  // Story 4b.4: Load rate configuration on mount
  useEffect(() => {
    const loadRateConfig = async () => {
      try {
        const config = await invoke<RateConfig>("get_user_rate_config");
        if (config.hourly_rate !== null) {
          setHourlyRate(config.hourly_rate.toString());
        }
        if (config.project_rate_min !== null) {
          setProjectRateMin(config.project_rate_min.toString());
        }
      } catch (err) {
        console.error("Failed to load rate config:", err);
      }
    };
    loadRateConfig();
  }, []);

  // Story 8.14: Handle crash reporting toggle
  const handleCrashReportingChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setCrashReportingEnabled(newValue);
    setCrashReportingSaving(true);
    setCrashReportingError(null);

    try {
      await invoke("set_setting", {
        key: "crash_reporting_enabled",
        value: newValue.toString(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setCrashReportingError(errorMessage);
      // Revert on error
      setCrashReportingEnabled(!newValue);
    } finally {
      setCrashReportingSaving(false);
    }
  };

  const handleLogLevelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLevel = e.target.value;
    setLogLevel(newLevel);
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await invoke("set_log_level", { level: newLevel });
      setSaveMessage("Log level updated. Restart the app for changes to take effect.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setSaveMessage(`Failed to update log level: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowOnboardingAgain = async () => {
    setIsResettingOnboarding(true);
    try {
      await invoke("set_setting", {
        key: "onboarding_completed",
        value: "false",
      });
      setShowOnboarding(true);
    } catch (err) {
      alert(`Failed to reset onboarding: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsResettingOnboarding(false);
    }
  };

  // Story 3.5: Handle threshold change with debouncing (300ms)
  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setThreshold(newValue);
    setThresholdMessage(null);

    // Debounce save (300ms) to prevent excessive DB writes during drag
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = window.setTimeout(async () => {
      setThresholdSaving(true);
      try {
        await invoke("set_setting", {
          key: "safety_threshold",
          value: newValue.toString(),
        });
        setThresholdMessage("✓ Saved");
        setTimeout(() => setThresholdMessage(null), 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setThresholdMessage(`Failed: ${errorMessage}`);
        // Revert slider on error
        try {
          const current = await invoke<number>("get_safety_threshold");
          setThreshold(current);
        } catch (revertErr) {
          console.error("Failed to revert threshold:", revertErr);
        }
      } finally {
        setThresholdSaving(false);
      }
    }, 300);
  };

  // Story 4b.4: Handle hourly rate change with 500ms debounce (Subtask 7.6)
  const handleHourlyRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHourlyRate(value);
    setRateMessage(null);

    // Clear pending timeout
    if (hourlyTimeoutRef.current) clearTimeout(hourlyTimeoutRef.current);

    // Don't save empty values
    if (!value.trim()) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;

    // Debounce save (500ms per story requirement)
    hourlyTimeoutRef.current = window.setTimeout(async () => {
      setRateSaving("hourly");
      try {
        await invoke("set_user_hourly_rate", { rate: numValue });
        setRateMessage("✓ Hourly rate saved");
        setTimeout(() => setRateMessage(null), 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setRateMessage(`Failed: ${errorMessage}`);
      } finally {
        setRateSaving(null);
      }
    }, 500);
  }, []);

  // Story 4b.4: Handle project rate change with 500ms debounce (Subtask 7.6)
  const handleProjectRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProjectRateMin(value);
    setRateMessage(null);

    // Clear pending timeout
    if (projectTimeoutRef.current) clearTimeout(projectTimeoutRef.current);

    // Don't save empty values
    if (!value.trim()) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;

    // Debounce save (500ms per story requirement)
    projectTimeoutRef.current = window.setTimeout(async () => {
      setRateSaving("project");
      try {
        await invoke("set_user_project_rate_min", { rate: numValue });
        setRateMessage("✓ Project rate saved");
        setTimeout(() => setRateMessage(null), 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setRateMessage(`Failed: ${errorMessage}`);
      } finally {
        setRateSaving(null);
      }
    }, 500);
  }, []);

  // Story 9.9 Task 5.4: Load skipped versions on mount
  useEffect(() => {
    const loadSkipList = async () => {
      try {
        const versions = await invoke<string[]>("get_failed_update_versions_command");
        setSkippedVersions(versions ?? []);
      } catch {
        // Non-critical — skip list display is informational
      }
    };
    loadSkipList();
  }, []);

  // Story 9.9 Task 5.4: Handle clearing the skip list
  const handleClearSkipList = async () => {
    setClearingSkipList(true);
    setSkipListMessage(null);
    try {
      await invoke("clear_failed_update_versions_command");
      setSkippedVersions([]);
      setSkipListMessage("Skipped updates cleared. All versions will be offered again.");
      setTimeout(() => setSkipListMessage(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setSkipListMessage(`Failed: ${errorMessage}`);
    } finally {
      setClearingSkipList(false);
    }
  };

  // Story 9.7 Task 4.3: Handle auto-update toggle
  const handleAutoUpdateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    try {
      await setAutoUpdateEnabled(newValue);
    } catch (err) {
      console.error("Failed to toggle auto-update:", err);
    }
  };

  // Story 9.7 Task 4.4: Handle check for update button
  const handleCheckForUpdate = async () => {
    setCheckMessage(null);
    try {
      const info = await checkForUpdate();
      const now = new Date().toISOString();
      await setLastUpdateCheck(now);

      if (info) {
        setCheckMessage(`Update available: v${info.version}`);
      } else {
        setCheckMessage("You're up to date!");
      }

      // Clear message after 5 seconds
      setTimeout(() => setCheckMessage(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setCheckMessage(`Check failed: ${errorMessage}`);
    }
  };

  // Story 10.5 Task 3.5-3.7: Handle manual config update check
  const handleCheckForConfigUpdates = async () => {
    setIsCheckingConfig(true);
    setConfigCheckMessage(null);
    try {
      const result = await invoke<{
        success: boolean;
        version: string | null;
        error: string | null;
        source: "remote" | "cached" | "defaults";
      }>("check_for_config_updates");

      const now = new Date().toISOString();
      await setLastConfigChecked(now);
      await setConfigSource(result.source);
      if (result.version) {
        await setLastConfigVersion(result.version);
      }

      if (result.success && result.version) {
        setConfigCheckMessage(`Config updated to v${result.version}`);
      } else {
        setConfigCheckMessage("Config is up to date");
      }
      setTimeout(() => setConfigCheckMessage(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setConfigCheckMessage(`Config check failed: ${errorMessage}. Using cached config.`);
    } finally {
      setIsCheckingConfig(false);
    }
  };

  return (
    <div className="settings-panel">
      <h2>Settings</h2>

      <section className="settings-section">
        <h3>Profile</h3>
        <div className="settings-field">
          <label>Your Skills</label>
          <p className="settings-help">Skills used for job matching and scoring (Story 4b.2)</p>
          <UserSkillsConfig />
        </div>

        {/* Story 4b.4: Rate configuration (Task 7) */}
        <div className="settings-field settings-field--rates">
          <label>Your Rates</label>
          <p className="settings-help" id="rates-help">
            Used to calculate budget alignment for job scoring
          </p>
          <div className="rate-inputs">
            <div className="rate-input-group">
              <label htmlFor="hourly-rate">Hourly Rate ($/hr)</label>
              <input
                type="number"
                id="hourly-rate"
                value={hourlyRate}
                onChange={handleHourlyRateChange}
                placeholder="75"
                min="0"
                max="999999"
                step="0.01"
                disabled={rateSaving === "hourly"}
                aria-describedby="rates-help"
                aria-label="Hourly rate in dollars per hour"
                data-testid="hourly-rate-input"
              />
              {rateSaving === "hourly" && <span className="rate-saving">Saving...</span>}
            </div>
            <div className="rate-input-group">
              <label htmlFor="project-rate">Minimum Project Rate ($)</label>
              <input
                type="number"
                id="project-rate"
                value={projectRateMin}
                onChange={handleProjectRateChange}
                placeholder="2000"
                min="0"
                max="999999"
                step="0.01"
                disabled={rateSaving === "project"}
                aria-describedby="rates-help"
                aria-label="Minimum project rate in dollars"
                data-testid="project-rate-input"
              />
              {rateSaving === "project" && <span className="rate-saving">Saving...</span>}
            </div>
          </div>
          {rateMessage && (
            <p
              className={`settings-message ${rateMessage.includes("Failed") ? "error" : "success"}`}
            >
              {rateMessage}
            </p>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h3>Logging</h3>
        <div className="settings-field">
          <label htmlFor="log-level">Log Level</label>
          <select
            id="log-level"
            value={logLevel}
            onChange={handleLogLevelChange}
            disabled={isSaving}
          >
            <option value="ERROR">ERROR - Errors only</option>
            <option value="WARN">WARN - Warnings and errors</option>
            <option value="INFO">INFO - Normal operation (recommended)</option>
            <option value="DEBUG">DEBUG - Detailed debugging</option>
          </select>
          {saveMessage && (
            <p
              className={`settings-message ${saveMessage.includes("Failed") ? "error" : "success"}`}
            >
              {saveMessage}
            </p>
          )}
          <p className="settings-help">
            Controls the level of detail in log files. Requires app restart to take effect.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h3>Safety</h3>
        <div className="settings-field">
          <label htmlFor="safety-threshold">
            AI Detection Threshold: <strong>{threshold}</strong>
          </label>
          <input
            type="range"
            id="safety-threshold"
            aria-label={`AI Detection Threshold: ${threshold}`}
            min="140"
            max="220"
            step="10"
            value={threshold}
            onChange={handleThresholdChange}
            className="threshold-slider"
            disabled={thresholdSaving}
          />
          <div className="threshold-labels">
            <span>Strict (140)</span>
            <span>Balanced (180)</span>
            <span>Permissive (220)</span>
          </div>
          <p className="settings-help">
            Lower = stricter AI detection checks, Higher = more proposals pass
          </p>
          {thresholdMessage && (
            <p
              className={`settings-message ${thresholdMessage.includes("Failed") ? "error" : "success"}`}
            >
              {thresholdMessage}
            </p>
          )}
        </div>
      </section>

      {/* Story 8.14: Privacy and telemetry */}
      {/* AC-4: No update check sends user data. Constraint: If auto-update is added,
          it must NOT send user data without opt-in. See NFR-8. */}
      <section className="settings-section">
        <h3>Privacy</h3>
        <div className="privacy-indicator">
          <span className="privacy-icon" aria-hidden="true">
            ✓
          </span>
          <span className="privacy-label">Zero Telemetry</span>
          <p className="settings-help">
            No usage data, analytics, or crash reports are sent without your permission. All data
            stays on your device.
          </p>
        </div>

        <div className="settings-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={crashReportingEnabled}
              onChange={handleCrashReportingChange}
              disabled={crashReportingSaving}
              aria-label="Enable crash reporting"
            />
            <span>Enable crash reporting (helps improve the app)</span>
          </label>
          <p className="settings-help settings-help--warning">
            When enabled, anonymous crash data may be sent to help diagnose issues. Disabled by
            default for maximum privacy.
          </p>
          {crashReportingError && (
            <p className="settings-error" role="alert" aria-live="assertive">
              Failed to save: {crashReportingError}
            </p>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h3>Humanization</h3>
        <p className="settings-help">
          Controls how many natural imperfections are injected into generated proposals to reduce AI
          detection risk.
        </p>
        <div className="settings-field humanization-options">
          {INTENSITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`humanization-option${humanizationIntensity === option.value ? " humanization-option--selected" : ""}${intensitySaving ? " humanization-option--disabled" : ""}`}
            >
              <input
                type="radio"
                name="humanization_intensity"
                value={option.value}
                checked={humanizationIntensity === option.value}
                disabled={intensitySaving}
                onChange={async () => {
                  setIntensitySaving(true);
                  setIntensityMessage(null);
                  try {
                    await setSetting("humanization_intensity", option.value);
                    setIntensityMessage("Humanization intensity updated.");
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    setIntensityMessage(`Failed: ${errorMessage}`);
                  } finally {
                    setIntensitySaving(false);
                  }
                }}
              />
              <span className="humanization-option__label">
                {option.label}
                {option.badge && <span className="humanization-option__badge">{option.badge}</span>}
              </span>
              <span className="humanization-option__description">{option.description}</span>
            </label>
          ))}
        </div>
        {intensityMessage && (
          <p
            className={`settings-message ${intensityMessage.includes("Failed") ? "error" : "success"}`}
          >
            {intensityMessage}
          </p>
        )}
      </section>

      <section className="settings-section">
        <h3>Onboarding</h3>
        <button
          onClick={handleShowOnboardingAgain}
          disabled={isResettingOnboarding}
          className="button-secondary"
        >
          {isResettingOnboarding ? "Resetting..." : "Show Onboarding Wizard Again"}
        </button>
        <p className="settings-help">
          Re-run the initial setup wizard to configure your API key and preferences.
        </p>
      </section>

      {/* Story 6.2: Voice Settings - Manual voice parameter adjustments */}
      <section className="settings-section">
        <VoiceSettings />
      </section>

      {/* Story 7.6 & 7.7: Data Management - Export/Import */}
      <section className="settings-section">
        <h3>Data Management</h3>
        <div className="data-management-buttons">
          <DatabaseExportButton />
          <button
            className="button-secondary import-archive-button"
            onClick={() => setShowImportDialog(true)}
            aria-label="Import from encrypted archive"
          >
            Import from Archive
          </button>
        </div>
        <p className="settings-help">
          Export your data to an encrypted .urb file for backup or transfer to another device.
          Import to restore from a previous backup.
        </p>
      </section>

      {/* Story 9.7 Task 4.5: Auto-Update Settings + Story 9.9 Task 5.4: Skip list reset */}
      <section className="settings-section">
        <h3>Auto-Update</h3>
        <div className="settings-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoUpdateEnabled}
              onChange={handleAutoUpdateChange}
              aria-label="Enable automatic update checking"
              data-testid="auto-update-toggle"
            />
            <span>Check for updates automatically</span>
          </label>
          <p className="settings-help">
            When enabled, the app checks for updates in the background every 4 hours.
          </p>
        </div>

        <div className="settings-field">
          <div className="auto-update-info">
            <div className="version-info">
              <span className="version-label">Current Version:</span>
              <span className="version-value" data-testid="current-version">
                {currentVersion || "Loading..."}
              </span>
            </div>
            {lastUpdateCheck && (
              <div className="last-check-info">
                <span className="last-check-label">Last Checked:</span>
                <span className="last-check-value" data-testid="last-update-check">
                  {formatRelativeTime(lastUpdateCheck)}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleCheckForUpdate}
            disabled={isChecking}
            className="button-secondary check-update-button"
            data-testid="check-update-button"
          >
            {isChecking ? "Checking..." : "Check Now"}
          </button>

          {checkMessage && (
            <p
              className={`settings-message ${checkMessage.includes("failed") || checkMessage.includes("Failed") ? "error" : "success"}`}
              role="status"
              aria-live="polite"
              data-testid="check-message"
            >
              {checkMessage}
            </p>
          )}
        </div>

        {/* Story 9.9 Task 5.4: Skip list reset for advanced users */}
        {skippedVersions.length > 0 && (
          <div className="settings-field">
            <p className="settings-help">
              {skippedVersions.length} version{skippedVersions.length !== 1 ? "s" : ""} skipped due to
              failed updates: {skippedVersions.join(", ")}
            </p>
            <button
              onClick={handleClearSkipList}
              disabled={clearingSkipList}
              className="button-secondary"
              data-testid="clear-skip-list-button"
            >
              {clearingSkipList ? "Clearing..." : "Clear Skipped Updates"}
            </button>
            {skipListMessage && (
              <p
                className={`settings-message ${skipListMessage.includes("Failed") ? "error" : "success"}`}
                role="status"
                aria-live="polite"
              >
                {skipListMessage}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Story 10.5 Task 3: Remote Configuration section (AC-2, AC-3, AC-4) */}
      <section className="settings-section">
        <h3>Remote Configuration</h3>

        <div className="settings-field">
          {/* AC-2: Status indicator with 3 states */}
          <div className="remote-config-status-row">
            <span
              className={`remote-config-status-dot remote-config-status-dot--${configSource}`}
              aria-hidden="true"
            />
            <span
              className={`remote-config-status--${configSource}`}
              data-testid="remote-config-status"
            >
              {configSource === "remote" && "Connected"}
              {configSource === "cached" && "Using cached"}
              {configSource === "defaults" && "Using defaults"}
            </span>
          </div>

          {/* AC-2: Last fetched + version */}
          <div className="remote-config-info">
            <div>
              <span className="settings-label">Last fetched: </span>
              <span data-testid="last-config-checked">
                {lastConfigChecked
                  ? new Date(lastConfigChecked).toLocaleString()
                  : "Never"}
              </span>
            </div>
            {lastConfigVersion && (
              <div>
                <span className="settings-label">Config version: </span>
                <span>v{lastConfigVersion}</span>
              </div>
            )}
          </div>

          {/* AC-4: Informational note when using defaults */}
          {configSource === "defaults" && (
            <p className="settings-help settings-help--warning">
              Remote config is unavailable. Using bundled strategies.
            </p>
          )}

          {/* AC-3: Check for Config Updates button (Task 3.5, 3.6) */}
          <button
            onClick={handleCheckForConfigUpdates}
            disabled={isCheckingConfig}
            className="button-secondary"
            data-testid="check-config-button"
          >
            {isCheckingConfig ? "Checking..." : "Check for Config Updates"}
          </button>

          {/* AC-3: Success / failure feedback (Task 3.7) */}
          {configCheckMessage && (
            <p
              className={`settings-message ${configCheckMessage.includes("failed") ? "error" : "success"}`}
              role="status"
              aria-live="polite"
              data-testid="config-check-message"
            >
              {configCheckMessage}
            </p>
          )}
        </div>
      </section>

      {/* Story 7.7: Import Archive Dialog */}
      {showImportDialog && (
        <ImportArchiveDialog
          onClose={() => setShowImportDialog(false)}
          onImportComplete={() => {
            // AC-6: Invalidate all TanStack Query caches so UI reflects imported data
            queryClient.invalidateQueries();
          }}
        />
      )}
    </div>
  );
}

export default SettingsPanel;
