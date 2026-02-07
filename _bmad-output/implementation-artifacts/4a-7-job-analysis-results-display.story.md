---
status: ready-for-dev
---

# Story 4a.7: Job Analysis Results Display

## Story

As a freelancer,
I want to see all extracted information in a clear format,
So that I can quickly understand the job requirements.

## Acceptance Criteria

**AC-1:** Given job analysis has completed successfully, When I view the generate view, Then I see a structured panel displaying all extracted information grouped by section (Client, Key Skills, Hidden Needs).

**AC-2:** Given the analysis panel is visible, Then each section has a labeled header and the corresponding data:

- **Client** section: Displays "Client: John Smith" or "Client: Unknown" if no name was extracted
- **Key Skills** section: Displays skills as styled tag chips (e.g. `[React] [TypeScript] [API Integration]`) or "No skills detected" if empty
- **Hidden Needs** section: Displays each need with its supporting evidence, or "No hidden needs detected" if empty

**AC-3:** Given the analysis panel is visible, Then a "Generate Proposal" button or link is available within or adjacent to the panel that triggers proposal generation using the analysis context.

**AC-4:** Given no analysis has been run yet, Then the analysis panel is not visible (no empty panel shell shown).

**AC-5:** Given the analysis panel is visible, Then it has clear visual hierarchy: section labels are muted/secondary, data content is primary/prominent, and hidden need evidence is subordinate to the need label.

**AC-6:** Given the panel is displayed in dark mode or light mode, Then all text and backgrounds render correctly using existing theme CSS variables.

**AC-7:** Given a screen reader is active, Then the panel uses semantic HTML (headings, lists, definition-style markup) and each section is navigable.

## Technical Notes

### Requirements Traceability

- **FR-2:** System extracts "Client Name", "Key Skills", and "Hidden Needs" — this story displays all three in a unified view
- **UX Spec (Information Hierarchy):** "Clear visual hierarchy — proposal text larger than UI chrome"
- **UX Spec (Color-Coded Icons):** "Color-coded icons + text, never color alone" — indicators must pair with text labels
- **UX Spec (Card Pattern):** Dark card with `#1a1a1a` background, `#555` border, `border-radius: 6px`

### Architecture: Wrapper Panel Over Existing Components

Stories 4a-2, 4a-3, and 4a-4 each create minimal display components (`ClientNameDisplay`, `SkillTags`, `HiddenNeedsDisplay`). All three explicitly defer comprehensive display to this story.

**Design decision: Wrap existing components in a unified panel, don't replace them.**

Rationale:

- The individual components are already tested and styled for their data types
- A wrapper panel (`JobAnalysisPanel`) provides layout, section headers, and visual containment
- This is less disruptive than rebuilding three components into one monolith
- Individual components remain reusable if needed elsewhere (e.g., proposal history view in Epic 6)

**Component hierarchy after 4a-7:**

```text
<JobAnalysisPanel visible={hasAnalysisResults}>
  <section: Client>
    <ClientNameDisplay clientName={clientName} />
  </section>
  <section: Key Skills>
    <SkillTags skills={keySkills} />
  </section>
  <section: Hidden Needs>
    <HiddenNeedsDisplay hiddenNeeds={hiddenNeeds} />
  </section>
  <section: Actions>
    <GenerateProposalCTA />
  </section>
</JobAnalysisPanel>
```

### Visual Design

**Panel container:**

- Background: `var(--color-card-bg)` (maps to `#1a1a1a` dark / `#f9fafb` light)
- Border: `1px solid var(--color-border)` (maps to `#555` dark / `#d1d5db` light)
- Border-radius: `6px` (matches existing card pattern in App.css)
- Padding: `1.25rem`
- Gap between sections: `1rem`

**Section headers:**

- Font-weight: `600`, font-size: `0.85rem`, color: muted text (`var(--color-text-muted)`)
- Text-transform: `uppercase`, letter-spacing: `0.05em` — distinguishes headers from content

**Hidden needs items:**

- Each item has a left border accent (3px solid `var(--color-accent)`)
- Need label: bold/primary text
- Evidence: secondary/muted text, indented, prefixed with arrow indicator

