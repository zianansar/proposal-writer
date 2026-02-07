---
status: ready-for-dev
assignedTo: null
tasksCompleted: 0
testsWritten: 0
fileList: []
---

# Story 6.5: Formatting Shortcuts

## Story

As a freelancer,
I want keyboard shortcuts for common formatting,
So that I can edit quickly.

## Acceptance Criteria

**Given** I'm editing in TipTap
**When** I use keyboard shortcuts
**Then** the following work:

- Cmd/Ctrl + B: Bold
- Cmd/Ctrl + I: Italic
- Cmd/Ctrl + Z: Undo
- Cmd/Ctrl + Shift + Z: Redo

**And** shortcuts are shown in toolbar tooltips

## Technical Notes

- Standard rich text shortcuts
- ProseMirror handles keybindings natively

## Architecture Context

### TipTap/ProseMirror Native Shortcuts

TipTap's StarterKit extension includes ProseMirror's standard keybindings out of the box:

| Shortcut | Action | Extension |
|----------|--------|-----------|
| Cmd/Ctrl + B | Toggle Bold | `@tiptap/extension-bold` (in StarterKit) |
| Cmd/Ctrl + I | Toggle Italic | `@tiptap/extension-italic` (in StarterKit) |
| Cmd/Ctrl + Z | Undo | `@tiptap/extension-history` (in StarterKit) |
| Cmd/Ctrl + Shift + Z | Redo | `@tiptap/extension-history` (in StarterKit) |
| Cmd/Ctrl + Y | Redo (Windows alt) | `@tiptap/extension-history` (in StarterKit) |

**These shortcuts work automatically** when using StarterKit — no additional configuration needed.

### Distinction from Story 3-9 (Core Keyboard Shortcuts)

| Story | Scope | Shortcuts |
|-------|-------|-----------|
| **3-9** | App-level actions | Cmd+Enter (generate), Cmd+C (copy proposal), Tab navigation |
| **6-5** | Editor formatting | Cmd+B (bold), Cmd+I (italic), Cmd+Z (undo), Cmd+Shift+Z (redo) |

Story 6-5 shortcuts only apply when the TipTap editor has focus.

### Tooltip Implementation

Toolbar buttons should display tooltips with shortcut hints:
- "Bold (⌘B)" on macOS
- "Bold (Ctrl+B)" on Windows

Use platform detection to show correct modifier key.

## Dependencies

### Depends On
- **Story 6-1: TipTap Editor Integration** — provides the editor and toolbar where shortcuts apply

### Depended On By
- None directly (enhancement to editor UX)

## Implementation Tasks

### Task 1: Verify StarterKit Shortcuts Work
- [ ] Confirm TipTap StarterKit is installed (from Story 6-1)
- [ ] Test Cmd/Ctrl + B toggles bold
- [ ] Test Cmd/Ctrl + I toggles italic
- [ ] Test Cmd/Ctrl + Z performs undo
- [ ] Test Cmd/Ctrl + Shift + Z performs redo
- [ ] Test Cmd/Ctrl + Y performs redo (Windows alternative)
- [ ] Document any missing shortcuts that need custom configuration

### Task 2: Add Tooltips to Toolbar Buttons
- [ ] Update `EditorToolbar.tsx` (from Story 6-1) to include tooltips
- [ ] Create platform-aware shortcut display utility
- [ ] Add tooltip to Bold button: "Bold (⌘B)" / "Bold (Ctrl+B)"
- [ ] Add tooltip to Italic button: "Italic (⌘I)" / "Italic (Ctrl+I)"
- [ ] Add tooltip to Undo button: "Undo (⌘Z)" / "Undo (Ctrl+Z)"
- [ ] Add tooltip to Redo button: "Redo (⇧⌘Z)" / "Redo (Ctrl+Shift+Z)"

### Task 3: Create Platform Detection Utility
- [ ] Create `upwork-researcher/src/utils/platform.ts`
- [ ] Detect macOS vs Windows/Linux
- [ ] Export `isMac()` function
- [ ] Export `formatShortcut(key: string, modifiers: string[])` function
- [ ] Return "⌘" for Cmd on Mac, "Ctrl" for Windows

### Task 4: Implement Tooltip Component
- [ ] Create `upwork-researcher/src/components/Tooltip.tsx` (if not exists)
- [ ] Create `upwork-researcher/src/components/Tooltip.css`
- [ ] Show on hover after brief delay (300ms)
- [ ] Position above button by default
- [ ] Style consistently with dark mode theme

### Task 5: Add Additional Formatting Shortcuts (Optional)
- [ ] Cmd/Ctrl + U: Underline (if underline extension added)
- [ ] Cmd/Ctrl + Shift + S: Strikethrough
- [ ] Review TipTap extensions for other useful shortcuts

### Task 6: Write Tests
- [ ] Unit tests for platform detection utility
- [ ] Unit tests for shortcut formatting utility
- [ ] Component tests for tooltip display
- [ ] Integration test: keyboard shortcuts trigger formatting

