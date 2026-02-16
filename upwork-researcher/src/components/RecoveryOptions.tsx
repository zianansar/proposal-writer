import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useState } from "react";
import "./RecoveryOptions.css";

interface RecoveryOptionsProps {
  passphrase: string;
  onComplete: () => void;
  onSkip: () => void;
}

interface RecoveryKeyData {
  key: string;
  encrypted: string;
}

type SelectedOption = "none" | "recovery-key" | "backup" | "skipped";

function RecoveryOptions({ passphrase, onComplete, onSkip }: RecoveryOptionsProps) {
  const [selectedOption, setSelectedOption] = useState<SelectedOption>("none");
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate recovery key
  const handleGenerateRecoveryKey = async () => {
    setError(null);
    setGenerating(true);

    try {
      const data: RecoveryKeyData = await invoke("generate_recovery_key", {
        passphrase,
      });

      setRecoveryKey(data.key);
      setSelectedOption("recovery-key");
    } catch (err) {
      setError(err as string);
    } finally {
      setGenerating(false);
    }
  };

  // Print recovery key
  const handlePrint = () => {
    window.print();
  };

  // Copy recovery key to clipboard (L1 fix: use Tauri clipboard plugin)
  const handleCopy = async () => {
    if (recoveryKey) {
      try {
        await writeText(recoveryKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Failed to copy to clipboard");
      }
    }
  };

  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Handle export backup (Story 2.9, AC3)
  const handleExportBackup = async () => {
    setError(null);
    setExporting(true);
    try {
      const result = await invoke<{
        success: boolean;
        filePath: string;
        message: string;
      }>("export_unencrypted_backup");

      if (result.success) {
        setBackupPath(result.filePath);
        setSelectedOption("backup");
      }
      // If not success, user cancelled the dialog — do nothing
    } catch (err) {
      setError(err as string);
    } finally {
      setExporting(false);
    }
  };

  // Handle skip with confirmation
  const handleSkipClick = () => {
    setShowSkipConfirmation(true);
  };

  const handleConfirmSkip = () => {
    setSelectedOption("skipped");
    onSkip();
  };

  const handleCancelSkip = () => {
    setShowSkipConfirmation(false);
  };

  const canContinue = selectedOption !== "none" && (selectedOption !== "recovery-key" || saved);

  return (
    <div className="recovery-options-container">
      <div className="recovery-options-content">
        <h1 className="recovery-title">Protect Your Data - Set Up Recovery</h1>
        <div className="recovery-warning">
          ⚠️ If you forget your passphrase AND lose your recovery key, your data CANNOT be recovered
        </div>

        <div className="recovery-options-grid">
          {/* Option 1: Recovery Key */}
          <div
            className={`recovery-option-card ${selectedOption === "recovery-key" ? "selected" : ""}`}
          >
            <h2 className="option-title">🔑 Generate Recovery Key</h2>
            <p className="option-description">
              Generate a 32-character recovery key that can unlock your data if you forget your
              passphrase. Print or write it down and store it securely offline.
            </p>

            {!recoveryKey ? (
              <button
                type="button"
                onClick={handleGenerateRecoveryKey}
                disabled={generating}
                className="option-btn primary"
              >
                {generating ? "Generating..." : "Generate Key"}
              </button>
            ) : (
              <div className="recovery-key-display">
                <div className="recovery-key-value" data-print="show">
                  {recoveryKey}
                </div>

                <div className="recovery-key-actions">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`action-btn ${copied ? "copied" : ""}`}
                  >
                    {copied ? "✅ Copied!" : "📋 Copy"}
                  </button>
                  <button type="button" onClick={handlePrint} className="action-btn">
                    🖨️ Print
                  </button>
                </div>

                <div className="recovery-key-instructions">
                  ⚠️ Print or write this down and store it securely offline
                </div>

                <label className="confirmation-checkbox">
                  <input
                    type="checkbox"
                    checked={saved}
                    onChange={(e) => setSaved(e.target.checked)}
                  />
                  I have saved my recovery key in a secure location
                </label>
              </div>
            )}
          </div>

          {/* Option 2: Export Backup */}
          <div className={`recovery-option-card ${selectedOption === "backup" ? "selected" : ""}`}>
            <h2 className="option-title">💾 Export Unencrypted Backup</h2>
            <p className="option-description">
              Export your data as an unencrypted JSON file. Keep this file in a secure location.
            </p>
            <div className="backup-warning">⚠️ This backup is NOT encrypted. Keep it secure.</div>

            {backupPath ? (
              <div className="backup-success">
                Backup saved to: <span className="backup-path">{backupPath}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={exporting}
                className="option-btn secondary"
              >
                {exporting ? "Exporting..." : "Export Backup"}
              </button>
            )}
          </div>

          {/* Option 3: Skip */}
          <div className={`recovery-option-card ${selectedOption === "skipped" ? "selected" : ""}`}>
            <h2 className="option-title">⏭️ Skip Recovery Setup</h2>
            <p className="option-description">
              Continue without recovery options. You won't be able to recover your data if you
              forget your passphrase.
            </p>

            <button type="button" onClick={handleSkipClick} className="option-btn warning">
              Skip
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="recovery-actions">
          <button
            type="button"
            onClick={onComplete}
            disabled={!canContinue}
            className="continue-btn"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Skip Confirmation Modal (L2 fix: accessibility attributes) */}
      {showSkipConfirmation && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-modal-title"
        >
          <div className="modal-content">
            <h2 className="modal-title" id="skip-modal-title">
              Skip Recovery Setup?
            </h2>
            <p className="modal-warning">
              Without a recovery option, forgotten passphrases CANNOT be recovered. You will lose
              all your data.
            </p>

            <div className="modal-actions">
              <button onClick={handleCancelSkip} className="modal-btn primary">
                Go Back and Set Up Recovery
              </button>
              <button onClick={handleConfirmSkip} className="modal-btn destructive">
                Skip Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecoveryOptions;
