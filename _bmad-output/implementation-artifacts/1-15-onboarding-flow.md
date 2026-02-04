# Story 1.15: Onboarding Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new user,
I want guided setup when I first open the app,
So that I can start quickly without confusion.

## Acceptance Criteria

**AC-1:** Given I'm opening the app for the first time, When the app loads, Then I see an onboarding wizard with 4 steps: Welcome → API Key → Voice Calibration (Optional) → Ready

**AC-2:** Step 1 (Welcome) displays: "Welcome to Upwork Research Agent!" and "This tool helps you write personalized proposals faster."

**AC-3:** Step 2 (API Key) prompts for Anthropic API key with link "Get a key at console.anthropic.com" and validates format (starts with "sk-ant-")

**AC-4:** Step 3 (Voice Calibration) offers "Upload 3-5 past proposals OR answer 5 quick questions" with "Skip for now" option clearly visible

**AC-5:** Step 4 (Ready) displays: "You're all set! Paste a job post to get started."

**AC-6:** Onboarding can be dismissed and revisited, with "Show onboarding again" option in settings

**AC-7:** Onboarding completion status saved to settings table as `onboarding_completed` flag

**AC-8:** First-launch detection checks settings table for `onboarding_completed` flag

## Tasks / Subtasks

- [x] Task 1: Create OnboardingWizard component structure (AC-1)
  - [x] Subtask 1.1: Create src/components/OnboardingWizard.tsx with 4-step wizard logic
  - [x] Subtask 1.2: Add step state management (currentStep, totalSteps=4)
  - [x] Subtask 1.3: Create progress indicator component (Step X of 4)
  - [x] Subtask 1.4: Add Next/Back/Skip navigation buttons

- [x] Task 2: Implement Step 1 - Welcome screen (AC-2)
  - [x] Subtask 2.1: Create WelcomeStep.tsx component
  - [x] Subtask 2.2: Display welcome message with conversational tone
  - [x] Subtask 2.3: Add "Get Started" button to proceed to Step 2

- [x] Task 3: Implement Step 2 - API Key entry (AC-3)
  - [x] Subtask 3.1: Create ApiKeyStep.tsx component
  - [x] Subtask 3.2: Add input field for API key with validation (sk-ant- prefix)
  - [x] Subtask 3.3: Display link to console.anthropic.com
  - [x] Subtask 3.4: Call existing set_api_key Tauri command
  - [x] Subtask 3.5: Show validation errors if key format invalid

- [x] Task 4: Implement Step 3 - Voice Calibration (AC-4)
  - [x] Subtask 4.1: Create VoiceCalibrationStep.tsx component
  - [x] Subtask 4.2: Add file upload UI for past proposals (3-5 files)
  - [x] Subtask 4.3: Add questionnaire alternative (placeholder: "Coming in Epic 6")
  - [x] Subtask 4.4: Make "Skip for now" button prominent
  - [x] Subtask 4.5: Note: Voice learning implementation is Epic 6, show UI only

- [x] Task 5: Implement Step 4 - Ready screen (AC-5)
  - [x] Subtask 5.1: Create ReadyStep.tsx component
  - [x] Subtask 5.2: Display completion message
  - [x] Subtask 5.3: Add "Start Using App" button that closes wizard

- [x] Task 6: Implement first-launch detection (AC-8)
  - [x] Subtask 6.1: Check settings table for `onboarding_completed` flag on app mount
  - [x] Subtask 6.2: Show onboarding wizard if flag missing or false
  - [x] Subtask 6.3: Set `onboarding_completed=true` in settings when wizard completes
  - [x] Subtask 6.4: Use existing get_setting/set_setting Tauri commands

- [x] Task 7: Add "Show onboarding again" setting (AC-6)
  - [x] Subtask 7.1: Add button in Settings view to reset `onboarding_completed` flag
  - [x] Subtask 7.2: Allow user to manually restart onboarding flow

