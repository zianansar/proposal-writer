---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 5
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 8.6: Expectation Management: Voice Learning Timeline

## Story

As a new user,
I want to know how long it takes for the app to learn my voice,
So that I have realistic expectations.

## Acceptance Criteria

**AC-1: Voice Learning Information Card**

**Given** I'm viewing the Voice Profile section (Settings → Voice Learning)
**When** I have completed initial calibration (Golden Set or Quick Calibration)
**Then** I see a "How Voice Learning Works" information card:

```
┌─────────────────────────────────────────────┐
│ How Voice Learning Works                    │
├─────────────────────────────────────────────┤
│                                             │
│ 📝 First proposal                           │
│    Uses your Quick Calibration or Golden    │
│    Set as the baseline.                     │
│                                             │
│ 📈 After 3-5 proposals                      │
│    System learns your editing patterns and  │
│    adjusts to your preferences.             │
│                                             │
│ ✨ After 10+ proposals                      │
│    Highly personalized to your unique       │
│    writing style.                           │
│                                             │
│ ────────────────────────────────────────    │
│                                             │
│ 💡 Takes 3-5 uses to learn your voice.     │
│                                             │
└─────────────────────────────────────────────┘
```

**And** this card appears below the Voice Profile Display (Story 5.5)

**AC-2: Progress Indicator**

**Given** I have generated and edited at least 1 proposal
**When** I view the Voice Learning section
**Then** I see a progress indicator showing:
- "Proposals edited: X/5 (learning in progress)" when X < 5
- "Proposals edited: X/10 (refining your style)" when 5 ≤ X < 10
- "Proposals edited: X ✓ (highly personalized)" when X ≥ 10

**And** the progress bar fills proportionally (X/10 max)
**And** the indicator updates in real-time when returning from proposal editing

**AC-3: Onboarding Integration**

**Given** I'm in the onboarding flow (Story 1.15)
**When** I complete the Quick Calibration step (Story 5.7)
**Then** I see a condensed version of the voice learning timeline:
"Takes 3-5 uses to learn your voice."
**And** a "Learn More" link that navigates to Settings → Voice Learning

**AC-4: Database Tracking**

**Given** I have generated a proposal and made edits to it
**When** I copy the proposal to clipboard (Story 0.4) after editing
**Then** the system increments my `proposals_edited_count` in the database
**And** this count persists across app restarts
**And** the count is used for the progress indicator (AC-2)

**AC-5: Accessibility**

**Given** I'm using keyboard-only navigation
**Then** I can tab through the information card
**And** screen reader announces "How Voice Learning Works" and each milestone
**And** progress indicator announces current count and status
**And** all text has minimum 4.5:1 contrast ratio (WCAG AA)

## Tasks/Subtasks

- [ ] Task 1: Create VoiceLearningTimeline component (AC-1)
  - [ ] Subtask 1.1: Create `src/features/voice-learning/VoiceLearningTimeline.tsx`
  - [ ] Subtask 1.2: Use shadcn/ui Card component as container
  - [ ] Subtask 1.3: Display 3 milestone sections with icons
  - [ ] Subtask 1.4: Add summary callout at bottom
  - [ ] Subtask 1.5: Style with dark theme colors per UX spec

- [ ] Task 2: Create progress indicator component (AC-2)
  - [ ] Subtask 2.1: Create `src/features/voice-learning/VoiceLearningProgress.tsx`
  - [ ] Subtask 2.2: Accept `proposalsEditedCount` prop
  - [ ] Subtask 2.3: Render progress bar (shadcn/ui Progress)
  - [ ] Subtask 2.4: Display appropriate status message based on count
  - [ ] Subtask 2.5: Add milestone markers at 5 and 10

