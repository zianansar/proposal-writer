import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef, useCallback } from "react";

import { useGenerationStore } from "../stores/useGenerationStore";
import type { StageStatus } from "../types/pipeline";

/** Event name constants - must match Rust events.rs */
const EVENTS = {
  GENERATION_TOKEN: "generation:token",
  GENERATION_COMPLETE: "generation:complete",
  GENERATION_ERROR: "generation:error",
  GENERATION_STAGE: "generation:stage",
} as const;

/** Payload for token batch events */
interface TokenPayload {
  tokens: string[];
  stageId: string;
}

/** Payload for generation complete events */
interface CompletePayload {
  fullText: string;
  /** Story 4a.9 H3: Indicates if job content was truncated during sanitization */
  wasTruncated: boolean;
}

/** Payload for error events */
interface ErrorPayload {
  message: string;
}

/** Payload for stage events (Story 8.4) */
interface StagePayload {
  stageId: string;
  status: StageStatus;
  durationMs?: number;
  error?: string;
}

/**
 * Hook that listens to Tauri events for streaming generation.
 * Automatically subscribes on mount and cleans up on unmount.
 * Updates the Zustand generation store with received tokens.
 *
 * Returns a function to ensure listeners are ready before invoking commands.
 */
export function useGenerationStream(): { ensureListenersReady: () => Promise<void> } {
  const { appendTokens, setComplete, setError, setStage } = useGenerationStore();

  // Track whether listeners have been registered
  const listenersReadyRef = useRef<Promise<void> | null>(null);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    // Register all listeners and track when they're ready
    listenersReadyRef.current = (async () => {
      const unlisteners = await Promise.all([
        // Listen for token batches
        listen<TokenPayload>(EVENTS.GENERATION_TOKEN, (event) => {
          appendTokens(event.payload.tokens);
        }),
        // Listen for generation complete
        // Story 4a.9 H3: Pass wasTruncated to show warning in UI
        listen<CompletePayload>(EVENTS.GENERATION_COMPLETE, (event) => {
          setComplete(event.payload.fullText, event.payload.wasTruncated);
        }),
        // Listen for errors (preserves tokens for partial result)
        listen<ErrorPayload>(EVENTS.GENERATION_ERROR, (event) => {
          setError(event.payload.message);
        }),
        // Story 8.4 Subtask 4.1-4.4: Listen for stage transitions
        listen<StagePayload>(EVENTS.GENERATION_STAGE, (event) => {
          const { stageId, status, error } = event.payload;
          setStage(stageId, status, error);
        }),
      ]);
      unlistenersRef.current = unlisteners;
    })();

    // Cleanup on unmount
    return () => {
      unlistenersRef.current.forEach((unlisten) => unlisten());
      unlistenersRef.current = [];
      listenersReadyRef.current = null;
    };
  }, [appendTokens, setComplete, setError, setStage]);

  // Callback to wait for listeners to be ready
  const ensureListenersReady = useCallback(async () => {
    if (listenersReadyRef.current) {
      await listenersReadyRef.current;
    }
  }, []);

  return { ensureListenersReady };
}
