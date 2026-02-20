/**
 * Mandatory Update Dialog (Story 9.8)
 *
 * Non-dismissible modal for critical safety updates.
 * Blocks all app functionality until update is installed.
 *
 * AC-1: Non-dismissible (no X button, no Escape, no backdrop click)
 * AC-2: Only "Update Now" action, automatic restart after download
 * AC-3: Blocks all app functionality
 * AC-4: Shows error and "Retry" button on download failure
 */

import { useRef } from 'react';

import { useFocusTrap } from '../hooks/useFocusTrap';
import type { UpdateInfo, DownloadProgress } from '../hooks/useUpdater';
import './MandatoryUpdateDialog.css';

interface MandatoryUpdateDialogProps {
  updateInfo: UpdateInfo;
  onUpdateNow: () => void;
  onRetry: () => void;
  downloadProgress: DownloadProgress | null;
  downloadError: string | null;
  isDownloading: boolean;
}

export function MandatoryUpdateDialog({
  updateInfo,
  onUpdateNow,
  onRetry,
  downloadProgress,
  downloadError,
  isDownloading,
}: MandatoryUpdateDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const receivedBytesRef = useRef(0);

  // Story 8.2 pattern: Focus trap without autoFocus or trigger (AC-1: non-dismissible)
  useFocusTrap(modalRef, { autoFocus: true });

  // Calculate cumulative progress percentage (Review Fix M1)
  // Track received bytes cumulatively instead of per-chunk
  if (downloadProgress?.event === 'Started') {
    receivedBytesRef.current = 0;
  } else if (downloadProgress?.event === 'Progress' && downloadProgress.data?.chunkLength) {
    receivedBytesRef.current += downloadProgress.data.chunkLength;
  }

  const progressPercent =
    downloadProgress?.event === 'Finished'
      ? 100
      : downloadProgress?.event === 'Progress' && downloadProgress.data?.contentLength
      ? Math.round(
          (receivedBytesRef.current / downloadProgress.data.contentLength) * 100
        )
      : 0;

  return (
    <div className="mandatory-update-overlay" aria-live="assertive">
      <div
        ref={modalRef}
        className="mandatory-update-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mandatory-update-title"
        aria-describedby="mandatory-update-description"
      >
        {/* Header */}
        <div className="mandatory-update-header">
          <h2 id="mandatory-update-title" className="mandatory-update-title">
            Critical Security Update Required
          </h2>
        </div>

        {/* Body */}
        <div id="mandatory-update-description" className="mandatory-update-body">
          <div className="mandatory-update-version">
            <strong>Version {updateInfo.version}</strong>
            {updateInfo.date && (
              <span className="mandatory-update-date">
                {' '}
                • {new Date(updateInfo.date).toLocaleDateString()}
              </span>
            )}
          </div>

          {updateInfo.body && (
            <div className="mandatory-update-notes">{updateInfo.body}</div>
          )}

          <div className="mandatory-update-warning">
            ⚠️ <strong>This update is mandatory</strong> for your security and
            privacy. You cannot use the app until the update is installed.
          </div>

          {/* Progress bar (shown during download) */}
          {isDownloading && !downloadError && (
            <div className="mandatory-update-progress">
              <div className="mandatory-update-progress-bar">
                <div
                  className="mandatory-update-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Download progress"
                />
              </div>
              <div className="mandatory-update-progress-text">
                {downloadProgress?.event === 'Started' && 'Starting download...'}
                {downloadProgress?.event === 'Progress' &&
                  `Downloading... ${progressPercent}%`}
                {downloadProgress?.event === 'Finished' && 'Download complete'}
              </div>
            </div>
          )}

          {/* Error message (shown on download failure) */}
          {downloadError && (
            <div className="mandatory-update-error" role="alert">
              <strong>Update failed:</strong> {downloadError}
              <br />
              Check your internet connection and try again.
            </div>
          )}
        </div>

        {/* Footer with action button */}
        <div className="mandatory-update-footer">
          {downloadError ? (
            <button
              type="button"
              onClick={onRetry}
              className="mandatory-update-button mandatory-update-button-retry"
              disabled={isDownloading}
            >
              Retry
            </button>
          ) : (
            <button
              type="button"
              onClick={onUpdateNow}
              className="mandatory-update-button mandatory-update-button-primary"
              disabled={isDownloading}
            >
              {isDownloading ? 'Downloading...' : 'Update Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
