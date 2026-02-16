/**
 * Rollback Dialog Component (Story 9.9 Task 7.3)
 *
 * Dialog shown when health check fails and rollback is triggered.
 * Displays version info and reason for rollback.
 *
 * NOTE: This is a stub implementation. Full implementation requires:
 * - Integration with rollback execution flow
 * - Restart button wired to actual app restart
 * - Error handling for rollback failures
 * - Accessibility testing
 */

import React from 'react';
import './RollbackDialog.css';

export interface RollbackDialogProps {
  isOpen: boolean;
  failedVersion: string;
  previousVersion: string;
  reason: string;
  onRestart: () => void;
}

export const RollbackDialog: React.FC<RollbackDialogProps> = ({
  isOpen,
  failedVersion,
  previousVersion,
  reason,
  onRestart,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="rollback-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rollback-title"
      aria-describedby="rollback-description"
    >
      <div className="rollback-dialog">
        <div className="rollback-icon" aria-hidden="true">
          ⚠️
        </div>
        <h2 id="rollback-title">Update Failed</h2>
        <p id="rollback-description" className="rollback-message">
          Update to <strong>v{failedVersion}</strong> failed.
          <br />
          Rolled back to <strong>v{previousVersion}</strong>.
        </p>
        <p className="rollback-reason">
          <strong>Reason:</strong> {reason}
        </p>
        <p className="rollback-note">
          This version has been skipped and will not be downloaded again.
        </p>
        <button
          className="rollback-restart-button"
          onClick={onRestart}
          autoFocus
        >
          Restart App
        </button>
      </div>
    </div>
  );
};
