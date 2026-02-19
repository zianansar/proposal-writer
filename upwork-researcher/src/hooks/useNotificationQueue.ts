/**
 * useNotificationQueue hook (Story 10.5 Task 2)
 * Priority queue for app-update and config-update notifications.
 * AC-6: App update notifications always display before config update notifications.
 */

import { useState, useCallback } from 'react';

export type NotificationType = 'app-update' | 'config-update';
export type NotificationPriority = 'high' | 'normal';

/** CR R2 L-2: Type-safe payload per notification type */
export interface ConfigUpdatePayload {
  newCount: number;
  updatedCount: number;
}

export interface AppUpdatePayload {
  version: string;
}

export type NotificationPayloadMap = {
  'config-update': ConfigUpdatePayload;
  'app-update': AppUpdatePayload;
};

export interface QueuedNotification<T extends NotificationType = NotificationType> {
  type: T;
  payload: NotificationPayloadMap[T];
  priority: NotificationPriority;
}

interface NotificationQueueState {
  queue: QueuedNotification[];
}

/**
 * Priority queue for overlapping notifications.
 * - 'high' priority (app-update) always sorts before 'normal' (config-update)
 * - Multiple config-update notifications are coalesced (last wins)
 * - Only one notification visible at a time; next shows on dismiss
 *
 * ADR: AutoUpdateNotification is NOT routed through this queue. It manages its
 * own multi-state lifecycle (toast → downloading → restart dialog) with internal
 * state machine, focus trap, and progress tracking that don't fit a simple
 * show/dismiss queue model. Instead, App.tsx coordinates visibility between the
 * two notification types via the onToastHidden callback (CR R2 H-1).
 */
export function useNotificationQueue() {
  const [state, setState] = useState<NotificationQueueState>({ queue: [] });

  const enqueueNotification = useCallback(
    <T extends NotificationType>(type: T, payload: NotificationPayloadMap[T], priority: NotificationPriority) => {
      setState((prev) => {
        // Coalesce config-update: replace existing config-update in queue with new payload
        let newQueue: QueuedNotification[];
        if (type === 'config-update') {
          const withoutConfigUpdate = prev.queue.filter((n) => n.type !== 'config-update');
          newQueue = [...withoutConfigUpdate, { type, payload, priority } as QueuedNotification];
        } else {
          newQueue = [...prev.queue, { type, payload, priority } as QueuedNotification];
        }

        // Sort: high priority first, then FIFO within same priority
        newQueue.sort((a, b) => {
          if (a.priority === 'high' && b.priority !== 'high') return -1;
          if (b.priority === 'high' && a.priority !== 'high') return 1;
          return 0;
        });

        return { queue: newQueue };
      });
    },
    [],
  );

  const dismissCurrent = useCallback(() => {
    setState((prev) => ({
      queue: prev.queue.slice(1),
    }));
  }, []);

  const currentNotification = state.queue[0] ?? null;
  const queueLength = state.queue.length;

  return {
    currentNotification,
    queueLength,
    enqueueNotification,
    dismissCurrent,
  };
}
