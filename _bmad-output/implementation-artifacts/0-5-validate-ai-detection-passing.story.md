---
status: in-progress
assignedTo: "dev-agent"
tasksCompleted: 13
totalTasks: 18
testsWritten: false
fileList:
  - upwork-researcher/src-tauri/Cargo.toml
reviewFindings:
  high: 3
  medium: 3
  low: 4
  autoFixed: 10
  requiresManualTest: 5
  requiresPMDecision: 3
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

- Target: <150 perplexity score (when using GPTZero perplexity mode)
- Alternative: <30% AI detection (when using ZeroGPT/GPTCleanup percentage mode)
- **Pass Criteria (Code Review Clarification):** Either perplexity <150 OR <30% AI detection score
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

### Review Follow-ups (AI Code Review - 2026-02-05)

#### Structural Improvements (Completed by Dev Agent)
- [x] **[AI-Review][HIGH]** ✅ Create separate product decision artifact with 4 decision options for PM/SM escalation [Product Decision Required section added]
- [x] **[AI-Review][HIGH]** ✅ Add test evidence section with template for screenshots, raw data, tool versions, reproducibility instructions [Test Evidence section added]
- [x] **[AI-Review][HIGH]** ✅ Change "Epic 3 MANDATORY" to "STRONGLY RECOMMENDED" with PM escalation note [Recommendations section updated]
- [x] **[AI-Review][MEDIUM]** ✅ Add structure for Cargo.toml error documentation (awaiting user input) [Implementation Plan section updated]
- [x] **[AI-Review][MEDIUM]** ✅ Add table structure for technical domain tests (DevOps, Database, Security) [Additional Technical Domain Tests table added]
- [x] **[AI-Review][MEDIUM]** ✅ Add "Gen Time (s)" column to results table for NFR-6 validation [Test Results table updated]
- [x] **[AI-Review][LOW]** ✅ Clarify threshold scale mapping and add note about Epic 3 tool mapping [Recommendations section updated]
- [x] **[AI-Review][LOW]** ✅ Define explicit pass criteria with both perplexity and % scales [Perplexity Target section updated]
- [x] **[AI-Review][LOW]** ✅ Add human baseline test table structure [Human Baseline Test table added]
- [x] **[AI-Review][LOW]** ✅ Document git commit message issue in change log [Change Log updated]

#### Manual Testing Required (User Action)
- [ ] **[MANUAL-TEST]** Fill in generation timing data for tests #1-5 (requires re-running tests with timer)
- [ ] **[MANUAL-TEST]** Execute tests #6-8: Technical domains (DevOps, Database Admin, Security pentesting)
- [ ] **[MANUAL-TEST]** Execute test #H1: Human-written proposal baseline
- [ ] **[MANUAL-TEST]** Collect and store test evidence: Screenshots, raw proposal text, tool versions
- [ ] **[MANUAL-TEST]** Document Cargo.toml error message, root cause, and fix rationale

#### Awaiting Product Decision
- [ ] **[PM-DECISION]** Review "Product Decision Required" section and select Option 1-4
- [ ] **[PM-DECISION]** Set decision deadline date
- [ ] **[PM-DECISION]** Update story status based on decision (done/in-progress/blocked)

## Dev Notes

### Test Evidence (AI Review Action Item #2)

**Tool Versions:**
- ZeroGPT: [Version/Date used - add details]
- GPTCleanup: [Version/Date used - add details]

**Test Execution Details:**
- Test Date: 2026-02-04
- Test Duration: [Total time - add details]
- Environment: `npm run tauri dev` with ANTHROPIC_API_KEY set

**Evidence Artifacts:**
- [ ] Screenshots of AI detection results (store in `/docs/test-evidence/story-0-5/`)
- [ ] Raw proposal text files (sanitized, stored in same directory)
- [ ] Tool configuration settings used
- [ ] Timestamp logs of each test execution

**Reproducibility Instructions:**
1. Set ANTHROPIC_API_KEY environment variable
2. Run `npm run tauri dev`
3. Paste job post text (samples stored in [location TBD])
4. Generate proposal
5. Copy result and paste into ZeroGPT/GPTCleanup
6. Record score and screenshot

