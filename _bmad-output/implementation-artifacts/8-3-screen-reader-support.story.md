---
status: ready-for-dev
epic: 8
story: 3
assignedTo: ""
tasksCompleted: 0
totalTasks: 7
testsWritten: false
codeReviewCompleted: false
fileList: []
dependencies:
  - 8-1-dark-theme-system
  - 8-2-complete-keyboard-navigation
relates_to:
  - 8-11-accessibility-audit
---

# Story 8.3: Screen Reader Support

## Story

As a visually impaired freelancer,
I want the app to work with screen readers,
So that I can use it independently.

## Acceptance Criteria

### AC1: Button and Control Announcements

**Given** I'm using a screen reader (VoiceOver, NVDA, JAWS)
**When** I navigate to any button
**Then** the screen reader announces:
- Button label (e.g., "Generate Proposal")
- Button state (disabled, pressed, expanded)
- Role ("button")

**And** icon-only buttons have accessible labels via `aria-label`
**And** toggle buttons announce their state ("pressed" or "not pressed")

### AC2: Form Field Announcements

**Given** I focus on any form field
**When** the screen reader reads the field
**Then** it announces:
- Field label (e.g., "Job Post Description")
- Field type (text, textarea, checkbox, etc.)
- Current value
- Required status if applicable
- Error message if present

**And** labels are programmatically associated via `for`/`id` or `aria-labelledby`
**And** placeholders are NOT relied upon as the only label

### AC3: Status Updates via Live Regions

**Given** a status change occurs (loading, success, error)
**When** the change happens
**Then** the screen reader announces the update without user action:
- "Generating proposal..." (loading starts)
- "Proposal generated successfully" (success)
- "Error: Unable to connect to API" (error)
- "Copied to clipboard" (copy action)
- "Safety score: 72%" (score updates)

**And** announcements use appropriate politeness:
- `aria-live="polite"` for non-urgent updates
- `aria-live="assertive"` for errors and critical alerts

### AC4: Semantic Heading Structure

**Given** I navigate by headings (H key in screen reader)
**When** I browse the page structure
**Then** headings form a logical hierarchy:
- `h1`: "Upwork Research Agent" (app title, one per page)
- `h2`: Tab/section names (Generate, History, Settings)
- `h3`: Sub-sections within tabs
- `h4+`: Nested content as needed

**And** no heading levels are skipped
**And** headings accurately describe their sections

### AC5: Landmark Regions

**Given** I navigate by landmarks (D key in NVDA, rotor in VoiceOver)
**When** I browse the page
**Then** I can navigate between:
- `<header>` / `role="banner"`: App header
- `<nav>` / `role="navigation"`: Tab navigation
- `<main>` / `role="main"`: Primary content area
- `<footer>` / `role="contentinfo"`: Footer (if present)
- `role="dialog"`: Modal dialogs

**And** each landmark is appropriately labeled if multiple exist (e.g., `aria-label="Tab navigation"`)

### AC6: Image and Icon Accessibility

**Given** any image or icon is displayed
**When** a screen reader encounters it
**Then**:
- Decorative icons have `aria-hidden="true"` (not announced)
- Meaningful icons have `aria-label` or adjacent text
- Images have descriptive `alt` text
- SVG icons have `role="img"` and `aria-label` when meaningful

### AC7: Loading State Announcements

**Given** content is loading
**When** a loading indicator appears
**Then** the screen reader announces "Loading" or similar
**And** when loading completes, it announces the result
**And** spinners/progress indicators have `role="progressbar"` or `role="status"`

### AC8: Error Association with Fields

**Given** a form field has a validation error
**When** the error message appears
**Then** the error is programmatically associated with the field via `aria-describedby`
**And** the field has `aria-invalid="true"`
**And** the error message has `role="alert"` for immediate announcement

## Technical Notes

- NFR-20: WCAG AA screen reader support
- ARIA labels on all interactive elements
- Semantic HTML (h1-h6, nav, main, article)
- Test with macOS VoiceOver and Windows NVDA
- Builds on Story 8-1 (color contrast) and 8-2 (keyboard navigation)

## Tasks / Subtasks

- [ ] Task 1: Add semantic landmark structure (AC5)
  - [ ] 1.1: Wrap app header in `<header role="banner">`
  - [ ] 1.2: Wrap tab navigation in `<nav role="navigation" aria-label="Main navigation">`
  - [ ] 1.3: Wrap main content in `<main role="main" id="main-content">`
  - [ ] 1.4: Add `aria-label` to navigation if multiple nav elements exist
  - [ ] 1.5: Ensure all modals have `role="dialog"` and `aria-modal="true"`
  - [ ] 1.6: Add `aria-labelledby` to dialogs pointing to their titles

