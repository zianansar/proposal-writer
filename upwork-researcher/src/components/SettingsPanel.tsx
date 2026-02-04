import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";

function SettingsPanel() {
  const { getSetting } = useSettingsStore();
  const { setShowOnboarding } = useOnboardingStore();
  const [logLevel, setLogLevel] = useState("INFO");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isResettingOnboarding, setIsResettingOnboarding] = useState(false);

  useEffect(() => {
    // Load current log level from settings
    const currentLevel = getSetting("log_level") || "INFO";
    setLogLevel(currentLevel);
  }, [getSetting]);

  const handleLogLevelChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newLevel = e.target.value;
    setLogLevel(newLevel);
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await invoke("set_log_level", { level: newLevel });
      setSaveMessage(
        "Log level updated. Restart the app for changes to take effect."
      );
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
      alert(
        `Failed to reset onboarding: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsResettingOnboarding(false);
    }
  };

  return (
    <div className="settings-panel">
      <h2>Settings</h2>

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
            Controls the level of detail in log files. Requires app restart to
            take effect.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h3>Onboarding</h3>
        <button
          onClick={handleShowOnboardingAgain}
          disabled={isResettingOnboarding}
          className="button-secondary"
        >
          {isResettingOnboarding
            ? "Resetting..."
            : "Show Onboarding Wizard Again"}
        </button>
        <p className="settings-help">
          Re-run the initial setup wizard to configure your API key and
          preferences.
        </p>
      </section>
    </div>
  );
}

export default SettingsPanel;
