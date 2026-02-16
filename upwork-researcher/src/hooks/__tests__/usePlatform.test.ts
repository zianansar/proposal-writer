import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { usePlatform, getShortcutDisplay } from "../usePlatform";

describe("usePlatform", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
    });
  });

  it("returns isMac=true on macOS", () => {
    Object.defineProperty(global, "navigator", {
      value: { platform: "MacIntel" },
      writable: true,
    });

    const result = usePlatform();
    expect(result.isMac).toBe(true);
  });

  it("returns isMac=true on macOS ARM", () => {
    Object.defineProperty(global, "navigator", {
      value: { platform: "MacARM" },
      writable: true,
    });

    const result = usePlatform();
    expect(result.isMac).toBe(true);
  });

  it("returns isMac=false on Windows", () => {
    Object.defineProperty(global, "navigator", {
      value: { platform: "Win32" },
      writable: true,
    });

    const result = usePlatform();
    expect(result.isMac).toBe(false);
  });

  it("returns isMac=false on Linux", () => {
    Object.defineProperty(global, "navigator", {
      value: { platform: "Linux x86_64" },
      writable: true,
    });

    const result = usePlatform();
    expect(result.isMac).toBe(false);
  });
});

describe("getShortcutDisplay", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
    });
  });

  describe("on macOS", () => {
    beforeEach(() => {
      Object.defineProperty(global, "navigator", {
        value: { platform: "MacIntel" },
        writable: true,
      });
    });

    it("returns ⌘↵ for generate action", () => {
      expect(getShortcutDisplay("generate")).toBe("⌘↵");
    });

    it("returns ⌘⇧C for copy action", () => {
      expect(getShortcutDisplay("copy")).toBe("⌘⇧C");
    });
  });

  describe("on Windows/Linux", () => {
    beforeEach(() => {
      Object.defineProperty(global, "navigator", {
        value: { platform: "Win32" },
        writable: true,
      });
    });

    it("returns Ctrl+Enter for generate action", () => {
      expect(getShortcutDisplay("generate")).toBe("Ctrl+Enter");
    });

    it("returns Ctrl+Shift+C for copy action", () => {
      expect(getShortcutDisplay("copy")).toBe("Ctrl+Shift+C");
    });
  });
});
