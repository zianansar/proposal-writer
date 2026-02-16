// Story 4b.7: RSS Import Progress Hook
// Story 4b.8: Added fallback event listening
// Listens to RSS import events and tracks progress

import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

interface RssImportProgress {
  batch_id: string;
  current: number;
  total: number;
  job_title: string;
}

interface RssImportComplete {
  batch_id: string;
  total_analyzed: number;
  failed_count: number;
}

interface RssFallbackPayload {
  original_error: string;
}

export function useRssImport() {
  const [progress, setProgress] = useState<RssImportProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [completionData, setCompletionData] = useState<RssImportComplete | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFallingBack, setIsFallingBack] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  // Reset state for new import
  const reset = () => {
    setProgress(null);
    setIsComplete(false);
    setCompletionData(null);
    setError(null);
    setIsFallingBack(false);
    setFallbackMessage(null);
  };

  useEffect(() => {
    let unlistenProgress: UnlistenFn | undefined;
    let unlistenComplete: UnlistenFn | undefined;
    let unlistenError: UnlistenFn | undefined;
    let unlistenFallback: UnlistenFn | undefined;

    const setup = async () => {
      unlistenProgress = await listen<RssImportProgress>("rss:import-progress", (event) => {
        setProgress(event.payload);
        setIsComplete(false);
        setIsFallingBack(false); // Clear fallback state when progress resumes
      });

      unlistenComplete = await listen<RssImportComplete>("rss:import-complete", (event) => {
        setIsComplete(true);
        setCompletionData(event.payload);
        setIsFallingBack(false);

        // Story 4b.7: Show browser notification if permission granted
        if ("Notification" in window && Notification.permission === "granted") {
          const { total_analyzed, failed_count } = event.payload;
          const message =
            failed_count > 0
              ? `${total_analyzed} jobs analyzed, ${failed_count} failed`
              : `All ${total_analyzed} jobs analyzed successfully`;
          new Notification("RSS Import Complete", { body: message });
        }
      });

      unlistenError = await listen<string>("rss:import-error", (event) => {
        setError(event.payload);
        setIsFallingBack(false);
      });

      // Story 4b.8: Listen for fallback event
      unlistenFallback = await listen<RssFallbackPayload>("rss:fallback-started", (event) => {
        setIsFallingBack(true);
        setFallbackMessage("RSS blocked. Trying alternative method...");
      });
    };

    setup();

    return () => {
      unlistenProgress?.();
      unlistenComplete?.();
      unlistenError?.();
      unlistenFallback?.();
    };
  }, []);

  return { progress, isComplete, completionData, error, isFallingBack, fallbackMessage, reset };
}
