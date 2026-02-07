---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 5
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 5.6: Privacy Indicator: "Proposals Never Leave Your Device"

## Story

As a freelancer,
I want clear reassurance that my proposals stay private,
So that I feel comfortable uploading my best work.

## Acceptance Criteria

**AC-1: Privacy Indicator Display on Golden Set Upload Screen**

**Given** I'm on the Golden Set upload screen (Story 5-3)
**When** I view the page
**Then** I see a prominent privacy indicator with:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔒 Your proposals never leave your device                   │
│                                                             │
│ We analyze your writing style locally and only send         │
│ statistical parameters (like tone and length) to the AI.    │
│ Your actual proposal text stays on your computer.           │
│                                                             │
│                    [How does this work?]                    │
└─────────────────────────────────────────────────────────────┘
```

**And** the indicator has:
- A lock icon (🔒) for immediate visual trust signal
- A green/success-themed border or badge for positive reinforcement
- Clear, non-technical language that any freelancer can understand

**AC-2: "How Does This Work?" Expandable Explanation**

**Given** I see the privacy indicator
**When** I click "How does this work?"
**Then** the indicator expands to show detailed explanation:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔒 Your proposals never leave your device                   │
│                                                             │
│ We analyze your writing style locally and only send         │
│ statistical parameters (like tone and length) to the AI.    │
│ Your actual proposal text stays on your computer.           │
│                                                             │
│ ─────────────────────────────────────────────────────────   │
│                                                             │
│ 📊 What We Analyze Locally:                                 │
│ • Sentence length patterns (average words per sentence)     │
│ • Tone and formality level (professional vs casual)         │
│ • Structure preferences (paragraphs vs bullet points)       │
│ • Vocabulary complexity (technical depth)                   │
│ • Common phrases you use                                    │
│                                                             │
│ 📤 What Gets Sent to AI:                                    │
│ • Style parameters only (numbers like "tone: 7/10")         │
│ • Never your actual proposal text                           │
│ • Never client names or project details                     │
│                                                             │
│ 🗑️ Your Data:                                               │
│ • Stored in encrypted local database (SQLCipher)            │
│ • Delete anytime from Settings → Data Management            │
│ • Zero telemetry - we never track your usage                │
│                                                             │
│                        [Collapse ▲]                         │
└─────────────────────────────────────────────────────────────┘
```

**And** clicking "Collapse" or clicking outside closes the expanded view

**AC-3: Visual Trust Signal Design**

**Given** I view the privacy indicator
**Then** the design conveys trust through:
- Green-tinted accent color (success/safe)
- Lock icon prominently displayed
- Card/panel design that stands out from regular content
- Subtle animation on first appearance (fade-in)

**And** matches the dark theme palette:
- Card background: slightly lighter than page (`#242424`)
- Green accent border: `#22c55e` (green-500)
- Lock icon color: `#22c55e`
- Text: `#fafafa` (primary), `#a3a3a3` (secondary)

**AC-4: Reusable Component**

**Given** the PrivacyIndicator component exists
**When** integrated into different screens
**Then** it can be used with different messaging variants:
- `variant="golden-set"` — Full message for Golden Set upload
- `variant="compact"` — Single-line for Voice Profile Display (Story 5-5)
- `variant="settings"` — Settings page variant with delete link

**And** each variant maintains consistent trust visual language

**AC-5: Accessibility**

**Given** I'm using assistive technology
**When** I interact with the privacy indicator
**Then**:
- Lock icon has `aria-hidden="true"` (decorative)
- "How does this work?" button has `aria-expanded` state
- Expanded content is announced by screen readers
- Keyboard: Tab to button, Enter/Space to expand
- All text has minimum 4.5:1 contrast ratio (WCAG AA)

## Tasks/Subtasks

- [ ] Task 1: Create PrivacyIndicator component (AC-1, AC-3, AC-4)
  - [ ] Subtask 1.1: Create `src/components/PrivacyIndicator.tsx`
  - [ ] Subtask 1.2: Implement base card layout with lock icon and message
  - [ ] Subtask 1.3: Add green accent border styling
  - [ ] Subtask 1.4: Create `variant` prop for different contexts
  - [ ] Subtask 1.5: Implement fade-in animation (CSS)
  - [ ] Subtask 1.6: Create `src/components/PrivacyIndicator.css` for styles

- [ ] Task 2: Implement expandable explanation (AC-2)
  - [ ] Subtask 2.1: Add "How does this work?" button
  - [ ] Subtask 2.2: Create expanded content section
  - [ ] Subtask 2.3: Implement expand/collapse state with `useState`
  - [ ] Subtask 2.4: Add slide-down animation for expansion
  - [ ] Subtask 2.5: Add "Collapse" button in expanded view
  - [ ] Subtask 2.6: Track aria-expanded state for accessibility