- [x] Task 8: Styling and UX polish
  - [x] Subtask 8.1: Use custom modal component (following existing DraftRecoveryModal pattern instead of shadcn/ui)
  - [x] Subtask 8.2: Apply CSS dark mode styling
  - [x] Subtask 8.3: Add keyboard navigation (Enter to proceed, Esc to skip/close)
  - [x] Subtask 8.4: Ensure responsive design for small screens

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Fix infinite re-render loop - hasApiKey in useEffect dependency causes re-runs [App.tsx:125]
- [x] [AI-Review][HIGH] Fix race condition - checkOnboarding runs before hasApiKey is set [App.tsx:102-105]
- [x] [AI-Review][HIGH] Add error handling for set_setting failure in ReadyStep - show error modal instead of silently closing [ReadyStep.tsx:14-26]
- [x] [AI-Review][HIGH] Remove unused voiceFiles state from useOnboardingStore - dead code or add Epic 6 comment [useOnboardingStore.ts:7,11,23-24]
- [x] [AI-Review][HIGH] Remove redundant apiKey from Zustand - already persisted via Tauri, security risk [ApiKeyStep.tsx:33, useOnboardingStore.ts:6,10,22]
- [x] [AI-Review][HIGH] Extract inline async function to named handler with loading state for "Show Onboarding Again" button [App.tsx:283-293]
- [x] [AI-Review][HIGH] Add ARIA attributes to modal - role="dialog", aria-modal="true", aria-labelledby for WCAG 2.1 AA [OnboardingWizard.tsx:47-54]
- [x] [AI-Review][MEDIUM] Only check onboarding when hasApiKey is true, not just non-null [App.tsx:102-104]
- [x] [AI-Review][MEDIUM] Add loading state to "Show Onboarding Again" button to prevent double-clicks [App.tsx:288]
- [x] [AI-Review][MEDIUM] Clear apiKeyInput when wizard reopens after Escape - reset() doesn't clear local component state [ApiKeyStep.tsx:7]
- [x] [AI-Review][LOW] Extract magic number 4 to TOTAL_STEPS constant in progress indicator [OnboardingWizard.tsx:50]
- [x] [AI-Review][LOW] Remove or sanitize console.error in production - leaks implementation details [ReadyStep.tsx:23]

## Dev Notes

### Architecture Requirements

**UX-7: Expectation Management**
- Use clear, simple language throughout onboarding
- Explain WHY each step matters (e.g., "API key allows proposal generation")
- Set expectations for voice learning: "Takes 3-5 uses to learn your voice"
- Make optional steps clearly marked

**Story Dependencies (CRITICAL):**
- **Story 1.8 (Settings Table):** MUST exist before this story. Settings table schema required for `onboarding_completed` flag.
- **Story 1.7 (API Key Configuration):** set_api_key, validate_api_key Tauri commands already implemented. Reuse them.
- **Epic 6 (Voice Learning):** Voice calibration UI shown in Step 3, but actual implementation deferred to Epic 6. Show placeholder.

**NFR-4: UI Response <100ms**
- Settings reads/writes must complete quickly
- Use Zustand for onboarding state (no backend calls during navigation)
- Only backend calls: get_setting (on mount), set_setting (on completion)

### File Structure

```
upwork-researcher/
  src/
    components/
      OnboardingWizard.tsx       # NEW: Main wizard container
      onboarding/
        WelcomeStep.tsx           # NEW: Step 1 component
        ApiKeyStep.tsx            # NEW: Step 2 component
        VoiceCalibrationStep.tsx  # NEW: Step 3 component
        ReadyStep.tsx             # NEW: Step 4 component
      OnboardingWizard.css        # NEW: Wizard-specific styles
    stores/
      useOnboardingStore.ts       # NEW: Zustand store for wizard state
    App.tsx                       # MODIFIED: Add first-launch check
  src-tauri/
    src/
      lib.rs                      # NO CHANGES: Reuse existing commands
      db/queries/settings.rs      # NO CHANGES: Already has get/set_setting
```

### Project Structure Notes

**Existing Commands to Reuse (from Story 1.7, 1.9):**
- `set_api_key(api_key: String) -> Result<(), String>` - Validates and saves API key
- `validate_api_key(api_key: String) -> Result<(), String>` - Format validation only
- `get_setting(key: String) -> Result<Option<String>, String>` - Read from settings table
- `set_setting(key: String, value: String) -> Result<(), String>` - Write to settings table

**Settings Table Schema (Story 1.8):**
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**First-Launch Detection Logic:**
```typescript
// On app mount (App.tsx)
useEffect(() => {
  const checkFirstLaunch = async () => {
    const completed = await invoke<string | null>("get_setting", { key: "onboarding_completed" });
    if (!completed || completed === "false") {
      setShowOnboarding(true);
    }
  };
  checkFirstLaunch();
}, []);
```