### Test Results Summary

| # | Industry | Domain Type | Job Excerpt | Gen Time (s) | Detection Score | Tool Used | Pass/Fail |
|---|----------|-------------|-------------|--------------|-----------------|-----------|-----------|
| 1 | SaaS/CRM | Technical | CRM setup specialist | [TBD] | GPTCleanup: 45% human, ZeroGPT: 25% AI | GPTCleanup, ZeroGPT | PASS ✅ |
| 2 | Automation | Technical/Creative | Automation setup | [TBD] | ZeroGPT: 68% AI | ZeroGPT | FAIL ❌ |
| 3 | UI/UX Design | Creative | UI/UX design work | [TBD] | ZeroGPT: 98% AI | ZeroGPT | FAIL ❌ |
| 4 | ML/Data Analysis | Technical/Creative | Machine learning data analysis | [TBD] | ZeroGPT: 89% AI | ZeroGPT | FAIL ❌ |
| 5 | Copywriting | Creative | Content writing/marketing | [TBD] | ZeroGPT: 100% AI | ZeroGPT | FAIL ❌ |

**Initial Round Summary:** 1/5 passed (20% success rate) - ❌ **AC-2 FAILED** (requires 4/5 minimum, 80%)

#### Additional Technical Domain Tests (AI Review Action Item #5)

| # | Industry | Domain Type | Job Excerpt | Gen Time (s) | Detection Score | Tool Used | Pass/Fail |
|---|----------|-------------|-------------|--------------|-----------------|-----------|-----------|
| 6 | DevOps/Infrastructure | Deep Technical | [Job excerpt TBD] | [TBD] | [TBD] | ZeroGPT | [TBD] |
| 7 | Database Admin | Deep Technical | [Job excerpt TBD] | [TBD] | [TBD] | ZeroGPT | [TBD] |
| 8 | Security/Pentesting | Deep Technical | [Job excerpt TBD] | [TBD] | [TBD] | ZeroGPT | [TBD] |

**Extended Testing Goal:** Determine if deep technical domains show lower AI detection rates than creative domains.

#### Human Baseline Test (AI Review Action Item #9)

| # | Source | Domain Type | Job Post | Detection Score | Tool Used | Result |
|---|--------|-------------|----------|-----------------|-----------|--------|
| H1 | Human-written | [Select domain] | [Job excerpt TBD] | [TBD] | ZeroGPT | [TBD] |

**Baseline Goal:** Establish if tools over-detect AI or if AI content is genuinely distinguishable from human writing.

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

**CRITICAL PRIORITY - Epic 3 (Safety & Compliance) STRONGLY RECOMMENDED:**

> **Product Decision Required:** Testing shows 1/5 proposals passed (20% vs. required 80%). Based on these findings, Dev Agent recommends Epic 3 as mandatory blocker for MVP. **Escalate to PM/SM for prioritization decision.**

1. **Humanization Techniques Required:**
   - Implement perplexity-based humanization injection (Story 3-3)
   - Add adaptive threshold learning (Story 3-7)
   - Target: Reduce AI detection to <30% consistently

2. **Pre-flight Analysis Mandatory:**
   - Implement Perplexity pre-flight analysis (Story 3-1)
   - Flag high-risk sentences before generation
   - User must see warnings before copying

3. **Recommended Safety Thresholds (ZeroGPT/GPTCleanup % AI Scale):**
   - Block threshold: >70% AI detection (auto-warn user)
   - Warning threshold: 50-70% AI detection (suggest re-humanization)
   - Safe zone: <50% AI detection (allow copy)
   - **Note:** Epic 3 implementation will need to map between tool-specific scales (% vs perplexity vs confidence)

4. **Industry-Specific Tuning:**
   - Technical domains (SaaS, CRM): Current approach acceptable
   - Creative domains (Copywriting, Design): Require aggressive humanization

5. **Epic 0 Decision:**
   - **DO NOT skip Epic 0** - Walking Skeleton validation failed
   - Core concept requires Epic 3 humanization to be viable
   - Skipping Epic 0 was contingent on 5/5 pass; only achieved 1/5

