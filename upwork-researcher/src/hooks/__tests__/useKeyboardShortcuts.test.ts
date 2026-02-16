import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useKeyboardShortcuts } from "../useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  const originalNavigator = global.navigator;
  let onGenerate: ReturnType<typeof vi.fn>;
  let onCopy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onGenerate = vi.fn();
    onCopy = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
    });
  });

  const dispatchKeyDown = (options: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...options,
    });
    window.dispatchEvent(event);
    return event;
  };

  describe("on macOS (metaKey)", () => {
    beforeEach(() => {
      Object.defineProperty(global, "navigator", {
        value: { platform: "MacIntel" },
        writable: true,
      });
    });

    it("triggers onGenerate when Cmd+Enter pressed and canGenerate=true", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: true,
          canCopy: false,
        }),
      );

      const event = dispatchKeyDown({ key: "Enter", metaKey: true });

      expect(onGenerate).toHaveBeenCalledTimes(1);
      expect(onCopy).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it("does NOT trigger onGenerate when Cmd+Enter pressed and canGenerate=false", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: false,
        }),
      );

      dispatchKeyDown({ key: "Enter", metaKey: true });

      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("triggers onCopy when Cmd+Shift+C pressed and canCopy=true", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: true,
        }),
      );

      const event = dispatchKeyDown({ key: "C", metaKey: true, shiftKey: true });

      expect(onCopy).toHaveBeenCalledTimes(1);
      expect(onGenerate).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it("does NOT trigger onCopy when Cmd+Shift+C pressed and canCopy=false", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: false,
        }),
      );

      dispatchKeyDown({ key: "C", metaKey: true, shiftKey: true });

      expect(onCopy).not.toHaveBeenCalled();
    });

    it("does NOT trigger onGenerate with Ctrl+Enter on Mac (uses metaKey)", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: true,
          canCopy: false,
        }),
      );

      // Ctrl+Enter should not work on Mac
      dispatchKeyDown({ key: "Enter", ctrlKey: true });

      expect(onGenerate).not.toHaveBeenCalled();
    });
  });

  describe("on Windows/Linux (ctrlKey)", () => {
    beforeEach(() => {
      Object.defineProperty(global, "navigator", {
        value: { platform: "Win32" },
        writable: true,
      });
    });

    it("triggers onGenerate when Ctrl+Enter pressed and canGenerate=true", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: true,
          canCopy: false,
        }),
      );

      const event = dispatchKeyDown({ key: "Enter", ctrlKey: true });

      expect(onGenerate).toHaveBeenCalledTimes(1);
      expect(onCopy).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it("does NOT trigger onGenerate when Ctrl+Enter pressed and canGenerate=false", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: false,
        }),
      );

      dispatchKeyDown({ key: "Enter", ctrlKey: true });

      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("triggers onCopy when Ctrl+Shift+C pressed and canCopy=true", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: true,
        }),
      );

      const event = dispatchKeyDown({ key: "C", ctrlKey: true, shiftKey: true });

      expect(onCopy).toHaveBeenCalledTimes(1);
      expect(onGenerate).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it("does NOT trigger onCopy when Ctrl+Shift+C pressed and canCopy=false", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: false,
        }),
      );

      dispatchKeyDown({ key: "C", ctrlKey: true, shiftKey: true });

      expect(onCopy).not.toHaveBeenCalled();
    });

    it("does NOT trigger onGenerate with Cmd+Enter on Windows (uses ctrlKey)", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: true,
          canCopy: false,
        }),
      );

      // Meta+Enter should not work on Windows
      dispatchKeyDown({ key: "Enter", metaKey: true });

      expect(onGenerate).not.toHaveBeenCalled();
    });
  });

  describe("native clipboard preservation", () => {
    beforeEach(() => {
      Object.defineProperty(global, "navigator", {
        value: { platform: "Win32" },
        writable: true,
      });
    });

    it("does NOT prevent default for Ctrl+C (native copy)", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: true,
        }),
      );

      const event = dispatchKeyDown({ key: "c", ctrlKey: true });

      // Native Ctrl+C should not be intercepted
      expect(onCopy).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("does NOT prevent default for Ctrl+V (native paste)", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: true,
        }),
      );

      const event = dispatchKeyDown({ key: "v", ctrlKey: true });

      // Native Ctrl+V should not be intercepted
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("removes event listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: true,
          canCopy: true,
        }),
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("textarea integration (AC3)", () => {
    beforeEach(() => {
      Object.defineProperty(global, "navigator", {
        value: { platform: "Win32" },
        writable: true,
      });
    });

    it("triggers onGenerate when shortcut pressed from within a focused textarea", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: true,
          canCopy: false,
        }),
      );

      // Create and focus a textarea to simulate typing context
      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      // Dispatch keydown event from the textarea (bubbles to window)
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      textarea.dispatchEvent(event);

      expect(onGenerate).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);

      // Cleanup
      document.body.removeChild(textarea);
    });

    it("triggers onCopy when shortcut pressed from within a focused textarea", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onGenerate,
          onCopy,
          canGenerate: false,
          canCopy: true,
        }),
      );

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      const event = new KeyboardEvent("keydown", {
        key: "C",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      textarea.dispatchEvent(event);

      expect(onCopy).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);

      document.body.removeChild(textarea);
    });
  });
});