- [ ] Task 3: Create variant configurations (AC-4)
  - [ ] Subtask 3.1: Define variant types in TypeScript
  - [ ] Subtask 3.2: Implement "golden-set" variant (full message)
  - [ ] Subtask 3.3: Implement "compact" variant (single-line)
  - [ ] Subtask 3.4: Implement "settings" variant (with delete link)
  - [ ] Subtask 3.5: Document usage examples in code comments

- [ ] Task 4: Integrate with Golden Set Upload (AC-1)
  - [ ] Subtask 4.1: Import PrivacyIndicator into GoldenSetUpload.tsx (Story 5-3)
  - [ ] Subtask 4.2: Place indicator prominently at top of upload form
  - [ ] Subtask 4.3: Verify visual hierarchy (indicator visible but not blocking)

- [ ] Task 5: Add tests (AC-1 through AC-5)
  - [ ] Subtask 5.1: Test default variant renders correctly
  - [ ] Subtask 5.2: Test "How does this work?" expands content
  - [ ] Subtask 5.3: Test collapse button closes expanded view
  - [ ] Subtask 5.4: Test all three variants render correctly
  - [ ] Subtask 5.5: Test accessibility (aria-expanded, keyboard navigation)
  - [ ] Subtask 5.6: Test lock icon has aria-hidden="true"

## Dev Notes

### Architecture Requirements

**AR-12: Privacy Layer**
- Send derived style parameters, not raw writing samples
- Golden Set text stays LOCAL — only analyzed locally (Story 5-4)
- Raw proposals NEVER sent to Claude API
- This indicator communicates AR-12 to users in plain language

**UX-8: Progressive Trust Building**
- Visual trust signals build confidence
- Clear, non-technical language for non-developers
- Transparency about what data goes where
- "Local-only" terminology (per Round 4 Red Team feedback)

**UX-1: Dark Theme**
- Card background: `#242424` (slightly elevated from page)
- Green accent: `#22c55e` for success/trust
- Text: `#fafafa` (white) for primary, `#a3a3a3` (muted) for secondary
- Lock icon: `#22c55e` (green)

### TypeScript Types

```typescript
// src/components/PrivacyIndicator.tsx

export type PrivacyIndicatorVariant = 'golden-set' | 'compact' | 'settings';

interface PrivacyIndicatorProps {
  variant?: PrivacyIndicatorVariant;
  expandable?: boolean;
  className?: string;
}
```

### Component Implementation

```typescript
// src/components/PrivacyIndicator.tsx

import { useState } from 'react';
import './PrivacyIndicator.css';

export type PrivacyIndicatorVariant = 'golden-set' | 'compact' | 'settings';

interface PrivacyIndicatorProps {
  variant?: PrivacyIndicatorVariant;
  expandable?: boolean;
  className?: string;
}

const VARIANT_CONTENT = {
  'golden-set': {
    headline: 'Your proposals never leave your device',
    description: 'We analyze your writing style locally and only send statistical parameters (like tone and length) to the AI. Your actual proposal text stays on your computer.',
    showExpandable: true,
  },
  'compact': {
    headline: 'Your proposals stay on your device',
    description: 'Only style patterns are used for generation.',
    showExpandable: false,
  },
  'settings': {
    headline: 'Your proposals never leave your device',
    description: 'All analysis happens locally. You can delete all data anytime.',
    showExpandable: true,
  },
};

export function PrivacyIndicator({
  variant = 'golden-set',
  expandable = true,
  className = ''
}: PrivacyIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const content = VARIANT_CONTENT[variant];
  const canExpand = expandable && content.showExpandable;

  return (
    <div className={`privacy-indicator privacy-indicator--${variant} ${className}`}>
      <div className="privacy-indicator__header">
        <span className="privacy-indicator__icon" aria-hidden="true">🔒</span>
        <div className="privacy-indicator__content">
          <p className="privacy-indicator__headline">{content.headline}</p>
          <p className="privacy-indicator__description">{content.description}</p>
        </div>
      </div>

      {canExpand && (
        <button
          className="privacy-indicator__toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="privacy-details"
        >
          {isExpanded ? 'Collapse ▲' : 'How does this work?'}
        </button>
      )}

      {isExpanded && (
        <div
          id="privacy-details"
          className="privacy-indicator__details"
          role="region"
          aria-label="Privacy details"
        >
          <div className="privacy-indicator__section">
            <p className="privacy-indicator__section-title">
              <span aria-hidden="true">📊</span> What We Analyze Locally:
            </p>
            <ul>
              <li>Sentence length patterns (average words per sentence)</li>
              <li>Tone and formality level (professional vs casual)</li>
              <li>Structure preferences (paragraphs vs bullet points)</li>
              <li>Vocabulary complexity (technical depth)</li>
              <li>Common phrases you use</li>
            </ul>
          </div>

          <div className="privacy-indicator__section">
            <p className="privacy-indicator__section-title">
              <span aria-hidden="true">📤</span> What Gets Sent to AI:
            </p>
            <ul>
              <li>Style parameters only (numbers like "tone: 7/10")</li>
              <li>Never your actual proposal text</li>
              <li>Never client names or project details</li>
            </ul>
          </div>

          <div className="privacy-indicator__section">
            <p className="privacy-indicator__section-title">
              <span aria-hidden="true">🗑️</span> Your Data:
            </p>
            <ul>
              <li>Stored in encrypted local database (SQLCipher)</li>
              <li>Delete anytime from Settings → Data Management</li>
              <li>Zero telemetry - we never track your usage</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrivacyIndicator;
```

