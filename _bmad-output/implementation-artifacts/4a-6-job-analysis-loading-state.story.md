---
status: ready-for-dev
---

# Story 4a.6: Job Analysis Loading State

## Story

As a freelancer,
I want to see progress while job analysis is running,
So that I know the app is working and not frozen.

## Acceptance Criteria

**AC-1:** Given I clicked "Analyze Job", When the analysis API call is in progress, Then a progress indicator appears below the Analyze button showing staged messages.

**AC-2:** Given analysis is in progress, Then the progress indicator displays messages in sequence:

- Stage 1: "Analyzing job post..." (shown immediately on click)
- Stage 2: "Extracting details..." (shown after ~1.5s if analysis is still running)
- Stage 3: "Complete ✓" (shown when `analyze_job_post` invoke resolves successfully)

**AC-3:** Given the analysis completes before stage 2 would start (fast API response <1.5s), Then stage 2 is skipped and "Complete ✓" is shown directly after stage 1.

**AC-4:** Given each stage transition, Then a subtle fade-in animation plays on the new stage message.

**AC-5:** Given analysis is in progress, Then the "Analyze Job" button is disabled and shows "Analyzing..." text (per 4a-2 pattern).

**AC-6:** Given the API call fails during analysis, Then the progress indicator shows an error message instead of "Complete ✓", styled with the error color.

**AC-7:** Given normal network conditions, Then total analysis time is <3 seconds (NFR performance target for Claude Haiku extraction).

## Technical Notes

### Requirements Traceability

- **NFR (Analysis Speed):** <3 seconds for full extraction (client name + skills + hidden needs in single Haiku call)
- **UX Spec (Streaming Pattern):** Progressive status indicators with checkmarks (job analysis ✓ → complete ✓)
- **UX Spec (Semantic Colors):** Success green `#22c55e` for completion state

### Architecture: Frontend Timer-Based Progress (NOT Backend Events)

The analysis pipeline is a **single non-streaming API call** to Claude Haiku that returns all extraction fields at once (`client_name`, `key_skills`, `hidden_needs`). There are no real intermediate backend stages — the API call dominates the ~1-3s total time.

**Design decision: Frontend-driven progress stages, not backend Tauri events.**

Rationale:

- The backend operation is a single `invoke("analyze_job_post")` → single Haiku request → single JSON response. No meaningful intermediate milestones exist to report via events.
- Adding Tauri event emission for a <3s non-streaming call is over-engineering. The `invoke` promise resolution is sufficient to signal completion.
- The staged messages ("Analyzing...", "Extracting...") are **UX comfort indicators**, not reflections of real pipeline stages. They give the user a sense of progress during a brief wait.
- Compare: generation streaming (8+ seconds, real token flow) legitimately needs events via `useGenerationStream`. Analysis (single API call, <3s) does not.

**Relationship to 4a-2:** Story 4a-2 (Task 4.5) adds basic button-level loading ("Analyzing..."). Story 4a-6 enhances this with a dedicated progress indicator component below the button.

### Progress State Machine

```text
IDLE → ANALYZING → EXTRACTING → COMPLETE → IDLE        (normal flow, API >1.5s)

IDLE → ANALYZING → COMPLETE → IDLE                      (fast response, API <1.5s)

IDLE → ANALYZING → ERROR → IDLE                         (API failure)
IDLE → ANALYZING → EXTRACTING → ERROR → IDLE            (late API failure)
```

**Timing logic:**

1. On button click: set state to `ANALYZING`, start a 1.5s `setTimeout` for `EXTRACTING` transition
2. If timer fires before invoke resolves: transition to `EXTRACTING`
3. When invoke resolves (success): clear timeout, set state to `COMPLETE`, start 2s auto-dismiss timer to return to `IDLE`
4. When invoke rejects (error): clear timeout, set state to `ERROR` with error message
5. If invoke resolves before timer fires: cancel timer, go straight to `COMPLETE`

### Component Design

**`AnalysisProgress.tsx`** — Presentational component, receives stage as prop.

