/**
 * AutoUpdateNotification component (Story 9.7 Task 3)
 * Multi-state notification for update availability, download progress, and restart prompts
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import './AutoUpdateNotification.css';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAnnounce } from '../components/LiveAnnouncer';

export interface AutoUpdateNotificationProps {
  updateAvailable: boolean;
  updateInfo: {
    version: string;
    currentVersion: string;
    body: string | null;
    date: string | null;
  } | null;
  downloadProgress: number;
  isDownloading: boolean;
  isDownloaded: boolean;
  onUpdateNow: () => void;
  onLater: () => void;
  onSkip: () => void;
  onRestart: () => void;
  onRemindLater: () => void;
  onCancel: () => void;
}

type NotificationState = 'hidden' | 'toast' | 'downloading' | 'ready' | 'dismissed';

export function AutoUpdateNotification({
  updateAvailable,
  updateInfo,
  downloadProgress,
  isDownloading,
  isDownloaded,
  onUpdateNow,
  onLater,
  onSkip,
  onRestart,
  onRemindLater,
  onCancel,
}: AutoUpdateNotificationProps) {
  const [state, setState] = useState<NotificationState>('hidden');
  const [dismissed, setDismissed] = useState(false);
  const announce = useAnnounce();

  // Focus trap for restart dialog
  const dialogRef = useRef<HTMLElement>(null);
  useFocusTrap(dialogRef, { autoFocus: state === 'ready' });

  // Determine current state based on props
  useEffect(() => {
    if (dismissed) {
      setState('hidden');
      return;
    }

    if (isDownloaded) {
      setState('ready');
      announce('Update downloaded. Ready to restart.');
    } else if (isDownloading) {
      setState('downloading');
      announce(`Downloading update: ${downloadProgress}%`);
    } else if (updateAvailable && updateInfo) {
      setState('toast');
      announce(`Update available: version ${updateInfo.version}`);
    } else {
      setState('hidden');
    }
  }, [updateAvailable, updateInfo, isDownloading, isDownloaded, downloadProgress, dismissed, announce]);

  // Auto-dismiss toast after 10 seconds (AC-1)
  useEffect(() => {
    if (state === 'toast') {
      const timer = setTimeout(() => {
        setDismissed(true);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [state]);

  // Escape key handler for toast (Task 3.8)
  useEffect(() => {
    if (state === 'toast') {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setDismissed(true);
        }
      };

      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [state]);

  const handleUpdateNow = useCallback(() => {
    setDismissed(false);
    onUpdateNow();
  }, [onUpdateNow]);

  const handleLater = useCallback(() => {
    setDismissed(true);
    onLater();
  }, [onLater]);

  const handleSkip = useCallback(() => {
    setDismissed(true);
    onSkip();
  }, [onSkip]);

  const handleRestart = useCallback(() => {
    onRestart();
  }, [onRestart]);

  const handleRemindLater = useCallback(() => {
    setDismissed(true);
    onRemindLater();
  }, [onRemindLater]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  if (state === 'hidden') {
    return null;
  }

  // Toast state (AC-1)
  if (state === 'toast') {
    return (
      <div
        className="auto-update-notification auto-update-notification--toast"
        role="alert"
        aria-live="polite"
      >
        <div className="auto-update-notification__content">
          <p className="auto-update-notification__message">
            Update available: v{updateInfo?.version}
          </p>
          <div className="auto-update-notification__actions">
            <button
              className="auto-update-notification__button auto-update-notification__button--primary"
              onClick={handleUpdateNow}
            >
              Update Now
            </button>
            <button
              className="auto-update-notification__button auto-update-notification__button--secondary"
              onClick={handleLater}
            >
              Later
            </button>
            <button
              className="auto-update-notification__button auto-update-notification__button--secondary"
              onClick={handleSkip}
            >
              Skip This Version
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Downloading state (AC-2)
  if (state === 'downloading') {
    return (
      <div
        className="auto-update-notification auto-update-notification--downloading"
        role="alert"
        aria-live="polite"
      >
        <div className="auto-update-notification__content">
          <p className="auto-update-notification__message">Downloading update...</p>
          <div className="auto-update-notification__progress">
            <div
              className="auto-update-notification__progress-bar"
              style={{ width: `${downloadProgress}%` }}
              role="progressbar"
              aria-valuenow={downloadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="auto-update-notification__progress-text">{downloadProgress}%</p>
          <div className="auto-update-notification__actions">
            <button
              className="auto-update-notification__button auto-update-notification__button--secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ready state (AC-3) - restart dialog with focus trap
  if (state === 'ready') {
    return (
      <>
        <div className="auto-update-notification__overlay" />
        <div
          ref={dialogRef}
          className="auto-update-notification auto-update-notification--ready"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-ready-title"
        >
          <div className="auto-update-notification__content">
            <h2 id="update-ready-title" className="auto-update-notification__title">
              Update Downloaded
            </h2>
            <p className="auto-update-notification__message">
              Update downloaded. Restart to apply?
            </p>
            <div className="auto-update-notification__actions">
              <button
                className="auto-update-notification__button auto-update-notification__button--primary"
                onClick={handleRestart}
              >
                Restart Now
              </button>
              <button
                className="auto-update-notification__button auto-update-notification__button--secondary"
                onClick={handleRemindLater}
              >
                Remind Me Later
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}
