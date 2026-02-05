import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./PassphraseEntry.css";

interface PassphraseStrength {
  level: "weak" | "medium" | "strong";
  meetsMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

interface PassphraseEntryProps {
  onComplete: (passphrase: string) => void;
  onCancel?: () => void;
}

function PassphraseEntry({ onComplete, onCancel }: PassphraseEntryProps) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
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
      const criteriaCount = [hasUppercase, hasLowercase, hasNumber, hasSymbol].filter(Boolean).length;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    setError(null);

    try {
      // Call backend to set passphrase and derive key
      await invoke("set_passphrase", { passphrase });
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

  return (
    <div className="passphrase-entry-container">
      <div className="passphrase-entry-content">
        <h1 className="passphrase-title">Protect Your Data</h1>
        <p className="passphrase-subtitle">
          Create a strong passphrase to encrypt your proposals and API key
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
                {showPassphrase ? "👁️" : "👁️‍🗨️"}
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
                <li>→ All proposals are <strong>PERMANENTLY UNRECOVERABLE</strong></li>
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
                I understand my data will be permanently lost if I forget my passphrase and lose my recovery key
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
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn btn-primary"
            >
              Set Passphrase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PassphraseEntry;
