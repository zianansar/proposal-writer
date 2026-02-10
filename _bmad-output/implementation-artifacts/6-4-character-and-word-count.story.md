---
status: done
assignedTo: Dev Agent
tasksCompleted: 7
testsWritten: 32
fileList:
  - src/components/EditorStatusBar.tsx
  - src/components/EditorStatusBar.css
  - src/components/EditorStatusBar.test.tsx
  - src/utils/textStats.ts
  - src/utils/textStats.test.ts
  - src/components/ProposalEditor.tsx
  - src/components/ProposalEditor.css
  - src/components/ProposalEditor.test.tsx
---

# Story 6.4: Character and Word Count

## Story

As a freelancer,
I want to see character and word counts as I edit,
So that I can match Upwork's proposal length guidelines.

## Acceptance Criteria

**Given** I'm editing a proposal
**When** I type or delete text
**Then** I see real-time counts in status bar:

- "342 characters"
- "67 words"

**And** if <200 words, shows warning: "Upwork recommends 200-500 words"
**And** if >600 words, shows warning: "Long proposals may not be fully read"

## Technical Notes

- Real-time calculation (no debounce needed for counts)
- Based on Upwork best practices

## Domain Context: Upwork Proposal Length Best Practices

From research artifacts:
- **Optimal proposal length:** 150-300 words (domain research)
- **Upwork recommendation:** 200-500 words (UX spec)
- **Warning threshold:** >600 words considered too long
- **Minimum viable:** 200+ words for Golden Set calibration (Story 5-3)

Clients scanning proposals appreciate conciseness. Wall-of-text proposals (500+ words with no formatting) are anti-patterns identified in domain research.

## Dependencies

### Depends On
- **Story 6-1: TipTap Editor Integration** — provides the editor component where counts will be displayed

### Depended On By
- None directly (quality-of-life feature)

## Architecture Context

### Real-Time Calculation Strategy

Character and word counts must update on every keystroke with zero perceptible lag. Since TipTap/ProseMirror already tracks document state, we extract text content and calculate counts synchronously — no debouncing needed for display (unlike auto-save which needs debouncing for DB writes).

### Word Counting Algorithm

```typescript
function countWords(text: string): number {
  // Trim and split on whitespace, filter empty strings
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}
```

Edge cases:
- Empty editor: 0 words, 0 characters
- Whitespace only: 0 words, N characters (count spaces)
- Rich text (bold/italic): Count underlying text, not formatting markers

### Status Bar Placement

The status bar should appear below the TipTap editor, showing:
```
┌─────────────────────────────────────────────────────────────┐
│ [TipTap Editor Content Area]                                │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 342 characters · 67 words     ⚠️ Upwork recommends 200-500  │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Tasks

### Task 1: Create EditorStatusBar Component
- [x] Create `upwork-researcher/src/components/EditorStatusBar.tsx`
- [x] Create `upwork-researcher/src/components/EditorStatusBar.css`
- [x] Display character count: "{N} characters"
- [x] Display word count: "{N} words"
- [x] Add separator between counts (· or |)
- [x] Position below editor content area

### Task 2: Implement Count Logic
- [x] Create `upwork-researcher/src/utils/textStats.ts`
- [x] Implement `countCharacters(text: string): number`
- [x] Implement `countWords(text: string): number`
- [x] Handle edge cases (empty, whitespace-only, rich text)
- [x] Export utility functions for testing

### Task 3: Add Warning Messages
- [x] If wordCount < 200: Show warning "Upwork recommends 200-500 words"
- [x] If wordCount > 600: Show warning "Long proposals may not be fully read"
- [x] If 200 <= wordCount <= 600: No warning (ideal range)
- [x] Style warnings with appropriate color (yellow/amber for caution)
- [x] Add warning icon (⚠️) for visual prominence

### Task 4: Integrate with TipTap Editor
- [x] Pass editor content to EditorStatusBar component
- [x] Subscribe to editor content changes (onUpdate callback)
- [x] Extract plain text from ProseMirror document
- [x] Update counts on every change (no debounce)

### Task 5: Style for Dark Mode
- [x] Status bar background slightly different from editor
- [x] Text colors readable in dark mode
- [x] Warning colors accessible (sufficient contrast)
- [x] Subtle border/divider between editor and status bar

### Task 6: Write Tests
- [x] Unit tests for `countCharacters()` utility
- [x] Unit tests for `countWords()` utility
- [x] Unit tests for edge cases (empty, whitespace, special chars)
- [x] Component tests for EditorStatusBar
  - Displays correct counts
  - Shows warning when wordCount < 200
  - Shows warning when wordCount > 600
  - No warning when in ideal range
- [x] Integration test: counts update as user types

### Task 7: Accessibility
- [x] ARIA live region for count updates (polite, not assertive)
- [x] Screen reader announces warnings
- [x] Status bar has proper semantic role
- [x] Color is not the only indicator for warnings (also text + icon)

### Review Follow-ups (AI) - RESOLVED
- [x] [AI-Review][MEDIUM] Fix test count in story: corrected to 32 (13+17+2)
- [x] [AI-Review][MEDIUM] Add missing test for wordCount=0 warning case [EditorStatusBar.test.tsx:22-25]
- [x] [AI-Review][MEDIUM] Added CSS variables for theme consistency [EditorStatusBar.css]
- [x] [AI-Review][LOW] Fixed internal story inconsistency

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/EditorStatusBar.tsx` | Status bar displaying counts and warnings |
| `src/components/EditorStatusBar.css` | Status bar styling |
| `src/utils/textStats.ts` | Word/character counting utilities |
| `src/components/EditorStatusBar.test.tsx` | Component tests |
| `src/utils/textStats.test.ts` | Utility function tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ProposalEditor.tsx` | Add EditorStatusBar below editor |
| `src/components/ProposalEditor.css` | Layout adjustments for status bar |

## Component Implementation

### EditorStatusBar.tsx

```tsx
import "./EditorStatusBar.css";

