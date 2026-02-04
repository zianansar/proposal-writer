import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useGenerationStream } from "./useGenerationStream";
import { useGenerationStore } from "../stores/useGenerationStore";

// Get mocked listen function
const mockListen = vi.mocked(listen);

describe("useGenerationStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGenerationStore.getState().reset();
  });

  it("sets up event listeners on mount", () => {
    renderHook(() => useGenerationStream());

    // Should listen to all three events
    expect(mockListen).toHaveBeenCalledTimes(3);
    expect(mockListen).toHaveBeenCalledWith("generation:token", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("generation:complete", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("generation:error", expect.any(Function));
  });

  it("calls unlisten functions on unmount", async () => {
    const mockUnlisten1 = vi.fn();
    const mockUnlisten2 = vi.fn();
    const mockUnlisten3 = vi.fn();

    mockListen
      .mockResolvedValueOnce(mockUnlisten1)
      .mockResolvedValueOnce(mockUnlisten2)
      .mockResolvedValueOnce(mockUnlisten3);

    const { unmount } = renderHook(() => useGenerationStream());

    // Allow promises to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    unmount();

    expect(mockUnlisten1).toHaveBeenCalled();
    expect(mockUnlisten2).toHaveBeenCalled();
    expect(mockUnlisten3).toHaveBeenCalled();
  });

  it("appends tokens when token event is received", async () => {
    let tokenCallback: (event: { payload: { tokens: string[]; stageId: string } }) => void;

    mockListen.mockImplementation((eventName, callback) => {
      if (eventName === "generation:token") {
        tokenCallback = callback as typeof tokenCallback;
      }
      return Promise.resolve(() => {});
    });

    renderHook(() => useGenerationStream());

    // Allow setup to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Simulate receiving token event
    act(() => {
      tokenCallback({ payload: { tokens: ["Hello", " world"], stageId: "generation" } });
    });

    expect(useGenerationStore.getState().tokens).toEqual(["Hello", " world"]);
  });

  it("sets complete when complete event is received", async () => {
    let completeCallback: (event: { payload: { fullText: string } }) => void;

    mockListen.mockImplementation((eventName, callback) => {
      if (eventName === "generation:complete") {
        completeCallback = callback as typeof completeCallback;
      }
      return Promise.resolve(() => {});
    });

    renderHook(() => useGenerationStream());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      completeCallback({ payload: { fullText: "Complete proposal text" } });
    });

    expect(useGenerationStore.getState().fullText).toBe("Complete proposal text");
  });

  it("sets error when error event is received", async () => {
    let errorCallback: (event: { payload: { message: string } }) => void;

    mockListen.mockImplementation((eventName, callback) => {
      if (eventName === "generation:error") {
        errorCallback = callback as typeof errorCallback;
      }
      return Promise.resolve(() => {});
    });

    renderHook(() => useGenerationStream());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      errorCallback({ payload: { message: "API error occurred" } });
    });

    expect(useGenerationStore.getState().error).toBe("API error occurred");
  });

  it("provides ensureListenersReady function that resolves when listeners are registered", async () => {
    const { result } = renderHook(() => useGenerationStream());

    // ensureListenersReady should be available
    expect(result.current.ensureListenersReady).toBeDefined();
    expect(typeof result.current.ensureListenersReady).toBe("function");

    // Should resolve without error
    await act(async () => {
      await result.current.ensureListenersReady();
    });
  });
});
