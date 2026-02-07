---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 7
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 5.2: Hook Strategy Selection UI

## Story

As a freelancer,
I want to choose which hook strategy to use for my proposal,
So that I can match my approach to the client's needs.

## Acceptance Criteria

**AC-1: Hook Strategies Display**

**Given** I have pasted a job post and I'm ready to generate a proposal
**When** I see the hook selection UI (appears above "Generate Proposal" button)
**Then** I see 5 hook strategies displayed as selectable cards with:
- Strategy name (bold, 18px)
- Brief description (2-3 lines)
- ONE example opening line (first from examples_json array)
- "Best for: [client type]" tag at bottom
**And** all 5 strategies are loaded from the `hook_strategies` database table (not hardcoded)
**And** cards are displayed in a 2-2-1 grid layout (2 cards first row, 2 cards second row, 1 card centered third row)

**AC-2: Default Selection**

**Given** I'm viewing the hook selection UI for the first time
**When** the component loads
**Then** "Social Proof" strategy is pre-selected (card has orange border and checkmark icon)
**And** the selection state is stored in React state

**AC-3: Strategy Selection Interaction**

**Given** I'm viewing the hook strategies
**When** I click on a different strategy card
**Then** the previously selected card returns to default state (gray border, no checkmark)
**And** the newly selected card shows active state (orange border, checkmark icon in top-right)
**And** the selection is immediately saved to local component state
**And** the card hover state shows visual feedback (lifted shadow, cursor pointer)

**AC-4: Persistence of Selection**

