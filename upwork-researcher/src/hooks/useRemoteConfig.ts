/**
 * useRemoteConfig hook (Story 10.5 Task 5)
 * Listens for Tauri `strategies:updated` event and routes to notification queue.
 * AC-1: Event triggers ConfigUpdateNotification via callback.
 */

import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

export interface StrategiesUpdatedPayload {
  newCount: number;
  updatedCount: number;
  newStrategies: string[];
}

interface UseRemoteConfigOptions {
  onStrategiesUpdated: (payload: StrategiesUpdatedPayload) => void;
}

/**
 * Registers a Tauri event listener for `strategies:updated`.
 * On event: calls `onStrategiesUpdated` with change counts.
 * Cleans up listener on unmount.
 */
export function useRemoteConfig({ onStrategiesUpdated }: UseRemoteConfigOptions) {
  useEffect(() => {
    // CR R2 M-1: Track cancellation to prevent listener leak if unmount happens during setup
    let cancelled = false;
    let unlistenFn: (() => void) | null = null;

    const setup = async () => {
      const unlisten = await listen<StrategiesUpdatedPayload>(
        'strategies:updated',
        (event) => {
          onStrategiesUpdated(event.payload);
        },
      );
      if (cancelled) {
        unlisten(); // Cleanup immediately if effect was already torn down
      } else {
        unlistenFn = unlisten;
      }
    };

    setup().catch((err) => {
      if (import.meta.env.DEV) {
        console.error('[useRemoteConfig] Failed to register strategies:updated listener:', err);
      }
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [onStrategiesUpdated]);
}