**Note on emojis:** The original story stub used emoji icons (fire, dollar). The UX spec does not include emoji in the design system. Use CSS-styled indicators (colored dots or semantic icons via accessible patterns) instead of raw emoji.

### Generate Proposal Connection

The "Generate Proposal" action within the panel connects analysis to generation. This does NOT change the generation logic — it provides a convenient CTA within the analysis context.

**Implementation:** A styled button or link in the panel's action section that either:

- Scrolls to and activates the existing `GenerateButton`, OR
- Directly invokes the same `handleGenerate` function from App.tsx

The actual integration of analysis data INTO the generation prompt is **Epic 5 scope** (Story 5-8: Voice-Informed Proposal Generation). For now, the CTA simply triggers generation with whatever prompt context already exists.

## Tasks / Subtasks

- [ ] Task 1: Create `JobAnalysisPanel` container component (AC: 1, 4, 5, 6, 7)
  - [ ] 1.1: Create `src/components/JobAnalysisPanel.tsx` — accepts `clientName`, `keySkills`, `hiddenNeeds`, `onGenerateClick`, and `visible` props
  - [ ] 1.2: Return `null` when `visible` is `false` (no empty panel shell)
  - [ ] 1.3: Render three labeled sections: Client, Key Skills, Hidden Needs
  - [ ] 1.4: Each section uses a semantic heading (e.g., `<h3>`) with muted uppercase label styling
  - [ ] 1.5: Render `ClientNameDisplay`, `SkillTags`, `HiddenNeedsDisplay` within their respective sections
  - [ ] 1.6: Add `role="region"` and `aria-label="Job Analysis Results"` for screen reader navigation

- [ ] Task 2: Add action section with Generate Proposal CTA (AC: 3)
  - [ ] 2.1: Add a "Generate Proposal" button at the bottom of the panel
  - [ ] 2.2: Style as a primary action button (consistent with existing `GenerateButton` styling)
  - [ ] 2.3: On click: call `onGenerateClick` prop (wired to generation handler in App.tsx)
  - [ ] 2.4: Button disabled while generation is already in progress

- [ ] Task 3: Create panel CSS (AC: 5, 6)
  - [ ] 3.1: Create `src/components/JobAnalysisPanel.css` with card container styles (background, border, border-radius, padding)
  - [ ] 3.2: Section header styles: muted color, uppercase, small font, letter-spacing
  - [ ] 3.3: Section dividers: subtle border or gap between sections
  - [ ] 3.4: Hidden needs item styling: left border accent, need/evidence hierarchy
  - [ ] 3.5: Use existing CSS variables for all colors (dark/light mode compatible)
  - [ ] 3.6: Fade-in animation on panel appearance (300ms ease-in, respects `prefers-reduced-motion`)

- [ ] Task 4: Integrate panel into App.tsx (AC: 1, 3, 4)
  - [ ] 4.1: Add `hasAnalysisResults` derived state: `true` when `clientName !== null || keySkills.length > 0 || hiddenNeeds.length > 0`
  - [ ] 4.2: Render `<JobAnalysisPanel>` between the analysis area and `GenerateButton`
  - [ ] 4.3: Pass `onGenerateClick` prop that triggers existing generation handler
  - [ ] 4.4: Remove or reposition the individual inline components (ClientNameDisplay, SkillTags, HiddenNeedsDisplay) from their original placements into the panel — they now live inside `JobAnalysisPanel`

- [ ] Task 5: Write tests (AC: All)
  - [ ] 5.1: `JobAnalysisPanel` renders nothing when `visible` is `false`
  - [ ] 5.2: `JobAnalysisPanel` renders all three sections when analysis data is provided
  - [ ] 5.3: `JobAnalysisPanel` renders "Client: Unknown" when `clientName` is null
  - [ ] 5.4: `JobAnalysisPanel` renders skill tags for provided skills array
  - [ ] 5.5: `JobAnalysisPanel` renders "No skills detected" when skills array is empty
  - [ ] 5.6: `JobAnalysisPanel` renders hidden needs with need + evidence for each item
  - [ ] 5.7: `JobAnalysisPanel` renders "No hidden needs detected" when array is empty
  - [ ] 5.8: "Generate Proposal" button calls `onGenerateClick` when clicked
  - [ ] 5.9: "Generate Proposal" button is disabled during active generation
  - [ ] 5.10: Panel has `role="region"` and proper `aria-label`
  - [ ] 5.11: Section headings are rendered as semantic heading elements

