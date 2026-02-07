---
status: ready-for-dev
epic: 8
story: 2
assignedTo: ""
tasksCompleted: 0
totalTasks: 8
testsWritten: false
codeReviewCompleted: false
fileList: []
dependencies:
  - 3-9-core-keyboard-shortcuts
  - 8-1-dark-theme-system
relates_to:
  - 8-3-screen-reader-support
  - 8-11-accessibility-audit
---

# Story 8.2: Complete Keyboard Navigation

## Story

As a freelancer (keyboard power user),
I want to navigate the entire app with keyboard only,
So that I never have to use my mouse.

## Acceptance Criteria

### AC1: Logical Tab Order

**Given** I'm using the app with keyboard only
**When** I press Tab repeatedly
**Then** focus moves through all interactive elements in logical order:

1. Skip to main content link (visible on focus)
2. Navigation tabs (Generate, History, Settings)
3. Tab content area:
   - Generate tab: Job input → Generate button → Proposal output → Copy button
   - History tab: Proposal list items
   - Settings tab: Form controls in order
4. Any active modal buttons

**And** no elements are skipped or unreachable by keyboard
**And** hidden/invisible elements do not receive focus

### AC2: Reverse Tab Navigation

**Given** I'm navigating with keyboard
**When** I press Shift+Tab
**Then** focus moves backwards through elements in reverse order
**And** focus wraps from first element to last when at beginning

### AC3: Focus Indicators

