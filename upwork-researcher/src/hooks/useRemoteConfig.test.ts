/**
 * Tests for useRemoteConfig hook (Story 10.5 Task 5.5)
 * AC-1: strategies:updated event triggers toast via notification queue
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are available when vi.mock factory is hoisted
const { mockUnlisten, mockListen } = vi.hoisted(() => {
  const mockUnlisten = vi.fn();
  const mockListen = vi.fn(() => Promise.resolve(mockUnlisten));
  return { mockUnlisten, mockListen };
});

let mockStrategiesUpdatedHandler: ((e: { payload: unknown }) => void) | null = null;

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => {
    const [event, handler] = args as [string, (e: { payload: unknown }) => void];
    if (event === 'strategies:updated') {
      mockStrategiesUpdatedHandler = handler;
    }
    return mockListen(...args);
  },
}));

import { useRemoteConfig } from './useRemoteConfig';

describe('useRemoteConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStrategiesUpdatedHandler = null;
  });

  it('should register listener for strategies:updated event on mount', async () => {
    const onStrategiesUpdated = vi.fn();
    renderHook(() => useRemoteConfig({ onStrategiesUpdated }));

    // Allow the effect to run
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListen).toHaveBeenCalledWith('strategies:updated', expect.any(Function));
  });

  it('should call onStrategiesUpdated when event fires with change counts (AC-1)', async () => {
    const onStrategiesUpdated = vi.fn();
    renderHook(() => useRemoteConfig({ onStrategiesUpdated }));

    await act(async () => {
      await Promise.resolve();
    });

    const payload = { newCount: 2, updatedCount: 1, newStrategies: ['hook-new-1'] };
    act(() => {
      mockStrategiesUpdatedHandler?.({ payload });
    });

    expect(onStrategiesUpdated).toHaveBeenCalledWith(payload);
  });

  it('should call onStrategiesUpdated with correct counts from event payload', async () => {
    const onStrategiesUpdated = vi.fn();
    renderHook(() => useRemoteConfig({ onStrategiesUpdated }));

    await act(async () => {
      await Promise.resolve();
    });

    const payload = { newCount: 0, updatedCount: 5, newStrategies: [] };
    act(() => {
      mockStrategiesUpdatedHandler?.({ payload });
    });

    expect(onStrategiesUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ newCount: 0, updatedCount: 5 })
    );
  });

  it('should unregister listener on unmount', async () => {
    const onStrategiesUpdated = vi.fn();
    const { unmount } = renderHook(() => useRemoteConfig({ onStrategiesUpdated }));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    // mockUnlisten should have been called
    expect(mockUnlisten).toHaveBeenCalled();
  });
});
