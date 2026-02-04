---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 3
testsWritten: false
fileList: []
---

# Story 0.5: Validate AI Detection Passing

## Story

As a product team,
I want to validate that generated proposals pass AI detection tools,
So that we know the core concept works before investing in infrastructure.

## Acceptance Criteria

**AC-1:** Given 5 test job posts from different industries, When I generate proposals for each, Then all 5 proposals are manually tested with AI detection tools.

**AC-2:** Given AI detection testing is complete, Then at least 4/5 proposals pass with perplexity <150.

**AC-3:** Given testing is complete, Then findings are documented for Epic 3 safety threshold calibration.

## Technical Notes

### This is a Manual Testing Story

Per epics-stories.md:
- **Manual testing story (not automated)**
- Use ZeroGPT, GPTZero, or similar tools
- If 5/5 pass, Epic 0 can be skipped per Round 4 refinement

### Prerequisites

1. Stories 0-1 through 0-4 must be complete (all done)
2. `ANTHROPIC_API_KEY` environment variable must be set
3. App must be running via `npm run tauri dev`

### Test Job Posts

Recommended industries for diversity:
1. Web development / SaaS
2. Mobile app development
3. Data analysis / ML
4. UI/UX design
5. Content writing / Marketing

### AI Detection Tools

Use one or more of:
- [ZeroGPT](https://www.zerogpt.com/)
- [GPTZero](https://gptzero.me/)
- [Originality.ai](https://originality.ai/)

### Perplexity Target

- Target: <150 perplexity score
- 4/5 must pass for Epic 0 validation
- If 5/5 pass, this validates core concept

## Tasks/Subtasks

- [ ] Task 1: Set up test environment
  - [ ] Subtask 1.1: Set ANTHROPIC_API_KEY environment variable
  - [ ] Subtask 1.2: Run app with `npm run tauri dev`
  - [ ] Subtask 1.3: Prepare 5 sample job posts from different industries

- [ ] Task 2: Generate and test proposals
  - [ ] Subtask 2.1: Generate proposal for job post #1, test with AI detection
  - [ ] Subtask 2.2: Generate proposal for job post #2, test with AI detection
  - [ ] Subtask 2.3: Generate proposal for job post #3, test with AI detection
  - [ ] Subtask 2.4: Generate proposal for job post #4, test with AI detection
  - [ ] Subtask 2.5: Generate proposal for job post #5, test with AI detection

- [ ] Task 3: Document findings
  - [ ] Subtask 3.1: Record perplexity scores for each proposal
  - [ ] Subtask 3.2: Note patterns in passing/failing proposals
  - [ ] Subtask 3.3: Document recommendations for Epic 3 safety thresholds
  - [ ] Subtask 3.4: Update this story with results

## Dev Notes

### Results Template

| # | Industry | Job Excerpt | Perplexity Score | Tool Used | Pass/Fail |
|---|----------|-------------|------------------|-----------|-----------|
| 1 |          |             |                  |           |           |
| 2 |          |             |                  |           |           |
| 3 |          |             |                  |           |           |
| 4 |          |             |                  |           |           |
| 5 |          |             |                  |           |           |

**Summary:** X/5 passed

### Observations

(To be filled during testing)

### Recommendations for Epic 3

(To be filled based on findings)

## References

- [Source: epics-stories.md#Story 0.5: Validate AI Detection Passing]
- [Source: architecture.md#Safety & Compliance]

## Change Log
- 2026-02-04: Story created - Manual testing story for AI detection validation
