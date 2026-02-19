// Tests for useAbTestingListener hook (Story 10.4: Task 6.5)
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useAbTestingListener, AB_NO_ACTIVE_WEIGHTS_MESSAGE } from "./useAbTestingListener";

// Mock Tauri event listener
vi.mock("@tauri-apps/api/event", () => {
  const listeners: Map<string, ((event: { payload: unknown }) => void)[]> = new Map();

  return {
    listen: vi.fn((eventName: string, callback: (event: { payload: unknown }) => void) => {
      if (!listeners.has(eventName)) listeners.set(eventName, []);
      listeners.get(eventName)!.push(callback);

      const unlisten = () => {
        const cbs = listeners.get(eventName);
        if (cbs) {
          const idx = cbs.indexOf(callback);
          if (idx !== -1) cbs.splice(idx, 1);
        }
      };
      return Promise.resolve(unlisten);
    }),
    // Expose for triggering events in tests
    __trigger: (eventName: string, payload: unknown) => {
      const cbs = listeners.get(eventName) || [];
      cbs.forEach((cb) => cb({ payload }));
    },
    __clearListeners: () => listeners.clear(),
  };
});

const { listen, __trigger, __clearListeners } = await import("@tauri-apps/api/event") as any;
const mockListen = vi.mocked(listen);

beforeEach(() => {
  __clearListeners();
  vi.clearAllMocks();
});

afterEach(() => {
  __clearListeners();
});

describe("useAbTestingListener", () => {
  // Task 6.5.1: Toast displays on event emission
  it("calls onNoActiveWeights when ab:no-active-weights event is received", async () => {
    const onNoActiveWeights = vi.fn();
    renderHook(() => useAbTestingListener({ onNoActiveWeights }));

    // Wait for listener registration
    await act(async () => {
      await Promise.resolve();
    });

    // Trigger the event
    act(() => {
      __trigger("ab:no-active-weights", null);
    });

    expect(onNoActiveWeights).toHaveBeenCalledTimes(1);
  });

  // Task 6.5.2: Toast message matches spec
  it("exports the correct message matching AC-6 specification", () => {
    expect(AB_NO_ACTIVE_WEIGHTS_MESSAGE).toBe(
      "No strategies are currently in A/B testing. Please select a strategy manually.",
    );
  });

  it("registers listener for ab:no-active-weights event", async () => {
    renderHook(() => useAbTestingListener({}));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListen).toHaveBeenCalledWith("ab:no-active-weights", expect.any(Function));
  });

  it("cleans up listener on unmount", async () => {
    const onNoActiveWeights = vi.fn();
    const { unmount } = renderHook(() => useAbTestingListener({ onNoActiveWeights }));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    // Trigger after unmount — callback should NOT be called
    act(() => {
      __trigger("ab:no-active-weights", null);
    });

    expect(onNoActiveWeights).not.toHaveBeenCalled();
  });
});
