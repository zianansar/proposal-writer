import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import "./PassphraseEntry.css";

interface PassphraseStrength {
  level: "weak" | "medium" | "strong";
  meetsMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

type PassphraseMode = "setup" | "recovery" | "new-passphrase";

interface PassphraseEntryProps {
  onComplete: (passphrase: string) => void;
  onCancel?: () => void;
  /** Show "Use Recovery Key" link (AC6) */
  showRecoveryOption?: boolean;
}

function PassphraseEntry({ onComplete, onCancel, showRecoveryOption }: PassphraseEntryProps) {
  const [mode, setMode] = useState<PassphraseMode>("setup");
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [strength, setStrength] = useState<PassphraseStrength>({
    level: "weak",
    meetsMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSymbol: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Calculate passphrase strength
  useEffect(() => {
    const meetsMinLength = passphrase.length >= 12;
    const hasUppercase = /[A-Z]/.test(passphrase);
    const hasLowercase = /[a-z]/.test(passphrase);
    const hasNumber = /[0-9]/.test(passphrase);
    const hasSymbol = /[^A-Za-z0-9]/.test(passphrase);

    let level: "weak" | "medium" | "strong" = "weak";

    if (meetsMinLength) {
      const criteriaCount = [hasUppercase, hasLowercase, hasNumber, hasSymbol].filter(
        Boolean,
      ).length;

      if (criteriaCount >= 4) {
        level = "strong";
      } else if (criteriaCount >= 2) {
        level = "medium";
      }
    }

    setStrength({
      level,
      meetsMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSymbol,
    });
  }, [passphrase]);

  const canSubmit =
    strength.meetsMinLength &&
    passphrase === confirmation &&
    confirmation.length > 0 &&
    acknowledged;

  // Handle recovery key verification (Story 2.9, AC6)
  const handleRecoveryKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setVerifying(true);

    try {
      const result = await invoke<{ success: boolean; message: string }>(
        "unlock_with_recovery_key",
        { recoveryKey: recoveryKeyInput },
      );

      if (result.success) {
        setRecoveryVerified(true);
        setMode("new-passphrase");
        // Reset passphrase fields for new passphrase entry
        setPassphrase("");
        setConfirmation("");
        setAcknowledged(false);
      }
    } catch (err) {
      setRecoveryError(err as string);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    setError(null);

    try {
      if (mode === "new-passphrase" && recoveryVerified) {
        // After recovery: set new passphrase and re-encrypt recovery key
        await invoke("set_new_passphrase_after_recovery", {
          newPassphrase: passphrase,
          recoveryKey: recoveryKeyInput,
        });
      } else {
        // Normal setup: set passphrase and derive key
        await invoke("set_passphrase", { passphrase });
      }
      onComplete(passphrase);
    } catch (err) {
      setError(err as string);
    }
  };

  const getStrengthColor = () => {
    switch (strength.level) {
      case "weak":
        return "#ef4444"; // red
      case "medium":
        return "#eab308"; // yellow
      case "strong":
        return "#22c55e"; // green
    }
  };

  const getStrengthText = () => {
    switch (strength.level) {
      case "weak":
        return "Weak";
      case "medium":
        return "Medium";
      case "strong":
        return "Strong";
    }
  };

  // Recovery key mode (AC6)
  if (mode === "recovery") {
    return (
      <div className="passphrase-entry-container">
        <div className="passphrase-entry-content">
          <h1 className="passphrase-title">Recovery Key</h1>
          <p className="passphrase-subtitle">
            Enter your 32-character recovery key to unlock your data
          </p>

          <form onSubmit={handleRecoveryKeySubmit} className="passphrase-form">
            <div className="form-group">
              <label htmlFor="recovery-key" className="form-label">
                Recovery Key (32 alphanumeric characters)
              </label>
              <input
                id="recovery-key"
                type="text"
                value={recoveryKeyInput}
                onChange={(e) => setRecoveryKeyInput(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                className="password-input recovery-key-input"
                placeholder="Enter your 32-character recovery key"
                maxLength={32}
                autoFocus
              />
              <div className="recovery-key-count">{recoveryKeyInput.length}/32 characters</div>
            </div>

            {recoveryError && (
              <div className="error-banner">
                <strong>Error:</strong> {recoveryError}
              </div>
            )}

            <div className="button-group">
              <button
                type="button"
                onClick={() => {
                  setMode("setup");
                  setRecoveryError(null);
                }}
                className="btn btn-secondary"
              >
                Back to Passphrase
              </button>
              <button
                type="submit"
                disabled={recoveryKeyInput.length !== 32 || verifying}
                className="btn btn-primary"
              >
                {verifying ? "Verifying..." : "Unlock with Recovery Key"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="passphrase-entry-container">
      <div className="passphrase-entry-content">
        <h1 className="passphrase-title">
          {mode === "new-passphrase" ? "Set New Passphrase" : "Protect Your Data"}
        </h1>
        <p className="passphrase-subtitle">
          {mode === "new-passphrase"
            ? "Recovery successful! Set a new passphrase for your data."
            : "Create a strong passphrase to encrypt your proposals and API key"}
        </p>

        <form onSubmit={handleSubmit} className="passphrase-form">
          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="passphrase" className="form-label">
              Passphrase (minimum 12 characters)
            </label>
            <div className="password-input-wrapper">
              <input
                id="passphrase"
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="password-input"
                placeholder="Enter a strong passphrase"
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="toggle-visibility-btn"
                aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
              >
                {showPassphrase ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Strength Meter */}
          {passphrase.length > 0 && (
            <div className="strength-meter">
              <div className="strength-bar-container">
                <div
                  className="strength-bar"
                  style={{
                    width: `${strength.level === "weak" ? 33 : strength.level === "medium" ? 66 : 100}%`,
                    backgroundColor: getStrengthColor(),
                  }}
                />
              </div>
              <div className="strength-text" style={{ color: getStrengthColor() }}>
                {getStrengthText()}
              </div>
              <div className="strength-requirements">
                <div className={strength.meetsMinLength ? "requirement-met" : "requirement-unmet"}>
                  {strength.meetsMinLength ? "✓" : "○"} At least 12 characters
                </div>
                <div className={strength.hasUppercase ? "requirement-met" : "requirement-unmet"}>
                  {strength.hasUppercase ? "✓" : "○"} Uppercase letter
                </div>
                <div className={strength.hasLowercase ? "requirement-met" : "requirement-unmet"}>
                  {strength.hasLowercase ? "✓" : "○"} Lowercase letter
                </div>
                <div className={strength.hasNumber ? "requirement-met" : "requirement-unmet"}>
                  {strength.hasNumber ? "✓" : "○"} Number
                </div>
                <div className={strength.hasSymbol ? "requirement-met" : "requirement-unmet"}>
                  {strength.hasSymbol ? "✓" : "○"} Symbol (recommended)
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Field */}
          <div className="form-group">
            <label htmlFor="confirmation" className="form-label">
              Confirm Passphrase
            </label>
            <input
              id="confirmation"
              type={showPassphrase ? "text" : "password"}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="password-input"
              placeholder="Re-enter your passphrase"
              autoComplete="new-password"
            />
            {confirmation.length > 0 && passphrase !== confirmation && (
              <div className="error-text">Passphrases do not match</div>
            )}
          </div>

          {/* Critical Warning Banner */}
          <div className="critical-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <h3 className="warning-title">CRITICAL WARNING</h3>
              <ul className="warning-list">
                <li>If you forget your passphrase...</li>
                <li>AND lose your recovery key...</li>
                <li>
                  → All proposals are <strong>PERMANENTLY UNRECOVERABLE</strong>
                </li>
                <li>We cannot reset your password or decrypt your data</li>
              </ul>
              <p className="warning-footer">Keep your recovery key in a safe place!</p>
            </div>
          </div>

          {/* Acknowledgment Checkbox */}
          <div className="acknowledgment-container">
            <label className="acknowledgment-label">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="acknowledgment-checkbox"
              />
              <span className="acknowledgment-text">
                I understand my data will be permanently lost if I forget my passphrase and lose my
                recovery key
              </span>
            </label>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-banner">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="button-group">
            {onCancel && (
              <button type="button" onClick={onCancel} className="btn btn-secondary">
                Cancel
              </button>
            )}
            <button type="submit" disabled={!canSubmit} className="btn btn-primary">
              {mode === "new-passphrase" ? "Set New Passphrase" : "Set Passphrase"}
            </button>
          </div>

          {/* Recovery Key Link (AC6) */}
          {showRecoveryOption && mode === "setup" && (
            <div className="recovery-link-container">
              <button type="button" onClick={() => setMode("recovery")} className="recovery-link">
                Forgot passphrase? Use recovery key
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default PassphraseEntry;