### CSS Styles

```css
/* src/components/PrivacyIndicator.css */

.privacy-indicator {
  background: #242424;
  border: 1px solid #22c55e;
  border-left: 4px solid #22c55e;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.privacy-indicator__header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.privacy-indicator__icon {
  font-size: 24px;
  line-height: 1;
  color: #22c55e;
}

.privacy-indicator__content {
  flex: 1;
}

.privacy-indicator__headline {
  font-size: 16px;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 4px 0;
}

.privacy-indicator__description {
  font-size: 14px;
  color: #a3a3a3;
  margin: 0;
  line-height: 1.5;
}

.privacy-indicator__toggle {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 8px;
  background: transparent;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  color: #a3a3a3;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.privacy-indicator__toggle:hover {
  background: #2a2a2a;
  color: #fafafa;
}

.privacy-indicator__toggle:focus-visible {
  outline: 2px solid #22c55e;
  outline-offset: 2px;
}

.privacy-indicator__details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #3a3a3a;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
}

.privacy-indicator__section {
  margin-bottom: 16px;
}

.privacy-indicator__section:last-child {
  margin-bottom: 0;
}

.privacy-indicator__section-title {
  font-size: 14px;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.privacy-indicator__section ul {
  margin: 0;
  padding-left: 24px;
  color: #a3a3a3;
  font-size: 13px;
  line-height: 1.6;
}

.privacy-indicator__section li {
  margin-bottom: 4px;
}

/* Compact variant */
.privacy-indicator--compact {
  padding: 12px;
  border-left-width: 3px;
}

.privacy-indicator--compact .privacy-indicator__icon {
  font-size: 18px;
}

.privacy-indicator--compact .privacy-indicator__headline {
  font-size: 14px;
}

.privacy-indicator--compact .privacy-indicator__description {
  font-size: 12px;
}

/* Settings variant */
.privacy-indicator--settings .privacy-indicator__description {
  font-size: 14px;
}
```

### File Structure

```
upwork-researcher/
  src/
    components/
      PrivacyIndicator.tsx         # NEW: Main component
      PrivacyIndicator.css         # NEW: Component styles
      PrivacyIndicator.test.tsx    # NEW: Component tests
```

### Integration Example

```typescript
// In GoldenSetUpload.tsx (Story 5-3)

import { PrivacyIndicator } from '../components/PrivacyIndicator';

export function GoldenSetUpload() {
  return (
    <div className="golden-set-upload">
      <h2>Upload Your Best Proposals</h2>

      {/* Privacy indicator prominently at top */}
      <PrivacyIndicator variant="golden-set" />

      {/* Rest of upload UI... */}
      <p>Upload 3-5 of your best proposals that got responses</p>
      {/* ... */}
    </div>
  );
}
```

```typescript
// In VoiceProfileDisplay.tsx (Story 5-5) - compact variant

import { PrivacyIndicator } from '../components/PrivacyIndicator';

export function VoiceProfileDisplay() {
  return (
    <Card>
      {/* ... profile content ... */}

      {/* Compact privacy indicator at bottom */}
      <PrivacyIndicator variant="compact" expandable={false} />
    </Card>
  );
}
```

### Testing Requirements

**Component Tests (PrivacyIndicator.test.tsx):**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyIndicator } from './PrivacyIndicator';

