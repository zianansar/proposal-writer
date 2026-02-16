// ImportArchiveDialog — Multi-step wizard for importing encrypted .urb archives (Story 7.7)

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useState, useEffect, useCallback } from "react";
import "./ImportArchiveDialog.css";

interface ArchiveMetadata {
  formatVersion: number;
  exportDate: string;
  appVersion: string;
  passphraseHint: string | null;
  proposalCount: number;
  revisionCount: number;
  jobPostCount: number;
  settingsCount: number;
  voiceProfileCount: number;
  dbSizeBytes: number;
}

interface ImportPreview {
  metadata: ArchiveMetadata;
  schemaCompatibility: "compatible" | "older" | "newer";
  archiveVersion: number | null;
  currentVersion: number;
  warnings: string[];
}

interface ImportProgress {
  table: string;
  current: number;
  total: number;
  phase: string;
}

interface ImportSummary {
  proposalsImported: number;
  proposalsSkipped: number;
  jobsImported: number;
  revisionsImported: number;
  settingsImported: number;
  settingsSkipped: number;
  voiceProfileImported: boolean;
  totalRecords: number;
}

type ImportStep = "select" | "metadata" | "decrypt" | "mode" | "importing" | "complete" | "error";
type ImportMode = "replace" | "merge";

interface ImportArchiveDialogProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export function ImportArchiveDialog({ onClose, onImportComplete }: ImportArchiveDialogProps) {
  const [step, setStep] = useState<ImportStep>("select");
  const [archivePath, setArchivePath] = useState<string>("");
  const [metadata, setMetadata] = useState<ArchiveMetadata | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Listen for import progress events
  useEffect(() => {
    const unlisten = listen<ImportProgress>("import-progress", (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Task 5.2: File picker
  const handleSelectFile = useCallback(async () => {
    try {
      const selected = await open({
        title: "Select Archive File",
        filters: [{ name: "Upwork Research Backup", extensions: ["urb"] }],
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        setArchivePath(selected);
        setIsProcessing(true);
        setError("");

        try {
          // Task 5.3: Read metadata
          const meta = await invoke<ArchiveMetadata>("read_archive_metadata", {
            archivePath: selected,
          });

          setMetadata(meta);
          setStep("metadata");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to read archive");
          setStep("error");
        } finally {
          setIsProcessing(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open file picker");
      setStep("error");
    }
  }, []);

  // Task 6.2: Decrypt and show preview
  const handleDecrypt = useCallback(async () => {
    if (!passphrase || !archivePath) return;

    setIsProcessing(true);
    setError("");

    try {
      const previewData = await invoke<ImportPreview>("decrypt_archive", {
        archivePath,
        passphrase,
      });

      setPreview(previewData);
      setStep("mode");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Decryption failed";
      setError(errorMsg);
      // Stay on decrypt step for retry
    } finally {
      setIsProcessing(false);
    }
  }, [archivePath, passphrase]);

  // Task 7.2: Execute import
  const handleImport = useCallback(async () => {
    if (!archivePath || !passphrase) return;

    // Task 6.6: Validate Replace All confirmation
    if (mode === "replace" && !replaceConfirmed) {
      setError("Please confirm that you understand this will delete your current data");
      return;
    }

    setIsProcessing(true);
    setError("");
    setStep("importing");

    try {
      const result = await invoke<ImportSummary>("execute_import", {
        archivePath,
        passphrase,
        mode,
      });

      setSummary(result);
      setStep("complete");
      // Cache invalidation happens when user clicks "Done" (onImportComplete in Done handler)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Import failed";
      setError(errorMsg);
      setStep("error");
    } finally {
      setIsProcessing(false);
    }
  }, [archivePath, passphrase, mode, replaceConfirmed]);

  const formatDate = (isoDate: string): string => {
    try {
      return new Date(isoDate).toLocaleString();
    } catch {
      return isoDate;
    }
  };

  const getStepNumber = (): number => {
    switch (step) {
      case "select":
        return 1;
      case "metadata":
        return 2;
      case "decrypt":
        return 3;
      case "mode":
        return 4;
      case "importing":
        return 5;
      case "complete":
        return 5;
      case "error":
        return 0;
    }
  };

  return (
    <div
      className="import-dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="import-dialog" role="dialog" aria-labelledby="import-dialog-title">
        <div className="import-dialog-header">
          <h2 id="import-dialog-title">Import from Archive</h2>
          {step !== "importing" && (
            <button
              className="import-dialog-close"
              onClick={onClose}
              aria-label="Close import dialog"
            >
              ✕
            </button>
          )}
        </div>

        {/* Multi-step indicator */}
        {step !== "error" && step !== "complete" && (
          <div className="import-steps-indicator">
            {[1, 2, 3, 4, 5].map((num) => (
              <div
                key={num}
                className={`step-circle ${num <= getStepNumber() ? "active" : ""} ${num < getStepNumber() ? "completed" : ""}`}
              >
                {num}
              </div>
            ))}
          </div>
        )}

        <div className="import-dialog-content">
          {/* Step 1: File Selection */}
          {step === "select" && (
            <div className="import-step">
              <h3>Select Archive File</h3>
              <p>Choose an encrypted .urb backup file to import.</p>
              <button
                className="select-archive-button"
                onClick={handleSelectFile}
                disabled={isProcessing}
              >
                {isProcessing ? "Loading..." : "Select Archive File"}
              </button>
            </div>
          )}

          {/* Step 2: Metadata Display */}
          {step === "metadata" && metadata && (
            <div className="import-step">
              <h3>Archive Information</h3>
              <div className="metadata-display">
                <div className="metadata-row">
                  <span className="metadata-label">Export Date:</span>
                  <span className="metadata-value">{formatDate(metadata.exportDate)}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">App Version:</span>
                  <span className="metadata-value">{metadata.appVersion}</span>
                </div>
                {metadata.passphraseHint && (
                  <div className="metadata-row metadata-hint">
                    <span className="metadata-label">Passphrase Hint:</span>
                    <span className="metadata-value">"{metadata.passphraseHint}"</span>
                  </div>
                )}
                <div className="metadata-section-title">Contents:</div>
                <div className="metadata-counts">
                  <div className="count-item">
                    <span className="count-value">{metadata.proposalCount}</span>
                    <span className="count-label">Proposals</span>
                  </div>
                  <div className="count-item">
                    <span className="count-value">{metadata.revisionCount}</span>
                    <span className="count-label">Revisions</span>
                  </div>
                  <div className="count-item">
                    <span className="count-value">{metadata.jobPostCount}</span>
                    <span className="count-label">Jobs</span>
                  </div>
                  <div className="count-item">
                    <span className="count-value">{metadata.settingsCount}</span>
                    <span className="count-label">Settings</span>
                  </div>
                  {metadata.voiceProfileCount > 0 && (
                    <div className="count-item">
                      <span className="count-value">{metadata.voiceProfileCount}</span>
                      <span className="count-label">Voice Profile</span>
                    </div>
                  )}
                </div>
              </div>
              <button className="import-button-primary" onClick={() => setStep("decrypt")}>
                Next: Enter Passphrase
              </button>
            </div>
          )}

          {/* Step 3: Passphrase Entry & Preview */}
          {step === "decrypt" && (
            <div className="import-step">
              <h3>Decrypt Archive</h3>
              {metadata?.passphraseHint && (
                <div className="passphrase-hint-reminder">Hint: "{metadata.passphraseHint}"</div>
              )}
              <div className="passphrase-input-group">
                <label htmlFor="import-passphrase">Archive Passphrase:</label>
                <div className="passphrase-input-wrapper">
                  <input
                    id="import-passphrase"
                    type={showPassphrase ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDecrypt()}
                    placeholder="Enter passphrase"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="toggle-passphrase"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                  >
                    {showPassphrase ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
              {error && <div className="error-message">{error}</div>}
              <button
                className="import-button-primary"
                onClick={handleDecrypt}
                disabled={!passphrase || isProcessing}
              >
                {isProcessing ? "Decrypting..." : "Decrypt Archive"}
              </button>
            </div>
          )}

          {/* Step 4: Import Mode Selection */}
          {step === "mode" && preview && (
            <div className="import-step">
              <h3>Import Preview</h3>

              {/* Task 6.3: Schema compatibility warnings */}
              {preview.warnings.length > 0 && (
                <div className="compatibility-warnings">
                  {preview.warnings.map((warning, idx) => (
                    <div key={idx} className="warning-item">
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <h4>Choose Import Mode</h4>
              <div className="import-modes">
                {/* Task 6.5: Merge mode */}
                <label className={`mode-card ${mode === "merge" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="import-mode"
                    value="merge"
                    checked={mode === "merge"}
                    onChange={() => {
                      setMode("merge");
                      setReplaceConfirmed(false);
                    }}
                  />
                  <div className="mode-icon">🔀</div>
                  <div className="mode-title">Merge (Skip Duplicates)</div>
                  <div className="mode-description">
                    Add archive data alongside current data. Existing records and settings are kept;
                    only new records are added.
                  </div>
                </label>

                {/* Task 6.5: Replace All mode */}
                <label className={`mode-card ${mode === "replace" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="import-mode"
                    value="replace"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                  />
                  <div className="mode-icon">🔄</div>
                  <div className="mode-title">Replace All</div>
                  <div className="mode-description">
                    Delete current data and replace with archive. A backup of your current data will
                    be created first.
                  </div>
                </label>
              </div>

              {/* Task 6.6: Replace All confirmation */}
              {mode === "replace" && (
                <div className="replace-confirmation">
                  <label className="confirmation-checkbox">
                    <input
                      type="checkbox"
                      checked={replaceConfirmed}
                      onChange={(e) => setReplaceConfirmed(e.target.checked)}
                    />
                    <span className="warning-text">
                      I understand this will permanently delete my current data
                    </span>
                  </label>
                  <p className="backup-note">
                    Your current data will be backed up before replacement.
                  </p>
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <button
                className="import-button-primary"
                onClick={handleImport}
                disabled={isProcessing || (mode === "replace" && !replaceConfirmed)}
              >
                {isProcessing ? "Starting Import..." : "Start Import"}
              </button>
            </div>
          )}

          {/* Step 5: Import Progress */}
          {step === "importing" && (
            <div className="import-step">
              <h3>Importing Data</h3>
              {progress && (
                <div className="import-progress">
                  <div className="progress-label">
                    {progress.phase}: {progress.table}
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="progress-count">
                    {progress.current} / {progress.total}
                  </div>
                </div>
              )}
              <p className="progress-note">Please wait while your data is being imported...</p>
            </div>
          )}

          {/* Step 6: Complete */}
          {step === "complete" && summary && (
            <div className="import-step">
              <h3 className="success-title">✅ Import Complete</h3>
              <div className="import-summary">
                <div className="summary-row">
                  <span className="summary-label">Total Records:</span>
                  <span className="summary-value">{summary.totalRecords}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Proposals Imported:</span>
                  <span className="summary-value">{summary.proposalsImported}</span>
                </div>
                {summary.proposalsSkipped > 0 && (
                  <div className="summary-row">
                    <span className="summary-label">Proposals Skipped:</span>
                    <span className="summary-value">{summary.proposalsSkipped}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="summary-label">Revisions Imported:</span>
                  <span className="summary-value">{summary.revisionsImported}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Jobs Imported:</span>
                  <span className="summary-value">{summary.jobsImported}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Settings Imported:</span>
                  <span className="summary-value">{summary.settingsImported}</span>
                </div>
                {summary.voiceProfileImported && (
                  <div className="summary-row">
                    <span className="summary-label">Voice Profile:</span>
                    <span className="summary-value">Imported</span>
                  </div>
                )}
              </div>
              <button
                className="import-button-primary"
                onClick={() => {
                  onImportComplete();
                  onClose();
                }}
              >
                Done
              </button>
            </div>
          )}

          {/* Error State */}
          {step === "error" && (
            <div className="import-step">
              <h3 className="error-title">❌ Import Failed</h3>
              <div className="error-message">{error}</div>
              <p className="error-note">Your current data is unchanged.</p>
              <div className="error-actions">
                {/* AC-7: Retry re-attempts import with same archive/passphrase/mode */}
                {archivePath && passphrase && (
                  <button
                    className="import-button-primary"
                    onClick={() => {
                      setError("");
                      handleImport();
                    }}
                  >
                    Retry
                  </button>
                )}
                <button
                  className="import-button-secondary"
                  onClick={() => {
                    setStep("select");
                    setError("");
                    setArchivePath("");
                    setMetadata(null);
                    setPreview(null);
                    setPassphrase("");
                  }}
                >
                  Start Over
                </button>
                <button className="import-button-secondary" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
