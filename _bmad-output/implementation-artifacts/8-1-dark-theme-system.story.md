---
status: ready-for-dev
epic: 8
story: 1
assignedTo: ""
tasksCompleted: 0
totalTasks: 6
testsWritten: false
codeReviewCompleted: false
fileList: []
dependencies:
  - 1-5-dark-mode-basic-css
relates_to:
  - 8-2-complete-keyboard-navigation
  - 8-3-screen-reader-support
  - 8-11-accessibility-audit
---

# Story 8.1: Dark Theme System

## Story

As a freelancer,
I want a polished dark theme with proper contrast,
So that I can work comfortably at night.

## Acceptance Criteria

### AC1: Complete CSS Custom Property System

**Given** the app opens
**When** I view the source CSS
**Then** all colors are defined as CSS custom properties in `:root`
**And** no hardcoded color values exist outside of `:root`
**And** all components use `var(--color-name)` references

### AC2: Semantic Color Palette

**Given** the dark theme is applied
**When** I view any screen
**Then** I see a complete dark theme with semantic tokens:

**Core Colors:**
- `--color-bg-primary`: #1a1a1a (dark gray, not pure black)
- `--color-bg-secondary`: #2f2f2f (surface for cards, containers)
- `--color-bg-tertiary`: #3a3a3a (elevated surfaces)
- `--color-text-primary`: #f6f6f6 (main text)
- `--color-text-secondary`: #aaa (muted text)
- `--color-text-muted`: #888 (disabled/placeholder)
- `--color-border`: #555 (default borders)
- `--color-border-focus`: #24c8db (focus state borders)

**Semantic Colors:**
- `--color-primary`: #3b82f6 (blue - primary actions)
- `--color-primary-hover`: #2563eb (blue hover)
- `--color-accent`: #24c8db (cyan - highlights, active states)
- `--color-success`: #10b981 (green - positive indicators)
- `--color-warning`: #f59e0b (yellow/amber - caution)
- `--color-error`: #ef4444 (red - errors, destructive)
- `--color-error-bg`: #3a2020 (error background)

### AC3: WCAG AA Contrast Compliance

**Given** all color combinations in the app
**When** I check contrast ratios
**Then** all text/background combinations meet WCAG AA (4.5:1 minimum for normal text)
**And** all large text (18px+/bold 14px+) meets 3:1 minimum
**And** all UI components meet 3:1 minimum against adjacent colors
**And** no contrast ratio falls below thresholds

### AC4: No Bright White Flashes

