# Story 3.4 Integration Blocker

**Date:** 2026-02-05
**Status:** Blocked
**Story:** 3.4 - One-Click Re-Humanization

## Summary

Story 3.4 backend and UI are **fully implemented and tested**. However, the story cannot be completed because Stories 3.1 and 3.2 infrastructure was built but never integrated into the App.tsx generation flow.

## What Was Completed

### ✅ Backend Implementation
- **`HumanizationIntensity::escalate()` method** — Escalates intensity through path: Off → Light → Medium → Heavy → Error
- **`regenerate_with_humanization` Tauri command** — Enforces max 3 attempts, escalates intensity, regenerates proposal
- **5 comprehensive unit tests** — All passing, covers full escalation path and error handling

### ✅ Frontend Implementation
- **SafetyWarningModal enhancements** — Regeneration button, attempt counter, score comparison, max attempts messaging
- **9 new component tests** — All passing (19 total SafetyWarningModal tests pass)
- **`useRehumanization` hook** — Complete integration guide ready for App.tsx

### ✅ Test Coverage
- **Backend:** 179/179 Rust tests passing (5 new escalation tests)
- **Frontend:** 214/220 tests passing (9 new modal tests; 6 pre-existing failures in unrelated component)

## The Blocker

### Root Cause
Stories 3.1 (Pre-flight Perplexity Analysis) and 3.2 (Safety Warning Screen) built the infrastructure components but **did not integrate them into the App.tsx generation flow**.

### Evidence

#### What Exists (Built in 3.1 + 3.2)
✅ `analyze_perplexity` Tauri command (Story 3.1)
✅ `PerplexityAnalysis` type and `FlaggedSentence` type
✅ `SafetyWarningModal` React component (Story 3.2)
✅ Perplexity analysis tests passing
✅ SafetyWarningModal tests passing

#### What's Missing (Not Done in 3.1 + 3.2)
❌ App.tsx does not call `analyze_perplexity` after proposal generation
❌ App.tsx does not render `SafetyWarningModal` when score ≥ threshold (180)
❌ No safety check flow in current generation pipeline
❌ No perplexity state management in App.tsx or generation stores

### Impact on Story 3.4

Story 3.4 (One-Click Re-Humanization) **depends on** the safety warning modal being shown in the first place. The regeneration flow is:

1. **Generate proposal** (existing)
2. **Analyze perplexity** (3.1 infrastructure exists but not called) ← MISSING
3. **Show safety warning if failing** (3.2 component exists but not rendered) ← MISSING
4. **User clicks "Regenerate with More Humanization"** (3.4 button ready)
5. **Backend regenerates with escalated intensity** (3.4 command ready)
6. **Re-analyze perplexity** (3.1 infrastructure exists)
7. **Show updated safety warning** (3.2 component ready)

**Steps 2 and 3 are missing**, which blocks the entire flow.

## Resolution Path

### Option 1: Integrate 3.1 + 3.2 into App.tsx (Recommended)
Complete the original intent of Stories 3.1 and 3.2 by wiring them into the generation flow.

**Changes Required:**
1. Add perplexity state to App.tsx or useGenerationStore
2. Call `analyze_perplexity` after `generate_proposal_streaming` completes
3. Render `SafetyWarningModal` when `score >= 180`
4. Use `useRehumanization` hook to wire regeneration flow

**Estimated Effort:** 2-3 hours (moderate complexity)

**Files to Modify:**
- `src/App.tsx` — Add perplexity analysis call and modal rendering
- `src/stores/useGenerationStore.ts` (optional) — Add perplexity state
- Wire `useRehumanization` hook into App.tsx

**Acceptance Criteria:**
- After proposal generation completes, perplexity analysis runs automatically
- If score ≥ 180, SafetyWarningModal appears
- User can edit proposal or override warning
- User can regenerate with more humanization (Story 3.4 flow activates)

### Option 2: Create Integration Story (Alternative)
Create a new story "3.x - Integrate Safety Check into Generation Flow" to explicitly handle the missing integration.

**Pros:**
- Explicit tracking of integration work
- Clear separation of concerns

**Cons:**
- Additional story overhead
- Delays Story 3.4 completion

### Option 3: Mark 3.1, 3.2, 3.4 as "Review" and Note Blocker (Not Recommended)
Accept that the safety check feature is partially implemented and document the blocker.

**Pros:**
- All code is ready and tested

**Cons:**
- No user-facing functionality delivered
- Feature incomplete despite "done" stories

## Recommendation

**Proceed with Option 1** — Integrate Stories 3.1 + 3.2 into App.tsx to complete the safety check feature end-to-end, then Story 3.4 will automatically work.

This aligns with the original intent of Epic 3 (Safety Guardrails) and delivers a complete user-facing feature.

## Code Ready for Integration

All code for Story 3.4 is ready. When Stories 3.1 + 3.2 are integrated:

1. Import `useRehumanization` hook in App.tsx
2. Pass regeneration props to SafetyWarningModal
3. Story 3.4 is complete

**Example Integration:**
```tsx
// In App.tsx (after 3.1 + 3.2 integration)
import { useRehumanization } from "./hooks/useRehumanization";

function App() {
  const [perplexityAnalysis, setPerplexityAnalysis] = useState<PerplexityAnalysis | null>(null);
  const humanizationIntensity = useSettingsStore(getHumanizationIntensity);

  const {
    attemptCount,
    previousScore,
    isRegenerating,
    handleRegenerate,
    resetAttempts,
  } = useRehumanization(jobContent, humanizationIntensity, {
    onSuccess: (text, analysis) => {
      // Close modal, show success
      setPerplexityAnalysis(null);
      useGenerationStore.getState().setFullText(text);
    },
    onAnalysisComplete: (analysis) => {
      // Update modal with new score
      setPerplexityAnalysis(analysis);
    },
  });

  return (
    <>
      {/* Existing generation UI */}

      {perplexityAnalysis && perplexityAnalysis.score >= 180 && (
        <SafetyWarningModal
          score={perplexityAnalysis.score}
          threshold={180}
          flaggedSentences={perplexityAnalysis.flagged_sentences}
          humanizationIntensity={humanizationIntensity}
          onRegenerate={handleRegenerate}
          attemptCount={attemptCount}
          previousScore={previousScore}
          isRegenerating={isRegenerating}
          onEdit={() => {
            setPerplexityAnalysis(null);
            resetAttempts();
          }}
          onOverride={() => {
            setPerplexityAnalysis(null);
            resetAttempts();
          }}
        />
      )}
    </>
  );
}
```

## Conclusion

Story 3.4 implementation is **complete and production-ready**. The blocker is external (missing App.tsx integration from Stories 3.1 + 3.2). Once that integration is added, Story 3.4 will function immediately with no additional code changes required.