**Given** I have selected a hook strategy
**When** I generate a proposal
**Then** the selected strategy ID is passed to the generation pipeline
**And** the strategy selection persists for the next generation (doesn't reset to default)
**And** the strategy name is included in generation prompt context

**AC-5: Keyboard Accessibility**

**Given** I'm navigating with keyboard only
**When** I tab through the interface
**Then** I can navigate between strategy cards using Tab/Shift+Tab
**And** I can select a strategy using Enter or Space key
**And** the focused card has a visible orange outline (2px)
**And** screen reader announces "Hook strategy: [name]. [description]. Selected." or "Not selected."

**AC-6: Loading and Error States**

**Given** the app is fetching hook strategies from the database
**When** the query is in progress
**Then** I see a loading skeleton (5 gray card outlines with pulse animation)
**And** the "Generate Proposal" button is disabled until strategies load
**When** the database query fails
**Then** I see an error message: "Unable to load hook strategies. Please restart the app."
**And** a "Retry" button appears to re-fetch strategies

**AC-7: Visual Design Compliance**

**Given** the hook selection UI is rendered
**Then** it follows the app's dark theme design system:
- Card background: `#1e1e1e` (dark gray)
- Card border: `#2a2a2a` default, `#f97316` (orange) when selected
- Text color: `#fafafa` (white) for titles, `#a3a3a3` (muted) for descriptions
- Spacing: 16px gap between cards, 16px padding inside cards
- Typography: Inter for all text
**And** all text has minimum 4.5:1 contrast ratio (WCAG AA compliant)

## Tasks/Subtasks

- [ ] Task 1: Create Tauri command to fetch hook strategies (AC-1, AC-6)
  - [ ] Subtask 1.1: Add `get_hook_strategies` command in `src-tauri/src/commands/hooks.rs` (new file)
  - [ ] Subtask 1.2: Use `db::queries::hook_strategies::get_all_hook_strategies()` from Story 5-1
  - [ ] Subtask 1.3: Return Vec<HookStrategy> serialized as JSON
  - [ ] Subtask 1.4: Add error handling for database query failures
  - [ ] Subtask 1.5: Register command in `src-tauri/src/lib.rs` invoke_handler

- [ ] Task 2: Create HookStrategy TypeScript types (AC-1)
  - [ ] Subtask 2.1: Create `src/types/hooks.ts` file
  - [ ] Subtask 2.2: Define HookStrategy interface matching Rust struct:
    ```typescript
    interface HookStrategy {
      id: number;
      name: string;
      description: string;
      examples_json: string; // JSON array as string
      best_for: string;
      created_at: string;
    }
    ```
  - [ ] Subtask 2.3: Add helper function `parseExamples(json: string): string[]`
  - [ ] Subtask 2.4: Add type for parsed hook strategy with first example extracted

- [ ] Task 3: Create HookStrategyCard component (AC-1, AC-3, AC-7)
  - [ ] Subtask 3.1: Create `src/components/HookStrategyCard.tsx`
  - [ ] Subtask 3.2: Use shadcn/ui Card component as base
  - [ ] Subtask 3.3: Implement card layout (name, description, example, best_for tag)
  - [ ] Subtask 3.4: Add selected/unselected states with visual styling
  - [ ] Subtask 3.5: Add checkmark icon (shadcn Check icon) in top-right when selected
  - [ ] Subtask 3.6: Implement hover state with transform and shadow
  - [ ] Subtask 3.7: Add onClick handler to trigger selection callback
  - [ ] Subtask 3.8: Make card keyboard accessible (role="radio", tabIndex, onKeyDown)

- [ ] Task 4: Create HookStrategySelector component (AC-1, AC-2, AC-3, AC-4, AC-6)
  - [ ] Subtask 4.1: Create `src/components/HookStrategySelector.tsx`
  - [ ] Subtask 4.2: Fetch hook strategies using Tauri invoke("get_hook_strategies")
  - [ ] Subtask 4.3: Store strategies in component state (useState)
  - [ ] Subtask 4.4: Initialize selectedStrategyId to "Social Proof" strategy ID (find by name)
  - [ ] Subtask 4.5: Implement loading state with skeleton cards (use shadcn Skeleton)
  - [ ] Subtask 4.6: Implement error state with error message + retry button
  - [ ] Subtask 4.7: Render grid of HookStrategyCard components (CSS Grid: 2 columns)
  - [ ] Subtask 4.8: Pass selection state and handler to each card
  - [ ] Subtask 4.9: Expose selectedStrategyId via props callback to parent (App.tsx)

- [ ] Task 5: Integrate HookStrategySelector into App.tsx (AC-4)
  - [ ] Subtask 5.1: Import HookStrategySelector component
  - [ ] Subtask 5.2: Add hook strategy state to App component (useState<number | null>)
  - [ ] Subtask 5.3: Place HookStrategySelector above "Generate Proposal" button
  - [ ] Subtask 5.4: Add visual separator (horizontal line or spacing) between selector and button
  - [ ] Subtask 5.5: Pass selected strategy ID to generation function when "Generate" clicked
  - [ ] Subtask 5.6: Update generateProposal function to accept strategyId parameter
  - [ ] Subtask 5.7: Include strategy context in Claude API generation prompt

- [ ] Task 6: Add accessibility features (AC-5)
  - [ ] Subtask 6.1: Wrap card grid in <div role="radiogroup" aria-label="Hook strategies">
  - [ ] Subtask 6.2: Add ARIA attributes to each card (role="radio", aria-checked)
  - [ ] Subtask 6.3: Implement keyboard navigation (Arrow keys to move between cards)
  - [ ] Subtask 6.4: Add visible focus indicator (2px orange outline on :focus-visible)
  - [ ] Subtask 6.5: Test with screen reader (NVDA/VoiceOver) - verify announcements

- [ ] Task 7: Add tests for hook strategy selection (AC-1 through AC-7)
  - [ ] Subtask 7.1: Test HookStrategyCard renders with correct data
  - [ ] Subtask 7.2: Test card selection changes visual state
  - [ ] Subtask 7.3: Test HookStrategySelector fetches and displays 5 strategies
  - [ ] Subtask 7.4: Test default selection is "Social Proof"
  - [ ] Subtask 7.5: Test keyboard navigation (Tab, Enter, Space)
  - [ ] Subtask 7.6: Test loading state renders skeleton cards
  - [ ] Subtask 7.7: Test error state renders error message and retry button
  - [ ] Subtask 7.8: Test selection persists across re-renders (state doesn't reset)
  - [ ] Subtask 7.9: Integration test: selected strategy ID passed to generation function

## Dev Notes

### Architecture Requirements

**AR-12: Frontend Stack (React + TypeScript + Vite)**
- Use React 19 functional components with TypeScript
- Use Vite for hot module reload during development
- Follow React Hooks patterns (useState for local state)

**AR-13: shadcn/ui Component Library**
- Use shadcn/ui Card component for strategy cards
- Use shadcn/ui Skeleton component for loading state
- Use shadcn/ui Alert component for error messages
- Use Lucide React icons (Check icon for selected state)

**AR-18: Database Queries**
- Fetch hook strategies via `db::queries::hook_strategies::get_all_hook_strategies()`
- Query function already implemented in Story 5-1

**FR-5: Hook Strategy Selection**
- User selects from 5 pre-defined hook strategies
- Selection influences generation prompt sent to Claude API
- Per PRD: "Core Loop: Job Parsing → Hook Selection → AI Generation"

**NFR-8: Offline-First Architecture**
- Hook strategies loaded from local SQLite database (no network required)
- Strategies bundled via Story 5-1 seed data

**UX-1: Dark Theme**
- All components use dark theme color palette
- Orange accent color (#f97316) for selected/active states

**UX-4: Accessibility (WCAG AA)**
- Keyboard navigation support (Tab, Enter, Space, Arrow keys)
- Screen reader support (ARIA labels, roles, announcements)
- 4.5:1 minimum contrast ratio for all text

### UI/UX Specifications

**Component Hierarchy:**
```
App.tsx
└── HookStrategySelector
    ├── Loading State (Skeleton Cards x5)
    ├── Error State (Alert + Retry Button)
    └── Loaded State
        └── HookStrategyCard x5
```

**HookStrategyCard Layout:**
```
┌─────────────────────────────────────┐
│ Strategy Name               [✓]     │ ← Bold, 18px, Checkmark if selected
│ ─────────────────────────────────   │
│ Brief description of when to use    │ ← 14px, muted gray, 2-3 lines
│ this strategy and why it works.     │
│                                     │
│ Example: "I've helped 12 clients    │ ← 14px, italic, first example only
│ in your industry achieve..."        │
│                                     │
│ Best for: [client type description] │ ← 12px, orange tag at bottom
└─────────────────────────────────────┘
```

**Visual States:**
- **Default:** Gray border (#2a2a2a), no checkmark
- **Hover:** Lifted (translateY(-2px)), shadow increases, cursor pointer
- **Selected:** Orange border (#f97316), checkmark in top-right, slightly elevated
- **Focused:** Orange outline (2px), keyboard focus visible

**Grid Layout:**
```css
display: grid;
grid-template-columns: repeat(2, 1fr);
gap: 16px;
/* Last card spans both columns and centered */
.card:last-child {
  grid-column: 1 / -1;
  max-width: 50%;
  margin: 0 auto;
}
```

### File Structure

```
upwork-researcher/
  src/
    components/
      HookStrategyCard.tsx          # NEW: Individual strategy card component
      HookStrategyCard.test.tsx     # NEW: Unit tests for card
      HookStrategySelector.tsx      # NEW: Container component for all cards
      HookStrategySelector.test.tsx # NEW: Integration tests for selector
    types/
      hooks.ts                      # NEW: TypeScript types for HookStrategy
    App.tsx                         # MODIFIED: Add HookStrategySelector + state
    App.test.tsx                    # MODIFIED: Add integration tests

  src-tauri/
    src/
      commands/
        hooks.rs                    # NEW: Tauri command get_hook_strategies
        mod.rs                      # MODIFIED: Export hooks module
      lib.rs                        # MODIFIED: Register get_hook_strategies command
```

### State Management

**Component State (useState):**
- `HookStrategySelector` manages:
  - `strategies: HookStrategy[]` - fetched from database
  - `selectedId: number | null` - currently selected strategy ID
  - `loading: boolean` - loading state
  - `error: string | null` - error message if fetch fails

**Parent State (App.tsx):**
- `selectedStrategyId: number | null` - lifted state from HookStrategySelector
- Passed to generation function when user clicks "Generate Proposal"

**No Global State Needed:**
- Strategy selection is ephemeral (doesn't need persistence across sessions)
- Simple parent-child prop passing is sufficient

### Integration with Generation Pipeline

**Current Flow (Story 0-2):**
1. User pastes job post
2. User clicks "Generate Proposal"
3. App calls `generate_proposal()` Tauri command
4. Claude API generates proposal

**Updated Flow (After Story 5-2):**
1. User pastes job post
2. User selects hook strategy from cards
3. User clicks "Generate Proposal"
4. App calls `generate_proposal(job_post, strategy_id)` with strategy ID
5. Backend fetches strategy details from database
6. Strategy context added to generation prompt:
   ```
   Use the following hook strategy:
   - Strategy: Social Proof
   - Description: Lead with relevant experience and quantified results
   - Example: "I've helped 12 clients in your industry achieve..."
   ```
7. Claude API generates proposal with hook guidance

**Prompt Engineering Note:**
- Strategy details should be injected into system prompt, not user message
- Include strategy name, description, and first example
- Instruct Claude to adapt the hook to the specific job post context

### Testing Strategy

**Unit Tests (Vitest + Testing Library):**

1. **HookStrategyCard Tests:**
   - Renders strategy data correctly (name, description, example, best_for)
   - Shows checkmark when `isSelected={true}`
   - Calls onClick handler when clicked
   - Shows hover state on mouse enter
   - Keyboard: calls onSelect when Enter/Space pressed

2. **HookStrategySelector Tests:**
   - Fetches strategies from Tauri command on mount
   - Displays loading skeleton while fetching
   - Displays error message on fetch failure
   - Renders 5 strategy cards when data loads
   - "Social Proof" is pre-selected by default
   - Clicking a card updates selection state
   - Calls parent callback with selected strategy ID

3. **Integration Tests (App.tsx):**
   - HookStrategySelector visible above "Generate" button
   - Selected strategy ID passed to generation function
   - Strategy selection persists across multiple generations (doesn't reset)

**Manual Testing Checklist:**
- [ ] All 5 strategies display with correct data
- [ ] Default selection is "Social Proof" (orange border + checkmark)
- [ ] Clicking a different card changes selection
- [ ] Hover state works (card lifts, shadow increases)
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Focus indicator visible (orange outline)
- [ ] Screen reader announces selection changes
- [ ] Loading state appears briefly on app start
- [ ] Error state + retry button work if database unavailable
- [ ] Generated proposal reflects selected hook strategy

### Dependencies

**Depends On:**
- **Story 5-1: Hook Strategies Seed Data** (BLOCKING)
  - Requires `hook_strategies` table to exist
  - Requires `get_all_hook_strategies()` query function
  - Requires 5 default strategies seeded in database

**Depended On By:**
- **Story 5-8: Voice-Informed Proposal Generation**
  - Requires strategy selection to be part of generation context

### Scope Boundaries

**In Scope for Story 5-2:**
- Fetching hook strategies from database
- Displaying strategies as selectable cards
- Managing selection state
- Passing selected strategy to generation pipeline (basic integration)
- Keyboard accessibility and screen reader support

**Out of Scope (Future Stories):**
- Custom hook strategies (user-created) - Post-MVP
- Hook strategy editing - Post-MVP
- Hook strategy effectiveness tracking (which hooks get better responses) - Epic 7
- A/B testing of hook strategies - FR-18 (Dynamic Config, Post-MVP)
- Strategy recommendations based on job analysis - Future enhancement

### Design Decisions

**Decision: Why Cards Instead of Dropdown?**
- Cards allow visual scanning of all 5 options simultaneously
- Dropdown hides options until clicked (requires extra interaction)
- Cards surface examples and "best for" guidance upfront
- Research: Users prefer visual comparison when choosing from 3-7 options

**Decision: Why 2-2-1 Grid Instead of Single Row?**
- 5 cards in one row is too wide (horizontal scrolling on smaller screens)
- 2-2-1 grid balances space efficiency with visual hierarchy
- Centered last card creates focal point (last option is deliberate)

**Decision: Why One Example Instead of All 2-3?**
- Space constraint: 3 examples per card creates visual clutter
- Cognitive load: Users need quick scanning, not exhaustive review
- First example is sufficient to convey the strategy pattern
- Full examples available in hook library reference (Story 5-1)

**Decision: Default to "Social Proof" Strategy?**
- Per PRD, Social Proof is most universally applicable hook
- Research shows "relevant experience + results" is safest opening
- Users can change if job context requires different approach

**Decision: No Persistence Across Sessions?**
- Hook selection is job-context-dependent (changes per proposal)
- Saving last selection may lead to inappropriate hooks on next job
- Better UX: force intentional selection each time (default: Social Proof)
- Future enhancement: suggest hook based on job analysis (Story 4a-4)

### References

- [Source: epics-stories.md#Story 5.2: Hook Strategy Selection UI]
- [Source: prd.md#FR-5: Hook strategy selection]
- [Source: prd.md#Section 10.2: Core Loop - Job Parsing → Hook Selection → AI Generation]
- [Source: architecture.md#Proposal Generation Pipeline - Step 2: Hook Selection]
- [Source: Story 5-1: Hook Strategies Seed Data - hook_strategies table schema]
- [Source: ux-design-specification.md#Dark Theme Color System]
- [Source: ux-design-specification.md#Accessibility Requirements (WCAG AA)]
