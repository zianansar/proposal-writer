/**
 * Centralized keyboard shortcut handler.
 * Story 3.9: Core Keyboard Shortcuts - Task 3
 *
 * Listens for:
 * - Cmd/Ctrl+Enter → Generate proposal
 * - Cmd/Ctrl+Shift+C → Copy proposal (with safety analysis)
 */

import { useEffect, useCallback } from "react";

import { usePlatform } from "./usePlatform";

export interface UseKeyboardShortcutsConfig {
  /** Callback when generate shortcut is triggered */
  onGenerate: () => void;
  /** Callback when copy shortcut is triggered */
  onCopy: () => void;
  /** Whether generate action is allowed */
  canGenerate: boolean;
  /** Whether copy action is allowed */
  canCopy: boolean;
}

/**
 * Hook that registers global keyboard shortcuts.
 *
 * Shortcuts:
 * - Cmd/Ctrl+Enter: Triggers onGenerate (even from within textarea)
 * - Cmd/Ctrl+Shift+C: Triggers onCopy
 *
 * Native clipboard operations (Cmd/Ctrl+C/V) are preserved.
 *
 * @returns void - This hook only registers side effects (event listeners)
 */
export function useKeyboardShortcuts({
  onGenerate,
  onCopy,
  canGenerate,
  canCopy,
}: UseKeyboardShortcutsConfig): void {
  const { isMac } = usePlatform();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for modifier key (Cmd on Mac, Ctrl on Windows/Linux)
      const modifierPressed = isMac ? event.metaKey : event.ctrlKey;

      if (!modifierPressed) {
        return;
      }

      // Cmd/Ctrl+Enter → Generate
      if (event.key === "Enter" && !event.shiftKey) {
        if (canGenerate) {
          event.preventDefault();
          onGenerate();
        }
        return;
      }

      // Cmd/Ctrl+Shift+C → Copy with safety analysis
      // Using Shift+C to avoid conflict with native Cmd/Ctrl+C
      if (event.key === "C" && event.shiftKey) {
        if (canCopy) {
          event.preventDefault();
          onCopy();
        }
        return;
      }

      // Let native Cmd/Ctrl+C and Cmd/Ctrl+V pass through
      // (no preventDefault for standard clipboard operations)
    },
    [isMac, onGenerate, onCopy, canGenerate, canCopy],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
