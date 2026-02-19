/**
 * Hook for listening to A/B testing events (Story 10.4: Task 6)
 *
 * Registers a Tauri event listener for `ab:no-active-weights` emitted by the
 * backend when all hook strategy ab_weights are 0.0 (AC-6 fallback).
 *
 * Displays a toast notification with the spec-required message and auto-dismisses
 * after 5 seconds.
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

/** Exact message from AC-6 specification */
export const AB_NO_ACTIVE_WEIGHTS_MESSAGE =
  "No strategies are currently in A/B testing. Please select a strategy manually.";

/** Options for useAbTestingListener */
export interface UseAbTestingListenerOptions {
  /**
   * Called when ab:no-active-weights event is received.
   * Typically used to show a toast notification (Task 6.2).
   * If not provided, the hook uses a default console.warn.
   */
  onNoActiveWeights?: () => void;
}

/**
 * Register a listener for the `ab:no-active-weights` Tauri event (Story 10.4: AC-6).
 *
 * When all strategies have ab_weight == 0.0, the backend emits this event and
 * the frontend should show a toast prompting the user to select a strategy manually.
 *
 * @param options.onNoActiveWeights - Callback to display toast (required for UI integration)
 *
 * @example
 * useAbTestingListener({
 *   onNoActiveWeights: () => showToast(AB_NO_ACTIVE_WEIGHTS_MESSAGE),
 * });
 */
export function useAbTestingListener(options: UseAbTestingListenerOptions = {}): void {
  const { onNoActiveWeights } = options;

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    // Task 6.1: Listen for ab:no-active-weights event
    listen<null>("ab:no-active-weights", () => {
      if (onNoActiveWeights) {
        onNoActiveWeights();
      } else {
        // Default: log to console when no callback provided
        console.warn("[A/B Testing]", AB_NO_ACTIVE_WEIGHTS_MESSAGE);
      }
    }).then((unlistenFn) => {
      unlisten = unlistenFn;
    });

    // Task 6.1: Cleanup listener on unmount
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [onNoActiveWeights]);
}