```typescript
type AnalysisStage = 'idle' | 'analyzing' | 'extracting' | 'complete' | 'error';

interface AnalysisProgressProps {
  stage: AnalysisStage;
  errorMessage?: string;
}
```

**Display mapping:**

| Stage      | Message                 | Icon/Animation    | Color                                    |
| :--------- | :---------------------- | :---------------- | :--------------------------------------- |
| idle       | (hidden)                | —                 | —                                        |
| analyzing  | "Analyzing job post..." | Pulsing dot       | Default text                             |
| extracting | "Extracting details..." | Pulsing dot       | Default text                             |
| complete   | "Complete ✓"            | Checkmark fade-in | Success green (`#22c55e`)                |
| error      | Error message text      | —                 | Error red (existing `--color-error` var) |

### Animation Specification

- **Stage transitions:** `opacity` fade-in, 300ms ease-in
- **Pulsing dot:** CSS `@keyframes pulse` on a small circle (8px), alternating opacity 0.3 → 1.0, 1s cycle
- **Checkmark:** Fade-in + slight scale-up (1.0 → 1.1 → 1.0), 400ms
- **All animations respect `prefers-reduced-motion`** — disable pulse/scale when reduced motion is preferred

## Tasks / Subtasks

- [ ] Task 1: Create `AnalysisProgress` component (AC: 1, 2, 3, 4)
  - [ ] 1.1: Create `src/components/AnalysisProgress.tsx` — accepts `stage: AnalysisStage` and optional `errorMessage` props
  - [ ] 1.2: Render stage-specific message text with appropriate icon (pulsing dot for in-progress, checkmark for complete)
  - [ ] 1.3: Component returns `null` when stage is `idle`
  - [ ] 1.4: Apply fade-in CSS transition on stage changes
  - [ ] 1.5: Add `aria-live="polite"` and `aria-busy` attributes for accessibility (follow `ProposalOutput.tsx` pattern)

- [ ] Task 2: Create CSS for progress animations (AC: 4)
  - [ ] 2.1: Create `src/components/AnalysisProgress.css` with fade-in transition (300ms ease-in on `opacity`)
  - [ ] 2.2: Add `@keyframes pulse` for in-progress dot indicator (opacity 0.3 → 1.0, 1s cycle)
  - [ ] 2.3: Add checkmark fade-in + scale animation (400ms)
  - [ ] 2.4: Add `@media (prefers-reduced-motion: reduce)` — disable pulse/scale, keep simple opacity transitions
  - [ ] 2.5: Use existing CSS variables for colors (`--color-success` or define inline, `--color-error`, text colors)
  - [ ] 2.6: Verify dark/light mode compatibility via existing theme variables in `App.css`

- [ ] Task 3: Add progress state management to App.tsx (AC: 1, 2, 3, 5, 6)
  - [ ] 3.1: Add `analysisStage` state: `AnalysisStage` (default `'idle'`)
  - [ ] 3.2: Add `analysisError` state: `string | null`
  - [ ] 3.3: On "Analyze Job" click: set stage to `'analyzing'`, start 1.5s `setTimeout` for `'extracting'` transition
  - [ ] 3.4: When `invoke("analyze_job_post")` resolves: clear timeout, set stage to `'complete'`, start 2s auto-dismiss timer to return to `'idle'`
  - [ ] 3.5: When invoke rejects: clear timeout, set stage to `'error'` with error message
  - [ ] 3.6: Store timeout IDs in `useRef` — clean up in `useEffect` return to prevent state updates on unmounted component
  - [ ] 3.7: Place `<AnalysisProgress stage={analysisStage} errorMessage={analysisError} />` below Analyze button, above analysis results area

- [ ] Task 4: Write tests (AC: All)
  - [ ] 4.1: `AnalysisProgress` renders nothing when stage is `idle`
  - [ ] 4.2: `AnalysisProgress` renders "Analyzing job post..." when stage is `analyzing`
  - [ ] 4.3: `AnalysisProgress` renders "Extracting details..." when stage is `extracting`
  - [ ] 4.4: `AnalysisProgress` renders "Complete ✓" with success styling when stage is `complete`
  - [ ] 4.5: `AnalysisProgress` renders error message with error styling when stage is `error`
  - [ ] 4.6: Integration test: stage transitions from `analyzing` → `extracting` after 1.5s (use `vi.useFakeTimers`)
  - [ ] 4.7: Integration test: fast completion skips `extracting` stage (resolve invoke before 1.5s timer fires)
  - [ ] 4.8: Integration test: error during analysis shows error state and clears timers
  - [ ] 4.9: Verify `prefers-reduced-motion` media query exists in CSS