## Dev Notes

### Dependencies

- **Story 4a-2 (HARD DEPENDENCY):** Creates `ClientNameDisplay` component and `clientName` state in App.tsx
- **Story 4a-3 (HARD DEPENDENCY):** Creates `SkillTags` component and `keySkills` state in App.tsx
- **Story 4a-4 (HARD DEPENDENCY):** Creates `HiddenNeedsDisplay` component and `hiddenNeeds` state in App.tsx
- **Story 4a-6 (SOFT DEPENDENCY):** Loading state transitions to results display — panel appears after loading completes

### Existing Code References

| File | What's There (after 4a-4) | What to Change |
| :--- | :--- | :--- |
| `src/App.tsx` | Individual `ClientNameDisplay`, `SkillTags`, `HiddenNeedsDisplay` rendered inline | Wrap in `JobAnalysisPanel`, add `hasAnalysisResults` state |
| `src/components/ClientNameDisplay.tsx` | Minimal inline client name text | No change — rendered inside panel |
| `src/components/SkillTags.tsx` | Styled tag chips for skills | No change — rendered inside panel |
| `src/components/HiddenNeedsDisplay.tsx` | Need + evidence list | No change — rendered inside panel |
| `src/components/GenerateButton.tsx` | Primary action button styling | Reference for CTA button styling |
| `src/App.css` | Card pattern (`.proposal-output`), theme variables | Reference for panel container styling |

### Edge Cases

- **Partial results:** Analysis may return client name but no skills or hidden needs (e.g., very vague post). Panel still shows all sections with appropriate empty states.
- **Re-analysis:** User clicks "Analyze" again — panel updates in place with new results. No duplicate panels.
- **Long skill lists (>7 tags):** Skills section should wrap gracefully with horizontal flow (already handled by `SkillTags` component)
- **Long evidence strings:** Hidden need evidence text should wrap naturally within the panel width. No truncation.
- **Generation in progress:** "Generate Proposal" CTA should be disabled while streaming is active (prevent duplicate generation)
- **Panel visibility transition:** Panel appears after analysis completes. If using fade-in animation, respect `prefers-reduced-motion`.

### Scope Boundaries

**In scope:**

- `JobAnalysisPanel` wrapper component with section layout
- Section headers with visual hierarchy
- Relocating individual display components into the panel
- "Generate Proposal" CTA button within panel
- Panel CSS with dark/light mode support
- Accessible semantic HTML structure

**Out of scope:**

- Changing the individual display component internals (ClientNameDisplay, SkillTags, HiddenNeedsDisplay already handle their own rendering)
- Integrating analysis data into the generation prompt (Epic 5, Story 5-8)
- Job scoring or match percentage display (Epic 4b)
- Collapsible/expandable sections (future polish, not MVP)
- Editing or correcting extracted data (not in scope)

### NFR Targets

| NFR | Target | Validation |
| :--- | :--- | :--- |
| Render time | <50ms after data available | No heavy computation, pure render of props |
| Accessibility | WCAG 2.1 AA | Semantic headings, `role="region"`, `aria-label`, no color-only indicators |
| Theme support | Dark + light mode | All colors via CSS variables |

### References

- [FR-2: prd.md Section 4.2 — Job Analysis extraction scope]
- [UX Spec: Information hierarchy and card patterns]
- [UX Spec: Color-coded icons + text, never color alone]
- [Story 4a-2: ClientNameDisplay (minimal, defers to 4a-7)]
- [Story 4a-3: SkillTags (minimal, defers to 4a-7)]
- [Story 4a-4: HiddenNeedsDisplay (minimal, defers to 4a-7)]
- [Story 4a-6: Loading state transitions to results display]
- [Pattern: ProposalOutput.tsx card styling in App.css]
