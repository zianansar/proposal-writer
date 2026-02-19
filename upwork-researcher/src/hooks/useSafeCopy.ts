/**
 * Safe copy hook with pre-flight perplexity analysis.
 * Story 3.9: Core Keyboard Shortcuts - Task 2
 *
 * Extracts copy + safety analysis logic from CopyButton.tsx
 * so both the button and keyboard shortcuts can use the same logic.
 */

import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useState, useCallback, useRef, useEffect } from "react";

import type { PerplexityAnalysis } from "../types/perplexity";

/** Pending override data when proposalId wasn't available at copy time */
export interface PendingOverride {
  aiScore: number;
  threshold: number;
}

export interface UseSafeCopyState {
  analyzing: boolean;
  copied: boolean;
  error: string | null;
  showWarningModal: boolean;
  showOverrideConfirm: boolean;
  analysisResult: PerplexityAnalysis | null;
  /** Queued override waiting for proposalId (Story 3.7 H4) */
  pendingOverride: PendingOverride | null;
}

export interface UseSafeCopyActions {
  triggerCopy: (text: string) => Promise<void>;
  dismissWarning: () => void;
  showOverrideDialog: () => void;
  cancelOverride: () => void;
  confirmOverride: (text: string, proposalId?: number | null) => Promise<void>;
  /** Flush pending override once proposalId becomes available (Story 3.7 H4) */
  flushPendingOverride: (proposalId: number) => Promise<void>;
  reset: () => void;
}

export interface UseSafeCopyReturn {
  state: UseSafeCopyState;
  actions: UseSafeCopyActions;
}

/**
 * Hook for copying text with pre-flight perplexity analysis.
 *
 * Flow:
 * 1. triggerCopy(text) - runs analysis
 * 2. If score < threshold: copies immediately, sets copied=true
 * 3. If score >= threshold: sets showWarningModal=true, analysisResult
 * 4. User can dismissWarning() to close modal without copying
 * 5. User can showOverrideDialog() -> cancelOverride() or confirmOverride()
 */
export function useSafeCopy(): UseSafeCopyReturn {
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PerplexityAnalysis | null>(null);

  // Store text for override flow
  const [pendingText, setPendingText] = useState<string>("");

  // Story 3.7 H4: Queue override when proposalId not yet available
  const [pendingOverride, setPendingOverride] = useState<PendingOverride | null>(null);

  // Timer ref for "copied" auto-reset — cleaned up on unmount
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const triggerCopy = useCallback(async (text: string) => {
    if (!text) return;

    try {
      setAnalyzing(true);
      setError(null);
      setCopied(false);
      setPendingText(text);

      // Fetch current threshold (Story 3.5)
      let threshold: number;
      try {
        threshold = await invoke<number>("get_safety_threshold");
      } catch (thresholdErr) {
        console.warn("Failed to get safety threshold, using default 180:", thresholdErr);
        threshold = 180;
      }

      // Run perplexity analysis
      let analysis: PerplexityAnalysis;
      try {
        analysis = await invoke<PerplexityAnalysis>("analyze_perplexity", {
          text,
          threshold,
        });
      } catch (analysisErr) {
        // On analysis failure, allow copy (graceful degradation)
        console.warn("Perplexity analysis failed, allowing copy:", analysisErr);
        await writeText(text);
        setCopied(true);
        setAnalyzing(false);

        copiedTimerRef.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
        return;
      }

      setAnalyzing(false);

      // Check threshold
      if (analysis.score < analysis.threshold) {
        // Safe to copy
        await writeText(text);
        setCopied(true);
        setError(null);

        copiedTimerRef.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        // AI detection risk - show warning modal
        setAnalysisResult(analysis);
        setShowWarningModal(true);
      }
    } catch (err) {
      setAnalyzing(false);
      setError("Failed to copy to clipboard");
      console.error("Clipboard write failed:", err);
    }
  }, []);

  const dismissWarning = useCallback(() => {
    setShowWarningModal(false);
    setAnalysisResult(null);
    setError(null);
    setPendingText("");
  }, []);

  const showOverrideDialog = useCallback(() => {
    setShowWarningModal(false);
    setShowOverrideConfirm(true);
  }, []);

  const cancelOverride = useCallback(() => {
    setShowOverrideConfirm(false);
    setShowWarningModal(true);
  }, []);

  const confirmOverride = useCallback(
    async (text: string, proposalId?: number | null) => {
      setShowOverrideConfirm(false);

      try {
        await writeText(text);
        setCopied(true);
        setError(null);

        // Story 3.7: Record override for adaptive learning
        if (analysisResult) {
          if (proposalId) {
            // Record immediately if we have proposalId
            invoke("record_safety_override", {
              proposalId,
              aiScore: analysisResult.score,
              threshold: analysisResult.threshold,
            }).catch((err) => console.warn("Override recording failed:", err));
          } else {
            // H4: Queue override for later when proposalId becomes available
            setPendingOverride({
              aiScore: analysisResult.score,
              threshold: analysisResult.threshold,
            });
          }
        }

        copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        setError("Failed to copy to clipboard");
        console.error("Clipboard write failed:", err);
      }

      setAnalysisResult(null);
      setPendingText("");
    },
    [analysisResult],
  );

  // Story 3.7 H4: Flush pending override once proposalId is available
  const flushPendingOverride = useCallback(
    async (proposalId: number) => {
      if (!pendingOverride) return;

      try {
        await invoke("record_safety_override", {
          proposalId,
          aiScore: pendingOverride.aiScore,
          threshold: pendingOverride.threshold,
        });
        setPendingOverride(null);
      } catch (err) {
        console.warn("Pending override recording failed:", err);
      }
    },
    [pendingOverride],
  );

  const reset = useCallback(() => {
    setAnalyzing(false);
    setCopied(false);
    setError(null);
    setShowWarningModal(false);
    setShowOverrideConfirm(false);
    setAnalysisResult(null);
    setPendingText("");
    setPendingOverride(null);
  }, []);

  return {
    state: {
      analyzing,
      copied,
      error,
      showWarningModal,
      showOverrideConfirm,
      analysisResult,
      pendingOverride,
    },
    actions: {
      triggerCopy,
      dismissWarning,
      showOverrideDialog,
      cancelOverride,
      confirmOverride,
      flushPendingOverride,
      reset,
    },
  };
}