- [ ] Task 2: Implement heading hierarchy (AC4)
  - [ ] 2.1: Audit current heading usage in App.tsx and components
  - [ ] 2.2: Add single `<h1>` for app title (visible or visually-hidden)
  - [ ] 2.3: Use `<h2>` for major sections (Generate, History, Settings)
  - [ ] 2.4: Use `<h3>` for subsections within tabs
  - [ ] 2.5: Verify no heading levels are skipped
  - [ ] 2.6: Add visually-hidden headings where needed for structure

- [ ] Task 3: Create live region announcement system (AC3, AC7)
  - [ ] 3.1: Create `src/components/LiveAnnouncer.tsx` component
  - [ ] 3.2: Create `src/hooks/useAnnounce.ts` hook
  - [ ] 3.3: Implement polite announcements queue
  - [ ] 3.4: Implement assertive announcements for errors
  - [ ] 3.5: Add announcements for: generation start, completion, error
  - [ ] 3.6: Add announcements for: copy to clipboard
  - [ ] 3.7: Add announcements for: safety score updates
  - [ ] 3.8: Add loading state announcements with `role="status"`

- [ ] Task 4: Enhance button accessibility (AC1)
  - [ ] 4.1: Audit all buttons for accessible names
  - [ ] 4.2: Add `aria-label` to icon-only buttons (Copy, Rehumanize)
  - [ ] 4.3: Add `aria-disabled` to match disabled state
  - [ ] 4.4: Add `aria-pressed` to toggle buttons
  - [ ] 4.5: Add `aria-expanded` to buttons that open dropdowns/modals
  - [ ] 4.6: Add `aria-busy="true"` to Generate button during generation

- [ ] Task 5: Enhance form field accessibility (AC2, AC8)
  - [ ] 5.1: Audit all form fields for label associations
  - [ ] 5.2: Add `<label>` elements with proper `for`/`id` connections
  - [ ] 5.3: Add `aria-required="true"` to required fields
  - [ ] 5.4: Add `aria-describedby` for hint text
  - [ ] 5.5: Add `aria-invalid="true"` when validation fails
  - [ ] 5.6: Add `aria-describedby` linking fields to error messages
  - [ ] 5.7: Add `role="alert"` to error message containers
  - [ ] 5.8: Ensure Settings form fields have proper associations

- [ ] Task 6: Handle icons and decorative elements (AC6)
  - [ ] 6.1: Audit all SVG icons and images
  - [ ] 6.2: Add `aria-hidden="true"` to decorative icons
  - [ ] 6.3: Add `role="img"` and `aria-label` to meaningful SVGs
  - [ ] 6.4: Verify any images have descriptive `alt` text
  - [ ] 6.5: Check loading spinners have accessible names

- [ ] Task 7: Write comprehensive tests (AC1-AC8)
  - [ ] 7.1: Test: Buttons announce label and role
  - [ ] 7.2: Test: Form fields announce label, type, and value
  - [ ] 7.3: Test: Live region announces status changes
  - [ ] 7.4: Test: Headings form logical hierarchy
  - [ ] 7.5: Test: Landmarks are present and labeled
  - [ ] 7.6: Test: Decorative icons are hidden from screen readers
  - [ ] 7.7: Test: Error messages associated with fields
  - [ ] 7.8: Test: Loading states announced
  - [ ] 7.9: Run axe-core accessibility audit in tests

## Dev Notes

### Architecture Context

**NFR-20: WCAG AA Compliance**
- Screen reader support is required for WCAG 2.1 AA
- All content must be accessible to assistive technologies
- Dynamic updates must be announced appropriately

**Story 8-1 Foundation**
- Provides color contrast meeting WCAG AA
- This story adds the ARIA layer for screen readers

**Story 8-2 Foundation**
- Provides keyboard navigation and focus management
- This story adds screen reader announcements for those interactions

### LiveAnnouncer Component

```typescript
// src/components/LiveAnnouncer.tsx

import { createContext, useContext, useState, useCallback, useRef } from 'react';

interface Announcement {
  message: string;
  politeness: 'polite' | 'assertive';
}

interface LiveAnnouncerContextValue {
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue | null>(null);

/**
 * Provides screen reader announcements via aria-live regions.
 * Wrap your app with this provider.
 */
export function LiveAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    // Clear any pending announcements
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (politeness === 'assertive') {
      setAssertiveMessage(message);
      // Clear after announcement
      timeoutRef.current = setTimeout(() => setAssertiveMessage(''), 1000);
    } else {
      setPoliteMessage(message);
      timeoutRef.current = setTimeout(() => setPoliteMessage(''), 1000);
    }
  }, []);

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Visually hidden live regions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}

/**
 * Hook to announce messages to screen readers.
 */
export function useAnnounce() {
  const context = useContext(LiveAnnouncerContext);
  if (!context) {
    throw new Error('useAnnounce must be used within LiveAnnouncerProvider');
  }
  return context.announce;
}
```