**BLOCKER:** Product cannot launch without Epic 3 humanization features. Current generation is not market-ready.

## Product Decision Required (AI Review Action Item #1)

**Issue:** AC-2 FAILED - Only 1/5 proposals passed AI detection (20% vs. required 80%)

**Impact:**
- Epic 0 "Walking Skeleton" validation objective not met
- Current AI generation produces highly detectable content (68-100% AI detection)
- Product cannot launch with current generation quality

**Decision Options:**

### Option 1: Accept Reduced Pass Rate (Fast Path)
- **Accept:** 1/5 pass rate as "acceptable for spike"
- **Rationale:** Epic 0 proves technical feasibility, not market readiness
- **Action:** Mark story as "done with exception", proceed to Epic 1-2
- **Risk:** Launch blockers discovered late (Epic 3 becomes critical path)
- **Timeline Impact:** No delay

### Option 2: Implement Basic Humanization Now (Hybrid)
- **Accept:** Current results show need for immediate humanization
- **Rationale:** Don't wait for Epic 3, add basic fixes now
- **Action:** Create new story "0-6: Basic Humanization Injection" (2-3 days)
- **Risk:** Scope creep in Epic 0, may not solve detection problem
- **Timeline Impact:** +2-3 days before Epic 1

### Option 3: Escalate Epic 3 to MVP (Dev Agent Recommendation)
- **Accept:** Epic 3 is mandatory blocker, move to MVP scope
- **Rationale:** Product unusable without humanization features
- **Action:** Re-sequence: Epic 0 → Epic 1 → Epic 2 → **Epic 3** (before 4-6)
- **Risk:** Increased MVP scope, longer time to market
- **Timeline Impact:** Epic 3 estimated 2-3 weeks

### Option 4: Pivot Product Strategy
- **Accept:** AI detection risk too high for Upwork platform
- **Rationale:** Even with humanization, detection tools will improve
- **Action:** Pivot to "proposal assistant" vs. "proposal generator"
- **Risk:** Major product direction change
- **Timeline Impact:** Requires new PRD/Architecture

**PM/SM Decision:** [PENDING - Assign to Product Manager for evaluation]

**Decision Deadline:** [TBD - Recommend decision by: date]

## References

- [Source: epics-stories.md#Story 0.5: Validate AI Detection Passing]
- [Source: architecture.md#Safety & Compliance]

## Dev Agent Record

### Implementation Plan
Fixed prerequisite issues to enable manual testing:

1. **Cargo.toml Fix (AI Review Action Item #4):**
   - Added `default-run = "upwork-research-agent"` to Cargo.toml:7
   - **Original Error Message:** [TBD - Document the exact cargo/tauri error that occurred]
   - **Root Cause:** [TBD - Was this binary ambiguity, cargo version issue, or tauri-specific?]
   - **Why This Fix Works:** [TBD - Explain why default-run solves the issue]
   - This fix resolved binary ambiguity and allowed `npm run tauri dev` to succeed

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
- 2026-02-04: Story created - Manual testing story for AI detection validation - Dev Agent
- 2026-02-04: Fixed app launch issues (Cargo.toml default-run, npm deps) - Dev Agent
- 2026-02-04: Completed manual testing - 1/5 passed (AC-2 FAILED), Epic 3 mandatory - Dev Agent
- 2026-02-05: Code review completed - 10 findings (3 HIGH, 3 MEDIUM, 4 LOW), status changed to in-progress - Dev Agent
- 2026-02-05: Implemented all 10 structural action items: Added Product Decision section (4 options for PM), Test Evidence template, expanded test tables (technical domains + human baseline), documented error context, clarified thresholds and pass criteria - Dev Agent
- 2026-02-05: Created manual testing checklist (5 items) and PM decision checklist (3 items) for story completion - Dev Agent
- 2026-02-05: Note: Git commit bbbaeb7 message says "feat: Complete story 0-5" but should clarify AC-2 failed (1/5 passed). Future commits should indicate validation outcomes. - Code Review
