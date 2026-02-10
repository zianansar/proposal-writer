import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./DatabaseMigration.css";

interface DatabaseMigrationProps {
  passphrase: string;
  backupPath: string;
  onMigrationComplete: (metadata: MigrationMetadata) => void;
  onMigrationFailed: (error: string) => void;
  onRetry?: () => void;
}

interface MigrationResult {
  success: boolean;
  proposals_migrated: number;
  settings_migrated: number;
  job_posts_migrated: number;
  duration_ms: number;
  message: string;
}

interface MigrationMetadata {
  proposalsMigrated: number;
  settingsMigrated: number;
  jobPostsMigrated: number;
  durationMs: number;
}

type MigrationState = "migrating" | "success" | "error";

export function DatabaseMigration({
  passphrase,
  backupPath,
  onMigrationComplete,
  onMigrationFailed,
  onRetry,
}: DatabaseMigrationProps) {
  const [state, setState] = useState<MigrationState>("migrating");
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subtask 9.2-9.5: Auto-start migration on mount
  useEffect(() => {
    const performMigration = async () => {
      try {
        setState("migrating");

        const migrationResult = await invoke<MigrationResult>("migrate_database", {
          passphrase,
          backupPath,
        });

        if (migrationResult.success) {
          setState("success");
          setResult(migrationResult);

          // Call completion callback with metadata
          onMigrationComplete({
            proposalsMigrated: migrationResult.proposals_migrated,
            settingsMigrated: migrationResult.settings_migrated,
            jobPostsMigrated: migrationResult.job_posts_migrated,
            durationMs: migrationResult.duration_ms,
          });
        } else {
          setState("error");
          const errorMsg = "Migration failed: Unknown error";
          setError(errorMsg);
          onMigrationFailed(errorMsg);
        }
      } catch (err) {
        setState("error");
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        onMigrationFailed(errorMessage);
      }
    };

    performMigration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run once on mount

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const handleCancelMigration = () => {
    if (error) {
      onMigrationFailed(error);
    }
  };

  return (
    <div className="database-migration">
      {state === "migrating" && (
        <div className="database-migration__loading">
          {/* Subtask 9.2: Display migration progress message */}
          <div className="database-migration__spinner"></div>
          <h2>Migrating database to encrypted storage...</h2>
          {/* Subtask 9.3: Show progress bar (indeterminate) */}
          <div className="database-migration__progress-bar">
            <div className="database-migration__progress-bar-fill"></div>
          </div>
          <p className="database-migration__loading-text">
            This may take a few moments depending on your data size.
            <br />
            Please do not close the application.
          </p>
        </div>
      )}

      {state === "success" && result && (
        <div className="database-migration__success">
          {/* Subtask 9.4: Display success message with counts */}
          <div className="database-migration__success-icon" aria-hidden="true">✓</div>
          <h2>Migration Complete</h2>
          <p className="database-migration__success-message">{result.message}</p>

          <div className="database-migration__counts">
            <div className="database-migration__count-item">
              <span className="database-migration__count-value">
                {result.proposals_migrated}
              </span>
              <span className="database-migration__count-label">Proposals</span>
            </div>
            <div className="database-migration__count-item">
              <span className="database-migration__count-value">
                {result.settings_migrated}
              </span>
              <span className="database-migration__count-label">Settings</span>
            </div>
            <div className="database-migration__count-item">
              <span className="database-migration__count-value">
                {result.job_posts_migrated}
              </span>
              <span className="database-migration__count-label">Job Posts</span>
            </div>
          </div>

          {/* Subtask 9.5: Display duration */}
          <p className="database-migration__duration">
            Completed in {(result.duration_ms / 1000).toFixed(2)}s
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="database-migration__error">
          {/* Story 2.5: Enhanced error state with recovery status */}
          <div className="database-migration__error-icon">⚠</div>
          <h2>Migration Failed</h2>
          <p className="database-migration__error-message">
            {error || "An unknown error occurred during migration"}
          </p>

          {/* Story 2.5: Recovery status indicator */}
          <div className="database-migration__recovery-status">
            <div className="database-migration__recovery-status-icon" aria-hidden="true">✓</div>
            <p className="database-migration__recovery-status-text">
              <strong>Your data is safe.</strong> The migration was rolled back
              automatically and your unencrypted database remains intact.
            </p>
          </div>

          <div className="database-migration__error-actions">
            {onRetry && (
              <button
                className="database-migration__button database-migration__button--retry"
                onClick={handleRetry}
                aria-label="Retry migration after fixing the issue"
              >
                Retry Migration
              </button>
            )}
            <button
              className="database-migration__button database-migration__button--cancel"
              onClick={handleCancelMigration}
              aria-label="Cancel migration and continue with unencrypted database"
            >
              Continue Without Encryption
            </button>
          </div>

          <div className="database-migration__recovery-info">
            <h3>What Happened:</h3>
            <ul>
              <li>Migration encountered an error and stopped automatically</li>
              <li>All partial changes were rolled back</li>
              <li>Your original database is unchanged and fully functional</li>
              <li>A backup was created before migration started at: <code>{backupPath}</code></li>
            </ul>

            <h3>Next Steps:</h3>
            <ul>
              <li>Review the error message above to identify the cause</li>
              <li>Fix any issues (e.g., free up disk space, close other apps)</li>
              <li>Click "Retry Migration" to attempt again</li>
              <li>Or click "Continue Without Encryption" to use the app normally</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
