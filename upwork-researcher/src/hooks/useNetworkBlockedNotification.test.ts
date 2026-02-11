// Story 8.13 H3: Frontend tests for useNetworkBlockedNotification hook
// Tests event listening, toast state, auto-dismiss, timer management, and accessibility

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNetworkBlockedNotification } from './useNetworkBlockedNotification';

// Mock Tauri event API (same pattern as useRssImport.test.ts)
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

// Mock LiveAnnouncer
const mockAnnounce = vi.fn();

vi.mock('../components/LiveAnnouncer', () => ({
  useAnnounce: () => mockAnnounce,
}));

// Helper to emit mock events
function emitEvent(eventName: string, payload: unknown) {
  const listeners = mockListeners.get(eventName) || [];
  listeners.forEach(cb => cb({ payload }));
}

describe('useNetworkBlockedNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns null initially', () => {
    const { result } = renderHook(() => useNetworkBlockedNotification());
    expect(result.current).toBeNull();
  });

  it('sets toast on network:blocked event', async () => {
    const { result } = renderHook(() => useNetworkBlockedNotification());

    // Wait for listener registration
    await waitFor(() => {
      expect(mockListeners.has('network:blocked')).toBe(true);
    });

    act(() => {
      emitEvent('network:blocked', {
        domain: 'evil.com',
        url: 'https://evil.com/exfiltrate',
        timestamp: '2026-02-11T00:00:00Z',
      });
    });

    expect(result.current).toEqual({
      domain: 'evil.com',
      url: 'https://evil.com/exfiltrate',
      timestamp: '2026-02-11T00:00:00Z',
    });
  });

  it('auto-dismisses after 5 seconds', async () => {
    const { result } = renderHook(() => useNetworkBlockedNotification());

    await waitFor(() => {
      expect(mockListeners.has('network:blocked')).toBe(true);
    });

    act(() => {
      emitEvent('network:blocked', {
        domain: 'evil.com',
        url: 'https://evil.com/exfiltrate',
        timestamp: '2026-02-11T00:00:00Z',
      });
    });

    expect(result.current).not.toBeNull();

    // Advance time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBeNull();
  });

  it('clears previous timer on rapid events', async () => {
    const { result } = renderHook(() => useNetworkBlockedNotification());

    await waitFor(() => {
      expect(mockListeners.has('network:blocked')).toBe(true);
    });

    // First event
    act(() => {
      emitEvent('network:blocked', {
        domain: 'evil1.com',
        url: 'https://evil1.com/test',
        timestamp: '2026-02-11T00:00:00Z',
      });
    });

    expect(result.current?.domain).toBe('evil1.com');

    // Advance 3 seconds (not enough to dismiss first)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Second event arrives before first timer fires
    act(() => {
      emitEvent('network:blocked', {
        domain: 'evil2.com',
        url: 'https://evil2.com/test',
        timestamp: '2026-02-11T00:00:03Z',
      });
    });

    expect(result.current?.domain).toBe('evil2.com');

    // Advance 2 more seconds (5 total from first event)
    // Without the fix, the first timer would fire and clear the second toast
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Toast should still be visible (second timer hasn't expired yet)
    expect(result.current).not.toBeNull();
    expect(result.current?.domain).toBe('evil2.com');

    // Advance remaining 3 seconds (5 total from second event)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Now it should be dismissed
    expect(result.current).toBeNull();
  });

  it('announces to screen readers with assertive politeness', async () => {
    renderHook(() => useNetworkBlockedNotification());

    await waitFor(() => {
      expect(mockListeners.has('network:blocked')).toBe(true);
    });

    act(() => {
      emitEvent('network:blocked', {
        domain: 'evil.com',
        url: 'https://evil.com/exfiltrate',
        timestamp: '2026-02-11T00:00:00Z',
      });
    });

    expect(mockAnnounce).toHaveBeenCalledWith(
      'Blocked network request to unauthorized domain: evil.com',
      'assertive'
    );
  });

  it('cleans up listener on unmount', async () => {
    const { unmount } = renderHook(() => useNetworkBlockedNotification());

    await waitFor(() => {
      expect(mockListeners.has('network:blocked')).toBe(true);
      expect(mockListeners.get('network:blocked')!.length).toBeGreaterThan(0);
    });

    unmount();

    // Listener should be removed
    expect(mockListeners.get('network:blocked')!.length).toBe(0);
  });
});
