/**
 * Platform detection and keyboard shortcut formatting utilities (Story 6.5)
 */

/**
 * Detect if running on macOS
 */
export function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Get the modifier key symbol for the current platform
 */
export function getModifierKey(): string {
  return isMac() ? "⌘" : "Ctrl";
}

/**
 * Get the shift key symbol for the current platform
 */
export function getShiftKey(): string {
  return isMac() ? "⇧" : "Shift";
}

/**
 * Format a keyboard shortcut for display
 * @param key - The key (e.g., 'B', 'I', 'Z')
 * @param modifiers - Array of modifiers ('cmd', 'shift', 'alt')
 * @returns Formatted shortcut string (e.g., '⌘B' or 'Ctrl+B')
 */
export function formatShortcut(
  key: string,
  modifiers: string[] = ["cmd"]
): string {
  const parts: string[] = [];
  const mac = isMac();

  // Mac order: ⇧⌥⌘ (Shift, Alt, Cmd)
  // Windows order: Ctrl+Alt+Shift (standard Windows convention)
  if (mac) {
    if (modifiers.includes("shift")) parts.push("⇧");
    if (modifiers.includes("alt")) parts.push("⌥");
    if (modifiers.includes("cmd")) parts.push("⌘");
  } else {
    if (modifiers.includes("cmd")) parts.push("Ctrl+");
    if (modifiers.includes("alt")) parts.push("Alt+");
    if (modifiers.includes("shift")) parts.push("Shift+");
  }

  parts.push(key.toUpperCase());

  return parts.join("");
}

/**
 * Predefined keyboard shortcuts for common editor actions
 * Platform-aware formatting applied automatically
 * Implemented as getters to ensure platform detection happens at runtime
 */
export const SHORTCUTS = {
  get BOLD() {
    return formatShortcut("B");
  },
  get ITALIC() {
    return formatShortcut("I");
  },
  get UNDO() {
    return formatShortcut("Z");
  },
  get REDO() {
    return formatShortcut("Z", ["cmd", "shift"]);
  },
};
