/**
 * Tests for useStrategySyncListener hook (Story 10.3: Task 5.3)
 *
 * Tests:
 * - Listener registered on mount (Task 5.3.1)
 * - Listener cleans up on unmount (Task 5.3.2)
 * - onSync callback called when event received (Task 5.3.3)
 * - showNotification logs to console in dev mode (Task 5.3.4)
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useStrategySyncListener, StrategySyncResult } from "./useStrategySyncListener";

// Mock Tauri event API — same pattern as useNetworkBlockedNotification.test.ts
const mockListeners: Map<string, ((event: { payload: unknown }) => void)[]> = new Map();

const mockListen = vi.fn(
  async (eventName: string, callback: (event: { payload: unknown }) => void) => {
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
  },
);

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: Parameters<typeof mockListen>) => mockListen(...args),
}));

/** Helper to emit a mock strategies:updated event */
function emitStrategiesUpdated(payload: StrategySyncResult) {
  const listeners = mockListeners.get("strategies:updated") || [];
  listeners.forEach((cb) => cb({ payload }));
}

describe("useStrategySyncListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers listener for strategies:updated on mount", async () => {
    // Task 5.3.1: Listener is registered when hook mounts
    renderHook(() => useStrategySyncListener());

    // Wait for the async listen() call to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListen).toHaveBeenCalledWith("strategies:updated", expect.any(Function));
    expect(mockListeners.has("strategies:updated")).toBe(true);
    expect(mockListeners.get("strategies:updated")).toHaveLength(1);
  });

  it("cleans up listener on unmount", async () => {
    // Task 5.3.2: Listener is removed when hook unmounts
    const { unmount } = renderHook(() => useStrategySyncListener());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListeners.get("strategies:updated")).toHaveLength(1);

    unmount();

    // After unmount, the unlisten function should have been called
    expect(mockListeners.get("strategies:updated")).toHaveLength(0);
  });

  it("calls onSync callback when strategies:updated event is received", async () => {
    // Task 5.3.3: onSync callback is invoked with the event payload
    const onSyncMock = vi.fn();

    renderHook(() => useStrategySyncListener({ onSync: onSyncMock }));

    await act(async () => {
      await Promise.resolve();
    });

    const syncResult: StrategySyncResult = {
      added_count: 2,
      updated_count: 1,
      retired_count: 0,
    };

    act(() => {
      emitStrategiesUpdated(syncResult);
    });

    expect(onSyncMock).toHaveBeenCalledTimes(1);
    expect(onSyncMock).toHaveBeenCalledWith(syncResult);
  });

  it("logs notification when showNotification is true (dev mode)", async () => {
    // Task 5.3.4: Console notification shown with correct counts when showNotification=true
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    renderHook(() => useStrategySyncListener({ showNotification: true }));

    await act(async () => {
      await Promise.resolve();
    });

    const syncResult: StrategySyncResult = {
      added_count: 3,
      updated_count: 2,
      retired_count: 1,
    };

    act(() => {
      emitStrategiesUpdated(syncResult);
    });

    // In test environment, import.meta.env.DEV is typically true
    // The notification log should include the counts
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("+3 added"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("~2 updated"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("-1 retired"),
    );

    consoleSpy.mockRestore();
  });
});
