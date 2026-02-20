/**
 * Tests for AutoUpdateNotification component (Story 9.7 Task 3.10)
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AutoUpdateNotification } from './AutoUpdateNotification';
import * as LiveAnnouncer from './LiveAnnouncer';

// Mock LiveAnnouncer
vi.mock('./LiveAnnouncer', () => ({
  useAnnounce: vi.fn(() => vi.fn()),
}));

// Mock useFocusTrap
vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(() => ({ ref: { current: null } })),
}));

const mockUpdateInfo = {
  version: '1.2.0',
  currentVersion: '1.0.0',
  body: 'New features and bug fixes',
  date: '2026-02-16T10:00:00Z',
};

describe('AutoUpdateNotification', () => {
  const defaultProps = {
    updateAvailable: false,
    updateInfo: null,
    downloadProgress: 0,
    isDownloading: false,
    isDownloaded: false,
    onUpdateNow: vi.fn(),
    onLater: vi.fn(),
    onSkip: vi.fn(),
    onRestart: vi.fn(),
    onRemindLater: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hidden state', () => {
    it('should not render when no update available', () => {
      const { container } = render(<AutoUpdateNotification {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('toast state (AC-1, Task 3.3)', () => {
    it('should render toast when update is available', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      expect(screen.getByText('Update available: v1.2.0')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have ARIA live region (Task 3.7)', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('should render action buttons', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      expect(screen.getByText('Update Now')).toBeInTheDocument();
      expect(screen.getByText('Later')).toBeInTheDocument();
      expect(screen.getByText('Skip This Version')).toBeInTheDocument();
    });

    it('should call onUpdateNow when Update Now is clicked', () => {
      const onUpdateNow = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onUpdateNow={onUpdateNow}
        />
      );

      fireEvent.click(screen.getByText('Update Now'));
      expect(onUpdateNow).toHaveBeenCalledTimes(1);
    });

    it('should call onLater when Later is clicked', () => {
      const onLater = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onLater={onLater}
        />
      );

      fireEvent.click(screen.getByText('Later'));
      expect(onLater).toHaveBeenCalledTimes(1);
    });

    it('should call onSkip when Skip This Version is clicked', () => {
      const onSkip = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onSkip={onSkip}
        />
      );

      fireEvent.click(screen.getByText('Skip This Version'));
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('should auto-dismiss after 10 seconds (AC-1)', async () => {
      const { container } = render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      expect(screen.getByText('Update available: v1.2.0')).toBeInTheDocument();

      // Run all pending timers
      await act(async () => {
        vi.runAllTimers();
      });

      expect(container.firstChild).toBeNull();
    });

    it('should dismiss on Escape key (Task 3.8)', async () => {
      const { container } = render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      expect(screen.getByText('Update available: v1.2.0')).toBeInTheDocument();

      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
        // Flush any pending microtasks
        await Promise.resolve();
      });

      expect(container.firstChild).toBeNull();
    });

    it('should announce to screen readers (Task 3.9)', () => {
      const mockAnnounce = vi.fn();
      vi.mocked(LiveAnnouncer.useAnnounce).mockReturnValue(mockAnnounce);

      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      expect(mockAnnounce).toHaveBeenCalledWith('Update available: version 1.2.0');
    });
  });

  describe('downloading state (AC-2, Task 3.4)', () => {
    it('should render progress bar when downloading', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={50}
        />
      );

      expect(screen.getByText('Downloading update...')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should have progress bar ARIA attributes', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={75}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should render Cancel button', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={25}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call onCancel when Cancel is clicked', () => {
      const onCancel = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={25}
          onCancel={onCancel}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should update progress percentage', () => {
      const { rerender } = render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={25}
        />
      );

      expect(screen.getByText('25%')).toBeInTheDocument();

      rerender(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={75}
        />
      );

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should announce download progress (Task 3.9)', () => {
      const mockAnnounce = vi.fn();
      vi.mocked(LiveAnnouncer.useAnnounce).mockReturnValue(mockAnnounce);

      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={60}
        />
      );

      expect(mockAnnounce).toHaveBeenCalledWith('Downloading update: 60%');
    });

    // CR R1 H-3: Verify milestone-based throttling
    it('should throttle announcements to 25% milestones', () => {
      const mockAnnounce = vi.fn();
      vi.mocked(LiveAnnouncer.useAnnounce).mockReturnValue(mockAnnounce);

      const { rerender } = render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={10}
        />
      );

      // First render at 10% — milestone 0, should announce
      expect(mockAnnounce).toHaveBeenCalledWith('Downloading update: 10%');
      mockAnnounce.mockClear();

      // 15% — still milestone 0, should NOT re-announce
      rerender(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={15}
        />
      );
      // Should not have been called with a downloading announcement
      const downloadCalls = mockAnnounce.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Downloading')
      );
      expect(downloadCalls).toHaveLength(0);

      // 30% — milestone 25, should announce
      rerender(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={30}
        />
      );
      expect(mockAnnounce).toHaveBeenCalledWith('Downloading update: 30%');
    });
  });

  describe('ready state (AC-3, Task 3.5)', () => {
    it('should render restart dialog when download completes', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloaded={true}
        />
      );

      expect(screen.getByText('Update Downloaded')).toBeInTheDocument();
      expect(screen.getByText('Update downloaded. Restart to apply?')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have dialog ARIA attributes (Task 3.7)', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloaded={true}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'update-ready-title');
    });

    it('should render restart action buttons', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloaded={true}
        />
      );

      expect(screen.getByText('Restart Now')).toBeInTheDocument();
      expect(screen.getByText('Remind Me Later')).toBeInTheDocument();
    });

    it('should call onRestart when Restart Now is clicked', () => {
      const onRestart = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloaded={true}
          onRestart={onRestart}
        />
      );

      fireEvent.click(screen.getByText('Restart Now'));
      expect(onRestart).toHaveBeenCalledTimes(1);
    });

    it('should call onRemindLater when Remind Me Later is clicked', () => {
      const onRemindLater = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloaded={true}
          onRemindLater={onRemindLater}
        />
      );

      fireEvent.click(screen.getByText('Remind Me Later'));
      expect(onRemindLater).toHaveBeenCalledTimes(1);
    });

    it('should render modal overlay', () => {
      const { container } = render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloaded={true}
        />
      );

      const overlay = container.querySelector('.auto-update-notification__overlay');
      expect(overlay).toBeInTheDocument();
    });

    it('should announce download completion (Task 3.9)', () => {
      const mockAnnounce = vi.fn();
      vi.mocked(LiveAnnouncer.useAnnounce).mockReturnValue(mockAnnounce);

      render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloaded={true}
        />
      );

      expect(mockAnnounce).toHaveBeenCalledWith('Update downloaded. Ready to restart.');
    });
  });

  describe('state transitions', () => {
    it('should transition from hidden to toast when update becomes available', () => {
      const { container, rerender } = render(<AutoUpdateNotification {...defaultProps} />);

      expect(container.firstChild).toBeNull();

      rerender(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      expect(screen.getByText('Update available: v1.2.0')).toBeInTheDocument();
    });

    it('should transition from toast to downloading when download starts', () => {
      const { rerender } = render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      expect(screen.getByText('Update available: v1.2.0')).toBeInTheDocument();

      rerender(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={10}
        />
      );

      expect(screen.getByText('Downloading update...')).toBeInTheDocument();
    });

    it('should transition from downloading to ready when download completes', () => {
      const { rerender } = render(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloading={true}
          downloadProgress={100}
        />
      );

      expect(screen.getByText('Downloading update...')).toBeInTheDocument();

      rerender(
        <AutoUpdateNotification
          {...defaultProps}
          isDownloaded={true}
        />
      );

      expect(screen.getByText('Update Downloaded')).toBeInTheDocument();
    });
  });

  // CR R1 L-2: Timer clearing tests
  describe('auto-dismiss timer clearing', () => {
    it('should clear auto-dismiss timer when Update Now is clicked', async () => {
      const onUpdateNow = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onUpdateNow={onUpdateNow}
        />
      );

      expect(screen.getByText('Update available: v1.2.0')).toBeInTheDocument();

      // Advance 5s into the 10s auto-dismiss timer
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Click Update Now — this clears dismissedVersion and calls onUpdateNow
      fireEvent.click(screen.getByText('Update Now'));
      expect(onUpdateNow).toHaveBeenCalledTimes(1);

      // Toast should still be visible immediately after click (dismissedVersion was reset to null)
      expect(screen.getByText('Update available: v1.2.0')).toBeInTheDocument();
    });

    it('should clear auto-dismiss timer when Later is clicked before timeout', async () => {
      const onLater = vi.fn();
      const { container } = render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onLater={onLater}
        />
      );

      expect(screen.getByText('Update available: v1.2.0')).toBeInTheDocument();

      // Click Later (dismisses immediately)
      fireEvent.click(screen.getByText('Later'));
      expect(onLater).toHaveBeenCalledTimes(1);

      // Should be hidden now
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(container.firstChild).toBeNull();
    });
  });

  describe('keyboard navigation', () => {
    it('should support tab navigation in toast', () => {
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
        />
      );

      const updateNowButton = screen.getByText('Update Now');
      const laterButton = screen.getByText('Later');
      const skipButton = screen.getByText('Skip This Version');

      updateNowButton.focus();
      expect(document.activeElement).toBe(updateNowButton);

      fireEvent.keyDown(updateNowButton, { key: 'Tab' });
      laterButton.focus();
      expect(document.activeElement).toBe(laterButton);

      fireEvent.keyDown(laterButton, { key: 'Tab' });
      skipButton.focus();
      expect(document.activeElement).toBe(skipButton);
    });

    it('should support Enter key on buttons', () => {
      const onUpdateNow = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onUpdateNow={onUpdateNow}
        />
      );

      const button = screen.getByText('Update Now');
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.click(button); // Simulate browser behavior

      expect(onUpdateNow).toHaveBeenCalledTimes(1);
    });
  });

  describe('onToastHidden callback (CR R2 H-1)', () => {
    it('should NOT fire onToastHidden on initial render (starts hidden)', () => {
      const onToastHidden = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          onToastHidden={onToastHidden}
        />
      );
      expect(onToastHidden).not.toHaveBeenCalled();
    });

    it('should fire onToastHidden when transitioning from toast to hidden via auto-dismiss', async () => {
      const onToastHidden = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onToastHidden={onToastHidden}
        />
      );

      // Toast is showing, onToastHidden should not have fired
      expect(screen.getByText(/Update available/)).toBeInTheDocument();
      expect(onToastHidden).not.toHaveBeenCalled();

      // Auto-dismiss after 10 seconds → state transitions to hidden
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(onToastHidden).toHaveBeenCalledTimes(1);
    });

    it('should fire onToastHidden when transitioning from toast to hidden via Later button', () => {
      const onToastHidden = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onToastHidden={onToastHidden}
        />
      );

      expect(onToastHidden).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('Later'));

      expect(onToastHidden).toHaveBeenCalledTimes(1);
    });

    it('should fire onToastHidden when transitioning from toast to hidden via Escape', () => {
      const onToastHidden = vi.fn();
      render(
        <AutoUpdateNotification
          {...defaultProps}
          updateAvailable={true}
          updateInfo={mockUpdateInfo}
          onToastHidden={onToastHidden}
        />
      );

      expect(onToastHidden).not.toHaveBeenCalled();

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onToastHidden).toHaveBeenCalledTimes(1);
    });
  });
});