- [ ] Task 3: Add database tracking for proposals edited (AC-4)
  - [ ] Subtask 3.1: Add `proposals_edited_count` column to settings table (migration)
  - [ ] Subtask 3.2: Create `increment_proposals_edited` Tauri command in Rust
  - [ ] Subtask 3.3: Create `get_proposals_edited_count` Tauri command
  - [ ] Subtask 3.4: Hook into copy-to-clipboard flow to increment count
  - [ ] Subtask 3.5: Create `useProposalsEditedCount()` React hook

- [ ] Task 4: Integrate with Voice Profile Display (AC-1, AC-2)
  - [ ] Subtask 4.1: Add VoiceLearningTimeline below VoiceProfileDisplay in Settings
  - [ ] Subtask 4.2: Add VoiceLearningProgress below timeline card
  - [ ] Subtask 4.3: Ensure components only show after calibration complete
  - [ ] Subtask 4.4: Refresh progress count when returning from proposal view

- [ ] Task 5: Add tests (AC-1 through AC-5)
  - [ ] Subtask 5.1: Test VoiceLearningTimeline renders all 3 milestones
  - [ ] Subtask 5.2: Test progress indicator shows correct status for 0, 3, 5, 10, 15 proposals
  - [ ] Subtask 5.3: Test progress bar fills proportionally
  - [ ] Subtask 5.4: Test database commands increment/retrieve count
  - [ ] Subtask 5.5: Test accessibility (ARIA labels, keyboard navigation)
  - [ ] Subtask 5.6: Test components hidden when no calibration exists

## Dev Notes

### Architecture Requirements

**UX-7: "Takes 3-5 uses to learn your voice"**
- Clear expectation setting prevents frustration
- Progressive improvement messaging builds trust
- Quantified milestones (5 proposals, 10 proposals) give concrete goals

**UX-8: Progressive Trust Building**
- Transparent about learning timeline
- Shows measurable progress toward personalization
- Celebrates milestones ("highly personalized" at 10+)

**AR-12: React Stack**
- Use React 19 functional components with TypeScript
- shadcn/ui components (Card, Progress) for UI consistency
- Custom hooks for data fetching

**UX-1: Dark Theme**
- Card background: `#1e1e1e`
- Text color: `#fafafa` (white) for labels, `#a3a3a3` (muted) for descriptions
- Progress bar fill: `#f97316` (orange accent)
- Milestone icons: emoji Unicode characters

### TypeScript Types

```typescript
// src/features/voice-learning/types.ts (extend existing)

export interface VoiceLearningProgress {
  proposalsEditedCount: number;
  status: 'initial' | 'learning' | 'refining' | 'personalized';
  progressPercent: number; // 0-100
}

export function getVoiceLearningStatus(count: number): VoiceLearningProgress {
  if (count === 0) {
    return { proposalsEditedCount: count, status: 'initial', progressPercent: 0 };
  } else if (count < 5) {
    return { proposalsEditedCount: count, status: 'learning', progressPercent: (count / 10) * 100 };
  } else if (count < 10) {
    return { proposalsEditedCount: count, status: 'refining', progressPercent: (count / 10) * 100 };
  } else {
    return { proposalsEditedCount: count, status: 'personalized', progressPercent: 100 };
  }
}
```

### Database Migration

```sql
-- migrations/V9__add_proposals_edited_count.sql

ALTER TABLE settings ADD COLUMN proposals_edited_count INTEGER NOT NULL DEFAULT 0;
```

### Rust Commands

```rust
// src-tauri/src/db/queries/settings.rs

#[tauri::command]
pub async fn increment_proposals_edited(state: State<'_, DbPool>) -> Result<i32, String> {
    let pool = state.0.lock().await;
    sqlx::query_scalar!(
        "UPDATE settings SET proposals_edited_count = proposals_edited_count + 1
         RETURNING proposals_edited_count"
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_proposals_edited_count(state: State<'_, DbPool>) -> Result<i32, String> {
    let pool = state.0.lock().await;
    sqlx::query_scalar!("SELECT proposals_edited_count FROM settings LIMIT 1")
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())
}
```

### React Hook

