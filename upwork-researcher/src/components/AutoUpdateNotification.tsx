/**
 * AutoUpdateNotification component (Story 9.7 Task 3)
 * Multi-state notification for update availability, download progress, and restart prompts
 */

import { useEffect, useState, useCallback, useRef } from 'react';

import './AutoUpdateNotification.css';
import { useAnnounce } from '../components/LiveAnnouncer';
import { useFocusTrap } from '../hooks/useFocusTrap';

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
  /** CR R2 H-1: Notify parent when toast becomes hidden (auto-dismiss, Escape, or button) */
  onToastHidden?: () => void;
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
  onToastHidden,
}: AutoUpdateNotificationProps) {
  const [state, setState] = useState<NotificationState>('hidden');
  // CR R1 M-2: Track dismissed version so new versions still show notification
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const announce = useAnnounce();
  // CR R1 H-3: Track last announced milestone to avoid screen reader flooding
  const lastAnnouncedRef = useRef<number>(-1);

  // Focus trap for restart dialog
  const dialogRef = useRef<HTMLElement>(null);
  useFocusTrap(dialogRef, { autoFocus: state === 'ready' });

  // Determine current state based on props
  useEffect(() => {
    // CR R1 H-3: Reset announce milestone tracker when not downloading
    if (!isDownloading) {
      lastAnnouncedRef.current = -1;
    }

    // CR R1 M-2: Only hide if this specific version was dismissed (not downloading/downloaded)
    if (dismissedVersion && updateInfo?.version === dismissedVersion && !isDownloading && !isDownloaded) {
      setState('hidden');
      return;
    }

    if (isDownloaded) {
      setState('ready');
      announce('Update downloaded. Ready to restart.');
    } else if (isDownloading) {
      setState('downloading');
      // CR R1 H-3: Only announce at 25% milestones to avoid flooding screen readers
      const milestone = Math.floor(downloadProgress / 25) * 25;
      if (milestone !== lastAnnouncedRef.current) {
        lastAnnouncedRef.current = milestone;
        announce(`Downloading update: ${downloadProgress}%`);
      }
    } else if (updateAvailable && updateInfo) {
      setState('toast');
      announce(`Update available: version ${updateInfo.version}`);
    } else {
      setState('hidden');
    }
  }, [updateAvailable, updateInfo, isDownloading, isDownloaded, downloadProgress, dismissedVersion, announce]);

  // CR R2 H-1: Notify parent when toast transitions FROM visible TO hidden
  // (not on initial render, which starts in 'hidden')
  const prevStateRef = useRef<NotificationState>('hidden');
  useEffect(() => {
    if (state === 'hidden' && prevStateRef.current !== 'hidden') {
      onToastHidden?.();
    }
    prevStateRef.current = state;
  }, [state, onToastHidden]);

  // Auto-dismiss toast after 10 seconds (AC-1)
  useEffect(() => {
    if (state === 'toast') {
      const timer = setTimeout(() => {
        setDismissedVersion(updateInfo?.version ?? null);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [state, updateInfo]);

  // Escape key handler for toast (Task 3.8)
  useEffect(() => {
    if (state === 'toast') {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setDismissedVersion(updateInfo?.version ?? null);
        }
      };

      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [state, updateInfo]);

  const handleUpdateNow = useCallback(() => {
    setDismissedVersion(null);
    onUpdateNow();
  }, [onUpdateNow]);

  const handleLater = useCallback(() => {
    setDismissedVersion(updateInfo?.version ?? null);
    onLater();
  }, [onLater, updateInfo]);

  const handleSkip = useCallback(() => {
    setDismissedVersion(updateInfo?.version ?? null);
    onSkip();
  }, [onSkip, updateInfo]);

  const handleRestart = useCallback(() => {
    onRestart();
  }, [onRestart]);

  const handleRemindLater = useCallback(() => {
    setDismissedVersion(updateInfo?.version ?? null);
    onRemindLater();
  }, [onRemindLater, updateInfo]);

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
