// Story 4b.8: useRssImport Hook Tests
// Tests event listening for RSS import and fallback events

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRssImport } from './useRssImport';

// Mock Tauri event API
const mockListeners: Map<string, ((event: { payload: unknown }) => void)[]> = new Map();

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
    if (!mockListeners.has(eventName)) {
      mockListeners.set(eventName, []);
    }
    mockListeners.get(eventName)!.push(callback);

    // Return unlisten function
    return () => {
      const listeners = mockListeners.get(eventName);
      if (listeners) {
        const idx = listeners.indexOf(callback);
        if (idx > -1) listeners.splice(idx, 1);
      }
    };
  }),
}));

// Helper to emit mock events
function emitEvent(eventName: string, payload: unknown) {
  const listeners = mockListeners.get(eventName) || [];
  listeners.forEach(cb => cb({ payload }));
}

describe('useRssImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();

    // Mock Notification API
    vi.stubGlobal('Notification', {
      permission: 'default',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('returns initial state with null values', () => {
      const { result } = renderHook(() => useRssImport());

      expect(result.current.progress).toBeNull();
      expect(result.current.isComplete).toBe(false);
      expect(result.current.completionData).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isFallingBack).toBe(false);
      expect(result.current.fallbackMessage).toBeNull();
    });

    it('provides reset function', () => {
      const { result } = renderHook(() => useRssImport());
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('fallback event listening (AC-1)', () => {
    it('sets isFallingBack true when rss:fallback-started fires', async () => {
      const { result } = renderHook(() => useRssImport());

      // Wait for listeners to be set up
      await waitFor(() => {
        expect(mockListeners.has('rss:fallback-started')).toBe(true);
      });

      act(() => {
        emitEvent('rss:fallback-started', { original_error: 'RSS feed blocked (403)' });
      });

      expect(result.current.isFallingBack).toBe(true);
      expect(result.current.fallbackMessage).toBe('RSS blocked. Trying alternative method...');
    });

    it('clears fallback state when progress resumes', async () => {
      const { result } = renderHook(() => useRssImport());

      await waitFor(() => {
        expect(mockListeners.has('rss:fallback-started')).toBe(true);
      });

      // First, trigger fallback
      act(() => {
        emitEvent('rss:fallback-started', { original_error: 'RSS blocked' });
      });

      expect(result.current.isFallingBack).toBe(true);

      // Then, receive progress (scraping succeeded)
      act(() => {
        emitEvent('rss:import-progress', {
          batch_id: 'scrape_123',
          current: 1,
          total: 5,
          job_title: 'Test Job',
        });
      });

      expect(result.current.isFallingBack).toBe(false);
      expect(result.current.progress).not.toBeNull();
    });
  });

  describe('progress event listening', () => {
    it('updates progress when rss:import-progress fires', async () => {
      const { result } = renderHook(() => useRssImport());

      await waitFor(() => {
        expect(mockListeners.has('rss:import-progress')).toBe(true);
      });

      act(() => {
        emitEvent('rss:import-progress', {
          batch_id: 'rss_123',
          current: 3,
          total: 10,
          job_title: 'React Developer Needed',
        });
      });

      expect(result.current.progress).toEqual({
        batch_id: 'rss_123',
        current: 3,
        total: 10,
        job_title: 'React Developer Needed',
      });
      expect(result.current.isComplete).toBe(false);
    });
  });

  describe('completion event listening', () => {
    it('sets isComplete when rss:import-complete fires', async () => {
      const { result } = renderHook(() => useRssImport());

      await waitFor(() => {
        expect(mockListeners.has('rss:import-complete')).toBe(true);
      });

      act(() => {
        emitEvent('rss:import-complete', {
          batch_id: 'rss_123',
          total_analyzed: 10,
          failed_count: 2,
        });
      });

      expect(result.current.isComplete).toBe(true);
      expect(result.current.completionData).toEqual({
        batch_id: 'rss_123',
        total_analyzed: 10,
        failed_count: 2,
      });
      expect(result.current.isFallingBack).toBe(false);
    });

    it('shows browser notification on completion if permission granted', async () => {
      const notificationSpy = vi.fn();
      vi.stubGlobal('Notification', class {
        static permission = 'granted';
        constructor(title: string, options: { body: string }) {
          notificationSpy(title, options);
        }
      });

      const { result } = renderHook(() => useRssImport());

      await waitFor(() => {
        expect(mockListeners.has('rss:import-complete')).toBe(true);
      });

      act(() => {
        emitEvent('rss:import-complete', {
          batch_id: 'rss_123',
          total_analyzed: 10,
          failed_count: 0,
        });
      });

      expect(notificationSpy).toHaveBeenCalledWith(
        'RSS Import Complete',
        expect.objectContaining({ body: expect.stringContaining('10 jobs analyzed') })
      );
    });
  });

  describe('error event listening', () => {
    it('sets error when rss:import-error fires', async () => {
      const { result } = renderHook(() => useRssImport());

      await waitFor(() => {
        expect(mockListeners.has('rss:import-error')).toBe(true);
      });

      act(() => {
        emitEvent('rss:import-error', 'Both import methods failed. RSS: 403. Scraping: parse error.');
      });

      expect(result.current.error).toBe('Both import methods failed. RSS: 403. Scraping: parse error.');
      expect(result.current.isFallingBack).toBe(false);
    });
  });

  describe('reset function', () => {
    it('clears all state when reset is called', async () => {
      const { result } = renderHook(() => useRssImport());

      await waitFor(() => {
        expect(mockListeners.has('rss:import-progress')).toBe(true);
      });

      // Set some state
      act(() => {
        emitEvent('rss:fallback-started', { original_error: 'test' });
        emitEvent('rss:import-progress', {
          batch_id: 'test',
          current: 1,
          total: 5,
          job_title: 'Job',
        });
      });

      expect(result.current.isFallingBack).toBe(false); // Progress cleared fallback
      expect(result.current.progress).not.toBeNull();

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.progress).toBeNull();
      expect(result.current.isComplete).toBe(false);
      expect(result.current.completionData).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isFallingBack).toBe(false);
      expect(result.current.fallbackMessage).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('unregisters all listeners on unmount', async () => {
      const { unmount } = renderHook(() => useRssImport());

      await waitFor(() => {
        expect(mockListeners.has('rss:import-progress')).toBe(true);
        expect(mockListeners.has('rss:import-complete')).toBe(true);
        expect(mockListeners.has('rss:import-error')).toBe(true);
        expect(mockListeners.has('rss:fallback-started')).toBe(true);
      });

      // Verify listeners are registered
      expect(mockListeners.get('rss:import-progress')!.length).toBeGreaterThan(0);

      unmount();

      // Listeners should be cleaned up (empty arrays)
      expect(mockListeners.get('rss:import-progress')!.length).toBe(0);
      expect(mockListeners.get('rss:import-complete')!.length).toBe(0);
      expect(mockListeners.get('rss:import-error')!.length).toBe(0);
      expect(mockListeners.get('rss:fallback-started')!.length).toBe(0);
    });
  });
});