```typescript
// src/features/voice-learning/useProposalsEditedCount.ts

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVoiceLearningStatus, VoiceLearningProgress } from './types';

export function useProposalsEditedCount() {
  const [progress, setProgress] = useState<VoiceLearningProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      setLoading(true);
      const count = await invoke<number>('get_proposals_edited_count');
      setProgress(getVoiceLearningStatus(count));
    } catch (err) {
      console.error('Failed to fetch proposals edited count:', err);
    } finally {
      setLoading(false);
    }
  };

  const incrementCount = async () => {
    try {
      const newCount = await invoke<number>('increment_proposals_edited');
      setProgress(getVoiceLearningStatus(newCount));
    } catch (err) {
      console.error('Failed to increment proposals edited count:', err);
    }
  };

  useEffect(() => {
    fetchCount();
  }, []);

  return { progress, loading, refetch: fetchCount, incrementCount };
}
```

### File Structure

```
upwork-researcher/
  src/
    features/
      voice-learning/
        VoiceLearningTimeline.tsx      # NEW: Timeline info card
        VoiceLearningTimeline.test.tsx # NEW: Timeline tests
        VoiceLearningProgress.tsx      # NEW: Progress indicator
        VoiceLearningProgress.test.tsx # NEW: Progress tests
        useProposalsEditedCount.ts     # NEW: Count hook
        useProposalsEditedCount.test.ts # NEW: Hook tests
        types.ts                       # EXTEND: Add VoiceLearningProgress
  src-tauri/
    migrations/
      V9__add_proposals_edited_count.sql # NEW: DB migration
    src/db/queries/
      settings.rs                      # EXTEND: Add count commands
```

### Integration Points

**With Story 5.5 (Voice Profile Display):**
- VoiceLearningTimeline appears directly below VoiceProfileDisplay
- Both components live in Voice Learning settings section
- Share same loading/error state patterns

**With Story 5.7 (Quick Calibration):**
- After Quick Calibration completes, show condensed timeline message
- "Takes 3-5 uses" appears as post-calibration confirmation

**With Story 1.15 (Onboarding Flow):**
- Condensed version shown during onboarding after calibration step
- Links to full Voice Learning settings for details

**With Story 0.4 / Story 6.6 (Copy to Clipboard):**
- After user edits and copies proposal, increment proposals_edited_count
- Hooks into existing copy flow (CopyButton component)

### Dependencies

**Depends On:**
- **Story 5.5: Voice Profile Display** (BLOCKING) - Timeline appears below profile
- **Story 5.4: Local-Only Voice Analysis** (BLOCKING) - Calibration must exist first
- **Story 0.4: Manual Copy to Clipboard** - Increment count on copy after edit

**Depended On By:**
- Story 5.8: Voice-Informed Proposal Generation (uses implicit learning data)

### Testing Requirements

**Unit Tests:**
1. `getVoiceLearningStatus()` returns correct status for 0, 1, 4, 5, 9, 10, 15
2. Progress percent calculation is accurate
3. Status labels match expected values

**Component Tests:**
1. VoiceLearningTimeline renders all 3 milestones
2. VoiceLearningProgress shows correct message for each status
3. Progress bar fills to correct percentage
4. Components hidden when no voice profile exists
5. Accessibility: ARIA labels, keyboard navigation, contrast

**Integration Tests:**
1. Copy button increments proposals_edited_count
2. Progress indicator updates after returning from proposal view
3. Database persists count across app restarts

### References

- [Source: epics-stories.md#Story 8.6: Expectation Management]
- [Source: ux-design-specification.md#UX-7: Voice Learning Timeline]
- [Source: ux-design-specification.md#UX-8: Progressive Trust Building]
- [Story 5.5: Voice Profile Display — parent component]
- [Story 5.7: Quick Calibration — onboarding integration]
- [Story 1.15: Onboarding Flow — condensed version]
- [Story 0.4: Manual Copy to Clipboard — increment trigger]
