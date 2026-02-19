/**
 * Hook for listening to strategy sync events (Story 10.3: Task 5)
 *
 * Registers a Tauri event listener for the `strategies:updated` event emitted
 * by the backend when hook strategies are synced from remote config (AC-6).
 *
 * When the event fires, calls the optional `onSync` callback so the caller
 * can refresh its strategy data (e.g., re-fetching in HookStrategySelector).
 */

import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

/** Sync result payload from the `strategies:updated` Tauri event */
export interface StrategySyncResult {
  added_count: number;
  updated_count: number;
  retired_count: number;
}

/** Options for useStrategySyncListener */
export interface UseStrategySyncListenerOptions {
  /**
   * Called when strategies:updated event is received.
   * Use this to re-fetch the strategies list (e.g., call fetchStrategies()).
   */
  onSync?: (result: StrategySyncResult) => void;

  /**
   * If true, logs sync results to console in dev mode (optional toast substitute).
   * Defaults to false.
   */
  showNotification?: boolean;
}

/**
 * Register a listener for the `strategies:updated` Tauri event.
 *
 * Story 10.3: AC-6 — the frontend hook strategy list refreshes automatically
 * when this event is received from the backend sync process.
 *
 * @param options - Listener configuration (onSync callback, showNotification flag)
 *
 * @example
 * // In HookStrategySelector:
 * useStrategySyncListener({ onSync: fetchStrategies });
 */
export function useStrategySyncListener(
  options: UseStrategySyncListenerOptions = {},
): void {
  const { onSync, showNotification = false } = options;

  // Use refs to avoid re-registering listener on every render when callbacks change
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const showNotificationRef = useRef(showNotification);
  showNotificationRef.current = showNotification;

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let unmounted = false;

    // Register the listener (Task 5.1: AC-6)
    listen<StrategySyncResult>("strategies:updated", (event) => {
      const result = event.payload;

      if (showNotificationRef.current && import.meta.env.DEV) {
        // Optional: log sync notification (production UI toast would go here)
        console.info(
          `Hook strategies updated: +${result.added_count} added, ~${result.updated_count} updated, -${result.retired_count} retired`,
        );
      }

      // Call onSync callback to trigger data refresh (Task 5.2)
      if (onSyncRef.current) {
        onSyncRef.current(result);
      }
    }).then((unlistenFn) => {
      // H2 fix: if component unmounted before listen resolved, clean up immediately
      if (unmounted) {
        unlistenFn();
      } else {
        unlisten = unlistenFn;
      }
    });

    // Cleanup: unregister listener on unmount (Task 5.1: AC-6)
    return () => {
      unmounted = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, []); // Empty deps: register once on mount, cleanup on unmount
}
