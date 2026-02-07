---
status: ready-for-dev
assignedTo: null
tasksCompleted: 0
testsWritten: 0
fileList: []
---

# Story 6.2: Manual Voice Parameter Adjustments

## Story

As a freelancer,
I want to manually adjust voice settings,
So that future proposals better match my style.

## Acceptance Criteria

**Given** I'm in Settings → Voice
**When** I view voice settings
**Then** I see sliders for:

- Tone: Formal ←→ Casual (1-10 scale)
- Length: Brief ←→ Detailed (1-10 scale)
- Technical Depth: Simple ←→ Expert (1-10 scale)

**And** adjusting a slider immediately saves
**And** I see: "Changes will affect future proposals"
**And** current values are shown (e.g., Tone: 7/10 Professional)

## Technical Notes

- FR-10: voice weight updates (manual only in MVP)
- AR-22: MVP = few-shot prompting, NO automated learning
- Simplified from original FR-9/FR-10 scope per Round 3

## Architecture Context

### MVP Voice Learning Strategy (AR-22)

Per architecture decisions, voice learning is phased:
- **MVP (this story):** Few-shot prompting only. User manually sets parameters via sliders. No automated edit analysis.
- **v1.1:** Add explicit signals (ratings, style preferences)
- **v1.2:** Add implicit signals (edit pattern analysis)

This story implements the **manual parameter adjustment** portion of MVP voice learning.

### Voice Profile Data Model

From Story 5-5b, the `voice_profiles` table stores:
- `tone_score` (REAL, 1-10) — maps to Tone slider
- `technical_depth` (REAL, 1-10) — maps to Technical Depth slider
- `avg_sentence_length` (REAL) — calculated metric, NOT directly editable

**Schema Gap:** The "Length: Brief ←→ Detailed" slider needs a new column. Options:
1. Add `length_preference` column (REAL, 1-10) to voice_profiles table
2. Repurpose `avg_sentence_length` as preference (not recommended — breaks calibration)

**Recommendation:** Add migration to extend voice_profiles with `length_preference` column.

### How Manual Parameters Affect Generation

Voice parameters are injected into the Claude prompt as style guidance:
```
Voice Style Parameters:
- Tone: 7/10 (Professional with approachable warmth)
- Length: 4/10 (Concise, to-the-point responses)
- Technical Depth: 8/10 (Expert level, use industry terminology)
```

The proposal generation pipeline (Story 5-8) reads these values from `voice_profiles` and includes them in the prompt context.

## Dependencies

### Depends On
- **Story 5-5b: Persist Voice Profile to Database** — provides `voice_profiles` table and Tauri commands
- **Story 1-8: Settings Table** — settings infrastructure (already implemented)

### Depended On By
- **Story 5-8: Voice-Informed Proposal Generation** — uses manual parameters in prompt

## Implementation Tasks

### Task 1: Database Schema Update
- [ ] Create migration `V8__add_voice_length_preference.sql`
- [ ] Add `length_preference` column (REAL, 1-10, default 5.0)
- [ ] Add CHECK constraint for 1-10 range
- [ ] Update `VoiceProfileRow` struct to include `length_preference`

### Task 2: Create Voice Settings UI Component
- [ ] Create `upwork-researcher/src/components/VoiceSettings.tsx`
- [ ] Create `upwork-researcher/src/components/VoiceSettings.css`
- [ ] Implement three slider components:
  - Tone: 1 (Formal) ←→ 10 (Casual)
  - Length: 1 (Brief) ←→ 10 (Detailed)
  - Technical Depth: 1 (Simple) ←→ 10 (Expert)
- [ ] Show current value next to each slider (e.g., "7/10")
- [ ] Add descriptive label that changes based on value (e.g., "Professional", "Casual")
- [ ] Add "Changes will affect future proposals" info text

### Task 3: Integrate into Settings Panel
- [ ] Add "Voice" section to `SettingsPanel.tsx`
- [ ] Import and render `VoiceSettings` component
- [ ] Position after existing sections (Logging, Safety, Humanization, Onboarding)
- [ ] Style consistently with other settings sections

### Task 4: Implement Debounced Save Logic
- [ ] Load current voice profile on mount via `get_voice_profile` Tauri command
- [ ] Handle case where no profile exists (show defaults, create on first save)
- [ ] Debounce slider changes (300ms, matching existing threshold slider pattern)
- [ ] Call `save_voice_profile` on debounced change
- [ ] Show save indicator ("Saving...", "✓ Saved")
- [ ] Handle save errors with user feedback

### Task 5: Add/Update Tauri Backend
- [ ] Update `save_voice_profile` command to accept partial updates
- [ ] Or create new `update_voice_parameters` command for just the three sliders
- [ ] Ensure `length_preference` is included in VoiceProfile struct
- [ ] Update TypeScript types to match

