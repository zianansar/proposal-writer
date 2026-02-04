---
status: review
assignedTo: "dev-agent"
tasksCompleted: 3
totalTasks: 3
testsWritten: false
fileList:
  - upwork-researcher/src-tauri/Cargo.toml
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

- [x] Task 1: Set up test environment
  - [x] Subtask 1.1: Set ANTHROPIC_API_KEY environment variable
  - [x] Subtask 1.2: Run app with `npm run tauri dev`
  - [x] Subtask 1.3: Prepare 5 sample job posts from different industries

- [x] Task 2: Generate and test proposals
  - [x] Subtask 2.1: Generate proposal for job post #1, test with AI detection
  - [x] Subtask 2.2: Generate proposal for job post #2, test with AI detection
  - [x] Subtask 2.3: Generate proposal for job post #3, test with AI detection
  - [x] Subtask 2.4: Generate proposal for job post #4, test with AI detection
  - [x] Subtask 2.5: Generate proposal for job post #5, test with AI detection

- [x] Task 3: Document findings
  - [x] Subtask 3.1: Record perplexity scores for each proposal
  - [x] Subtask 3.2: Note patterns in passing/failing proposals
  - [x] Subtask 3.3: Document recommendations for Epic 3 safety thresholds
  - [x] Subtask 3.4: Update this story with results

## Dev Notes

### Results Template

| # | Industry | Job Excerpt | Detection Score | Tool Used | Pass/Fail |
|---|----------|-------------|-----------------|-----------|-----------|
| 1 | SaaS/CRM | CRM setup specialist | GPTCleanup: 45% human, ZeroGPT: 25% AI | GPTCleanup, ZeroGPT | PASS ✅ |
| 2 | Automation | Automation setup | ZeroGPT: 68% AI | ZeroGPT | FAIL ❌ |
| 3 | UI/UX Design | UI/UX design work | ZeroGPT: 98% AI | ZeroGPT | FAIL ❌ |
| 4 | ML/Data Analysis | Machine learning data analysis | ZeroGPT: 89% AI | ZeroGPT | FAIL ❌ |
| 5 | Copywriting | Content writing/marketing | ZeroGPT: 100% AI | ZeroGPT | FAIL ❌ |

**Summary:** 1/5 passed (20% success rate) - ❌ **AC-2 FAILED** (requires 4/5 minimum, 80%)

### Observations

**Pattern Analysis:**
1. **High failure rate**: 80% of proposals (4/5) failed AI detection with scores ranging from 68-100% AI detected
2. **Industry variation**:
   - SaaS/CRM: PASSED (25% AI) - More technical, specific domain knowledge
   - Automation, UI/UX, ML/Data, Copywriting: FAILED (68-100% AI) - More creative/descriptive writing
3. **Severity of detection**: Failed proposals showed VERY high AI signatures (68-100%), not borderline failures
4. **Tool consistency**: ZeroGPT consistently detected high AI content across multiple industries
5. **Creative writing most detectable**: Copywriting scored 100% AI - highest detection rate

**Critical Finding:** Basic AI generation without humanization produces highly detectable content. The Walking Skeleton (Epic 0) concept validation FAILED - proposals are easily flagged as AI-generated.

### Recommendations for Epic 3

**CRITICAL PRIORITY - Epic 3 (Safety & Compliance) is MANDATORY, not optional:**

1. **Humanization Techniques Required:**
   - Implement perplexity-based humanization injection (Story 3-3)
   - Add adaptive threshold learning (Story 3-7)
   - Target: Reduce AI detection to <30% consistently

2. **Pre-flight Analysis Mandatory:**
   - Implement Perplexity pre-flight analysis (Story 3-1)
   - Flag high-risk sentences before generation
   - User must see warnings before copying

3. **Recommended Safety Thresholds:**
   - Block threshold: >70% AI detection (auto-warn user)
   - Warning threshold: 50-70% AI detection (suggest re-humanization)
   - Safe zone: <50% AI detection (allow copy)

4. **Industry-Specific Tuning:**
   - Technical domains (SaaS, CRM): Current approach acceptable
   - Creative domains (Copywriting, Design): Require aggressive humanization

5. **Epic 0 Decision:**
   - **DO NOT skip Epic 0** - Walking Skeleton validation failed
   - Core concept requires Epic 3 humanization to be viable
   - Skipping Epic 0 was contingent on 5/5 pass; only achieved 1/5

**BLOCKER:** Product cannot launch without Epic 3 humanization features. Current generation is not market-ready.

## References

- [Source: epics-stories.md#Story 0.5: Validate AI Detection Passing]
- [Source: architecture.md#Safety & Compliance]

## Dev Agent Record

### Implementation Plan
Fixed prerequisite issues to enable manual testing:
1. Added `default-run = "upwork-research-agent"` to Cargo.toml (resolved binary ambiguity)
2. Ran `npm install` to install missing dependencies (zustand, @tauri-apps/plugin-clipboard-manager)
3. Successfully launched app via `npm run tauri dev`

### Completion Notes
✅ **All tasks completed:**
- Task 1: Environment setup (app running successfully)
- Task 2: Generated and tested 5 proposals across diverse industries
- Task 3: Documented findings with comprehensive analysis

❌ **Acceptance Criteria Results:**
- **AC-1**: ✅ PASSED - Tested 5 job posts from different industries (SaaS, Automation, UI/UX, ML/Data, Copywriting)
- **AC-2**: ❌ FAILED - Only 1/5 proposals passed (20%), required 4/5 (80%)
- **AC-3**: ✅ PASSED - Findings documented with Epic 3 recommendations

**Critical Finding:** Basic AI generation produces highly detectable content (68-100% AI detection). Epic 3 humanization features are **MANDATORY** for product viability.

### File List
- upwork-researcher/src-tauri/Cargo.toml

## Change Log
- 2026-02-04: Story created - Manual testing story for AI detection validation
- 2026-02-04: Fixed app launch issues (Cargo.toml default-run, npm deps) - Dev Agent
- 2026-02-04: Completed manual testing - 1/5 passed (AC-2 FAILED), Epic 3 mandatory - Dev Agent
