import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./PassphraseUnlock.css";

interface VerifyPassphraseResult {
  success: boolean;
  message: string;
  failedAttempts: number;
  showRecovery: boolean;
}

interface PassphraseUnlockProps {
  onUnlocked: () => void;
}

/**
 * Story 2-7b + TD-2: Passphrase unlock modal for encrypted database access on restart.
 *
 * Shown when the app detects an encrypted database (migration marker exists)
 * and needs the user's passphrase to derive the decryption key.
 *
 * Features:
 * - Password input with show/hide toggle
 * - Failed attempt counter
 * - Recovery key option after 5 failures
 * - TD-2: New passphrase entry after recovery key unlock (re-keys database)
 * - Loading state during key derivation (~200ms Argon2id)
 * - Auto-focus on mount
 */
function PassphraseUnlock({ onUnlocked }: PassphraseUnlockProps) {
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // TD-2: New passphrase mode after recovery unlock
  const [newPassphraseMode, setNewPassphraseMode] = useState(false);
  const [newPassphrase, setNewPassphrase] = useState("");
  const [newPassphraseConfirm, setNewPassphraseConfirm] = useState("");
  const [showNewPassphrase, setShowNewPassphrase] = useState(false);
  const [rekeyError, setRekeyError] = useState<string | null>(null);
  const [rekeySuccess, setRekeySuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [recoveryMode, newPassphraseMode]);

  // Passphrase strength calculation (mirrors PassphraseEntry.tsx)
  const meetsMinLength = newPassphrase.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassphrase);
  const hasLowercase = /[a-z]/.test(newPassphrase);
  const hasNumber = /[0-9]/.test(newPassphrase);
  const hasSymbol = /[^A-Za-z0-9]/.test(newPassphrase);
  const criteriaCount = [hasUppercase, hasLowercase, hasNumber, hasSymbol].filter(Boolean).length;
  const strengthLevel = meetsMinLength
    ? criteriaCount >= 4 ? "strong" : criteriaCount >= 2 ? "medium" : "weak"
    : "weak";
  const canSubmitNewPassphrase =
    meetsMinLength &&
    newPassphrase === newPassphraseConfirm &&
    newPassphraseConfirm.length > 0 &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passphrase.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<VerifyPassphraseResult>(
        "verify_passphrase_on_restart",
        { passphrase }
      );

      if (result.success) {
        onUnlocked();
      } else {
        setFailedAttempts(result.failedAttempts);
        setShowRecovery(result.showRecovery);
        setError(result.message);
        setPassphrase("");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryKey.length !== 32 || loading) return;

    setLoading(true);
    setRecoveryError(null);

    try {
      const result = await invoke<{ success: boolean; message: string }>(
        "unlock_with_recovery_key",
        { recoveryKey }
      );

      if (result.success) {
        // TD-2: Transition to new passphrase mode instead of immediately unlocking
        setNewPassphraseMode(true);
        setRecoveryMode(false);
      }
    } catch (err) {
      setRecoveryError(typeof err === 'string' ? err : String(err));
    } finally {
      setLoading(false);
    }
  };

  // TD-2: Handle new passphrase submission after recovery
  const handleNewPassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitNewPassphrase) return;

    setLoading(true);
    setRekeyError(null);

    try {
      await invoke("set_new_passphrase_after_recovery", {
        newPassphrase,
        recoveryKey,
      });
      // Clear sensitive data from state immediately after successful use
      setNewPassphrase("");
      setNewPassphraseConfirm("");
      setRecoveryKey("");
      setRekeySuccess(true);
    } catch (err) {
      const msg = typeof err === 'string' ? err : String(err);
      setRekeyError(msg || "Failed to update passphrase. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // TD-2: Success screen after re-key
  if (rekeySuccess) {
    return (
      <div className="passphrase-unlock-overlay" role="dialog" aria-modal="true" aria-label="Passphrase updated">
        <div className="passphrase-unlock-modal">
          <div className="passphrase-unlock-icon" aria-hidden="true">&#x2705;</div>
          <h2 className="passphrase-unlock-title">Passphrase Updated</h2>
          <p className="passphrase-unlock-subtitle">
            Your database is re-encrypted with the new passphrase.
          </p>
          <button
            type="button"
            onClick={onUnlocked}
            className="passphrase-unlock-btn passphrase-unlock-btn-primary passphrase-unlock-btn-full"
            autoFocus
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // TD-2: New passphrase entry after recovery unlock
  if (newPassphraseMode) {
    return (
      <div className="passphrase-unlock-overlay" role="dialog" aria-modal="true" aria-label="Set new passphrase">
        <div className="passphrase-unlock-modal">
          <div className="passphrase-unlock-icon" aria-hidden="true">&#x1F510;</div>
          <h2 className="passphrase-unlock-title">Set New Passphrase</h2>
          <p className="passphrase-unlock-subtitle">
            Recovery successful! Set a new passphrase to re-encrypt your database.
          </p>

          <form onSubmit={handleNewPassphraseSubmit} className="passphrase-unlock-form">
            <div className="passphrase-unlock-field">
              <label htmlFor="new-passphrase-input" className="passphrase-unlock-label">
                New Passphrase (minimum 12 characters)
              </label>
              <div className="passphrase-unlock-input-wrapper">
                <input
                  ref={inputRef}
                  id="new-passphrase-input"
                  type={showNewPassphrase ? "text" : "password"}
                  value={newPassphrase}
                  onChange={(e) => setNewPassphrase(e.target.value)}
                  className="passphrase-unlock-input"
                  placeholder="Enter a strong passphrase"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassphrase(!showNewPassphrase)}
                  className="passphrase-unlock-toggle"
                  aria-label={showNewPassphrase ? "Hide passphrase" : "Show passphrase"}
                >
                  {showNewPassphrase ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {newPassphrase.length > 0 && (
              <div className="passphrase-unlock-strength" data-testid="strength-meter">
                <div
                  className="passphrase-unlock-strength-bar"
                  style={{
                    width: `${strengthLevel === "weak" ? 33 : strengthLevel === "medium" ? 66 : 100}%`,
                    backgroundColor: strengthLevel === "weak" ? "var(--color-error, #ef4444)" : strengthLevel === "medium" ? "var(--color-warning, #eab308)" : "var(--color-success, #22c55e)",
                  }}
                />
                <span className="passphrase-unlock-strength-text">
                  {strengthLevel === "weak" ? "Weak" : strengthLevel === "medium" ? "Medium" : "Strong"}
                </span>
              </div>
            )}

            <div className="passphrase-unlock-field">
              <label htmlFor="confirm-passphrase-input" className="passphrase-unlock-label">
                Confirm Passphrase
              </label>
              <input
                id="confirm-passphrase-input"
                type={showNewPassphrase ? "text" : "password"}
                value={newPassphraseConfirm}
                onChange={(e) => setNewPassphraseConfirm(e.target.value)}
                className="passphrase-unlock-input"
                placeholder="Re-enter your passphrase"
                autoComplete="new-password"
                disabled={loading}
              />
              {newPassphraseConfirm.length > 0 && newPassphrase !== newPassphraseConfirm && (
                <div className="passphrase-unlock-error" role="alert">
                  Passphrases do not match
                </div>
              )}
            </div>

            {rekeyError && (
              <div className="passphrase-unlock-error" role="alert">
                {rekeyError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmitNewPassphrase}
              className="passphrase-unlock-btn passphrase-unlock-btn-primary passphrase-unlock-btn-full"
            >
              {loading ? "Re-encrypting..." : "Set New Passphrase"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (recoveryMode) {
    return (
      <div className="passphrase-unlock-overlay" role="dialog" aria-modal="true" aria-label="Recovery key entry">
        <div className="passphrase-unlock-modal">
          <div className="passphrase-unlock-icon" aria-hidden="true">&#x1F511;</div>
          <h2 className="passphrase-unlock-title">Recovery Key</h2>
          <p className="passphrase-unlock-subtitle">
            Enter your 32-character recovery key to unlock your data
          </p>

          <form onSubmit={handleRecoverySubmit} className="passphrase-unlock-form">
            <div className="passphrase-unlock-field">
              <label htmlFor="recovery-key-input" className="passphrase-unlock-label">
                Recovery Key
              </label>
              <input
                ref={inputRef}
                id="recovery-key-input"
                type="text"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                className="passphrase-unlock-input"
                placeholder="Enter 32-character recovery key"
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="passphrase-unlock-hint">
                {recoveryKey.length}/32 characters
              </div>
            </div>

            {recoveryError && (
              <div className="passphrase-unlock-error" role="alert">
                {recoveryError}
              </div>
            )}

            <div className="passphrase-unlock-actions">
              <button
                type="button"
                onClick={() => { setRecoveryMode(false); setRecoveryError(null); }}
                className="passphrase-unlock-btn passphrase-unlock-btn-secondary"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={recoveryKey.length !== 32 || loading}
                className="passphrase-unlock-btn passphrase-unlock-btn-primary"
              >
                {loading ? "Unlocking..." : "Unlock"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="passphrase-unlock-overlay" role="dialog" aria-modal="true" aria-label="Database unlock">
      <div className="passphrase-unlock-modal">
        <div className="passphrase-unlock-icon" aria-hidden="true">&#x1F512;</div>
        <h2 className="passphrase-unlock-title">Unlock Database</h2>
        <p className="passphrase-unlock-subtitle">
          Enter your passphrase to access your encrypted proposals
        </p>

        <form onSubmit={handleSubmit} className="passphrase-unlock-form">
          <div className="passphrase-unlock-field">
            <label htmlFor="passphrase-input" className="passphrase-unlock-label">
              Passphrase
            </label>
            <div className="passphrase-unlock-input-wrapper">
              <input
                ref={inputRef}
                id="passphrase-input"
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="passphrase-unlock-input"
                placeholder="Enter your passphrase"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="passphrase-unlock-toggle"
                aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
              >
                {showPassphrase ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="passphrase-unlock-error" role="alert">
              {error}
            </div>
          )}

          {failedAttempts > 1 && (
            <div className="passphrase-unlock-counter" aria-live="polite">
              Attempt {failedAttempts}/5
            </div>
          )}

          <button
            type="submit"
            disabled={!passphrase.trim() || loading}
            className="passphrase-unlock-btn passphrase-unlock-btn-primary passphrase-unlock-btn-full"
          >
            {loading ? "Unlocking..." : "Unlock"}
          </button>

          {showRecovery && (
            <button
              type="button"
              onClick={() => setRecoveryMode(true)}
              className="passphrase-unlock-btn passphrase-unlock-btn-secondary passphrase-unlock-btn-full"
            >
              Restore from Backup
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default PassphraseUnlock;
