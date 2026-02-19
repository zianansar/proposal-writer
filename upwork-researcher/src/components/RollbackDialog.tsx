/**
 * Rollback Dialog Component (Story 9.9 Task 7.3, TD2.3 Task 3)
 *
 * Dialog shown when health check fails and rollback is triggered.
 * Displays version info and reason for rollback.
 * Wired to App.tsx health check orchestration (TD2.3).
 */

import React, { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  // Task 3.4: Focus trap — keeps keyboard focus within dialog (AC-6)
  // autoFocus=false because the restart button already has the autoFocus attribute
  useFocusTrap(dialogRef as React.RefObject<HTMLElement>, { autoFocus: false });

  if (!isOpen) return null;

  return (
    <div
      className="rollback-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rollback-title"
      aria-describedby="rollback-description"
      ref={dialogRef}
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
