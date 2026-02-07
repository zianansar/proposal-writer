/**
 * Platform detection hook and shortcut display helper.
 * Story 3.9: Core Keyboard Shortcuts
 */

/**
 * Internal helper to detect macOS platform.
 * Exported for testing purposes only.
 * @internal
 */
export function detectIsMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().startsWith("mac")
  );
}

/**
 * Detects if the current platform is macOS.
 * Uses navigator.platform check (checking for "Mac" prefix).
 *
 * @returns Object with isMac boolean property
 */
export function usePlatform(): { isMac: boolean } {
  return { isMac: detectIsMac() };
}

/**
 * Returns platform-aware shortcut display text.
 * macOS uses ⌘ symbol, Windows/Linux uses "Ctrl+".
 *
 * @param action - The action to get shortcut text for
 * @returns Formatted shortcut string (e.g., "⌘↵" or "Ctrl+Enter")
 */
export function getShortcutDisplay(action: "generate" | "copy"): string {
  const isMac = detectIsMac();

  switch (action) {
    case "generate":
      return isMac ? "⌘↵" : "Ctrl+Enter";
    case "copy":
      return isMac ? "⌘⇧C" : "Ctrl+Shift+C";
    default: {
      // Exhaustive check - TypeScript will error if a case is missed
      const _exhaustiveCheck: never = action;
      throw new Error(`Unknown action: ${_exhaustiveCheck}`);
    }
  }
}