### Visually Hidden CSS Class

```css
/* Add to App.css or tokens.css */

/**
 * Visually hidden but accessible to screen readers.
 * Use for: skip links (off-screen), live regions, hidden labels.
 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/**
 * Shows element on focus (for skip links).
 */
.sr-only-focusable:focus,
.sr-only-focusable:active {
  position: static;
  width: auto;
  height: auto;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

### Semantic Landmark Structure

```tsx
// App.tsx structure with landmarks

function App() {
  return (
    <LiveAnnouncerProvider>
      <div className="app">
        <header role="banner">
          <h1 className="sr-only">Upwork Research Agent</h1>
          {/* App branding if visible */}
        </header>

        <nav role="navigation" aria-label="Main navigation">
          <button
            role="tab"
            aria-selected={activeTab === 'generate'}
            aria-controls="generate-panel"
          >
            Generate
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            aria-controls="history-panel"
          >
            History
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'settings'}
            aria-controls="settings-panel"
          >
            Settings
          </button>
        </nav>

        <main role="main" id="main-content">
          <div
            id="generate-panel"
            role="tabpanel"
            aria-labelledby="generate-tab"
            hidden={activeTab !== 'generate'}
          >
            <h2>Generate Proposal</h2>
            {/* Content */}
          </div>
          {/* Other panels */}
        </main>
      </div>
    </LiveAnnouncerProvider>
  );
}
```

### Button Accessibility Patterns

```tsx
// Icon-only button with accessible name
<button
  aria-label="Copy proposal to clipboard"
  onClick={handleCopy}
>
  <CopyIcon aria-hidden="true" />
</button>

// Button with loading state
<button
  aria-busy={isGenerating}
  aria-disabled={isGenerating}
  disabled={isGenerating}
  onClick={handleGenerate}
>
  {isGenerating ? (
    <>
      <Spinner aria-hidden="true" />
      <span className="sr-only">Generating proposal</span>
      Generating...
    </>
  ) : (
    'Generate Proposal'
  )}
</button>

// Toggle button
<button
  aria-pressed={isDarkMode}
  onClick={toggleDarkMode}
>
  Dark Mode
</button>

// Button that opens modal
<button
  aria-expanded={isModalOpen}
  aria-haspopup="dialog"
  onClick={openModal}
>
  Open Settings
</button>
```

### Form Field Patterns

```tsx
// Text input with label and error
<div className="form-field">
  <label htmlFor="job-input">
    Job Post Description
    <span aria-hidden="true">*</span>
  </label>
  <textarea
    id="job-input"
    aria-required="true"
    aria-invalid={!!error}
    aria-describedby={error ? 'job-input-error' : undefined}
    value={jobPost}
    onChange={(e) => setJobPost(e.target.value)}
  />
  {error && (
    <div id="job-input-error" role="alert" className="error-message">
      {error}
    </div>
  )}
</div>

// Checkbox with label
<div className="form-field">
  <input
    type="checkbox"
    id="remember-setting"
    checked={remember}
    onChange={(e) => setRemember(e.target.checked)}
  />
  <label htmlFor="remember-setting">
    Remember my preferences
  </label>
</div>

// Field with hint text
<div className="form-field">
  <label htmlFor="api-key">API Key</label>
  <input
    type="password"
    id="api-key"
    aria-describedby="api-key-hint"
    value={apiKey}
    onChange={(e) => setApiKey(e.target.value)}
  />
  <div id="api-key-hint" className="hint-text">
    Your API key is stored securely in the OS keychain
  </div>
</div>
```

### Dialog Accessibility

```tsx
// Modal dialog pattern
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Confirm Override</h2>
  <p id="modal-description">
    Are you sure you want to override the safety warning?
  </p>
  {/* Modal content */}
</div>
```

### Using the Announce Hook

```typescript
// In any component
import { useAnnounce } from '../components/LiveAnnouncer';

function GenerateButton() {
  const announce = useAnnounce();

  const handleGenerate = async () => {
    announce('Generating proposal...');
    try {
      await generateProposal();
      announce('Proposal generated successfully');
    } catch (error) {
      announce('Error generating proposal. Please try again.', 'assertive');
    }
  };
}

function CopyButton() {
  const announce = useAnnounce();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(proposal);
    announce('Copied to clipboard');
  };
}
```

### Heading Hierarchy Audit

```
Expected heading structure:

h1: Upwork Research Agent (one per page, can be visually hidden)
├── h2: Generate Proposal
│   ├── h3: Job Description (if section is labeled)
│   └── h3: Generated Proposal Output
├── h2: Proposal History
│   └── h3: [Individual proposal titles if expandable]
└── h2: Settings
    ├── h3: API Configuration
    ├── h3: Safety Thresholds
    └── h3: Preferences