**Given** any interactive element receives keyboard focus
**When** focus is visible
**Then** the focus indicator is clearly visible:
- Outline: 2px solid using `--color-focus-ring` (cyan #24c8db)
- Offset: 2px from element edge
- Contrast: minimum 3:1 against adjacent colors

**And** focus indicators use `:focus-visible` (not `:focus`) to avoid showing on mouse click
**And** all buttons, inputs, links, and custom controls have focus styles

### AC4: Enter Key Activation

**Given** a button or link has keyboard focus
**When** I press Enter
**Then** the element is activated (same as mouse click)
**And** Space key also activates buttons (native behavior)

### AC5: Escape Key Behavior

**Given** a modal or dialog is open
**When** I press Escape
**Then** the modal closes
**And** focus returns to the element that triggered the modal

**Given** a dropdown or popover is open
**When** I press Escape
**Then** the dropdown closes
**And** focus returns to the trigger button

### AC6: Focus Trap in Modals

**Given** a modal dialog is open (SafetyWarningModal, OverrideConfirmDialog, EncryptionDetailsModal, etc.)
**When** I press Tab repeatedly
**Then** focus cycles within the modal only (does not escape to background)
**And** Shift+Tab cycles focus backwards within the modal
**And** first focusable element receives focus on modal open
**And** focus returns to trigger element on modal close

### AC7: Skip Link

**Given** I start keyboard navigation from the top of the page
**When** I press Tab once
**Then** a "Skip to main content" link appears (visible on focus only)
**And** pressing Enter on it moves focus to the main content area
**And** the link is hidden when not focused

### AC8: Arrow Key Navigation in Lists

**Given** I'm focused on a list item in History view
**When** I press Arrow Down
**Then** focus moves to the next item
**When** I press Arrow Up
**Then** focus moves to the previous item
**And** Home/End keys move to first/last item

## Technical Notes

- Builds on Story 3.9 core shortcuts (already implements Tab/Shift+Tab basics, focus-visible)
- Full keyboard navigation per NFR-20: WCAG AA compliance
- Focus trap in modals (Tab stays within modal, Esc to close)
- Uses existing design tokens from Story 8-1 for focus ring colors

## Tasks / Subtasks

- [ ] Task 1: Create FocusTrap utility hook (AC6)
  - [ ] 1.1: Create `src/hooks/useFocusTrap.ts` hook
  - [ ] 1.2: Accept `containerRef` parameter for the modal container
  - [ ] 1.3: Query all focusable elements within container on mount
  - [ ] 1.4: Handle Tab key: move to next focusable, wrap to first at end
  - [ ] 1.5: Handle Shift+Tab: move to previous, wrap to last at beginning
  - [ ] 1.6: Track and return focus to trigger element on unmount
  - [ ] 1.7: Auto-focus first focusable element on mount
  - [ ] 1.8: Export `FOCUSABLE_SELECTOR` constant for reuse

- [ ] Task 2: Apply focus trap to all modals (AC6)
  - [ ] 2.1: Add useFocusTrap to SafetyWarningModal
  - [ ] 2.2: Add useFocusTrap to OverrideConfirmDialog
  - [ ] 2.3: Add useFocusTrap to EncryptionDetailsModal
  - [ ] 2.4: Add useFocusTrap to DeleteConfirmDialog
  - [ ] 2.5: Add useFocusTrap to DraftRecoveryModal
  - [ ] 2.6: Add useFocusTrap to OnboardingWizard
  - [ ] 2.7: Verify focus returns to trigger on close for all modals

- [ ] Task 3: Implement Skip Link component (AC7)
  - [ ] 3.1: Create `src/components/SkipLink.tsx` component
  - [ ] 3.2: Create `src/components/SkipLink.css` styles
  - [ ] 3.3: Position off-screen by default, visible on focus
  - [ ] 3.4: Target `#main-content` landmark
  - [ ] 3.5: Add `id="main-content"` to main content container in App.tsx
  - [ ] 3.6: Add `tabindex="-1"` to main content for programmatic focus
  - [ ] 3.7: Render SkipLink as first focusable element in App.tsx

- [ ] Task 4: Audit and fix tab order (AC1, AC2)
  - [ ] 4.1: Create tab order audit checklist for each view
  - [ ] 4.2: Verify Generate tab order: input → button → output → copy
  - [ ] 4.3: Verify History tab order: list items in DOM order
  - [ ] 4.4: Verify Settings tab order: form controls top-to-bottom
  - [ ] 4.5: Remove any positive `tabindex` values (use 0 or -1 only)
  - [ ] 4.6: Ensure hidden elements have `tabindex="-1"` or `display:none`
  - [ ] 4.7: Fix any tab order issues found in audit

- [ ] Task 5: Enhance focus indicator styles (AC3)
  - [ ] 5.1: Audit all interactive elements for focus-visible styles
  - [ ] 5.2: Update buttons to use `--color-focus-ring` token
  - [ ] 5.3: Update inputs to use `--color-focus-ring` token
  - [ ] 5.4: Update nav tabs to use `--color-focus-ring` token
  - [ ] 5.5: Update list items to use `--color-focus-ring` token
  - [ ] 5.6: Ensure 2px outline with 2px offset on all focusable elements
  - [ ] 5.7: Verify 3:1 contrast ratio for focus indicators

- [ ] Task 6: Implement arrow key navigation for lists (AC8)
  - [ ] 6.1: Create `src/hooks/useArrowKeyNavigation.ts` hook
  - [ ] 6.2: Handle ArrowUp/ArrowDown to move between items
  - [ ] 6.3: Handle Home/End keys for first/last item
  - [ ] 6.4: Apply to History list in App.tsx
  - [ ] 6.5: Use `role="listbox"` and `role="option"` for accessibility
  - [ ] 6.6: Manage `aria-activedescendant` for screen readers

- [ ] Task 7: Focus management on view changes (AC1, AC5)
  - [ ] 7.1: When switching tabs, move focus to first focusable in new view
  - [ ] 7.2: When closing modal, return focus to trigger element
  - [ ] 7.3: When generation completes, move focus to proposal output
  - [ ] 7.4: Store trigger element ref before opening modals
  - [ ] 7.5: Restore focus on modal close using stored ref

- [ ] Task 8: Write comprehensive tests (AC1-AC8)
  - [ ] 8.1: Test: Tab moves through elements in correct order
  - [ ] 8.2: Test: Shift+Tab moves backwards
  - [ ] 8.3: Test: Focus indicators visible on keyboard focus
  - [ ] 8.4: Test: Enter activates focused button
  - [ ] 8.5: Test: Escape closes modal and returns focus
  - [ ] 8.6: Test: Focus trap keeps Tab within modal
  - [ ] 8.7: Test: Skip link visible on focus, navigates to main
  - [ ] 8.8: Test: Arrow keys navigate list items
  - [ ] 8.9: Test: No focusable elements skipped in tab order

## Dev Notes

### Architecture Context

**NFR-20: WCAG AA Compliance**
- All interactive elements must be keyboard accessible
- Focus indicators must be visible (3:1 contrast minimum)
- Tab order must follow logical visual order
- Focus trapping required in modal dialogs

**Story 3-9 Foundation**
- Already implements: Tab/Shift+Tab navigation, `:focus-visible` styles
- Already implements: Escape key handlers on modals
- This story adds: focus trapping, skip link, arrow navigation, comprehensive audit

**UX-3: Keyboard Shortcuts for Power Users**
- Late-night proposal grinding context
- Users want speed without mouse hunting
- Every interactive element must be keyboard reachable

### FocusTrap Hook Implementation

```typescript
// src/hooks/useFocusTrap.ts

import { useEffect, useRef, useCallback } from 'react';

/** Selector for all focusable elements */
export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseFocusTrapOptions {
  /** Element that triggered the modal (to return focus on close) */
  triggerRef?: React.RefObject<HTMLElement>;
  /** Auto-focus first element on mount (default: true) */
  autoFocus?: boolean;
}

/**
 * Traps focus within a container element.
 * Used for modal dialogs to meet WCAG 2.1 SC 2.4.3.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  options: UseFocusTrapOptions = {}
) {
  const { triggerRef, autoFocus = true } = options;
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
  }, []);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(el => el.offsetParent !== null); // Filter out hidden elements
  }, [containerRef]);

  // Handle Tab key to trap focus
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, getFocusableElements]);

  // Auto-focus first element on mount
  useEffect(() => {
    if (!autoFocus) return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        focusableElements[0].focus();
      });
    }
  }, [autoFocus, getFocusableElements]);

  // Return focus to trigger element on unmount
  useEffect(() => {
    return () => {
      const elementToFocus = triggerRef?.current || previousActiveElement.current;
      if (elementToFocus && document.body.contains(elementToFocus)) {
        elementToFocus.focus();
      }
    };
  }, [triggerRef]);

  return { getFocusableElements };
}
```

### SkipLink Component

```typescript
// src/components/SkipLink.tsx

import './SkipLink.css';

interface SkipLinkProps {
  targetId?: string;
  children?: React.ReactNode;
}

/**
 * Skip to main content link for keyboard navigation.
 * Visible only when focused, allows users to bypass navigation.
 * WCAG 2.1 SC 2.4.1 Bypass Blocks.
 */
export function SkipLink({
  targetId = 'main-content',
  children = 'Skip to main content',
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.tabIndex = -1;
      target.focus();
      // Remove tabindex after focus to prevent future tab stops
      target.addEventListener('blur', () => {
        target.removeAttribute('tabindex');
      }, { once: true });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
```

```css
/* src/components/SkipLink.css */

.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-primary-text);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  border-radius: var(--radius-md);
  z-index: var(--z-tooltip);
  transition: top var(--transition-fast);
}

.skip-link:focus {
  top: var(--spacing-sm);
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

### Arrow Key Navigation Hook

```typescript
// src/hooks/useArrowKeyNavigation.ts

import { useCallback } from 'react';

interface UseArrowKeyNavigationOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Current focused item index */
  currentIndex: number;
  /** Callback when index changes */
  onIndexChange: (index: number) => void;
  /** Enable horizontal navigation (Left/Right instead of Up/Down) */
  horizontal?: boolean;
  /** Enable wrapping (first to last, last to first) */
  wrap?: boolean;
}