**Onboarding Completion:**
```typescript
// When user finishes Step 4
const completeOnboarding = async () => {
  await invoke("set_setting", {
    key: "onboarding_completed",
    value: "true"
  });
  setShowOnboarding(false);
};
```

### Previous Story Intelligence

**From Story 1.14 (Draft Recovery):**
- Modal implementation patterns: DraftRecoveryModal.tsx as reference
- Keyboard accessibility: Added Enter/Escape handlers, autoFocus on primary button
- Modal CSS patterns: Backdrop, centered content, responsive sizing
- Zustand state patterns: Added draftRecovery state with setters/clearers

**From Story 1.13 (API Error Handling):**
- Error UI patterns: Show error messages inline with action buttons
- Retry patterns: Exponential backoff for API calls
- Zustand store patterns: State management with actions

**From Story 1.9 (Persist User Preferences):**
- Settings table CRUD: get_setting, set_setting, list_settings already implemented
- UPSERT pattern: set_setting uses INSERT OR REPLACE for atomic updates
- Settings validation: Key length max 255 chars, value max 10000 chars

### Git Intelligence (Recent Commits)

**1084bff: Story 1.14 (draft recovery)**
- Created modal component: DraftRecoveryModal.tsx + CSS
- Added Zustand state for draft recovery
- Modified App.tsx to show modal conditionally
- **Pattern:** Modal components in src/components/, state in stores/

**c083a6b: Code review fixes**
- JobInput made controlled component (accepts value prop)
- Added keyboard accessibility to modals
- **Lesson:** Always add keyboard navigation (Enter/Escape/Tab)

**e4450fb: Story 1.13 (API error handling)**
- Added retry state to useGenerationStore
- Error UI with action buttons
- **Pattern:** Zustand for app state, inline error messages

### Latest Technical Specifics

**shadcn/ui Dialog Component (v4):**
- Latest stable: v4.0 (matches architecture.md requirement)
- Import: `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"`
- Accessibility: Built-in keyboard navigation, focus trap, ARIA attributes
- API: `<Dialog open={open} onOpenChange={setOpen}>`
- Dark mode support: Automatically styled via Tailwind

**React 19 + Vite 7:**
- Current stack version (confirmed in architecture)
- useEffect for mount-time side effects (first-launch check)
- useState for local wizard state (currentStep)
- Component composition for multi-step wizard

**Tailwind CSS v4:**
- Dark mode: `class` strategy (not media query)
- Apply dark: prefix for dark mode styles
- Responsive: Use sm:, md:, lg: breakpoints

### Implementation Strategy

**Step 1: Create Zustand store**
```typescript
// src/stores/useOnboardingStore.ts
import { create } from "zustand";

interface OnboardingState {
  currentStep: number;
  showOnboarding: boolean;
  apiKey: string;
  voiceFiles: File[];
  setCurrentStep: (step: number) => void;
  setShowOnboarding: (show: boolean) => void;
  setApiKey: (key: string) => void;
  addVoiceFile: (file: File) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 1,
  showOnboarding: false,
  apiKey: "",
  voiceFiles: [],
  setCurrentStep: (step) => set({ currentStep: step }),
  setShowOnboarding: (show) => set({ showOnboarding: show }),
  setApiKey: (key) => set({ apiKey: key }),
  addVoiceFile: (file) => set((state) => ({ voiceFiles: [...state.voiceFiles, file] })),
  reset: () => set({ currentStep: 1, apiKey: "", voiceFiles: [] }),
}));
```

**Step 2: Create main wizard component**
```typescript
// src/components/OnboardingWizard.tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import WelcomeStep from "./onboarding/WelcomeStep";
import ApiKeyStep from "./onboarding/ApiKeyStep";
import VoiceCalibrationStep from "./onboarding/VoiceCalibrationStep";
import ReadyStep from "./onboarding/ReadyStep";

export default function OnboardingWizard() {
  const { currentStep, showOnboarding } = useOnboardingStore();

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <WelcomeStep />;
      case 2: return <ApiKeyStep />;
      case 3: return <VoiceCalibrationStep />;
      case 4: return <ReadyStep />;
      default: return <WelcomeStep />;
    }
  };

  return (
    <Dialog open={showOnboarding} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl">
        <div className="onboarding-progress">
          Step {currentStep} of 4
        </div>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Integrate in App.tsx**
```typescript
// In App.tsx, add after API key check
useEffect(() => {
  const checkOnboarding = async () => {
    const completed = await invoke<string | null>("get_setting", { key: "onboarding_completed" });
    if (!completed || completed === "false") {
      useOnboardingStore.getState().setShowOnboarding(true);
    }
  };

  if (hasApiKey !== null) {
    checkOnboarding();
  }
}, [hasApiKey]);

