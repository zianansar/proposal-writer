/**
 * Re-humanization hook (Story 3.4)
 *
 * Provides regeneration flow for proposals that fail AI detection checks.
 * Escalates humanization intensity and re-analyzes perplexity scores.
 *
 * **INTEGRATION STATUS**: Ready but blocked on Stories 3.1 + 3.2 integration.
 * Stories 3.1 and 3.2 built the perplexity analysis and SafetyWarningModal components
 * but did not integrate them into the App.tsx generation flow. This hook cannot be
 * used until that integration is complete.
 *
 * **Usage** (once 3.1+3.2 integrated):
 * ```tsx
 * const {
 *   attemptCount,
 *   previousScore,
 *   isRegenerating,
 *   handleRegenerate,
 *   resetAttempts,
 * } = useRehumanization(jobContent, currentIntensity);
 *
 * // Pass to SafetyWarningModal:
 * <SafetyWarningModal
 *   score={perplexityScore}
 *   threshold={180}
 *   flaggedSentences={flaggedSentences}
 *   humanizationIntensity={currentIntensity}
 *   onRegenerate={handleRegenerate}
 *   attemptCount={attemptCount}
 *   previousScore={previousScore}
 *   isRegenerating={isRegenerating}
 *   onEdit={handleEdit}
 *   onOverride={handleOverride}
 * />
 * ```
 */

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { HumanizationIntensity } from "../stores/useSettingsStore";
import type { PerplexityAnalysis } from "../types/perplexity";

interface RegenerationResult {
  generated_text: string;
  new_intensity: string;
  attempt_count: number;
}

interface UseRehumanizationOptions {
  onSuccess?: (text: string, analysis: PerplexityAnalysis) => void;
  onFailure?: (error: string) => void;
  onAnalysisComplete?: (analysis: PerplexityAnalysis) => void;
}

export function useRehumanization(
  jobContent: string,
  currentIntensity: HumanizationIntensity,
  currentScore: number | undefined,
  options: UseRehumanizationOptions = {}
) {
  const [attemptCount, setAttemptCount] = useState(0);
  const [previousScore, setPreviousScore] = useState<number | undefined>(undefined);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const MAX_ATTEMPTS = 3;

  /**
   * Regenerate proposal with escalated humanization intensity.
   *
   * Flow:
   * 1. Call `regenerate_with_humanization` Tauri command
   * 2. Wait for streaming to complete (via useGenerationStream events)
   * 3. Run perplexity analysis on new text
   * 4. If passing (score < 180): call onSuccess
   * 5. If still failing: call onAnalysisComplete with new score
   * 6. If max attempts reached: disable further regeneration
   */
  const handleRegenerate = useCallback(async () => {
    if (attemptCount >= MAX_ATTEMPTS) {
      options.onFailure?.("Maximum regeneration attempts reached");
      return;
    }

    setIsRegenerating(true);
    // Save current score as previous BEFORE regeneration (C2 review fix)
    setPreviousScore(currentScore);

    try {
      // Call regeneration backend (Story 3.4 Task 1)
      const result = await invoke<RegenerationResult>("regenerate_with_humanization", {
        jobContent,
        currentIntensity,
        attemptCount,
      });

      // Update attempt count
      const newAttemptCount = result.attempt_count;
      setAttemptCount(newAttemptCount);

      // Analyze perplexity of regenerated text
      const analysis = await invoke<PerplexityAnalysis>("analyze_perplexity", {
        text: result.generated_text,
      });

      // Check if passing
      const THRESHOLD = 180;
      if (analysis.score < THRESHOLD) {
        // Success! Close modal and show success state
        options.onSuccess?.(result.generated_text, analysis);
        setAttemptCount(0); // Reset for next generation
        setPreviousScore(undefined);
      } else {
        // Still failing - show updated warning with new score
        options.onAnalysisComplete?.(analysis);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      options.onFailure?.(errorMessage);
    } finally {
      setIsRegenerating(false);
    }
  }, [jobContent, currentIntensity, currentScore, attemptCount, options]);

  /**
   * Reset attempt counter (called after successful generation or manual close)
   */
  const resetAttempts = useCallback(() => {
    setAttemptCount(0);
    setPreviousScore(undefined);
  }, []);

  return {
    attemptCount,
    previousScore,
    isRegenerating,
    handleRegenerate,
    resetAttempts,
    canRegenerate: attemptCount < MAX_ATTEMPTS && currentIntensity !== "heavy",
  };
}