/**
 * Handles arrow key navigation for list components.
 * Implements roving tabindex pattern for WCAG compliance.
 */
export function useArrowKeyNavigation({
  itemCount,
  currentIndex,
  onIndexChange,
  horizontal = false,
  wrap = true,
}: UseArrowKeyNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
      const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';

      switch (e.key) {
        case prevKey:
          e.preventDefault();
          if (currentIndex > 0) {
            onIndexChange(currentIndex - 1);
          } else if (wrap) {
            onIndexChange(itemCount - 1);
          }
          break;

        case nextKey:
          e.preventDefault();
          if (currentIndex < itemCount - 1) {
            onIndexChange(currentIndex + 1);
          } else if (wrap) {
            onIndexChange(0);
          }
          break;

        case 'Home':
          e.preventDefault();
          onIndexChange(0);
          break;

        case 'End':
          e.preventDefault();
          onIndexChange(itemCount - 1);
          break;
      }
    },
    [currentIndex, itemCount, onIndexChange, horizontal, wrap]
  );

  return { handleKeyDown };
}
```

### Applying Focus Trap to Modal

```tsx
// Example: SafetyWarningModal with focus trap

import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SafetyWarningModalProps {
  onClose: () => void;
  onOverride: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
}

function SafetyWarningModal({ onClose, onOverride, triggerRef }: SafetyWarningModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap with trigger element tracking
  useFocusTrap(modalRef, { triggerRef });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div ref={modalRef} className="modal-content">
        {/* Modal content */}
        <button onClick={onClose}>Cancel</button>
        <button onClick={onOverride}>Override</button>
      </div>
    </div>
  );
}
```

### Focus Management Pattern

```typescript
// Pattern for storing trigger and returning focus