interface EditorStatusBarProps {
  characterCount: number;
  wordCount: number;
}

const WARNING_LOW = 200;
const WARNING_HIGH = 600;

export function EditorStatusBar({ characterCount, wordCount }: EditorStatusBarProps) {
  const getWarning = (): string | null => {
    if (wordCount < WARNING_LOW) {
      return "Upwork recommends 200-500 words";
    }
    if (wordCount > WARNING_HIGH) {
      return "Long proposals may not be fully read";
    }
    return null;
  };

  const warning = getWarning();

  return (
    <div className="editor-status-bar" role="status" aria-live="polite">
      <span className="status-counts">
        <span className="count-item">{characterCount} characters</span>
        <span className="count-separator" aria-hidden="true">·</span>
        <span className="count-item">{wordCount} words</span>
      </span>
      {warning && (
        <span className="status-warning" role="alert">
          <span className="warning-icon" aria-hidden="true">⚠️</span>
          {warning}
        </span>
      )}
    </div>
  );
}
```

### textStats.ts

```typescript
/**
 * Count characters in text (including spaces)
 */
export function countCharacters(text: string): number {
  return text.length;
}

/**
 * Count words in text
 * - Splits on whitespace
 * - Filters empty strings
 * - Handles edge cases (empty, whitespace-only)
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Get plain text from TipTap/ProseMirror editor
 */
export function getEditorText(editor: Editor): string {
  return editor.getText();
}
```

### Integration with ProposalEditor

```tsx
// In ProposalEditor.tsx

import { EditorStatusBar } from "./EditorStatusBar";
import { countCharacters, countWords } from "../utils/textStats";

export function ProposalEditor({ initialContent, onContentChange }) {
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setCharCount(countCharacters(text));
      setWordCount(countWords(text));
      onContentChange?.(editor.getHTML());
    },
  });

  return (
    <div className="proposal-editor-container">
      <EditorContent editor={editor} />
      <EditorStatusBar characterCount={charCount} wordCount={wordCount} />
    </div>
  );
}
```

## CSS Styling

```css
/* EditorStatusBar.css */

