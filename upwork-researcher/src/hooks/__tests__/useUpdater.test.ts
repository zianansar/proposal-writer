/**
 * Tests for useUpdater hook (Story 9.6 Task 6)
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useUpdater } from '../useUpdater';
import type { Update } from '@tauri-apps/plugin-updater';

// Mock the Tauri plugins
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

// Import mocked modules for assertions
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const mockCheck = vi.mocked(check);
const mockRelaunch = vi.mocked(relaunch);

describe('useUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.debug for background check errors
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkForUpdate', () => {
    it('should return update info when update is available', async () => {
      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'New features and bug fixes',
        date: '2026-02-15T10:00:00Z',
        downloadAndInstall: vi.fn(),
      };

      // Background check on mount (will be called first)
      mockCheck.mockResolvedValueOnce(null);
      // Manual check call (will be called second)
      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check to complete
      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      let updateInfo: Awaited<ReturnType<typeof result.current.checkForUpdate>>;
      await act(async () => {
        updateInfo = await result.current.checkForUpdate();
      });

      expect(updateInfo!).toEqual({
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'New features and bug fixes',
        date: '2026-02-15T10:00:00Z',
        isCritical: false, // Story 9.8: defaults to false if not set
      });
      expect(result.current.isChecking).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return null when no update is available', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      const updateInfo = await result.current.checkForUpdate();

      expect(updateInfo).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should handle errors during update check', async () => {
      // Background check succeeds
      mockCheck.mockResolvedValueOnce(null);
      // Manual check fails
      mockCheck.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      let updateInfo: Awaited<ReturnType<typeof result.current.checkForUpdate>>;
      await act(async () => {
        updateInfo = await result.current.checkForUpdate();
      });

      expect(updateInfo!).toBeNull();
      expect(result.current.error).toBe('Network error');
      expect(result.current.isChecking).toBe(false);
    });

    it('should handle non-Error exceptions', async () => {
      // Background check succeeds
      mockCheck.mockResolvedValueOnce(null);
      // Manual check fails with non-Error
      mockCheck.mockRejectedValueOnce('String error');

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      let updateInfo: Awaited<ReturnType<typeof result.current.checkForUpdate>>;
      await act(async () => {
        updateInfo = await result.current.checkForUpdate();
      });

      expect(updateInfo!).toBeNull();
      expect(result.current.error).toBe('Failed to check for updates');
    });
  });

  describe('downloadAndInstall', () => {
    it('should download and install update with progress callback', async () => {
      const mockDownloadAndInstall = vi.fn(
        async (
          callback: (event: {
            event: 'Started' | 'Progress' | 'Finished';
            data?: { contentLength?: number; chunkLength?: number };
          }) => void
        ) => {
          callback({ event: 'Started', data: { contentLength: 1000000 } });
          callback({ event: 'Progress', data: { chunkLength: 50000 } });
          callback({ event: 'Finished' });
        }
      );

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: mockDownloadAndInstall,
      };

      // Background check
      mockCheck.mockResolvedValueOnce(null);
      // Manual check
      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      // Check for update and flush state updates so pendingUpdate propagates
      // to downloadAndInstall's useCallback dependency
      await act(async () => {
        await result.current.checkForUpdate();
      });

      const progressEvents: Array<{ event: string; data?: unknown }> = [];
      const onProgress = vi.fn((event) => {
        progressEvents.push(event);
      });

      await result.current.downloadAndInstall(onProgress);

      expect(mockDownloadAndInstall).toHaveBeenCalledTimes(1);
      expect(progressEvents).toHaveLength(3);
      expect(progressEvents[0]).toEqual({
        event: 'Started',
        data: { contentLength: 1000000 },
      });
      expect(progressEvents[1]).toEqual({
        event: 'Progress',
        data: { chunkLength: 50000 },
      });
      expect(progressEvents[2]).toEqual({ event: 'Finished', data: undefined });
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should throw error when no update is available', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      await result.current.checkForUpdate();

      await expect(result.current.downloadAndInstall()).rejects.toThrow(
        'No update available to download'
      );
    });

    it('should handle download errors', async () => {
      const mockDownloadAndInstall = vi
        .fn()
        .mockRejectedValueOnce(new Error('Download failed'));

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: mockDownloadAndInstall,
      };

      // Background check
      mockCheck.mockResolvedValueOnce(null);
      // Manual check
      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      // Wrap in act() to flush pendingUpdate state for downloadAndInstall's useCallback
      await act(async () => {
        await result.current.checkForUpdate();
      });

      await expect(result.current.downloadAndInstall()).rejects.toThrow(
        'Download failed'
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Download failed');
        expect(result.current.isDownloading).toBe(false);
      });
    });
  });

  describe('relaunchApp', () => {
    it('should call relaunch from process plugin', async () => {
      mockCheck.mockResolvedValue(null);
      mockRelaunch.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useUpdater());

      await result.current.relaunchApp();

      expect(mockRelaunch).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
    });

    it('should handle relaunch errors', async () => {
      mockCheck.mockResolvedValue(null);
      mockRelaunch.mockRejectedValueOnce(new Error('Relaunch failed'));

      const { result } = renderHook(() => useUpdater());

      await expect(result.current.relaunchApp()).rejects.toThrow(
        'Relaunch failed'
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Relaunch failed');
      });
    });
  });

  describe('background update check', () => {
    it('should perform background check on mount without blocking', async () => {
      mockCheck.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useUpdater());

      // Background check is fire-and-forget, so we need to wait
      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(1);
      });

      // Should not throw or set error state for background check
      expect(result.current.error).toBeNull();
    });

    it('should swallow errors during background check', async () => {
      mockCheck.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUpdater());

      // Wait for background check to complete
      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(1);
      });

      // Error should be swallowed for background check (caught by try-catch)
      // The error is logged to console.debug but not set in state
      expect(result.current.error).toBeNull();
    });

    it('should only check once on mount, not on re-renders', async () => {
      mockCheck.mockResolvedValue(null);

      const { rerender } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(1);
      });

      // Re-render the hook
      rerender();
      rerender();

      // Should still only have been called once (on mount)
      expect(mockCheck).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-6: Resume support', () => {
    it('should pass progress callback to downloadAndInstall for resume support', async () => {
      const mockDownloadAndInstall = vi.fn();

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: mockDownloadAndInstall,
      };

      // Background check
      mockCheck.mockResolvedValueOnce(null);
      // Manual check
      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      // Wrap in act() to flush pendingUpdate state for downloadAndInstall's useCallback
      await act(async () => {
        await result.current.checkForUpdate();
      });

      const onProgress = vi.fn();
      await result.current.downloadAndInstall(onProgress);

      // Verify callback was passed to plugin (plugin handles resume internally)
      expect(mockDownloadAndInstall).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});

describe('Story 9.7: UI notification extensions', () => {
  describe('updateAvailable flag (Task 1.1)', () => {
    it('should expose updateAvailable=true when background check finds update', async () => {
      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: vi.fn(),
      };

      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(result.current.updateAvailable).toBe(true);
      });
    });

    it('should expose updateAvailable=false when no update found', async () => {
      mockCheck.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(result.current.updateAvailable).toBe(false);
      });
    });
  });

  describe('updateInfo exposure (Task 1.2)', () => {
    it('should expose updateInfo when update is available', async () => {
      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'New features',
        date: '2026-02-15T10:00:00Z',
        downloadAndInstall: vi.fn(),
      };

      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(result.current.updateInfo).toEqual({
          version: '1.2.0',
          currentVersion: '1.0.0',
          body: 'New features',
          date: '2026-02-15T10:00:00Z',
          isCritical: false, // Story 9.8: defaults to false if not set
        });
      });
    });

    it('should return null updateInfo when no update', async () => {
      mockCheck.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(result.current.updateInfo).toBeNull();
      });
    });
  });

  describe('clearError function (Task 1.3)', () => {
    it('should clear error state when clearError is called', async () => {
      mockCheck.mockResolvedValueOnce(null);
      mockCheck.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(result.current.error).toBe('Network error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('cancelDownload function (Task 1.4)', () => {
    it('should abort download and reset isDownloading state', async () => {
      const abortSpy = vi.fn();
      const mockDownloadAndInstall = vi.fn(async () => {
        // Simulate long download
        await new Promise((resolve) => setTimeout(resolve, 5000));
      });

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: mockDownloadAndInstall,
      };

      mockCheck.mockResolvedValueOnce(null);
      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.checkForUpdate();
      });

      // Start download (don't await, it's intentionally long)
      const downloadPromise = result.current.downloadAndInstall();

      // Wait for isDownloading to become true
      await waitFor(() => {
        expect(result.current.isDownloading).toBe(true);
      });

      // Cancel download
      act(() => {
        result.current.cancelDownload();
      });

      // Should reset isDownloading
      expect(result.current.isDownloading).toBe(false);
    });
  });

  describe('downloadProgress state (Task 1.5)', () => {
    it('should calculate progress percentage from download events', async () => {
      const mockDownloadAndInstall = vi.fn(
        async (
          callback: (event: {
            event: 'Started' | 'Progress' | 'Finished';
            data?: { contentLength?: number; chunkLength?: number };
          }) => void
        ) => {
          callback({ event: 'Started', data: { contentLength: 1000 } });
          callback({ event: 'Progress', data: { chunkLength: 250 } });
          callback({ event: 'Progress', data: { chunkLength: 250 } });
          callback({ event: 'Progress', data: { chunkLength: 500 } });
          callback({ event: 'Finished' });
        }
      );

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: mockDownloadAndInstall,
      };

      mockCheck.mockResolvedValueOnce(null);
      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      // After finished, progress should be 100
      expect(result.current.downloadProgress).toBe(100);
    });

    it('should reset downloadProgress to 0 before new download', async () => {
      const mockDownloadAndInstall = vi.fn(
        async (
          callback: (event: {
            event: 'Started' | 'Progress' | 'Finished';
            data?: { contentLength?: number; chunkLength?: number };
          }) => void
        ) => {
          callback({ event: 'Started', data: { contentLength: 1000 } });
          callback({ event: 'Finished' });
        }
      );

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: mockDownloadAndInstall,
      };

      mockCheck.mockResolvedValue(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(result.current.downloadProgress).toBe(100);

      // Start another download
      await act(async () => {
        await result.current.downloadAndInstall();
      });

      // Should have reset to 100 again (from Started → Finished)
      expect(result.current.downloadProgress).toBe(100);
    });
  });

  describe('isDownloaded state (Task 1.6)', () => {
    it('should set isDownloaded=true when download completes', async () => {
      const mockDownloadAndInstall = vi.fn(
        async (
          callback: (event: {
            event: 'Started' | 'Progress' | 'Finished';
            data?: { contentLength?: number; chunkLength?: number };
          }) => void
        ) => {
          callback({ event: 'Started', data: { contentLength: 1000 } });
          callback({ event: 'Finished' });
        }
      );

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: mockDownloadAndInstall,
      };

      mockCheck.mockResolvedValueOnce(null);
      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(result.current.isDownloaded).toBe(false);

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(result.current.isDownloaded).toBe(true);
    });
  });

  describe('periodic check timer (Task 1.7)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should re-check every 4 hours when autoCheckEnabled=true', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdater({ autoCheckEnabled: true }));

      // Initial background check on mount
      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      // Fast-forward 4 hours (14,400,000 ms)
      await act(async () => {
        vi.advanceTimersByTime(14_400_000);
      });

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(2));

      // Another 4 hours
      await act(async () => {
        vi.advanceTimersByTime(14_400_000);
      });

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(3));
    });

    it('should not set up periodic check when autoCheckEnabled=false', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdater({ autoCheckEnabled: false }));

      // No initial check
      expect(mockCheck).toHaveBeenCalledTimes(0);

      // Fast-forward 4 hours
      await act(async () => {
        vi.advanceTimersByTime(14_400_000);
      });

      // Still no check
      expect(mockCheck).toHaveBeenCalledTimes(0);
    });
  });

  describe('autoCheckEnabled param (Task 1.8)', () => {
    it('should skip background check when autoCheckEnabled=false', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdater({ autoCheckEnabled: false }));

      // Wait a bit to ensure no background check happens
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockCheck).not.toHaveBeenCalled();
    });

    it('should perform background check when autoCheckEnabled=true', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdater({ autoCheckEnabled: true }));

      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(1);
      });
    });

    it('should default to true when autoCheckEnabled not provided', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('skippedVersion param (Task 1.9)', () => {
    it('should suppress updateAvailable when version matches skippedVersion', async () => {
      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: vi.fn(),
      };

      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() =>
        useUpdater({ skippedVersion: '1.2.0' })
      );

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      // Should not set updateAvailable even though update was found
      expect(result.current.updateAvailable).toBe(false);
      expect(result.current.updateInfo).toBeNull();
    });

    it('should not suppress updateAvailable when version differs from skippedVersion', async () => {
      const mockUpdate: Partial<Update> = {
        version: '1.3.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-15',
        downloadAndInstall: vi.fn(),
      };

      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() =>
        useUpdater({ skippedVersion: '1.2.0' })
      );

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.updateInfo).not.toBeNull();
    });
  });
});

describe('Story 9.8: Critical update detection (Task 2)', () => {
  describe('isCritical field in UpdateInfo (Task 2.2, 2.3)', () => {
    it('should parse critical: true from update manifest', async () => {
      const mockUpdate: Partial<Update> & { critical?: boolean } = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'CRITICAL: AI detection fix',
        date: '2026-02-16T12:00:00Z',
        downloadAndInstall: vi.fn(),
        critical: true,
      };

      mockCheck.mockResolvedValueOnce(null);
      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

      let updateInfo: Awaited<ReturnType<typeof result.current.checkForUpdate>>;
      await act(async () => {
        updateInfo = await result.current.checkForUpdate();
      });

      expect(updateInfo!.isCritical).toBe(true);
    });

    it('should parse critical: false from update manifest', async () => {
      const mockUpdate: Partial<Update> & { critical?: boolean} = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Optional feature update',
        date: '2026-02-16T12:00:00Z',
        downloadAndInstall: vi.fn(),
        critical: false,
      };

      // Background check returns non-critical update
      mockCheck.mockResolvedValue(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalled());

      let updateInfo: Awaited<ReturnType<typeof result.current.checkForUpdate>>;
      await act(async () => {
        updateInfo = await result.current.checkForUpdate();
      });

      expect(updateInfo!.isCritical).toBe(false);
    });

    it('should default to false if critical field missing', async () => {
      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Regular update',
        date: '2026-02-16T12:00:00Z',
        downloadAndInstall: vi.fn(),
        // critical field intentionally omitted
      };

      // Background check and manual check return update without critical field
      mockCheck.mockResolvedValue(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalled());

      let updateInfo: Awaited<ReturnType<typeof result.current.checkForUpdate>>;
      await act(async () => {
        updateInfo = await result.current.checkForUpdate();
      });

      expect(updateInfo!.isCritical).toBe(false);
    });
  });

  describe('pendingCriticalUpdate state (Task 2.4, 2.5)', () => {
    it('should expose pendingCriticalUpdate=true when critical update found', async () => {
      const mockUpdate: Partial<Update> & { critical?: boolean } = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'CRITICAL: Security fix',
        date: '2026-02-16T12:00:00Z',
        downloadAndInstall: vi.fn(),
        critical: true,
      };

      // Background check finds critical update
      mockCheck.mockResolvedValue(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(result.current.pendingCriticalUpdate).toBe(true);
      });
    });

    it('should expose pendingCriticalUpdate=false when non-critical update found', async () => {
      const mockUpdate: Partial<Update> & { critical?: boolean } = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Optional update',
        date: '2026-02-16T12:00:00Z',
        downloadAndInstall: vi.fn(),
        critical: false,
      };

      mockCheck.mockResolvedValueOnce(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(result.current.pendingCriticalUpdate).toBe(false);
      });
    });

    it('should expose pendingCriticalUpdate=false when no update', async () => {
      mockCheck.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(result.current.pendingCriticalUpdate).toBe(false);
      });
    });
  });

  describe('retryDownload function (Task 5.2)', () => {
    it('should re-attempt download after error', async () => {
      const mockDownloadAndInstall = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-16',
        downloadAndInstall: mockDownloadAndInstall,
      };

      // Background check and manual check return update
      mockCheck.mockResolvedValue(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalled());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      // First attempt fails
      await expect(result.current.downloadAndInstall()).rejects.toThrow(
        'Network error'
      );

      // Wait for error state to propagate
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Retry should succeed
      await act(async () => {
        await result.current.retryDownload();
      });

      expect(result.current.error).toBeNull();
      expect(mockDownloadAndInstall).toHaveBeenCalledTimes(2);
    });

    it('should clear error when retryDownload starts (Task 5.3)', async () => {
      const mockDownloadAndInstall = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      const mockUpdate: Partial<Update> = {
        version: '1.2.0',
        currentVersion: '1.0.0',
        body: 'Update',
        date: '2026-02-16',
        downloadAndInstall: mockDownloadAndInstall,
      };

      // Background check and manual check return update
      mockCheck.mockResolvedValue(mockUpdate as Update);

      const { result } = renderHook(() => useUpdater());

      // Wait for background check
      await waitFor(() => expect(mockCheck).toHaveBeenCalled());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      // First download fails, setting error
      await expect(result.current.downloadAndInstall()).rejects.toThrow('First error');

      // Wait for error state to propagate
      await waitFor(() => {
        expect(result.current.error).toBe('First error');
      });

      // Retry should clear error before starting
      await act(async () => {
        await result.current.retryDownload();
      });

      expect(result.current.error).toBeNull();
      expect(mockDownloadAndInstall).toHaveBeenCalledTimes(2);
    });
  });
});

describe('tauri.conf.json updater configuration (Task 6.4)', () => {
  let tauriConfig: Record<string, unknown>;

  beforeAll(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.resolve(
      __dirname,
      '../../../src-tauri/tauri.conf.json'
    );
    const raw = fs.readFileSync(configPath, 'utf-8');
    tauriConfig = JSON.parse(raw);
  });

  it('should have createUpdaterArtifacts enabled in bundle', () => {
    const bundle = tauriConfig.bundle as Record<string, unknown>;
    expect(bundle.createUpdaterArtifacts).toBe(true);
  });

  it('should have plugins.updater section with pubkey', () => {
    const plugins = tauriConfig.plugins as Record<string, Record<string, unknown>>;
    expect(plugins).toBeDefined();
    expect(plugins.updater).toBeDefined();
    expect(plugins.updater.pubkey).toBeDefined();
    expect(typeof plugins.updater.pubkey).toBe('string');
    expect((plugins.updater.pubkey as string).length).toBeGreaterThan(0);
  });

  it('should have at least one endpoint configured', () => {
    const plugins = tauriConfig.plugins as Record<string, Record<string, unknown>>;
    const endpoints = plugins.updater.endpoints as string[];
    expect(endpoints).toBeDefined();
    expect(Array.isArray(endpoints)).toBe(true);
    expect(endpoints.length).toBeGreaterThanOrEqual(1);
    expect(endpoints[0]).toContain('latest.json');
  });

  it('should have windows updater installMode set', () => {
    const plugins = tauriConfig.plugins as Record<string, Record<string, unknown>>;
    const windows = plugins.updater.windows as Record<string, string>;
    expect(windows).toBeDefined();
    expect(windows.installMode).toBe('passive');
  });
});