// In the component that opens a modal:
const openButtonRef = useRef<HTMLButtonElement>(null);
const [isModalOpen, setIsModalOpen] = useState(false);

const handleOpenModal = () => {
  setIsModalOpen(true);
};

// Pass triggerRef to modal:
{isModalOpen && (
  <Modal
    onClose={() => setIsModalOpen(false)}
    triggerRef={openButtonRef}
  />
)}

// Render the button with ref:
<button ref={openButtonRef} onClick={handleOpenModal}>
  Open Modal
</button>
```

### Tab Order Audit Checklist

**Generate Tab (default view):**
1. Skip link (appears on first Tab)
2. Navigation: Generate tab
3. Navigation: History tab
4. Navigation: Settings tab
5. Job input textarea
6. Generate button
7. Proposal output (if visible) - container is focusable when has content
8. Copy button (if visible)
9. Rehumanize button (if visible)

**History Tab:**
1. Skip link
2. Navigation tabs
3. Proposal list items (arrow key navigation within list)

**Settings Tab:**
1. Skip link
2. Navigation tabs
3. Each form control in top-to-bottom order

**Modal Dialogs (focus trapped):**
1. Modal content container
2. Interactive elements within modal
3. Close/Cancel button
4. Action buttons

### CSS Focus Styles (update existing)

```css
/* Focus styles using design tokens from Story 8-1 */

/* Global focus-visible reset */
*:focus {
  outline: none;
}

*:focus-visible {
  outline: var(--focus-ring-width, 2px) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset, 2px);
}

/* Buttons */
button:focus-visible,
.btn:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
  box-shadow: var(--shadow-focus);
}

/* Inputs */
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: none;
  border-color: var(--color-input-border-focus);
  box-shadow: var(--shadow-focus);
}

/* Navigation tabs */
.nav-tab:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}

/* List items */
.history-item:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}

/* Links */
a:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
  border-radius: var(--radius-sm);
}
```

### File Structure

```
upwork-researcher/
  src/
    hooks/
      useFocusTrap.ts                    # NEW: Focus trap for modals
      useFocusTrap.test.ts               # NEW: Focus trap tests
      useArrowKeyNavigation.ts           # NEW: Arrow key list navigation
      useArrowKeyNavigation.test.ts      # NEW: Arrow nav tests
    components/
      SkipLink.tsx                       # NEW: Skip to main content
      SkipLink.css                       # NEW: Skip link styles
      SkipLink.test.tsx                  # NEW: Skip link tests
      SafetyWarningModal.tsx             # MODIFY: Add focus trap
      OverrideConfirmDialog.tsx          # MODIFY: Add focus trap
      EncryptionDetailsModal.tsx         # MODIFY: Add focus trap
      DeleteConfirmDialog.tsx            # MODIFY: Add focus trap
      DraftRecoveryModal.tsx             # MODIFY: Add focus trap
      OnboardingWizard.tsx               # MODIFY: Add focus trap
    App.tsx                              # MODIFY: Add skip link, main-content id
    App.css                              # MODIFY: Update focus styles to use tokens
    styles/
      tokens.css                         # EXISTS: Focus ring tokens (from 8-1)
