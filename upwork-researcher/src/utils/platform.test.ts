import { describe, it, expect, beforeEach, vi } from "vitest";
import { isMac, getModifierKey, getShiftKey, formatShortcut, SHORTCUTS } from "./platform";

describe("platform utilities", () => {
  describe("isMac", () => {
    beforeEach(() => {
      // Reset platform mock before each test
      vi.unstubAllGlobals();
    });

    it("returns true on macOS", () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });
      expect(isMac()).toBe(true);
    });

    it("returns true on Mac ARM", () => {
      vi.stubGlobal("navigator", {
        platform: "MacPPC",
      });
      expect(isMac()).toBe(true);
    });

    it("returns false on Windows", () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });
      expect(isMac()).toBe(false);
    });

    it("returns false on Linux", () => {
      vi.stubGlobal("navigator", {
        platform: "Linux x86_64",
      });
      expect(isMac()).toBe(false);
    });
  });

  describe("getModifierKey", () => {
    it("returns ⌘ on Mac", () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });
      expect(getModifierKey()).toBe("⌘");
    });

    it("returns Ctrl on Windows", () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });
      expect(getModifierKey()).toBe("Ctrl");
    });
  });

  describe("getShiftKey", () => {
    it("returns ⇧ on Mac", () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });
      expect(getShiftKey()).toBe("⇧");
    });

    it("returns Shift on Windows", () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });
      expect(getShiftKey()).toBe("Shift");
    });
  });

  describe("formatShortcut", () => {
    it("formats simple shortcut on Mac", () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });
      expect(formatShortcut("B")).toBe("⌘B");
    });

    it("formats simple shortcut on Windows", () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });
      expect(formatShortcut("B")).toBe("Ctrl+B");
    });

    it("formats shortcut with shift modifier on Mac", () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });
      expect(formatShortcut("Z", ["cmd", "shift"])).toBe("⇧⌘Z");
    });

    it("formats shortcut with shift modifier on Windows", () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });
      expect(formatShortcut("Z", ["cmd", "shift"])).toBe("Ctrl+Shift+Z");
    });

    it("formats shortcut with alt modifier on Mac", () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });
      expect(formatShortcut("A", ["cmd", "alt"])).toBe("⌥⌘A");
    });

    it("formats shortcut with alt modifier on Windows", () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });
      expect(formatShortcut("A", ["cmd", "alt"])).toBe("Ctrl+Alt+A");
    });

    it("formats shortcut with all modifiers on Mac", () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });
      expect(formatShortcut("X", ["shift", "alt", "cmd"])).toBe("⇧⌥⌘X");
    });

    it("uppercases the key", () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });
      expect(formatShortcut("b")).toBe("Ctrl+B");
    });
  });

  describe("SHORTCUTS", () => {
    beforeEach(() => {
      // Ensure consistent platform for predefined shortcuts
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });
    });

    it("exports BOLD shortcut", () => {
      expect(SHORTCUTS.BOLD).toBeDefined();
      expect(typeof SHORTCUTS.BOLD).toBe("string");
    });

    it("exports ITALIC shortcut", () => {
      expect(SHORTCUTS.ITALIC).toBeDefined();
      expect(typeof SHORTCUTS.ITALIC).toBe("string");
    });

    it("exports UNDO shortcut", () => {
      expect(SHORTCUTS.UNDO).toBeDefined();
      expect(typeof SHORTCUTS.UNDO).toBe("string");
    });

    it("exports REDO shortcut", () => {
      expect(SHORTCUTS.REDO).toBeDefined();
      expect(typeof SHORTCUTS.REDO).toBe("string");
    });
  });
});