.editor-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--surface-secondary, #1a1a1a);
  border-top: 1px solid var(--border-color, #333);
  font-size: 0.875rem;
  color: var(--text-secondary, #888);
}

.status-counts {
  display: flex;
  gap: 8px;
  align-items: center;
}

.count-separator {
  color: var(--text-tertiary, #555);
}

.status-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--warning-color, #f59e0b);
  font-weight: 500;
}

.warning-icon {
  font-size: 1rem;
}

/* Ideal range - subtle green indicator */
.editor-status-bar--ideal .status-counts {
  color: var(--success-color, #22c55e);
}
```

## Testing Requirements

### Unit Tests (textStats.test.ts)

```typescript
import { countCharacters, countWords } from "./textStats";

describe("countCharacters", () => {
  it("counts characters including spaces", () => {
    expect(countCharacters("hello world")).toBe(11);
  });

  it("returns 0 for empty string", () => {
    expect(countCharacters("")).toBe(0);
  });

  it("counts whitespace-only strings", () => {
    expect(countCharacters("   ")).toBe(3);
  });
});

describe("countWords", () => {
  it("counts words separated by spaces", () => {
    expect(countWords("hello world")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace-only string", () => {
    expect(countWords("   ")).toBe(0);
  });

  it("handles multiple spaces between words", () => {
    expect(countWords("hello    world")).toBe(2);
  });

  it("handles newlines and tabs", () => {
    expect(countWords("hello\nworld\there")).toBe(3);
  });

  it("handles leading/trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });
});
```

### Component Tests (EditorStatusBar.test.tsx)

```typescript
import { render, screen } from "@testing-library/react";
import { EditorStatusBar } from "./EditorStatusBar";

describe("EditorStatusBar", () => {
  it("displays character count", () => {
    render(<EditorStatusBar characterCount={342} wordCount={67} />);
    expect(screen.getByText("342 characters")).toBeInTheDocument();
  });

  it("displays word count", () => {
    render(<EditorStatusBar characterCount={342} wordCount={67} />);
    expect(screen.getByText("67 words")).toBeInTheDocument();
  });

  it("shows warning when under 200 words", () => {
    render(<EditorStatusBar characterCount={500} wordCount={100} />);
    expect(screen.getByText("Upwork recommends 200-500 words")).toBeInTheDocument();
  });

  it("shows warning when over 600 words", () => {
    render(<EditorStatusBar characterCount={3500} wordCount={650} />);
    expect(screen.getByText("Long proposals may not be fully read")).toBeInTheDocument();
  });

  it("shows no warning in ideal range", () => {
    render(<EditorStatusBar characterCount={1500} wordCount={300} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has accessible role for screen readers", () => {
    render(<EditorStatusBar characterCount={342} wordCount={67} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
```

## Definition of Done

1. Character count displays and updates in real-time as user types
2. Word count displays and updates in real-time as user types
3. Warning shows when wordCount < 200
4. Warning shows when wordCount > 600
5. No warning when 200 <= wordCount <= 600
6. Status bar styled consistently with dark mode theme
7. Warning has both icon and text (not color alone)
8. Screen reader announces count updates (aria-live)
9. All unit tests passing (textStats utilities)
10. All component tests passing (EditorStatusBar)
11. Counts display correctly for edge cases (empty, whitespace)

## Performance Considerations

- **No debouncing:** Counts are calculated synchronously on every keystroke
- **Efficient text extraction:** Use `editor.getText()` which is O(n) where n = document size
- **Lightweight component:** EditorStatusBar is a pure presentational component
- **Typical proposal size:** 200-500 words = ~1500-3000 characters = negligible computation

For proposals of typical length, counting is sub-millisecond and won't impact typing latency.

## Out of Scope (Future Stories)

- Reading time estimate (e.g., "~2 min read")
- Sentence count
- Paragraph count
- Readability score (Flesch-Kincaid)
- Target word count goal from user settings

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Rich text formatting markers counted | Use `editor.getText()` which extracts plain text only |
| Very long proposals slow down counting | Unlikely at proposal lengths; if needed, add requestAnimationFrame batching |
| Warning colors inaccessible | Use icon + text, ensure WCAG contrast ratio |
| Status bar layout breaks on narrow screens | Use flexbox wrap, test at 320px minimum |

## UI States

| Word Count | Character Count | Warning | Status Bar State |
|------------|-----------------|---------|------------------|
| 0 | 0 | "Upwork recommends..." | Empty, warning visible |
| 1-199 | varies | "Upwork recommends..." | Under minimum, warning visible |
| 200-600 | varies | None | Ideal range, no warning |
| 601+ | varies | "Long proposals..." | Over maximum, warning visible |

## References

- [Story 6-1: TipTap Editor Integration](6-1-tiptap-editor-integration.story.md) — parent editor component
- [Domain Research: Upwork Proposal Strategies](../planning-artifacts/research/domain-upwork-proposal-strategies-research-2026-01-29.md) — optimal length 150-250 words
- [UX Specification: Character Count](../planning-artifacts/ux-design-specification.md) — character count mentioned for job input

## Dev Agent Record

### Implementation Plan

**Date:** 2026-02-10

**Approach:**
- Followed TDD: RED → GREEN → REFACTOR cycle
- Created textStats utilities first (simpler, no dependencies)
- Created EditorStatusBar component second (depends on textStats)
- Integrated with ProposalEditor last (depends on both)

**Architecture Decisions:**
1. Used editor.getText() for plain text extraction (strips formatting)
2. Real-time calculation via editor "update" event (no debouncing needed)
3. Counts stored in local state, updated synchronously
4. Warning thresholds: <200 (low) and >600 (high)
5. Status bar positioned between editor content and save status

### Completion Notes

**Date:** 2026-02-10

**Implementation Summary:**
- ✅ Created EditorStatusBar.tsx with character/word counts and warnings
- ✅ Created EditorStatusBar.css with dark mode support
- ✅ Created textStats.ts with countCharacters() and countWords() utilities
- ✅ Integrated EditorStatusBar into ProposalEditor component
- ✅ Added real-time count updates via TipTap editor events
- ✅ Full accessibility: aria-live, role="status", role="alert", icon+text warnings
- ✅ All 32 tests passing (13 textStats + 17 EditorStatusBar + 2 integration)

**Tests Created:**
1. `textStats.test.ts` - 13 tests for character/word counting utilities
2. `EditorStatusBar.test.tsx` - 17 tests for component rendering and warnings
3. `ProposalEditor.test.tsx` - Updated mock + 2 integration tests

**Acceptance Criteria Validation:**
- ✅ AC-1: Displays "{N} characters" and "{N} words" in real-time
- ✅ AC-2: Shows warning when <200 words: "Upwork recommends 200-500 words"
- ✅ AC-3: Shows warning when >600 words: "Long proposals may not be fully read"
- ✅ AC-4: No warning when 200-600 words (ideal range)
- ✅ AC-5: Dark mode styling with accessible colors
- ✅ AC-6: Accessibility (aria-live, role="status", icon+text)

**Performance:**
- Count calculation is O(n) where n = text length
- Typical proposal (200-500 words) = sub-millisecond calculation
- No perceptible lag on keystroke