```

### Testing Requirements

**useFocusTrap Tests:**

1. `test_tab_moves_to_next_focusable()` — Tab moves forward through elements
2. `test_shift_tab_moves_to_previous()` — Shift+Tab moves backward
3. `test_tab_wraps_at_end()` — Tab from last element goes to first
4. `test_shift_tab_wraps_at_start()` — Shift+Tab from first goes to last
5. `test_auto_focuses_first_element()` — First element focused on mount
6. `test_returns_focus_on_unmount()` — Focus returns to trigger on close
7. `test_ignores_hidden_elements()` — Hidden elements not in trap

**useArrowKeyNavigation Tests:**

1. `test_arrow_down_moves_to_next()` — Down arrow increments index
2. `test_arrow_up_moves_to_previous()` — Up arrow decrements index
3. `test_home_moves_to_first()` — Home key sets index to 0
4. `test_end_moves_to_last()` — End key sets index to last
5. `test_wrapping_enabled()` — Down from last goes to first
6. `test_wrapping_disabled()` — Down from last stays at last

**SkipLink Tests:**

1. `test_visible_on_focus()` — Link becomes visible when focused
2. `test_hidden_when_not_focused()` — Link hidden by default
3. `test_navigates_to_main_content()` — Click moves focus to main

**Integration Tests:**

1. `test_tab_order_generate_view()` — Correct order on Generate tab
2. `test_tab_order_history_view()` — Correct order on History tab
3. `test_modal_traps_focus()` — Focus cannot escape modal
4. `test_escape_closes_modal_returns_focus()` — Escape behavior complete

### Cross-Story Dependencies

**Depends On:**
- **Story 3-9: Core Keyboard Shortcuts** — Base Tab/Shift+Tab, focus-visible, Escape handlers
- **Story 8-1: Dark Theme System** — Design tokens for focus ring colors

**Depended On By:**
- **Story 8-3: Screen Reader Support** — Uses semantic focus management
- **Story 8-11: Accessibility Audit** — Validates keyboard navigation

**Relates To:**
- **NFR-20: WCAG AA Compliance** — Keyboard accessibility requirement

### Performance Targets

- Focus trap initialization: <5ms
- Tab key handling: <1ms
- No visible delay in focus movement

### Scope Boundaries

**In Scope:**
- Focus trapping in all modals
- Skip to main content link
- Arrow key navigation in lists
- Complete tab order audit and fixes
- Focus return on modal close
- Focus indicator enhancements using tokens

**Out of Scope:**
- Screen reader announcements (Story 8-3)
- Full ARIA attribute audit (Story 8-3)
- Automated accessibility testing setup (Story 8-11)
- Custom focus indicators per component (uses global tokens)

### Definition of Done

- [ ] All tasks/subtasks marked complete
- [ ] useFocusTrap hook created and tested
- [ ] Focus trap applied to all 6 modals
- [ ] SkipLink component implemented
- [ ] Tab order verified on all views
- [ ] Focus indicators use design tokens
- [ ] Arrow key navigation works in lists
- [ ] Focus returns to trigger on modal close
- [ ] All tests passing (focus trap, arrow nav, skip link)
- [ ] No regressions in Story 3-9 keyboard functionality

## Change Log

- 2026-02-07: Story prepared for development by Scrum Master (Bob) — added full task breakdown, useFocusTrap hook implementation, SkipLink component, arrow key navigation hook, tab order audit checklist, CSS focus styles, file structure, testing requirements, and dependencies. Builds on Story 3-9 foundation.
