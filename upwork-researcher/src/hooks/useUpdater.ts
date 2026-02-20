/**
 * Hook for auto-updater functionality (Story 9.6)
 * Wraps @tauri-apps/plugin-updater for update checking, downloading, and installation
 */

import { relaunch } from '@tauri-apps/plugin-process';
import { check, Update } from '@tauri-apps/plugin-updater';
import { useState, useCallback, useEffect, useRef } from 'react';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  body: string | null;
  date: string | null;
  isCritical: boolean; // Story 9.8 Task 2.2
}

export type DownloadEventType = 'Started' | 'Progress' | 'Finished';

export interface DownloadProgress {
  event: DownloadEventType;
  data?: {
    contentLength?: number;
    chunkLength?: number;
  };
}

export interface UseUpdaterReturn {
  checkForUpdate: () => Promise<UpdateInfo | null>;
  downloadAndInstall: (
    onProgress?: (progress: DownloadProgress) => void
  ) => Promise<void>;
  relaunchApp: () => Promise<void>;
  retryDownload: (
    onProgress?: (progress: DownloadProgress) => void
  ) => Promise<void>; // Story 9.8 Task 5.2
  clearError: () => void;
  cancelDownload: () => void;
  isChecking: boolean;
  isDownloading: boolean;
  error: string | null;
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  isDownloaded: boolean;
  pendingCriticalUpdate: boolean; // Story 9.8 Task 2.4
}

export interface UseUpdaterOptions {
  autoCheckEnabled?: boolean;
  skippedVersion?: string | null;
  onCheckComplete?: () => void; // CR R1 M-4: Called after background check completes
}

/**
 * Hook providing auto-update functionality
 * AC-5: Background update check on launch
 * AC-6: Signed update download with resume support
 * Story 9.7: Extended with UI notification state management
 *
 * NOTE: pendingUpdate is stored as React state. If the component using this hook
 * unmounts, the pending update reference is lost. Story 9.7 (Update Notification UI)
 * must call this hook from a persistent location (e.g., App root) to avoid losing
 * update state during navigation.
 */