### Task 7: Accessibility
- [ ] Tooltips have `role="tooltip"`
- [ ] Buttons have `aria-describedby` pointing to tooltip
- [ ] Tooltips accessible via keyboard focus (not just hover)
- [ ] Shortcut text readable by screen readers

## Files to Create

| File | Purpose |
|------|---------|
| `src/utils/platform.ts` | Platform detection and shortcut formatting |
| `src/components/Tooltip.tsx` | Reusable tooltip component |
| `src/components/Tooltip.css` | Tooltip styling |
| `src/utils/platform.test.ts` | Platform utility tests |
| `src/components/Tooltip.test.tsx` | Tooltip component tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/EditorToolbar.tsx` | Add tooltips to formatting buttons |
| `src/components/EditorToolbar.css` | Tooltip positioning styles |

## Platform Detection Utility

```typescript
// src/utils/platform.ts

/**
 * Detect if running on macOS
 */
export function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

/**
 * Get the modifier key symbol for the current platform
 */
export function getModifierKey(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

/**
 * Get the shift key symbol for the current platform
 */
export function getShiftKey(): string {
  return isMac() ? '⇧' : 'Shift';
}

/**
 * Format a keyboard shortcut for display
 * @param key - The key (e.g., 'B', 'I', 'Z')
 * @param modifiers - Array of modifiers ('cmd', 'shift', 'alt')
 * @returns Formatted shortcut string (e.g., '⌘B' or 'Ctrl+B')
 */
export function formatShortcut(key: string, modifiers: string[] = ['cmd']): string {
  const parts: string[] = [];

  if (modifiers.includes('shift')) {
    parts.push(isMac() ? '⇧' : 'Shift+');
  }
  if (modifiers.includes('alt')) {
    parts.push(isMac() ? '⌥' : 'Alt+');
  }
  if (modifiers.includes('cmd')) {
    parts.push(isMac() ? '⌘' : 'Ctrl+');
  }

  parts.push(key.toUpperCase());

  return parts.join('');
}

// Predefined shortcuts
export const SHORTCUTS = {
  BOLD: formatShortcut('B'),
  ITALIC: formatShortcut('I'),
  UNDO: formatShortcut('Z'),
  REDO: formatShortcut('Z', ['cmd', 'shift']),
};
```

## Tooltip Component

```tsx
// src/components/Tooltip.tsx

import { useState, useRef, ReactNode } from "react";
import "./Tooltip.css";

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({
  content,
  children,
  delay = 300,
  position = 'top'
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).substr(2, 9)}`);

  const showTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      <div aria-describedby={isVisible ? tooltipId.current : undefined}>
        {children}
      </div>
      {isVisible && (
        <div
          id={tooltipId.current}
          role="tooltip"
          className={`tooltip tooltip--${position}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
```

## Toolbar with Tooltips

```tsx
// EditorToolbar.tsx updates

import { Tooltip } from "./Tooltip";
import { SHORTCUTS } from "../utils/platform";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      <Tooltip content={`Bold (${SHORTCUTS.BOLD})`}>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
          aria-pressed={editor.isActive('bold')}
          aria-label="Bold"
        >
          <strong>B</strong>
        </button>
      </Tooltip>

      <Tooltip content={`Italic (${SHORTCUTS.ITALIC})`}>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
          aria-pressed={editor.isActive('italic')}
          aria-label="Italic"
        >
          <em>I</em>
        </button>
      </Tooltip>

      <div className="toolbar-separator" aria-hidden="true" />

      <Tooltip content={`Undo (${SHORTCUTS.UNDO})`}>
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo"
        >
          ↩
        </button>
      </Tooltip>

      <Tooltip content={`Redo (${SHORTCUTS.REDO})`}>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo"
        >
          ↪
        </button>
      </Tooltip>
    </div>
  );
}
```

## CSS Styling

```css
/* Tooltip.css */

.tooltip-wrapper {
  position: relative;
  display: inline-block;
}

