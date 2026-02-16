import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { useAnnounce } from "../components/LiveAnnouncer";

/**
 * Network blocked event payload (matches Rust NetworkBlockedPayload)
 * Story 8.13 Task 4.3
 */
interface NetworkBlockedPayload {
  domain: string;
  url: string;
  timestamp: string;
}

/**
 * Toast notification state for blocked network requests
 */
export interface NetworkBlockedToast {
  domain: string;
  url: string;
  timestamp: string;
}

/**
 * Hook that listens for network:blocked events and manages notification state.
 * Story 8.13 Task 4.3: Show toast notification when domain is blocked.
 *
 * @returns Current toast notification (null if no notification)
 * @example
 * const toast = useNetworkBlockedNotification();
 * if (toast) {
 *   return <div>Blocked request to {toast.domain}</div>
 * }
 */
export function useNetworkBlockedNotification(): NetworkBlockedToast | null {
  const [toast, setToast] = useState<NetworkBlockedToast | null>(null);
  const announce = useAnnounce();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const unlisten = listen<NetworkBlockedPayload>("network:blocked", (event) => {
      const { domain, url, timestamp } = event.payload;

      // Clear previous timer to prevent stale closure from dismissing new toast
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Set toast notification
      setToast({ domain, url, timestamp });

      // Announce to screen readers (Story 8.3)
      announce(`Blocked network request to unauthorized domain: ${domain}`, "assertive");

      // Auto-dismiss after 5 seconds
      timeoutId = setTimeout(() => {
        setToast(null);
      }, 5000);
    });

    return () => {
      unlisten.then((unlistenFn) => unlistenFn());
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [announce]);

  return toast;
}
