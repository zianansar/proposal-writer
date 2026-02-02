# Story 0.1: Basic Job Input UI

**Epic:** 0 - Walking Skeleton (Proof of Concept)
**Story ID:** 0.1
**Status:** ready-for-dev
**Created:** 2026-02-02

---

## User Story

**As a** freelancer,
**I want to** paste a job post URL or text into the application,
**So that** I can start the proposal generation process quickly.

---

## Acceptance Criteria

**Given** the app is running
**When** I open the main window
**Then** I see a text input area for job post content
**And** I can paste either a URL or raw job text
**And** the input area has placeholder text explaining what to paste

---

## Technical Requirements

### Core Implementation
- Simple textarea component for job input
- **NO database persistence yet** (that's Epic 1)
- **NO URL vs text detection required** (both treated as text)
- **NO validation required** (this is a spike)
- Production-quality code (Epic 1 will build ON this, not replace it)

### Performance Targets
- Component should render in <100ms (NFR-4: UI response time)
- No blocking operations during user input

---

## Architecture Compliance

### AR-1: Starter Template - dannysmith/tauri-template

**Project Setup:**
- **Template:** `dannysmith/tauri-template`
- **Stack:** Tauri v2 + React 19.2.4 + Vite 7.3.1 + TypeScript + Rust
- **Node.js:** Requires v20.19+ or v22.12+ (Node 18 reached EOL April 2025)

**Key Template Features:**
- Type-safe Rust-TypeScript bridge via `tauri-specta`
- Multi-window architecture support
- Production-ready with best practices built-in
- Claude Code-ready template

**Setup Command:**
```bash
# Clone from dannysmith/tauri-template
git clone https://github.com/dannysmith/tauri-template.git upwork-research-agent
cd upwork-research-agent
npm install  # or pnpm install
```

**Sources:**
- [dannysmith/tauri-template on GitHub](https://github.com/dannysmith/tauri-template)
- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Vite 7.0 Release](https://vite.dev/blog/announcing-vite7)
- [React 19.2 Release Notes](https://react.dev/blog/2025/10/01/react-19-2)

### AR-11: Feature-Sliced Architecture

**Component Location:**
- Create component at: `src/features/job-input/components/JobTextarea.tsx` (or similar feature-sliced structure)
- If template has different structure, adapt to existing patterns

### AR-15: Error Handling

**Pattern:** Rust `Result<T, AppError>` → TypeScript structured errors
- For this story: Simple React error boundaries sufficient
- No Rust backend calls yet (just frontend UI)

### AR-16: State Management

**Three-layer approach:**
1. **useState** - Component-local state (use this for textarea value)
2. **Zustand** - Cross-component state (not needed in Story 0.1)
3. **TanStack Query** - Server state (not needed in Story 0.1)

**For Story 0.1:** Use simple `useState` for textarea value:
```tsx
const [jobContent, setJobContent] = useState('');
```

### AR-21: Pre-commit Hooks & Testing

**Required:**
- ESLint must pass
- Prettier formatting must pass
- Unit test for JobTextarea component
- Component should be testable in isolation

**Test Example:**
```tsx
describe('JobTextarea', () => {
  it('renders textarea with placeholder', () => {
    render(<JobTextarea />);
    expect(screen.getByPlaceholderText(/paste a job post/i)).toBeInTheDocument();
  });

  it('updates value on user input', () => {
    render(<JobTextarea />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test job post' } });
    expect(textarea).toHaveValue('Test job post');
  });
});
```

---

## Implementation Guidance

### Step 1: Verify Template Setup

1. **Clone/verify** dannysmith/tauri-template is set up
2. **Check Node.js version:** `node --version` (must be 20.19+ or 22.12+)
3. **Install dependencies:** `npm install` or `pnpm install`
4. **Start dev server:** `npm run tauri dev`
5. **Verify** app launches with default template UI

### Step 2: Create Job Input Component

**File:** `src/features/job-input/components/JobTextarea.tsx` (adapt path to template structure)

**Component Structure:**
```tsx
import { useState } from 'react';

interface JobTextareaProps {
  onContentChange?: (content: string) => void;
}

export function JobTextarea({ onContentChange }: JobTextareaProps) {
  const [jobContent, setJobContent] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setJobContent(value);
    onContentChange?.(value);
  };

  return (
    <div className="job-textarea-container">
      <label htmlFor="job-input" className="sr-only">
        Job Post Content
      </label>
      <textarea
        id="job-input"
        className="job-textarea"
        value={jobContent}
        onChange={handleChange}
        placeholder="Paste a job post URL or text here to start generating your proposal..."
        rows={10}
        aria-label="Job post input area"
      />
      <p className="text-sm text-gray-500 mt-2">
        Paste either a job URL or the full job description text
      </p>
    </div>
  );
}
```

**Accessibility Notes:**
- Include `aria-label` for screen readers
- Use semantic HTML (`<textarea>`, `<label>`)
- Ensure keyboard navigation works (Tab to focus, typing works)

### Step 3: Add to Main Window

Update main window/page to include JobTextarea:

```tsx
import { JobTextarea } from '@/features/job-input/components/JobTextarea';

function App() {
  return (
    <div className="app-container">
      <h1>Upwork Research Agent</h1>
      <JobTextarea />
    </div>
  );
}
```

### Step 4: Basic Styling

Use template's existing styling system (likely Tailwind CSS or styled-components):

**Key UI Requirements:**
- Textarea should be prominent and easy to find
- Placeholder text should be clearly visible
- Minimum height: ~200px (10 rows) to accommodate job posts
- Should resize well with window

**Example Tailwind Classes:**
```tsx
<textarea
  className="w-full p-4 border border-gray-300 rounded-lg
             focus:ring-2 focus:ring-blue-500 focus:border-transparent
             dark:bg-gray-800 dark:border-gray-600 dark:text-white"
  // ... other props
/>
```

### Step 5: Write Unit Test

**File:** `src/features/job-input/components/JobTextarea.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobTextarea } from './JobTextarea';

describe('JobTextarea', () => {
  it('renders textarea with placeholder text', () => {
    render(<JobTextarea />);
    const textarea = screen.getByPlaceholderText(/paste a job post/i);
    expect(textarea).toBeInTheDocument();
  });

  it('accepts user input', () => {
    render(<JobTextarea />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test job content' } });
    expect(textarea).toHaveValue('Test job content');
  });

  it('calls onContentChange callback when text changes', () => {
    const handleChange = vi.fn();
    render(<JobTextarea onContentChange={handleChange} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New content' } });
    expect(handleChange).toHaveBeenCalledWith('New content');
  });

  it('has accessible label', () => {
    render(<JobTextarea />);
    const textarea = screen.getByLabelText(/job post/i);
    expect(textarea).toBeInTheDocument();
  });
});
```

**Run Tests:**
```bash
npm run test
# or
npm run test:watch
```

### Step 6: Manual Testing

1. **Launch app:** `npm run tauri dev`
2. **Verify rendering:** Textarea appears on main window
3. **Test input:** Click textarea, type text, paste text
4. **Test placeholder:** Placeholder visible when empty
5. **Test accessibility:**
   - Tab to textarea (keyboard focus works)
   - Screen reader announces textarea purpose
6. **Test window resize:** Textarea adapts to window size

---

## Epic 0 Context

**Epic Goal:** User can paste a job, generate a basic proposal, and copy it — end-to-end proof the core loop works

**This Story's Role:**
- **First step** in the Walking Skeleton spike
- Provides the **input mechanism** for the core loop: paste → analyze → generate → copy
- Must be production-quality because **Epic 1 builds ON this codebase**

**Next Stories in Epic 0:**
- Story 0.2: Claude API Integration for Basic Generation
- Story 0.3: Streaming UI Display
- Story 0.4: Manual Copy to Clipboard
- Story 0.5: Validate AI Detection Passing

**Time Box:** Epic 0 has a hard time-box of 5 days max. This story should take 4-8 hours.

---

## Definition of Done

- [ ] Component renders textarea in main window
- [ ] Placeholder text explains what to paste
- [ ] User can type or paste text into textarea
- [ ] Component has accessible label/ARIA attributes
- [ ] Unit tests pass (minimum 3 tests)
- [ ] ESLint passes with no warnings
- [ ] Prettier formatting applied
- [ ] Manual testing completed
- [ ] No TypeScript errors
- [ ] Component exported and importable

---

## Notes for Developer

### Critical Reminders

🔥 **This is a spike, but production-quality code**
- Epic 1 will build on this codebase, not replace it
- Write clean, maintainable code with proper TypeScript types
- Follow template's existing patterns and conventions

⚡ **Keep it simple for Story 0.1**
- Just a textarea component with placeholder
- NO backend integration (that's Story 0.2)
- NO persistence (that's Epic 1)
- NO validation (this is a spike)

🎯 **Focus on the user experience**
- Textarea should be immediately visible and obvious
- Placeholder text should guide the user
- Component should feel responsive and polished

### Template-Specific Notes

The dannysmith/tauri-template includes:
- **Shadcn/ui components** (if needed for consistent styling)
- **Tailwind CSS** for styling
- **Zustand** for state management (not needed for this story)
- **TanStack Query** for server state (not needed for this story)
- **tauri-specta** for type-safe Rust↔TypeScript bridge (not needed for this story)

**For Story 0.1:** Use the simplest approach - a plain React component with useState.

### Common Pitfalls to Avoid

❌ **Don't over-engineer:**
- No need for Zustand/TanStack Query yet
- No need for complex validation
- No need for backend integration

❌ **Don't skip testing:**
- AR-21 requires unit tests
- Pre-commit hooks will block commits without tests

❌ **Don't ignore accessibility:**
- Include proper labels
- Test keyboard navigation
- Verify screen reader compatibility

### Questions or Issues?

If the template structure differs from expectations:
- Adapt the component location to match template's feature structure
- Follow template's existing patterns for components
- Check template's README for setup instructions

---

## Status

**Current Status:** ready-for-dev
**Assigned To:** [To be assigned by dev agent]
**Context Generated:** 2026-02-02

**Ultimate context engine analysis completed - comprehensive developer guide created.**