// Add component
{useOnboardingStore((state) => state.showOnboarding) && <OnboardingWizard />}
```

**Step 4: Implement individual steps**
Each step component handles:
- Display content per acceptance criteria
- Navigation buttons (Next/Back/Skip)
- Validation (API key format check in Step 2)
- Action on completion (set_api_key call in Step 2)

**Step 5: Complete onboarding**
```typescript
// In ReadyStep.tsx "Start Using App" button
const handleComplete = async () => {
  await invoke("set_setting", {
    key: "onboarding_completed",
    value: "true"
  });
  useOnboardingStore.getState().setShowOnboarding(false);
  useOnboardingStore.getState().reset();
};
```

### Scope Boundaries

**In Scope for Story 1.15:**
- 4-step wizard UI with navigation
- First-launch detection via settings table
- API key entry with validation
- Voice calibration UI (placeholder for Epic 6)
- Onboarding completion persistence
- "Show onboarding again" setting option

**Out of Scope (Future Stories/Enhancements):**
- **Epic 6:** Actual voice learning implementation (file processing, questionnaire logic)
- **Epic 2:** Passphrase entry integration (separate first-launch step)
- Multi-language support for onboarding text
- Animated transitions between steps
- Onboarding analytics/tracking

### Known Constraints

**Epic 2 Integration Note:**
Per architecture.md, first-launch flow should include passphrase creation BEFORE onboarding wizard. However, Epic 2 is not yet implemented. Current approach:
- Show onboarding wizard after API key check (Epic 1 scope)
- Epic 2 will add passphrase step BEFORE current onboarding
- No code changes needed in Story 1.15 when Epic 2 ships

**Voice Calibration Placeholder:**
Step 3 shows UI for voice calibration but doesn't process files. Epic 6 will:
- Implement file upload backend (Story 6.2)
- Add questionnaire logic (Story 6.3)
- Process voice samples for TF-IDF analysis (Story 6.4)

**Settings Table Dependency:**
Story 1.8 MUST be complete. If settings table doesn't exist, app will crash on get_setting call. Migration V2__add_settings_table.sql must have run.

### Edge Cases

**User Closes Wizard Mid-Flow:**
- Onboarding state persists in Zustand (in-memory)
- On app reload, wizard restarts from Step 1
- `onboarding_completed` only set to true on final step completion
- Acceptable: User can always restart wizard

**User Skips Voice Calibration:**
- App fully functional without voice samples (per acceptance criteria)
- Epic 6 will add voice learning, but it's optional
- No backend call needed on skip

**API Key Already Configured:**
- If user already configured API key (Story 1.7) but hasn't completed onboarding
- Show full wizard anyway (user might want voice calibration)
- Step 2 pre-populates with existing key (optional enhancement)

**Multiple Onboarding Attempts:**
- "Show onboarding again" resets `onboarding_completed` to false
- User can re-run wizard anytime from settings
- Each completion re-sets flag to true

### Testing Requirements

**Frontend Tests (Vitest + Testing Library):**
1. test_wizard_shows_on_first_launch: Check showOnboarding=true when `onboarding_completed` missing
2. test_wizard_hidden_if_completed: Check showOnboarding=false when `onboarding_completed=true`
3. test_step_navigation: Next button advances currentStep, Back button decrements
4. test_api_key_validation: Invalid key shows error, valid key allows progression
5. test_onboarding_completion: Final step sets `onboarding_completed=true`
6. test_keyboard_navigation: Enter advances, Escape closes (if applicable)

**Backend Tests (Rust):**
- No new tests needed (reuses existing settings table queries from Story 1.9)

**Manual Testing:**
1. Delete settings.db → restart app → verify wizard appears
2. Complete all 4 steps → verify wizard closes, flag set to true
3. Restart app → verify wizard doesn't appear again
4. Click "Show onboarding again" in settings → verify wizard appears
5. Enter invalid API key → verify error message shown
6. Skip voice calibration → verify app functions normally

### References

- [Source: epics-stories.md#Story 1.15: Onboarding Flow]
- [Source: ux-design-specification.md#Conversational Onboarding Design]
- [Source: architecture.md#First-Launch Detection Mechanism]
- [Source: Story 1.8: Settings Table Schema]
- [Source: Story 1.7: API Key Configuration UI]
- [Source: Story 1.14: Draft Recovery Modal Patterns]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

**Implementation Decisions:**

1. **Modal Pattern:** Used custom modal component (following DraftRecoveryModal pattern) instead of shadcn/ui, as the project doesn't have shadcn/ui installed and maintains a consistent custom modal approach.

2. **Keyboard Navigation:** Added Escape key to close wizard globally in OnboardingWizard.tsx, Enter key support in ApiKeyStep input field, and autoFocus on primary action buttons in each step.

3. **Settings Integration:** Onboarding completion check happens AFTER API key check completes in App.tsx initializeApp function, ensuring proper initialization order.

4. **Test Mocking:** Updated App.test.tsx to mock get_setting("onboarding_completed") returning "true" to prevent wizard from showing during tests.

### Completion Notes List

**All 8 acceptance criteria satisfied:**
- ✅ AC-1: 4-step wizard (Welcome → API Key → Voice Calibration → Ready) with progress indicator
- ✅ AC-2: Welcome step displays conversational welcome message
- ✅ AC-3: API Key step prompts for key with sk-ant- validation and console.anthropic.com link
- ✅ AC-4: Voice Calibration step offers two options (upload/questionnaire) with Epic 6 placeholders and prominent "Skip for now" button
- ✅ AC-5: Ready step displays completion message and "Start Using App" button
- ✅ AC-6: "Show onboarding again" button in settings view resets onboarding_completed flag
- ✅ AC-7: Onboarding completion saved to settings table as onboarding_completed=true
- ✅ AC-8: First-launch detection checks onboarding_completed flag on app mount

**All 8 tasks completed (29 subtasks):**
- Task 1: OnboardingWizard component with Zustand state management
- Task 2: WelcomeStep with conversational tone
- Task 3: ApiKeyStep with validation and set_api_key integration
- Task 4: VoiceCalibrationStep with Epic 6 placeholders
- Task 5: ReadyStep with set_setting integration
- Task 6: First-launch detection in App.tsx
- Task 7: Settings button to restart onboarding
- Task 8: Keyboard navigation, autoFocus, responsive CSS

**Tests:**
- 6 new test files created
- 42 new tests added (all passing)
- Total: 180 tests passing (frontend + backend)
- TypeScript compiles successfully
- 68 Rust tests still passing

### File List

**NEW:**
- upwork-researcher/src/stores/useOnboardingStore.ts
- upwork-researcher/src/stores/useOnboardingStore.test.ts
- upwork-researcher/src/components/OnboardingWizard.tsx
- upwork-researcher/src/components/OnboardingWizard.test.tsx
- upwork-researcher/src/components/OnboardingWizard.css
- upwork-researcher/src/components/onboarding/WelcomeStep.tsx
- upwork-researcher/src/components/onboarding/WelcomeStep.test.tsx
- upwork-researcher/src/components/onboarding/ApiKeyStep.tsx
- upwork-researcher/src/components/onboarding/ApiKeyStep.test.tsx
- upwork-researcher/src/components/onboarding/VoiceCalibrationStep.tsx
- upwork-researcher/src/components/onboarding/VoiceCalibrationStep.test.tsx
- upwork-researcher/src/components/onboarding/ReadyStep.tsx
- upwork-researcher/src/components/onboarding/ReadyStep.test.tsx

**MODIFIED:**
- upwork-researcher/src/App.tsx (added onboarding check, wizard rendering, settings button)
- upwork-researcher/src/App.test.tsx (added onboarding store mock)

## Senior Developer Review (AI)

**Review Date:** 2026-02-04
**Reviewer:** Claude Sonnet 4.5 (Adversarial Code Review Agent)
**Review Outcome:** ⚠️ Changes Requested

### Review Summary

Conducted adversarial review of Story 1.15 implementation. Found **12 specific issues** requiring attention before marking story as done.

**Severity Breakdown:**
- 🔴 **7 HIGH** - Critical bugs, accessibility violations, race conditions
- 🟡 **3 MEDIUM** - UX improvements, unnecessary backend calls
- 🟢 **2 LOW** - Code maintainability, minor improvements

### Critical Findings

**Most severe issues identified:**

1. **Infinite re-render loop risk** - `hasApiKey` in useEffect dependency array causes effect to re-run when hasApiKey changes (which happens inside the effect). This is a React anti-pattern that will cause performance issues.

2. **Race condition in onboarding check** - `checkOnboarding()` has a timing dependency on `hasApiKey` being set, but the check runs immediately after Promise.all completes. If hasApiKey updates asynchronously after the check, onboarding won't show when it should.

3. **Accessibility failure (WCAG 2.1 AA)** - Modal lacks required ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`). This makes the wizard completely unusable for screen reader users.