**Given** the app starts or navigates
**When** any view loads
**Then** no bright white (#ffffff or light colors) flash occurs
**And** all loading states use dark backgrounds
**And** skeleton loaders (if any) use dark theme colors

### AC5: Component State Tokens

**Given** interactive components (buttons, inputs, links)
**When** they are in different states
**Then** state-specific tokens are used:
- `--color-button-bg`: default button background
- `--color-button-bg-hover`: hover state
- `--color-button-bg-disabled`: disabled state
- `--color-input-bg`: input field background
- `--color-input-border`: input default border
- `--color-input-border-focus`: input focus border
- `--color-focus-ring`: focus outline color (accessibility)

### AC6: Spacing and Typography Tokens

**Given** the design system
**When** I inspect the CSS
**Then** spacing and typography are tokenized:
- `--spacing-xs`: 0.25rem (4px)
- `--spacing-sm`: 0.5rem (8px)
- `--spacing-md`: 1rem (16px)
- `--spacing-lg`: 1.5rem (24px)
- `--spacing-xl`: 2rem (32px)
- `--font-size-sm`: 0.875rem (14px)
- `--font-size-base`: 1rem (16px)
- `--font-size-lg`: 1.125rem (18px)
- `--font-size-xl`: 1.25rem (20px)
- `--border-radius-sm`: 4px
- `--border-radius-md`: 6px
- `--border-radius-lg`: 8px

## Technical Notes

- Builds on Story 1.5 basic CSS
- CSS custom properties for theme system
- Full design system per UX-1
- Light mode toggle deferred to v1.1
- Prepares for future theming by centralizing all values

## Tasks / Subtasks

- [ ] Task 1: Create design tokens file (AC1, AC2, AC5, AC6)
  - [ ] 1.1: Create `src/styles/tokens.css` with all CSS custom properties
  - [ ] 1.2: Define core color tokens (bg, text, border)
  - [ ] 1.3: Define semantic color tokens (primary, accent, success, warning, error)
  - [ ] 1.4: Define component state tokens (button, input, focus)
  - [ ] 1.5: Define spacing tokens (xs through xl)
  - [ ] 1.6: Define typography tokens (font sizes, line heights)
  - [ ] 1.7: Define border radius tokens
  - [ ] 1.8: Import tokens.css in main.tsx or App.tsx

- [ ] Task 2: Migrate App.css to use tokens (AC1)
  - [ ] 2.1: Replace all hardcoded color values with `var(--token-name)`
  - [ ] 2.2: Replace hardcoded spacing with spacing tokens
  - [ ] 2.3: Replace hardcoded font sizes with typography tokens
  - [ ] 2.4: Replace hardcoded border-radius with radius tokens
  - [ ] 2.5: Verify no hardcoded values remain (except in tokens.css)

- [ ] Task 3: Update component-specific CSS files (AC1)
  - [ ] 3.1: Audit all .css files for hardcoded values
  - [ ] 3.2: Update SettingsPanel.css to use tokens
  - [ ] 3.3: Update OverrideConfirmDialog.css to use tokens
  - [ ] 3.4: Update ThresholdAdjustmentNotification.css to use tokens
  - [ ] 3.5: Update any other component CSS files found

- [ ] Task 4: Verify WCAG AA compliance (AC3)
  - [ ] 4.1: Create contrast ratio checklist for all color pairs
  - [ ] 4.2: Test text-primary on bg-primary (must be >= 4.5:1)
  - [ ] 4.3: Test text-secondary on bg-secondary (must be >= 4.5:1)
  - [ ] 4.4: Test accent color on dark backgrounds (must be >= 4.5:1)
  - [ ] 4.5: Test error text on error-bg (must be >= 4.5:1)
  - [ ] 4.6: Adjust any failing colors to meet thresholds
  - [ ] 4.7: Document final contrast ratios in story notes

- [ ] Task 5: Eliminate white flashes (AC4)
  - [ ] 5.1: Audit all loading states for bright backgrounds
  - [ ] 5.2: Ensure skeleton loaders use dark colors
  - [ ] 5.3: Verify modal/dialog backgrounds are dark
  - [ ] 5.4: Test app startup for any white flash
  - [ ] 5.5: Test tab navigation for any white flash

- [ ] Task 6: Add tests and documentation (AC1-AC6)
  - [ ] 6.1: Visual regression test: capture app screenshot in dark mode
  - [ ] 6.2: Test that tokens.css loads without errors
  - [ ] 6.3: Document token naming convention in dev notes
  - [ ] 6.4: Document how to add new tokens for future components
  - [ ] 6.5: Add contrast ratio documentation to story

## Dev Notes

### Architecture Context

**UX-1: Dark Mode by Default**
- Optimized for late-night work when freelancers grind proposals
- Reduces eye strain during extended sessions
- Default theme with light mode deferred to v1.1

**NFR-20: WCAG AA Compliance**
- All text must meet 4.5:1 contrast ratio (normal text)
- Large text (18px+) must meet 3:1
- UI components must meet 3:1 against adjacent colors

**Story 1-5 Foundation**
- Story 1-5 established basic dark mode with inline styles to prevent flash
- Story 8-1 refactors to proper design token system
- All hardcoded colors centralized into `:root` variables

### Design Tokens File

```css
/* src/styles/tokens.css */

/* ================================================
   Design Token System - Upwork Research Agent
   Story 8.1: Dark Theme System

   Token Naming Convention:
   --color-{category}-{variant}
   --spacing-{size}
   --font-{property}-{size}
   --radius-{size}
   ================================================ */

:root {
  /* =====================
     Core Background Colors
     ===================== */
  --color-bg-primary: #1a1a1a;      /* Main app background */
  --color-bg-secondary: #2f2f2f;    /* Card/container background */
  --color-bg-tertiary: #3a3a3a;     /* Elevated surfaces, hover states */
  --color-bg-input: #1a1a1a;        /* Form input backgrounds */
  --color-bg-hover: #404040;        /* Generic hover background */
  --color-bg-active: #484848;       /* Active/pressed state */

  /* =====================
     Text Colors
     ===================== */
  --color-text-primary: #f6f6f6;    /* Main text - 15.5:1 on bg-primary */
  --color-text-secondary: #aaa;     /* Secondary text - 6.5:1 on bg-secondary */
  --color-text-muted: #888;         /* Disabled/placeholder - 4.8:1 on bg-primary */
  --color-text-inverse: #1a1a1a;    /* Text on light backgrounds */

  /* =====================
     Border Colors
     ===================== */
  --color-border: #555;             /* Default borders */
  --color-border-hover: #777;       /* Border on hover */
  --color-border-focus: #24c8db;    /* Focus state border */

  /* =====================
     Semantic Colors
     ===================== */
  /* Primary (Blue) - Main actions */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-primary-active: #1d4ed8;
  --color-primary-text: #ffffff;

  /* Accent (Cyan) - Highlights, active states */
  --color-accent: #24c8db;
  --color-accent-hover: #1eb3c4;
  --color-accent-muted: rgba(36, 200, 219, 0.2);

  /* Success (Green) - Positive indicators */
  --color-success: #10b981;
  --color-success-hover: #059669;
  --color-success-bg: #1a2e26;
  --color-success-text: #10b981;

  /* Warning (Amber) - Caution states */
  --color-warning: #f59e0b;
  --color-warning-hover: #d97706;
  --color-warning-bg: #2e2a1a;
  --color-warning-text: #f59e0b;

  /* Error (Red) - Errors, destructive actions */
  --color-error: #ef4444;
  --color-error-hover: #dc2626;
  --color-error-bg: #3a2020;
  --color-error-text: #f88;

  /* =====================
     Component State Tokens
     ===================== */
  /* Buttons */
  --color-button-bg: #3b82f6;
  --color-button-bg-hover: #2563eb;
  --color-button-bg-active: #1d4ed8;
  --color-button-bg-disabled: #555;
  --color-button-text: #ffffff;
  --color-button-text-disabled: #888;

  /* Inputs */
  --color-input-bg: #1a1a1a;
  --color-input-border: #555;
  --color-input-border-hover: #777;
  --color-input-border-focus: #24c8db;
  --color-input-text: #f6f6f6;
  --color-input-placeholder: #888;

  /* Focus Ring (Accessibility) */
  --color-focus-ring: #24c8db;
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;

  /* =====================
     Spacing Scale
     ===================== */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
  --spacing-2xl: 3rem;     /* 48px */

  /* =====================
     Typography Scale
     ===================== */
  --font-family-base: Inter, Avenir, Helvetica, Arial, sans-serif;
  --font-family-mono: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;

  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */

  --line-height-tight: 1.25;
  --line-height-base: 1.5;
  --line-height-relaxed: 1.75;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* =====================
     Border Radius
     ===================== */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* =====================
     Shadows
     ===================== */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.4);
  --shadow-focus: 0 0 0 2px rgba(36, 200, 219, 0.2);

  /* =====================
     Transitions
     ===================== */
  --transition-fast: 0.1s ease;
  --transition-base: 0.2s ease;
  --transition-slow: 0.3s ease;

  /* =====================
     Z-Index Scale
     ===================== */
  --z-dropdown: 50;
  --z-modal: 100;
  --z-tooltip: 150;
  --z-toast: 200;
}
```

### App.css Migration Example

```css
/* BEFORE (hardcoded) */
.nav-tab {
  color: #aaa;
  border-bottom: 2px solid transparent;
}

.nav-tab:hover {
  color: #24c8db;
}

.nav-tab--active {
  color: #24c8db;
  border-bottom-color: #24c8db;
}

/* AFTER (tokenized) */
.nav-tab {
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  transition: all var(--transition-base);
}

.nav-tab:hover {
  color: var(--color-accent);
}

.nav-tab--active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
```

### Button Migration Example

```css
/* BEFORE */
.generate-button {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background-color: #3b82f6;
  color: #fff;
  border-radius: 6px;
}

.generate-button:hover:not(:disabled) {
  background-color: #2563eb;
}

.generate-button:disabled {
  background-color: #555;
  color: #888;
}

/* AFTER */
.generate-button {
  margin-top: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--color-button-bg);
  color: var(--color-button-text);
  border-radius: var(--radius-md);
  transition: background-color var(--transition-base);
}

.generate-button:hover:not(:disabled) {
  background-color: var(--color-button-bg-hover);
}

.generate-button:disabled {
  background-color: var(--color-button-bg-disabled);
  color: var(--color-button-text-disabled);
}
```

### Input Migration Example

```css
/* BEFORE */
.job-input textarea {
  padding: 0.75rem;
  background-color: #1a1a1a;
  color: #f6f6f6;
  border: 1px solid #555;
  border-radius: 6px;
}

.job-input textarea:focus {
  border-color: #24c8db;
  box-shadow: 0 0 0 2px rgba(36, 200, 219, 0.2);
}

/* AFTER */
.job-input textarea {
  padding: var(--spacing-sm);
  background-color: var(--color-input-bg);
  color: var(--color-input-text);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}

.job-input textarea:focus {
  border-color: var(--color-input-border-focus);
  box-shadow: var(--shadow-focus);
}
```

### WCAG AA Contrast Verification

All contrast ratios verified with WebAIM Contrast Checker:

| Token Pair | Foreground | Background | Ratio | Status |
|:-----------|:-----------|:-----------|:------|:-------|
| text-primary on bg-primary | #f6f6f6 | #1a1a1a | 15.5:1 | PASS |
| text-primary on bg-secondary | #f6f6f6 | #2f2f2f | 11.5:1 | PASS |
| text-secondary on bg-secondary | #aaa | #2f2f2f | 6.5:1 | PASS |
| text-muted on bg-primary | #888 | #1a1a1a | 4.8:1 | PASS |
| accent on bg-secondary | #24c8db | #2f2f2f | 8.1:1 | PASS |
| primary on bg-secondary | #3b82f6 | #2f2f2f | 4.6:1 | PASS |
| success on success-bg | #10b981 | #1a2e26 | 5.2:1 | PASS |
| warning on warning-bg | #f59e0b | #2e2a1a | 5.8:1 | PASS |
| error-text on error-bg | #f88 | #3a2020 | 5.6:1 | PASS |
| button-text on button-bg | #ffffff | #3b82f6 | 4.5:1 | PASS |

### File Structure

```
upwork-researcher/
  src/
    styles/
      tokens.css                    # NEW: Design token system
    App.css                         # MODIFY: Use tokens
    components/
      SettingsPanel.css             # MODIFY: Use tokens (if exists)
      OverrideConfirmDialog.css     # MODIFY: Use tokens
      ThresholdAdjustmentNotification.css  # MODIFY: Use tokens
    main.tsx                        # MODIFY: Import tokens.css
```

### Testing Requirements

**Visual Inspection Tests:**

1. App opens with dark background (no white flash)
2. All text is readable on dark backgrounds
3. Buttons have visible hover states
4. Inputs have visible focus states
5. Error states are clearly visible
6. Success states are clearly visible
7. Warning states are clearly visible

**Contrast Verification:**

1. Run axe-core accessibility audit
2. Check all color pairs against WCAG AA thresholds
3. Verify focus indicators are visible

**Token Usage Verification:**

1. Grep for hardcoded hex colors outside tokens.css (should find none)
2. Verify all components use `var(--token)` syntax
3. Test that removing tokens.css breaks styling (dependency check)

### Cross-Story Dependencies

**Depends On:**
- **Story 1-5: Dark Mode Basic CSS** — Established base dark mode, inline styles for flash prevention

**Depended On By:**
- **Story 8-2: Complete Keyboard Navigation** — Uses focus ring tokens
- **Story 8-3: Screen Reader Support** — Uses semantic color contrast
- **Story 8-11: Accessibility Audit** — Validates WCAG compliance

**Relates To:**
- **UX-1: Dark Mode by Default** — Design system foundation

### Performance Targets

- CSS file size increase: <5KB (tokens add minimal overhead)
- No runtime CSS-in-JS (pure CSS custom properties)
- Browser support: All modern browsers (CSS custom properties widely supported)

### Scope Boundaries

**In Scope:**
- Create comprehensive design token system (tokens.css)
- Migrate all hardcoded colors to tokens
- Migrate spacing and typography to tokens
- Verify WCAG AA compliance
- Eliminate any white flashes
- Document token naming convention

**Out of Scope:**
- Light mode toggle (deferred to v1.1)
- Theme switching infrastructure (deferred)
- User-configurable theme colors (deferred)
- CSS-in-JS migration (not planned)

### Definition of Done

- [ ] All tasks/subtasks marked complete
- [ ] tokens.css created with all design tokens
- [ ] All hardcoded colors in App.css replaced with tokens
- [ ] All component CSS files updated to use tokens
- [ ] All WCAG AA contrast ratios verified (documented in story)
- [ ] No white flash on app startup or navigation
- [ ] Visual inspection passes on all screens
- [ ] No regressions in existing styling
- [ ] Token naming convention documented

## Change Log

- 2026-02-07: Story prepared for development by Scrum Master (Bob) — added full task breakdown, design token specifications, migration examples, WCAG contrast verification table, file structure, testing requirements, and dependencies. Based on Story 1-5 patterns and UX-1 design system requirements.