.tooltip {
  position: absolute;
  z-index: 1000;
  padding: 6px 10px;
  background-color: var(--tooltip-bg, #333);
  color: var(--tooltip-text, #fff);
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.tooltip--top {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 6px;
}

.tooltip--bottom {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 6px;
}

/* Arrow */
.tooltip--top::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--tooltip-bg, #333);
}

.tooltip--bottom::after {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom-color: var(--tooltip-bg, #333);
}
```

## Testing Requirements

### Unit Tests (platform.test.ts)

```typescript
import { isMac, formatShortcut, SHORTCUTS } from "./platform";

describe("platform utilities", () => {
  describe("formatShortcut", () => {
    it("formats simple shortcut on Mac", () => {
      // Mock Mac platform
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
      expect(formatShortcut('B')).toBe('⌘B');
    });

    it("formats simple shortcut on Windows", () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
      expect(formatShortcut('B')).toBe('Ctrl+B');
    });

    it("formats shortcut with shift modifier", () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
      expect(formatShortcut('Z', ['cmd', 'shift'])).toBe('⇧⌘Z');
    });
  });

  describe("SHORTCUTS", () => {
    it("exports predefined shortcuts", () => {
      expect(SHORTCUTS.BOLD).toBeDefined();
      expect(SHORTCUTS.ITALIC).toBeDefined();
      expect(SHORTCUTS.UNDO).toBeDefined();
      expect(SHORTCUTS.REDO).toBeDefined();
    });
  });
});
```

### Component Tests (Tooltip.test.tsx)

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("shows tooltip on hover after delay", async () => {
    render(
      <Tooltip content="Bold (⌘B)">
        <button>B</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText("B"));

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Bold (⌘B)");
    }, { timeout: 500 });
  });

  it("hides tooltip on mouse leave", async () => {
    render(
      <Tooltip content="Bold (⌘B)" delay={0}>
        <button>B</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText("B"));
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    fireEvent.mouseLeave(screen.getByText("B"));
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("shows tooltip on focus for keyboard users", async () => {
    render(
      <Tooltip content="Bold (⌘B)" delay={0}>
        <button>B</button>
      </Tooltip>
    );

    fireEvent.focus(screen.getByText("B"));

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });

  it("has accessible role and id", async () => {
    render(
      <Tooltip content="Bold (⌘B)" delay={0}>
        <button>B</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText("B"));

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveAttribute("id");
    });
  });
});
```

### Integration Tests (EditorToolbar.test.tsx)

```typescript
describe("EditorToolbar shortcuts", () => {
  it("toggles bold with Cmd+B", () => {
    const editor = createTestEditor();
    render(<EditorToolbar editor={editor} />);

    // Simulate Cmd+B
    fireEvent.keyDown(document, { key: 'b', metaKey: true });

    expect(editor.isActive('bold')).toBe(true);
  });

  it("shows correct shortcut in tooltip on Mac", async () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    const editor = createTestEditor();
    render(<EditorToolbar editor={editor} />);

    fireEvent.mouseEnter(screen.getByLabelText("Bold"));

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Bold (⌘B)");
    });
  });

  it("shows correct shortcut in tooltip on Windows", async () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    const editor = createTestEditor();
    render(<EditorToolbar editor={editor} />);

    fireEvent.mouseEnter(screen.getByLabelText("Bold"));

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Bold (Ctrl+B)");
    });
  });
});
```

## Definition of Done

1. Cmd/Ctrl + B toggles bold formatting
2. Cmd/Ctrl + I toggles italic formatting
3. Cmd/Ctrl + Z performs undo
4. Cmd/Ctrl + Shift + Z performs redo
5. Cmd/Ctrl + Y performs redo (Windows alternative)
6. Bold button tooltip shows "Bold (⌘B)" on Mac, "Bold (Ctrl+B)" on Windows
7. Italic button tooltip shows "Italic (⌘I)" on Mac, "Italic (Ctrl+I)" on Windows
8. Undo button tooltip shows correct platform shortcut
9. Redo button tooltip shows correct platform shortcut
10. Tooltips appear after 300ms hover delay
11. Tooltips accessible via keyboard focus
12. All tests passing (platform utils, tooltip, integration)

## Out of Scope (Future Stories)

- Bullet list shortcut (Cmd+Shift+8)
- Numbered list shortcut (Cmd+Shift+7)
- Clear formatting shortcut
- Custom shortcut configuration
- Global shortcuts help modal (? key)
- Shortcut conflicts resolution

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| StarterKit shortcuts don't work | Verify during Task 1; add manual keybindings if needed |
| Platform detection unreliable | Use `navigator.platform` with fallback to `navigator.userAgent` |
| Tooltip positioning off-screen | Add boundary detection, flip position if needed |
| Shortcuts conflict with browser/OS | Standard formatting shortcuts are universally expected, low risk |

## TipTap Shortcut Reference

StarterKit includes these extensions with built-in shortcuts:

| Extension | Shortcuts |
|-----------|-----------|
| Bold | Cmd/Ctrl+B |
| Italic | Cmd/Ctrl+I |
| Strike | Cmd/Ctrl+Shift+S |
| Code | Cmd/Ctrl+E |
| History | Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y (redo) |
| BulletList | Cmd/Ctrl+Shift+8 |
| OrderedList | Cmd/Ctrl+Shift+7 |
| Blockquote | Cmd/Ctrl+Shift+B |
| HardBreak | Shift+Enter |

This story focuses on Bold, Italic, Undo, and Redo. Others can be exposed in future stories.

## References

- [Story 6-1: TipTap Editor Integration](6-1-tiptap-editor-integration.story.md) — provides editor and toolbar
- [Story 3-9: Core Keyboard Shortcuts](3-9-core-keyboard-shortcuts.story.md) — app-level shortcuts (distinct scope)
- [TipTap Keyboard Shortcuts](https://tiptap.dev/docs/editor/api/keyboard-shortcuts) — official documentation
- [UX Spec: Keyboard Shortcuts](../planning-artifacts/ux-design-specification.md) — power user workflow patterns