export function useUpdater(options?: UseUpdaterOptions): UseUpdaterReturn {
  const { autoCheckEnabled = true, skippedVersion = null, onCheckComplete } = options || {};

  // CR R1 H-2: Ref to track cancelled downloads and prevent stale state updates
  const cancelledRef = useRef(false);

  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [totalBytes, setTotalBytes] = useState(0);
  const [receivedBytes, setReceivedBytes] = useState(0);
  const [pendingCriticalUpdate, setPendingCriticalUpdate] = useState(false); // Story 9.8 Task 2.4

  /**
   * Clear error state (Story 9.7 Task 1.3)
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Cancel in-progress download (Story 9.7 Task 1.4)
   */
  const cancelDownload = useCallback(() => {
    cancelledRef.current = true; // CR R1 H-2: Signal download callbacks to stop updating state
    setIsDownloading(false);
    setDownloadProgress(0);
    setReceivedBytes(0);
    setTotalBytes(0);
  }, []);

  /**
   * Check for available updates (AC-5)
   * Returns update info if available, null otherwise
   * Story 9.7: Filters out user-skipped versions via skippedVersion param
   */
  const checkForUpdate = useCallback(async (): Promise<UpdateInfo | null> => {
    setIsChecking(true);
    setError(null);

    try {
      const update = await check();

      if (update) {
        // Story 9.7: Check if manually skipped version
        if (skippedVersion && update.version === skippedVersion) {
          console.debug(`Skipping user-dismissed version ${update.version}`);
          setPendingUpdate(null);
          setPendingCriticalUpdate(false);
          return null;
        }

        setPendingUpdate(update);

        // Story 9.8 Task 2.1-2.3: Parse critical flag from update manifest
        const isCritical = (update as { critical?: boolean }).critical ?? false;
        setPendingCriticalUpdate(isCritical);

        return {
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body ?? null,
          date: update.date ?? null,
          isCritical, // Story 9.8 Task 2.3
        };
      }

      setPendingUpdate(null);
      setPendingCriticalUpdate(false); // Story 9.8 Task 2.5
      return null;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to check for updates';
      setError(errorMessage);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [skippedVersion]);

  /**
   * Download and install pending update (AC-6)
   * Signature verification is handled automatically by the plugin
   * Supports resume on network interruption
   * Story 9.7: Extended with progress tracking
   */
  const downloadAndInstall = useCallback(
    async (onProgress?: (progress: DownloadProgress) => void): Promise<void> => {
      if (!pendingUpdate) {
        throw new Error('No update available to download');
      }

      setIsDownloading(true);
      setError(null);
      setDownloadProgress(0);
      setReceivedBytes(0);
      setTotalBytes(0);
      setIsDownloaded(false);
      cancelledRef.current = false; // CR R1 H-2: Reset cancelled flag on new download

      // Use local variables to avoid stale closure issues
      let contentLength = 0;
      let received = 0;

      try {
        await pendingUpdate.downloadAndInstall((event) => {
          // CR R1 H-2: Skip state updates if download was cancelled
          if (cancelledRef.current) return;

          // Track progress for UI (Story 9.7 Task 1.5)
          if (event.event === 'Started' && event.data?.contentLength) {
            contentLength = event.data.contentLength;
            setTotalBytes(contentLength);
          } else if (event.event === 'Progress' && event.data?.chunkLength) {
            received += event.data.chunkLength;
            setReceivedBytes(received);
            if (contentLength > 0) {
              const progress = Math.round((received / contentLength) * 100);
              setDownloadProgress(progress);
            }
          } else if (event.event === 'Finished') {
            setDownloadProgress(100);
            setIsDownloaded(true);
          }

          if (onProgress) {
            onProgress({
              event: event.event,
              data: event.data,
            });
          }
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to download update';
        setError(errorMessage);
        throw err;
      } finally {
        setIsDownloading(false);
      }
    },
    [pendingUpdate]
  );

  /**
   * Relaunch the application after update installation
   */
  const relaunchApp = useCallback(async (): Promise<void> => {
    try {
      await relaunch();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to relaunch application';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Retry download after error (Story 9.8 Task 5.2)
   * Clears error state and re-attempts downloadAndInstall
   */
  const retryDownload = useCallback(
    async (onProgress?: (progress: DownloadProgress) => void): Promise<void> => {
      // Task 5.3: Clear error when retry starts
      setError(null);

      // Re-attempt download
      return downloadAndInstall(onProgress);
    },
    [downloadAndInstall]
  );

  /**
   * Background update check on app mount (AC-5, Subtask 5.6)
   * Story 9.7: Extended with periodic checks and skip logic
   * Non-blocking, fire-and-forget with error swallow
   */
  useEffect(() => {
    // Skip background check if auto-update is disabled (Task 1.8)
    if (!autoCheckEnabled) {
      return;
    }

    let mounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const backgroundCheck = async () => {
      // Don't use the checkForUpdate function here because we don't want
      // to set error state for background checks
      try {
        const update = await check();
        if (mounted && update) {
          // Story 9.7: Check if manually skipped version in background
          if (skippedVersion && update.version === skippedVersion) {
            console.debug(`Background check: Skipping user-dismissed version ${update.version}`);
            if (mounted) {
              setPendingUpdate(null);
              setPendingCriticalUpdate(false);
            }
            return;
          }

          // Version is not skipped, set as pending
          setPendingUpdate(update);

          // Story 9.8 Task 2.1: Parse critical flag from background check
          const isCritical = (update as { critical?: boolean }).critical ?? false;
          setPendingCriticalUpdate(isCritical);
        } else if (mounted && !update) {
          setPendingUpdate(null);
          setPendingCriticalUpdate(false);
        }
        // CR R1 M-4: Notify caller that background check completed (for timestamp persistence)
        if (mounted) {
          onCheckComplete?.();
        }
      } catch (err) {
        // Swallow errors for background check - non-critical
        console.debug('Background update check failed:', err);
      }
    };

    // Fire and forget - don't block app startup
    void backgroundCheck();

    // Periodic check every 4 hours (Task 1.7)
    intervalId = setInterval(() => {
      void backgroundCheck();
    }, 14_400_000); // 4 hours in milliseconds

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoCheckEnabled, skippedVersion, onCheckComplete]);

  // Compute derived state (Task 1.1, 1.2, 1.9, Story 9.8)
  const updateAvailable = Boolean(pendingUpdate && pendingUpdate.version !== skippedVersion);
  const updateInfo: UpdateInfo | null = pendingUpdate && pendingUpdate.version !== skippedVersion
    ? {
        version: pendingUpdate.version,
        currentVersion: pendingUpdate.currentVersion,
        body: pendingUpdate.body ?? null,
        date: pendingUpdate.date ?? null,
        isCritical: (pendingUpdate as { critical?: boolean }).critical ?? false, // Story 9.8 Task 2.3
      }
    : null;

  return {
    checkForUpdate,
    downloadAndInstall,
    relaunchApp,
    retryDownload, // Story 9.8 Task 5.2
    clearError,
    cancelDownload,
    isChecking,
    isDownloading,
    error,
    updateAvailable,
    updateInfo,
    downloadProgress,
    isDownloaded,
    pendingCriticalUpdate, // Story 9.8 Task 2.5
  };
}
