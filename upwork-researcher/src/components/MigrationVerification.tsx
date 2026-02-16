import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import "./MigrationVerification.css";

interface MigrationVerificationProps {
  onDeleteDatabase: () => void;
  onKeepBoth: () => void;
}

interface VerificationData {
  proposals_count: number;
  settings_count: number;
  job_posts_count: number;
  backup_path: string;
  old_db_path: string;
}

type DialogState = "none" | "delete-confirm" | "keep-info" | "deleting" | "deleted";

export function MigrationVerification({
  onDeleteDatabase,
  onKeepBoth,
}: MigrationVerificationProps) {
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>("none");
  const [error, setError] = useState<string | null>(null);

  // Subtask 4.3: Load verification data on mount
  useEffect(() => {
    const loadVerificationData = async () => {
      try {
        const data = await invoke<VerificationData>("get_migration_verification");
        setVerificationData(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      }
    };

    loadVerificationData();
  }, []);

  // Subtask 5.2: Show delete confirmation dialog
  const handleDeleteClick = () => {
    setDialogState("delete-confirm");
  };

  // Subtask 5.5-5.8: Confirm deletion and invoke delete command
  const handleConfirmDelete = async () => {
    if (!verificationData) return;

    setDialogState("deleting");

    try {
      await invoke("delete_old_database", {
        oldDbPath: verificationData.old_db_path,
      });

      setDialogState("deleted");

      // Show success toast briefly before proceeding
      setTimeout(() => {
        onDeleteDatabase();
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setDialogState("none");
    }
  };

  // Subtask 5.3: Cancel deletion dialog
  const handleCancelDelete = () => {
    setDialogState("none");
  };

  // Subtask 6.2-6.4: Show "Keep Both" informational message
  const handleKeepBothClick = () => {
    setDialogState("keep-info");
  };

  const handleConfirmKeepBoth = () => {
    onKeepBoth();
  };

  if (error) {
    return (
      <div className="migration-verification">
        <div className="migration-verification__error">
          <div className="migration-verification__error-icon">⚠</div>
          <h2>Failed to Load Verification Data</h2>
          <p className="migration-verification__error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (!verificationData) {
    return (
      <div className="migration-verification">
        <div className="migration-verification__loading">
          <div className="migration-verification__spinner"></div>
          <p>Loading verification data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="migration-verification">
      {/* Subtask 4.4: Success checkmark and heading */}
      <div className="migration-verification__success-icon">✓</div>
      <h1>Migration Complete!</h1>

      {/* Subtask 4.5: Display migration counts in card layout */}
      <div className="migration-verification__counts">
        <div className="migration-verification__count-card">
          <span className="migration-verification__count-value">
            {verificationData.proposals_count}
          </span>
          <span className="migration-verification__count-label">Proposals</span>
        </div>
        <div className="migration-verification__count-card">
          <span className="migration-verification__count-value">
            {verificationData.settings_count}
          </span>
          <span className="migration-verification__count-label">Settings</span>
        </div>
        <div className="migration-verification__count-card">
          <span className="migration-verification__count-value">
            {verificationData.job_posts_count}
          </span>
          <span className="migration-verification__count-label">Job Posts</span>
        </div>
      </div>

      {/* Subtask 4.6: Display backup file path */}
      <div className="migration-verification__info">
        <p className="migration-verification__info-label">Original database backed up to:</p>
        <p className="migration-verification__info-value">{verificationData.backup_path}</p>
      </div>

      {/* Subtask 4.7: Display old database path */}
      <div className="migration-verification__info">
        <p className="migration-verification__info-label">Unencrypted database location:</p>
        <p className="migration-verification__info-value">{verificationData.old_db_path}</p>
      </div>

      {/* Subtask 5.1, 6.1: Action buttons */}
      <div className="migration-verification__actions">
        <button
          className="migration-verification__button migration-verification__button--delete"
          onClick={handleDeleteClick}
          disabled={dialogState !== "none"}
        >
          Delete Unencrypted Database
        </button>
        <button
          className="migration-verification__button migration-verification__button--keep"
          onClick={handleKeepBothClick}
          disabled={dialogState !== "none"}
        >
          Keep Both (for now)
        </button>
      </div>

      {/* Subtask 5.3-5.4: Delete confirmation dialog */}
      {dialogState === "delete-confirm" && (
        <div className="migration-verification__dialog-overlay">
          <div className="migration-verification__dialog">
            <h2>⚠️ Warning</h2>
            <p>
              Deleting the unencrypted database is permanent. Only proceed if you're confident the
              migration was successful. Do you want to continue?
            </p>
            <div className="migration-verification__dialog-actions">
              <button
                className="migration-verification__button migration-verification__button--cancel"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                className="migration-verification__button migration-verification__button--confirm-delete"
                onClick={handleConfirmDelete}
              >
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtask 5.6: Loading state during deletion */}
      {dialogState === "deleting" && (
        <div className="migration-verification__dialog-overlay">
          <div className="migration-verification__dialog">
            <div className="migration-verification__spinner"></div>
            <p>Deleting unencrypted database...</p>
          </div>
        </div>
      )}

      {/* Subtask 5.7: Success toast after deletion */}
      {dialogState === "deleted" && (
        <div className="migration-verification__dialog-overlay">
          <div className="migration-verification__dialog migration-verification__dialog--success">
            <div className="migration-verification__success-icon">✓</div>
            <h2>Unencrypted database deleted successfully</h2>
            <p>Proceeding to application...</p>
          </div>
        </div>
      )}

      {/* Subtask 6.3: Keep both informational message */}
      {dialogState === "keep-info" && (
        <div className="migration-verification__dialog-overlay">
          <div className="migration-verification__dialog">
            <h2>Keep Both Databases</h2>
            <p>
              Both databases will remain on your system. You can manually delete the .old file at:
            </p>
            <p className="migration-verification__dialog-path">{verificationData.old_db_path}</p>
            <p>when you're ready.</p>
            <div className="migration-verification__dialog-actions">
              <button
                className="migration-verification__button migration-verification__button--primary"
                onClick={handleConfirmKeepBoth}
              >
                Continue to Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