4. **Dead code** - `voiceFiles` state and `addVoiceFile` action in Zustand store are never used. Either remove or document that it's placeholder for Epic 6.

5. **Redundant security risk** - API key stored in Zustand (`apiKey` state) after already being persisted via Tauri. Keeping sensitive data in memory longer than necessary is a security risk.

6. **Poor error UX** - If `set_setting("onboarding_completed", "true")` fails in ReadyStep, wizard closes silently and user will see onboarding again on next app start. Should show error modal and keep wizard open.

7. **Inline async handler** - "Show Onboarding Again" button in settings has inline async function with no loading state or error feedback. Users won't know if it worked.

### Action Items Created

All 12 issues documented in **Review Follow-ups (AI)** subsection under Tasks/Subtasks. Each item tagged with severity and file location for easy navigation.

### Recommendation

**Status:** Story should remain **in-progress** until HIGH severity issues are addressed. MEDIUM and LOW issues can be deferred to future stories if timeline pressure exists, but HIGH issues (especially accessibility and race conditions) should be fixed before considering story "done."

### Git vs Story Cross-Check

✅ **File List Accuracy:** All files in story File List match git changes. No discrepancies found.
✅ **Uncommitted Changes:** All changes documented in story.
✅ **Test Coverage:** 42 new tests added as claimed.

