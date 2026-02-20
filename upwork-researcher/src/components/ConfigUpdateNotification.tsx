/**
 * ConfigUpdateNotification component (Story 10.5 Task 1)
 * Toast notification for remote config strategy updates.
 * AC-1: Appears on strategies:updated event, auto-dismisses after 8s
 * AC-6: Lower-priority toast — routed through notification queue
 */

import { useEffect } from 'react';

import './ConfigUpdateNotification.css';
import type { ConfigUpdatePayload } from '../hooks/useNotificationQueue';

import { useAnnounce } from './LiveAnnouncer';

export interface ConfigUpdateNotificationProps {
  visible: boolean;
  changes: ConfigUpdatePayload;
  onDismiss: () => void;
}

export function ConfigUpdateNotification({
  visible,
  changes,
  onDismiss,
}: ConfigUpdateNotificationProps) {
  const announce = useAnnounce();

  const message = `Hook strategies updated: ${changes.newCount} new, ${changes.updatedCount} updated`;

  // AC-1: Announce to screen readers when toast appears (NFR-15)
  useEffect(() => {
    if (visible) {
      announce(message);
    }
  }, [visible, message, announce]);

  // AC-1: Auto-dismiss after 8 seconds
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss]);

  // Task 1.6: Escape key handler
  useEffect(() => {
    if (visible) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onDismiss();
        }
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [visible, onDismiss]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="config-update-notification"
      role="status"
      aria-live="polite"
    >
      <div className="config-update-notification__content">
        <p className="config-update-notification__message">{message}</p>
      </div>
    </div>
  );
}