describe('PrivacyIndicator', () => {
  describe('default rendering', () => {
    it('displays lock icon and headline', () => {
      render(<PrivacyIndicator />);
      expect(screen.getByText('🔒')).toBeInTheDocument();
      expect(screen.getByText('Your proposals never leave your device')).toBeInTheDocument();
    });

    it('displays description text', () => {
      render(<PrivacyIndicator />);
      expect(screen.getByText(/analyze your writing style locally/i)).toBeInTheDocument();
    });

    it('has lock icon with aria-hidden', () => {
      render(<PrivacyIndicator />);
      const icon = screen.getByText('🔒');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('expandable section', () => {
    it('shows "How does this work?" button', () => {
      render(<PrivacyIndicator />);
      expect(screen.getByRole('button', { name: /how does this work/i })).toBeInTheDocument();
    });

    it('expands when button is clicked', () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole('button', { name: /how does this work/i });
      fireEvent.click(button);
      expect(screen.getByText(/What We Analyze Locally/i)).toBeInTheDocument();
      expect(screen.getByText(/What Gets Sent to AI/i)).toBeInTheDocument();
      expect(screen.getByText(/Your Data/i)).toBeInTheDocument();
    });

    it('updates aria-expanded state', () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole('button', { name: /how does this work/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('collapses when Collapse button is clicked', () => {
      render(<PrivacyIndicator />);
      fireEvent.click(screen.getByRole('button', { name: /how does this work/i }));
      expect(screen.getByText(/What We Analyze Locally/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /collapse/i }));
      expect(screen.queryByText(/What We Analyze Locally/i)).not.toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders compact variant with shorter text', () => {
      render(<PrivacyIndicator variant="compact" />);
      expect(screen.getByText('Your proposals stay on your device')).toBeInTheDocument();
      expect(screen.getByText('Only style patterns are used for generation.')).toBeInTheDocument();
    });

    it('hides expandable button for compact variant', () => {
      render(<PrivacyIndicator variant="compact" />);
      expect(screen.queryByRole('button', { name: /how does this work/i })).not.toBeInTheDocument();
    });

    it('renders settings variant', () => {
      render(<PrivacyIndicator variant="settings" />);
      expect(screen.getByText(/delete all data anytime/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('is keyboard navigable', () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole('button', { name: /how does this work/i });
      button.focus();
      expect(button).toHaveFocus();
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('has correct aria-controls attribute', () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole('button', { name: /how does this work/i });
      expect(button).toHaveAttribute('aria-controls', 'privacy-details');
    });

    it('expanded content has region role', () => {
      render(<PrivacyIndicator />);
      fireEvent.click(screen.getByRole('button', { name: /how does this work/i }));
      expect(screen.getByRole('region', { name: /privacy details/i })).toBeInTheDocument();
    });
  });
});
```

### Scope Boundaries

**In Scope for Story 5-6:**
- PrivacyIndicator component with 3 variants
- Expandable "How does this work?" section
- Green trust visual styling
- Accessibility (keyboard, screen reader, ARIA)
- CSS animations (fade-in, slide-down)
- Component tests

**Out of Scope (Other Stories):**
- Golden Set Upload UI (Story 5-3) — this story creates the component, 5-3 integrates it
- Voice Profile Display integration (Story 5-5) — uses compact variant
- Data deletion functionality (Epic 8) — referenced in text only
- Settings → Data Management page (Epic 8)

### Dependencies

**Depends On:**
- None — this is a standalone presentational component

**Depended On By:**
- **Story 5-3: Golden Set Upload UI** — integrates PrivacyIndicator
- **Story 5-5: Voice Profile Display** — uses compact variant

### Design Rationale

**"Local-only" Terminology:**
Per Round 4 Red Team feedback, we use "local-only" and "stays on your device" instead of technical terms like "privacy layer" or "client-side processing."

**Green Accent Color:**
Green (`#22c55e`) is universally associated with safety, success, and "go" signals. The left border accent draws attention without being intrusive.

**Expandable Details:**
Most users will trust the summary. Power users can expand for full transparency. This balances trust-building with clean UI.

**Three-Section Breakdown:**
1. What we analyze (reassures it's just patterns)
2. What gets sent (confirms raw text never leaves)
3. Your data (control and deletion options)

This structure addresses the three main privacy concerns users have.

### References

- [Source: epics-stories.md#Story 5.6: Privacy Indicator]
- [Source: architecture.md#AR-12: Privacy layer]
- [Source: ux-design-specification.md#UX-8: Progressive Trust Building]
- [Source: prd.md#NFR-9: Privacy compliance]
- [Story 5-3: Golden Set Upload UI — integration point]
- [Story 5-5: Voice Profile Display — uses compact variant]
