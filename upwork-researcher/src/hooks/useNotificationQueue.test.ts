/**
 * Tests for useNotificationQueue hook (Story 10.5 Task 2.6)
 * AC-6: App update notifications have priority over config update notifications
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotificationQueue } from './useNotificationQueue';

describe('useNotificationQueue', () => {
  describe('initial state', () => {
    it('should start with empty queue and no current notification', () => {
      const { result } = renderHook(() => useNotificationQueue());
      expect(result.current.currentNotification).toBeNull();
      expect(result.current.queueLength).toBe(0);
    });
  });

  describe('app-update priority (AC-6)', () => {
    it('should show app-update notification first when enqueued before config-update', () => {
      const { result } = renderHook(() => useNotificationQueue());

      act(() => {
        result.current.enqueueNotification('app-update', { version: '1.2.0' }, 'high');
        result.current.enqueueNotification('config-update', { newCount: 2, updatedCount: 1 }, 'normal');
      });

      expect(result.current.currentNotification?.type).toBe('app-update');
    });

    it('should show app-update notification first even when config-update enqueued first', () => {
      const { result } = renderHook(() => useNotificationQueue());

      act(() => {
        result.current.enqueueNotification('config-update', { newCount: 1, updatedCount: 0 }, 'normal');
        result.current.enqueueNotification('app-update', { version: '1.2.0' }, 'high');
      });

      expect(result.current.currentNotification?.type).toBe('app-update');
    });

    it('should show config-update after app-update is dismissed', () => {
      const { result } = renderHook(() => useNotificationQueue());

      act(() => {
        result.current.enqueueNotification('app-update', { version: '1.2.0' }, 'high');
        result.current.enqueueNotification('config-update', { newCount: 2, updatedCount: 1 }, 'normal');
      });

      expect(result.current.currentNotification?.type).toBe('app-update');

      act(() => {
        result.current.dismissCurrent();
      });

      expect(result.current.currentNotification?.type).toBe('config-update');
    });

    it('should have queueLength 0 after all dismissed', () => {
      const { result } = renderHook(() => useNotificationQueue());

      act(() => {
        result.current.enqueueNotification('config-update', { newCount: 1, updatedCount: 0 }, 'normal');
      });

      act(() => {
        result.current.dismissCurrent();
      });

      expect(result.current.currentNotification).toBeNull();
      expect(result.current.queueLength).toBe(0);
    });

    it('should coalesce multiple config-update notifications (keep last)', () => {
      const { result } = renderHook(() => useNotificationQueue());

      act(() => {
        result.current.enqueueNotification('config-update', { newCount: 1, updatedCount: 0 }, 'normal');
        result.current.enqueueNotification('config-update', { newCount: 3, updatedCount: 2 }, 'normal');
      });

      // Only one config-update should be present (coalesced)
      expect(result.current.queueLength).toBeLessThanOrEqual(1);
      expect(result.current.currentNotification?.type).toBe('config-update');
      // The latest payload should win
      expect((result.current.currentNotification?.payload as { newCount: number }).newCount).toBe(3);
    });
  });
});
