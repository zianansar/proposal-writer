/**
 * Re-humanization hook (Story 3.4)
 *
 * Provides regeneration flow for proposals that fail AI detection checks.
 * Escalates humanization intensity and re-analyzes perplexity scores.
 *
 * Tracks the effective intensity locally so that subsequent regeneration
 * attempts escalate correctly (e.g. light → medium → heavy) rather than
 * re-sending the original settings-store value each time.
 */

import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback, useEffect, useRef } from "react";

import type { HumanizationIntensity } from "../stores/useSettingsStore";
import type { PerplexityAnalysis } from "../types/perplexity";
import { DEFAULT_PERPLEXITY_THRESHOLD } from "../types/perplexity";

interface RegenerationResult {
  generated_text: string;
  new_intensity: string;
  attempt_count: number;
}

/** Valid humanization intensity values (for validation) */
const VALID_INTENSITIES: readonly string[] = ["off", "light", "medium", "heavy"];

interface UseRehumanizationOptions {
  onSuccess?: (text: string, analysis: PerplexityAnalysis) => void;
  onFailure?: (error: string) => void;
  onAnalysisComplete?: (analysis: PerplexityAnalysis) => void;
}

export function useRehumanization(
  jobContent: string,
  currentIntensity: HumanizationIntensity,
  currentScore: number | undefined,
  options: UseRehumanizationOptions = {},
) {
  // M1 fix: Store options in a ref so callers don't need to stabilize the object.
  // This prevents handleRegenerate from being recreated on every render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [attemptCount, setAttemptCount] = useState(0);
  const [previousScore, setPreviousScore] = useState<number | undefined>(undefined);
  const [isRegenerating, setIsRegenerating] = useState(false);
  // H1 fix: Track the effective intensity locally so escalation compounds across attempts
  const [effectiveIntensity, setEffectiveIntensity] =
    useState<HumanizationIntensity>(currentIntensity);

  // Sync effectiveIntensity when the settings-store value changes (e.g. user adjusts setting)
  useEffect(() => {
    if (attemptCount === 0) {
      setEffectiveIntensity(currentIntensity);
    }
  }, [currentIntensity, attemptCount]);

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
      optionsRef.current.onFailure?.("Maximum regeneration attempts reached");
      return;
    }

    setIsRegenerating(true);
    // Save current score as previous BEFORE regeneration (C2 review fix)
    setPreviousScore(currentScore);

    try {
      // Call regeneration backend (Story 3.4 Task 1)
      // H1 fix: Use effectiveIntensity (tracks escalation across attempts)
      const result = await invoke<RegenerationResult>("regenerate_with_humanization", {
        jobContent,
        currentIntensity: effectiveIntensity,
        attemptCount,
      });

      // Update attempt count and track the escalated intensity for next attempt
      const newAttemptCount = result.attempt_count;
      setAttemptCount(newAttemptCount);

      // M1 fix (Review 3): Validate intensity before type assertion
      if (!VALID_INTENSITIES.includes(result.new_intensity)) {
        throw new Error(`Invalid intensity from backend: ${result.new_intensity}`);
      }
      setEffectiveIntensity(result.new_intensity as HumanizationIntensity);

      // Analyze perplexity of regenerated text
      const analysis = await invoke<PerplexityAnalysis>("analyze_perplexity", {
        text: result.generated_text,
        threshold: DEFAULT_PERPLEXITY_THRESHOLD,
      });

      // Check if passing
      if (analysis.score < DEFAULT_PERPLEXITY_THRESHOLD) {
        // Success! Close modal and show success state
        optionsRef.current.onSuccess?.(result.generated_text, analysis);
        setAttemptCount(0); // Reset for next generation
        setPreviousScore(undefined);
      } else {
        // Still failing - show updated warning with new score
        optionsRef.current.onAnalysisComplete?.(analysis);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      optionsRef.current.onFailure?.(errorMessage);
    } finally {
      setIsRegenerating(false);
    }
  }, [jobContent, effectiveIntensity, currentScore, attemptCount]);

  /**
   * Reset attempt counter (called after successful generation or manual close)
   */
  const resetAttempts = useCallback(() => {
    setAttemptCount(0);
    setPreviousScore(undefined);
    setEffectiveIntensity(currentIntensity);
  }, [currentIntensity]);

  return {
    attemptCount,
    previousScore,
    isRegenerating,
    handleRegenerate,
    resetAttempts,
    // M3 fix: Use effectiveIntensity (tracks escalation) instead of settings-store value
    canRegenerate: attemptCount < MAX_ATTEMPTS && effectiveIntensity !== "heavy",
  };
}