### Fixes Applied (2026-02-04)

All 12 review findings have been addressed:

**HIGH Issues Fixed (7):**
1. ✅ **useEffect infinite loop** - Removed `hasApiKey` from dependency array, moved onboarding check inside Promise.all completion
2. ✅ **Race condition** - Onboarding check now calls `has_api_key` directly instead of relying on state timing
3. ✅ **Error handling in ReadyStep** - Added `saveError` state, shows error message and "Retry" button on failure, keeps wizard open
4. ✅ **Dead code (voiceFiles)** - Removed from useOnboardingStore with comment explaining Epic 6 placeholder
5. ✅ **Redundant apiKey storage** - Removed from Zustand store, API key only persisted via Tauri
6. ✅ **Inline async handler** - Extracted `handleShowOnboardingAgain` with `isResettingOnboarding` loading state
7. ✅ **Accessibility (WCAG 2.1 AA)** - Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="onboarding-title"` to modal, added `id="onboarding-title"` to all step headings

**MEDIUM Issues Fixed (3):**
8. ✅ **Unnecessary onboarding check** - Only checks onboarding when `apiKeyConfigured === true`
9. ✅ **Missing loading state** - "Show Onboarding Again" button now shows "Resetting..." and disables during operation
10. ✅ **Input persistence** - Added `useEffect` to clear `apiKeyInput` on ApiKeyStep mount

**LOW Issues Fixed (2):**
11. ✅ **Magic number** - Extracted `TOTAL_STEPS = 4` constant in OnboardingWizard
12. ✅ **Console.error exposure** - Wrapped console.error calls in `import.meta.env.DEV` check

**Test Updates:**
- Updated useOnboardingStore.test.ts (removed apiKey/voiceFiles tests, now 4 tests)
- Updated ApiKeyStep.test.tsx (removed apiKey assertion)
- Updated ReadyStep.test.tsx (updated error test to verify wizard stays open)
- All 178 tests passing
- TypeScript compiles successfully

**Files Modified:**
- upwork-researcher/src/stores/useOnboardingStore.ts
- upwork-researcher/src/stores/useOnboardingStore.test.ts
- upwork-researcher/src/components/OnboardingWizard.tsx
- upwork-researcher/src/components/onboarding/WelcomeStep.tsx
- upwork-researcher/src/components/onboarding/ApiKeyStep.tsx (+ test)
- upwork-researcher/src/components/onboarding/VoiceCalibrationStep.tsx
- upwork-researcher/src/components/onboarding/ReadyStep.tsx (+ test)
- upwork-researcher/src/App.tsx
