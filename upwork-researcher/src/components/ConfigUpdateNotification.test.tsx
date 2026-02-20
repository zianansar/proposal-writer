/**
 * Tests for ConfigUpdateNotification component (Story 10.5 Task 1.7)
 * AC-1: Toast appears on strategies:updated event, auto-dismisses after 8s
 * AC-6: Notification queuing with app update priority
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ConfigUpdateNotification } from './ConfigUpdateNotification';
import * as LiveAnnouncer from './LiveAnnouncer';

// Mock LiveAnnouncer
vi.mock('./LiveAnnouncer', () => ({
  useAnnounce: vi.fn(() => vi.fn()),
}));

describe('ConfigUpdateNotification', () => {
  const defaultProps = {
    visible: false,
    changes: { newCount: 0, updatedCount: 0 },
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hidden state', () => {
    it('should not render when visible is false', () => {
      const { container } = render(<ConfigUpdateNotification {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('toast appearance (AC-1)', () => {
    it('should render toast when visible is true', () => {
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 2, updatedCount: 1 }}
        />
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should display correct message for multiple new and updated', () => {
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 2, updatedCount: 1 }}
        />
      );
      expect(screen.getByText(/Hook strategies updated: 2 new, 1 updated/)).toBeInTheDocument();
    });

    it('should pluralize correctly for 1 new strategy', () => {
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 1, updatedCount: 0 }}
        />
      );
      expect(screen.getByText(/1 new/)).toBeInTheDocument();
    });

    it('should handle 0 new strategies gracefully', () => {
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 0, updatedCount: 3 }}
        />
      );
      expect(screen.getByText(/0 new, 3 updated/)).toBeInTheDocument();
    });

    it('should handle 0 updated strategies gracefully', () => {
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 2, updatedCount: 0 }}
        />
      );
      expect(screen.getByText(/2 new, 0 updated/)).toBeInTheDocument();
    });
  });

  describe('auto-dismiss timer (AC-1)', () => {
    it('should call onDismiss after 8 seconds', async () => {
      const onDismiss = vi.fn();
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 1, updatedCount: 0 }}
          onDismiss={onDismiss}
        />
      );

      expect(onDismiss).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(8000);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not auto-dismiss before 8 seconds', async () => {
      const onDismiss = vi.fn();
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 1, updatedCount: 0 }}
          onDismiss={onDismiss}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(7999);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('should not start timer when visible is false', async () => {
      const onDismiss = vi.fn();
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={false}
          changes={{ newCount: 1, updatedCount: 0 }}
          onDismiss={onDismiss}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('screen reader announcement (AC-1, NFR-15)', () => {
    it('should announce to screen readers when toast appears', () => {
      const mockAnnounce = vi.fn();
      vi.mocked(LiveAnnouncer.useAnnounce).mockReturnValue(mockAnnounce);

      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 2, updatedCount: 1 }}
        />
      );

      expect(mockAnnounce).toHaveBeenCalledWith(
        'Hook strategies updated: 2 new, 1 updated'
      );
    });

    it('should not announce when not visible', () => {
      const mockAnnounce = vi.fn();
      vi.mocked(LiveAnnouncer.useAnnounce).mockReturnValue(mockAnnounce);

      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={false}
          changes={{ newCount: 2, updatedCount: 1 }}
        />
      );

      expect(mockAnnounce).not.toHaveBeenCalled();
    });
  });

  describe('escape key handler (Task 1.6)', () => {
    it('should call onDismiss when Escape is pressed', async () => {
      const onDismiss = vi.fn();
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 1, updatedCount: 0 }}
          onDismiss={onDismiss}
        />
      );

      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
        await Promise.resolve();
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not listen for Escape when not visible', async () => {
      const onDismiss = vi.fn();
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={false}
          changes={{ newCount: 1, updatedCount: 0 }}
          onDismiss={onDismiss}
        />
      );

      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('ARIA attributes', () => {
    it('should have role=status and aria-live=polite (CR R2 M-2)', () => {
      render(
        <ConfigUpdateNotification
          {...defaultProps}
          visible={true}
          changes={{ newCount: 1, updatedCount: 0 }}
        />
      );

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });
});