### Task 6: Create Hook for Voice Settings
- [ ] Create `upwork-researcher/src/hooks/useVoiceSettings.ts`
- [ ] Encapsulate load/save logic
- [ ] Manage loading, saving, and error states
- [ ] Return current values and setter functions

### Task 7: Write Tests
- [ ] Unit tests for `VoiceSettings.tsx` component
  - Renders three sliders
  - Displays current values
  - Shows info message
  - Handles slider changes
- [ ] Unit tests for `useVoiceSettings.ts` hook
  - Loads profile on mount
  - Debounces saves
  - Handles missing profile
- [ ] Integration test: slider change persists to database
- [ ] Rust tests: migration applies, new column works

### Task 8: Accessibility
- [ ] ARIA labels for each slider (e.g., "Tone: Formal to Casual, currently 7 out of 10")
- [ ] Keyboard navigation (arrow keys adjust value)
- [ ] Focus visible on sliders
- [ ] Screen reader announces value changes

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/VoiceSettings.tsx` | Voice parameter sliders UI |
| `src/components/VoiceSettings.css` | Slider styles |
| `src/hooks/useVoiceSettings.ts` | Voice settings state management |
| `src/components/VoiceSettings.test.tsx` | Component tests |
| `src/hooks/useVoiceSettings.test.ts` | Hook tests |
| `src-tauri/migrations/V8__add_voice_length_preference.sql` | Schema update |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/SettingsPanel.tsx` | Add Voice section with VoiceSettings component |
| `src-tauri/src/db/queries/voice_profiles.rs` | Update for length_preference column |
| `src-tauri/src/voice.rs` or types file | Add length_preference to VoiceProfile struct |
| `src/App.css` | Any global slider styles if needed |

## Database Migration

```sql
-- V8__add_voice_length_preference.sql

-- Add length_preference for manual "Brief to Detailed" slider
-- Default 5.0 = balanced length

ALTER TABLE voice_profiles
ADD COLUMN length_preference REAL NOT NULL DEFAULT 5.0
CHECK (length_preference >= 1 AND length_preference <= 10);
```

## UI Design Specification

### Slider Layout

```
┌─────────────────────────────────────────────────────────┐
│ Voice Settings                                          │
│                                                         │
│ Changes will affect future proposals.                   │
│                                                         │
│ Tone: 7/10 Professional                                 │
│ Formal ●━━━━━━━━━━━━━━━━○━━━━━━━━ Casual               │
│                         ▲                               │
│                                                         │
│ Length: 4/10 Concise                                    │
│ Brief ●━━━━━━━━━━━━━○━━━━━━━━━━━━━━━ Detailed          │
│                    ▲                                    │
│                                                         │
│ Technical Depth: 8/10 Expert                            │
│ Simple ●━━━━━━━━━━━━━━━━━━━━━━━━━○━━━━ Expert          │
│                                  ▲                      │
│                                                         │
│ [Saving... ✓]                                          │
└─────────────────────────────────────────────────────────┘
```

### Value Labels

| Slider | 1-2 | 3-4 | 5-6 | 7-8 | 9-10 |
|--------|-----|-----|-----|-----|------|
| Tone | Formal | Professional | Balanced | Conversational | Casual |
| Length | Very Brief | Concise | Balanced | Detailed | Comprehensive |
| Technical | Layman | Basic | Intermediate | Advanced | Expert |

## TypeScript Types

```typescript
// src/types/voice.ts

export interface VoiceParameters {
  tone_score: number;        // 1-10: formal to casual
  length_preference: number; // 1-10: brief to detailed
  technical_depth: number;   // 1-10: simple to expert
}

export interface VoiceProfile extends VoiceParameters {
  user_id: string;
  avg_sentence_length: number;
  vocabulary_complexity: number;
  structure_paragraphs_pct: number;
  structure_bullets_pct: number;
  common_phrases: string[];
  sample_count: number;
  calibration_source: 'GoldenSet' | 'QuickCalibration' | 'Implicit' | 'Manual';
  created_at?: string;
  updated_at?: string;
}

// For partial updates from sliders
export interface VoiceParameterUpdate {
  tone_score?: number;
  length_preference?: number;
  technical_depth?: number;
}
```

## Component Implementation Pattern

Follow the existing SettingsPanel patterns:

```tsx
// VoiceSettings.tsx (sketch)

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./VoiceSettings.css";

const TONE_LABELS = ["Formal", "Professional", "Balanced", "Conversational", "Casual"];
const LENGTH_LABELS = ["Very Brief", "Concise", "Balanced", "Detailed", "Comprehensive"];
const DEPTH_LABELS = ["Layman", "Basic", "Intermediate", "Advanced", "Expert"];

function getLabel(value: number, labels: string[]): string {
  const index = Math.min(Math.floor((value - 1) / 2), labels.length - 1);
  return labels[index];
}

export function VoiceSettings() {
  const [toneScore, setToneScore] = useState(5);
  const [lengthPreference, setLengthPreference] = useState(5);
  const [technicalDepth, setTechnicalDepth] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await invoke<VoiceProfile | null>("get_voice_profile");
      if (profile) {
        setToneScore(profile.tone_score);
        setLengthPreference(profile.length_preference);
        setTechnicalDepth(profile.technical_depth);
      }
      // If null, keep defaults (5, 5, 5)
    } catch (err) {
      console.error("Failed to load voice profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveWithDebounce = (updates: Partial<VoiceParameters>) => {
    setMessage(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        await invoke("update_voice_parameters", { params: updates });
        setMessage("✓ Saved");
        setTimeout(() => setMessage(null), 2000);
      } catch (err) {
        setMessage(`Failed to save: ${err}`);
      } finally {
        setSaving(false);
      }
    }, 300);
  };

  // ... render sliders ...
}
```

## Definition of Done

1. Voice Settings section appears in Settings panel
2. Three sliders render with correct labels (Tone, Length, Technical Depth)
3. Sliders show current value (X/10) and descriptive label
4. "Changes will affect future proposals" message is visible
5. Adjusting any slider triggers debounced save (300ms)
6. Save indicator shows during save operation
7. Values persist across app restarts
8. Works when no voice profile exists yet (creates one on first save)
9. All tests passing (component, hook, Rust)
10. Keyboard accessible (arrow keys, Tab navigation)
11. Dark mode styling matches rest of app

## Out of Scope (Future Stories)

- Automatic voice learning from edits (v1.1 per AR-22)
- Edit pattern detection (v1.2)
- Multiple voice profiles per user (future)
- Voice profile reset/recalibration from this screen (use Story 5-7 Quick Calibration)
- Real-time preview of how changes affect generation

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Story 5-5b not complete (no voice_profiles table) | Check table exists before render, show "Complete voice calibration first" message |
| Length preference column doesn't exist | Migration V8 adds it; handle gracefully if missing |
| User expects immediate generation change | Clear "affects future proposals" messaging |
| Slider values confusing (what does 7 mean?) | Descriptive labels (Professional, Concise, Expert) |

## Testing Requirements

### Frontend Tests

```typescript
// VoiceSettings.test.tsx

describe("VoiceSettings", () => {
  it("renders three sliders", () => {
    render(<VoiceSettings />);
    expect(screen.getByLabelText(/tone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/length/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/technical depth/i)).toBeInTheDocument();
  });

  it("displays info message", () => {
    render(<VoiceSettings />);
    expect(screen.getByText(/changes will affect future proposals/i)).toBeInTheDocument();
  });

  it("loads values from profile", async () => {
    mockInvoke.mockResolvedValue({ tone_score: 7, length_preference: 3, technical_depth: 9 });
    render(<VoiceSettings />);
    await waitFor(() => {
      expect(screen.getByLabelText(/tone/i)).toHaveValue("7");
    });
  });

  it("shows saving indicator on change", async () => {
    render(<VoiceSettings />);
    fireEvent.change(screen.getByLabelText(/tone/i), { target: { value: "8" } });
    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });
});
```

### Rust Tests

```rust
#[test]
fn test_length_preference_migration() {
    let conn = create_test_db();
    run_migrations(&conn);

    // Verify column exists with default
    let result: f64 = conn.query_row(
        "SELECT length_preference FROM voice_profiles WHERE user_id = 'test'",
        [],
        |row| row.get(0)
    ).unwrap();

    assert_eq!(result, 5.0);
}

#[test]
fn test_update_voice_parameters() {
    let conn = create_test_db();
    insert_test_profile(&conn);

    update_voice_parameters(&conn, "default", &VoiceParameterUpdate {
        tone_score: Some(8.0),
        length_preference: Some(3.0),
        technical_depth: None,  // Should not change
    }).unwrap();

    let profile = get_voice_profile(&conn, "default").unwrap().unwrap();
    assert_eq!(profile.tone_score, 8.0);
    assert_eq!(profile.length_preference, 3.0);
    // technical_depth unchanged
}
```

## References

- [Story 5-5b: Persist Voice Profile to Database](5-5b-persist-voice-profile-to-database.story.md) — provides database schema
- [Story 5-8: Voice-Informed Proposal Generation](5-8-voice-informed-proposal-generation.story.md) — consumes these parameters
- [Architecture: AR-22](../planning-artifacts/architecture.md) — MVP voice learning is manual only
- [Existing slider pattern](../src/components/SettingsPanel.tsx) — safety threshold slider as reference