```

### File Structure

```
upwork-researcher/
  src/
    components/
      LiveAnnouncer.tsx              # NEW: Live region announcements
      LiveAnnouncer.test.tsx         # NEW: Announcer tests
    hooks/
      useAnnounce.ts                 # NEW: (if separate from component)
    App.tsx                          # MODIFY: Add landmarks, headings
    App.css                          # MODIFY: Add .sr-only class
    components/
      GenerateButton.tsx             # MODIFY: Add aria-busy, announcements
      CopyButton.tsx                 # MODIFY: Add aria-label, announcements
      SettingsPanel.tsx              # MODIFY: Add form field associations
      SafetyWarningModal.tsx         # MODIFY: Add dialog ARIA
      OverrideConfirmDialog.tsx      # MODIFY: Add dialog ARIA
      ProposalOutput.tsx             # MODIFY: Add live region for updates
```

### Testing Requirements

**Unit Tests:**

1. `test_button_has_accessible_name()` — All buttons have text or aria-label
2. `test_form_field_has_label()` — All inputs have associated labels
3. `test_live_region_announces()` — Status updates are announced
4. `test_heading_hierarchy()` — Headings don't skip levels
5. `test_landmarks_present()` — Main, nav, header landmarks exist
6. `test_decorative_icons_hidden()` — Icons have aria-hidden
7. `test_error_associated_with_field()` — Errors linked via aria-describedby
8. `test_dialog_has_accessible_name()` — Modals have aria-labelledby

**Integration Tests with axe-core:**

```typescript
// Install: npm install --save-dev @axe-core/react

import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('should have no accessibility violations', async () => {
  const { container } = render(<App />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Manual Testing Checklist:**

1. VoiceOver (macOS):
   - [ ] VO+Right Arrow navigates through all content
   - [ ] VO+H moves between headings
   - [ ] VO+D moves between landmarks
   - [ ] Status updates announced automatically
   - [ ] Forms are navigable and editable

2. NVDA (Windows):
   - [ ] Insert+Down reads continuously
   - [ ] H/Shift+H moves between headings
   - [ ] D/Shift+D moves between landmarks
   - [ ] Browse/Focus modes work correctly
   - [ ] Tab navigation matches keyboard story

### Screen Reader Testing Commands

**VoiceOver (macOS):**
- `VO+H`: Next heading
- `VO+Shift+H`: Previous heading
- `VO+D`: Next landmark
- `VO+U`: Open rotor (navigate by type)
- `VO+F5`: Forms rotor
- `VO+Space`: Activate element

**NVDA (Windows):**
- `H`: Next heading
- `Shift+H`: Previous heading
- `D`: Next landmark
- `Shift+D`: Previous landmark
- `Insert+F7`: Elements list
- `Insert+Space`: Toggle focus/browse mode

### Cross-Story Dependencies

**Depends On:**
- **Story 8-1: Dark Theme System** — Color contrast meeting WCAG AA
- **Story 8-2: Complete Keyboard Navigation** — Focus management, keyboard access

**Depended On By:**
- **Story 8-11: Accessibility Audit** — Validates complete accessibility

**Relates To:**
- **NFR-20: WCAG AA Compliance** — Accessibility requirement

### Scope Boundaries

**In Scope:**
- Semantic landmark structure
- Heading hierarchy
- Live region announcements
- Button accessibility (aria-label, aria-pressed, etc.)
- Form field associations
- Icon accessibility
- Error message associations

**Out of Scope:**
- Color contrast (Story 8-1)
- Keyboard navigation (Story 8-2)
- Automated accessibility CI pipeline (Story 8-11)
- High contrast mode
- Screen reader installation/setup instructions

### Definition of Done

- [ ] All tasks/subtasks marked complete
- [ ] LiveAnnouncer component implemented
- [ ] Semantic landmarks added (header, nav, main)
- [ ] Heading hierarchy verified (h1-h6 in order)
- [ ] All buttons have accessible names
- [ ] All form fields have label associations
- [ ] Live regions announce status updates
- [ ] Decorative icons hidden from screen readers
- [ ] Error messages associated with fields
- [ ] axe-core tests pass with no violations
- [ ] Manual VoiceOver testing complete
- [ ] Manual NVDA testing complete (if Windows available)

## Change Log

- 2026-02-07: Story prepared for development by Scrum Master (Bob) — added full task breakdown (7 tasks, 55 subtasks), dev notes with LiveAnnouncer implementation, ARIA patterns for buttons/forms/dialogs, heading hierarchy guide, file structure, testing requirements (unit + axe-core + manual), dependencies on 8-1 and 8-2.
