/**
 * Health Check Modal Component (Story 9.9 Task 7.1-7.2)
 *
 * Blocking modal shown during post-update health checks.
 * Displays progress through the 4-check sequence.
 *
 * NOTE: This is a stub implementation. Full implementation requires:
 * - Integration with actual health check execution flow
 * - Error state handling with rollback trigger
 * - Accessibility testing (focus trap, screen reader)
 * - Integration testing with App.tsx mount sequence
 */

import React from 'react';
import './HealthCheckModal.css';

export interface HealthCheckProgress {
  currentCheck: number;
  totalChecks: number;
  checkName: string;
  passed: boolean;
}

export interface HealthCheckModalProps {
  isOpen: boolean;
  progress: HealthCheckProgress;
  onComplete: () => void;
  onFailure: (error: string) => void;
}

export const HealthCheckModal: React.FC<HealthCheckModalProps> = ({
  isOpen,
  progress,
  onComplete,
  onFailure,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="health-check-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-check-title"
    >
      <div className="health-check-modal">
        <h2 id="health-check-title">Verifying app health...</h2>
        <p className="health-check-status">
          {progress.currentCheck}/{progress.totalChecks} checks complete
        </p>
        <p className="health-check-name">{progress.checkName}</p>
        <div
          className="health-check-progress"
          role="progressbar"
          aria-valuenow={progress.currentCheck}
          aria-valuemin={0}
          aria-valuemax={progress.totalChecks}
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
