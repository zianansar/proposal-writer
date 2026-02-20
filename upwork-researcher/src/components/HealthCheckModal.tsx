/**
 * Health Check Modal Component (Story 9.9 Task 7.1-7.2, TD2.3 Task 3)
 *
 * Blocking modal shown during post-update health checks.
 * Displays progress through the 4-check sequence.
 *
 * This is a presentational component — the parent (App.tsx Task 7.4)
 * drives health check execution and handles completion/failure.
 */

import React, { useRef } from 'react';

import { useFocusTrap } from '../hooks/useFocusTrap';
import './HealthCheckModal.css';

export interface HealthCheckProgress {
  currentCheck: number;
  totalChecks: number;
  checkName: string;
}

export interface HealthCheckModalProps {
  isOpen: boolean;
  progress: HealthCheckProgress;
}

export const HealthCheckModal: React.FC<HealthCheckModalProps> = ({
  isOpen,
  progress,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Task 3.1: Focus trap — keeps keyboard focus within the modal (AC-5)
  useFocusTrap(dialogRef as React.RefObject<HTMLElement>, { autoFocus: true });

  if (!isOpen) return null;

  return (
    <div
      className="health-check-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-check-title"
      ref={dialogRef}
      // Allow the dialog div itself to receive focus when no buttons are present
      tabIndex={-1}
    >
      <div className="health-check-modal">
        <h2 id="health-check-title">Verifying app health...</h2>
        <p className="health-check-status">
          {progress.currentCheck}/{progress.totalChecks} checks complete
        </p>
        {/* Task 3.2: Announce each check name to screen readers (AC-5) */}
        <p className="health-check-name" aria-live="polite" aria-atomic="true">
          {progress.checkName}
        </p>
        <div
          className="health-check-progress"
          role="progressbar"
          aria-valuenow={progress.currentCheck}
          aria-valuemin={0}
          aria-valuemax={progress.totalChecks}
          aria-label={`Health check progress: ${progress.currentCheck} of ${progress.totalChecks}`}
        >
          <div
            className="health-check-progress-bar"
            style={{
              width: `${(progress.currentCheck / progress.totalChecks) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
