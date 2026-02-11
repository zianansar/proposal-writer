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
 * Story 2-7b: Passphrase unlock modal for encrypted database access on restart.
 *
 * Shown when the app detects an encrypted database (migration marker exists)
 * and needs the user's passphrase to derive the decryption key.
 *
 * Features:
 * - Password input with show/hide toggle
 * - Failed attempt counter
 * - Recovery key option after 5 failures
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [recoveryMode]);

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
        onUnlocked();
      }
    } catch (err) {
      setRecoveryError(typeof err === 'string' ? err : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (recoveryMode) {
    return (
      <div className="passphrase-unlock-overlay" role="dialog" aria-modal="true" aria-label="Recovery key entry">
        <div className="passphrase-unlock-modal">
          <div className="passphrase-unlock-icon" aria-hidden="true">🔑</div>
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
        <div className="passphrase-unlock-icon" aria-hidden="true">🔒</div>
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