## Dev Notes

### Dependencies

- **Story 4a-2 (HARD DEPENDENCY):** Creates `analyze_job_post` Tauri command, Analyze button, and basic button loading state ("Analyzing..."). 4a-6 enhances this with a dedicated progress component.
- **Story 4a-4 (SOFT DEPENDENCY):** After 4a-4, the analysis extracts all three FR-2 fields. The progress indicator works regardless of how many fields are extracted — it tracks the overall invoke call, not individual fields. Can be implemented after just 4a-2 if needed.

### Existing Code References

| File | What's There | What to Change |
| :--- | :--- | :--- |
| `src/App.tsx` | `AnalyzeButton` integration (from 4a-2), analysis state | Add `analysisStage` state, timer logic, render `AnalysisProgress` |
| `src/components/GenerateButton.tsx` | Button loading pattern (`loading ? "Generating..." : "Generate"`) | Reference only — AnalyzeButton follows same pattern |
| `src/components/ProposalOutput.tsx` | Loading states with `aria-live="polite"` and `aria-busy` | Reference for accessibility patterns |
| `src/hooks/useGenerationStream.ts` | Tauri event listening pattern | Reference only — 4a-6 uses timer-based progress, not events |
| `src-tauri/src/events.rs` | Generation event constants | No change — analysis uses invoke return, not events |
| `src/App.css` | Theme variables for colors, dark/light mode | Verify success/error color vars exist; reference in AnalysisProgress.css |

### Edge Cases

- **Fast API response (<1s):** Skip "Extracting details..." stage entirely, go straight to "Complete ✓". Timer cleanup is critical.
- **Slow API response (>3s):** "Extracting details..." stays visible until invoke resolves — no timeout or forced completion
- **Multiple rapid clicks:** Button is disabled during analysis (per 4a-2 AC), preventing duplicate invoke calls
- **Component unmount during analysis:** Timers must be cleaned up via `useEffect` return to avoid React state updates on unmounted component
- **Reduced motion preference:** Disable pulse/scale animations, keep simple opacity transitions for accessibility
- **Re-analysis:** User analyzes again after previous completion — stage resets to `ANALYZING`, previous results stay visible until new results arrive

### Scope Boundaries

**In scope:**

- `AnalysisProgress` presentational component with staged messages
- CSS animations (fade-in, pulse, checkmark) with reduced-motion support
- Timer-based stage management in App.tsx
- Accessibility (`aria-live`, `aria-busy`, `prefers-reduced-motion`)

**Out of scope:**

- Backend Tauri events for analysis progress (not needed for <3s single API call)
- Comprehensive analysis results display (Story 4a-7)
- Pipeline stage indicators for generation (Story 8-4)
- Progress percentage or progress bar (stages are qualitative, not quantitative)
- Cancellation of in-flight analysis (no cancel button in MVP)

### NFR Targets

| NFR | Target | Validation |
| :--- | :--- | :--- |
| Analysis speed | <3 seconds total | Measured from button click to "Complete ✓" display |
| Animation performance | No jank | CSS-only animations, no JS-driven layout changes |
| Accessibility | WCAG 2.1 AA | `aria-live` region, `prefers-reduced-motion` support |

### References

- [UX Spec: Streaming pattern with status indicators]
- [UX Spec: Semantic colors — Success green #22c55e]
- [Story 4a-2: AnalyzeButton basic loading state (Task 4.5)]
- [Story 8-4: Pipeline stage indicators during generation (separate scope)]
- [Pattern: ProposalOutput.tsx loading states with aria-live]
- [Pattern: useGenerationStream.ts event listening (reference, not used)]
