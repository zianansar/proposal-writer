import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import "./PreMigrationBackup.css";

interface BackupResult {
  success: boolean;
  filePath: string;
  proposalCount: number;
  settingsCount: number;
  jobPostsCount: number;
  message: string;
}

interface PreMigrationBackupProps {
  onBackupComplete: (backupPath: string) => void;
  onBackupFailed: (error: string) => void;
  onRetry?: () => void;
}

export function PreMigrationBackup({
  onBackupComplete,
  onBackupFailed,
  onRetry,
}: PreMigrationBackupProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);

  const createBackup = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const result = await invoke<BackupResult>("create_pre_migration_backup");

      if (result.success) {
        setBackupResult(result);
        onBackupComplete(result.filePath);
      } else {
        const errorMsg = "Backup failed: Unknown error";
        setError(errorMsg);
        onBackupFailed(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      onBackupFailed(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setBackupResult(null);
    if (onRetry) {
      onRetry();
    } else {
      createBackup();
    }
  };

  const truncateFilePath = (path: string): string => {
    const filename = path.split(/[/\\]/).pop() || path;
    return `...backups/${filename}`;
  };

  // Auto-start backup when component mounts
  useEffect(() => {
    createBackup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run once on mount

  if (isCreating) {
    return (
      <div className="pre-migration-backup">
        <div className="backup-progress">
          <div className="spinner"></div>
          <p className="backup-message">Creating backup before migration...</p>
          <p className="backup-hint">This ensures your data is safe</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pre-migration-backup">
        <div className="backup-error">
          <h3>⚠️ Backup Failed</h3>
          <p className="error-message">{error}</p>
          <div className="error-actions">
            <button onClick={handleRetry} className="btn-retry">
              Retry Backup
            </button>
            <button onClick={() => onBackupFailed(error)} className="btn-cancel">
              Cancel Migration
            </button>
          </div>
          <p className="error-hint">Migration cannot proceed without a successful backup</p>
        </div>
      </div>
    );
  }

  if (backupResult) {
    return (
      <div className="pre-migration-backup">
        <div className="backup-success">
          <h3>✅ Backup Created</h3>
          <p className="success-message">{backupResult.message}</p>
          <div className="backup-details">
            <div className="detail-row">
              <span className="detail-label">Proposals:</span>
              <span className="detail-value">{backupResult.proposalCount}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Settings:</span>
              <span className="detail-value">{backupResult.settingsCount}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Job Posts:</span>
              <span className="detail-value">{backupResult.jobPostsCount}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Location:</span>
              <span className="detail-value file-path" title={backupResult.filePath}>
                {truncateFilePath(backupResult.filePath)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
