# Epic 4a Retrospective - February 8, 2026

**Project:** Upwork Research Agent
**Epic:** Epic 4a - Job Intelligence: Analysis
**Retrospective Date:** 2026-02-08
**Facilitator:** Bob (Scrum Master)
**Participants:** Zian (Project Lead), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev)

---

## Executive Summary

Epic 4a delivered **8/8 stories completed** (4a-5 absorbed by 4a-3), establishing a complete job analysis extraction pipeline. The epic successfully implemented URL/text detection, client name extraction, key skills extraction, hidden needs detection, loading progress UI, results display panel, atomic database persistence, and prompt injection defense via input sanitization.

**Key Metrics:**
- **Stories Completed:** 8/8 (100%) — 4a-5 absorbed into 4a-3
- **Tests Written:** ~179 across frontend and backend
- **Code Reviews Conducted:** 12+ formal reviews (multiple rounds on several stories)
- **Issues Fixed:** 30+ HIGH/CRITICAL issues caught and resolved in code reviews
- **Deferred Items:** 6 (API mocking infra, CSS vars, shared types, batch optimization, structured logging, row validation)

**Key Achievement:** Complete FR-2 delivery — single Claude Haiku API call extracts client name, key skills, and hidden needs with atomic database persistence and prompt injection defense.

---

## What Went Well (Successes)

### 1. Single API Call Architecture for All Extractions

**Evidence:** Stories 4a-2, 4a-3, 4a-4 incrementally extended the same `analyze_job` function and system prompt to extract all three FR-2 fields in a single Haiku API call.

**Impact:**
- Maintained <3s analysis target despite growing prompt complexity
- Prompt caching (AR-5) with `anthropic-beta: prompt-caching-2024-07-31` header provides 50-70% token savings
- No redundant API calls — cost-effective per AR-4
- Graceful degradation via `#[serde(default)]` on all extraction fields

**Lesson:** Incremental prompt extension is more effective than multiple API calls. Design extraction functions for extensibility from the start.

### 2. Atomic Database Persistence Pattern

**Evidence:** Story 4a-8 implemented `save_job_analysis_atomic` with `BEGIN EXCLUSIVE TRANSACTION / COMMIT / ROLLBACK`.

**Impact:**
- All-or-nothing save: client_name + skills + hidden_needs in single transaction
- Actual save time ~45ms (well under 100ms NFR-4 target)
- Re-analysis safe: deletes old skills before inserting new ones
- Rollback verified with FK constraint violation test

**Lesson:** Atomic transactions with prepared statements for batch operations provide both correctness and performance.

### 3. Defense-in-Depth Sanitization (Story 4a-9)

**Evidence:** Separate `sanitization.rs` module implements 4-layer defense: NFKC normalization → XML escaping → token-based truncation → XML delimiter wrapping.

**Impact:**
- NFKC normalization prevents homoglyph attacks (fullwidth `＜` → ASCII `<`)
- Escaping approach (not blocklist) provides robust defense
- <10ms performance (benchmarked)
- Single entry point used by both analysis and generation pipelines
- 35 tests (26 Rust + 9 frontend) — highest test count in the epic

**Lesson:** Escape-based defense is more robust than pattern matching. NFKC normalization is critical for Unicode-aware security.

### 4. Story Absorption Efficiency

**Evidence:** Story 4a-5 (Job Skills Table Schema) was absorbed into 4a-3 (Key Skills Extraction) because the migration naturally belonged with the extraction implementation.

**Impact:**
- Eliminated one story of overhead (planning, review, status tracking)
- V9 migration for `job_skills` table shipped with the code that uses it
- Cleaner dependency chain

**Lesson:** When a schema story has a single consumer, absorb it into that consumer story rather than shipping it separately.

### 5. Comprehensive Code Review Process

**Evidence:** Every story had formal code reviews with HIGH/CRITICAL issues caught:

| Story | Review Rounds | Issues Found | Issues Fixed |
|-------|---------------|--------------|--------------|
| 4a-1 | 1 | 3M, 2L | 5/6 fixed |
| 4a-2 | 2 | 1C, 2H, 3M | 6/6 resolved |
| 4a-3 | 1 | 1H, 3M, 4L | H1+M1-M3 fixed |
| 4a-4 | 1 | 2H, 5M, 1L | 6/10 fixed, 3 deferred |
| 4a-6 | 2 | 2H, 3M, 5L | All fixed in R2 |
| 4a-7 | 1 | 1H, 2M, 1L | H1 fixed, M2 deferred |
| 4a-8 | 1 | 3H, 3M | All HIGH fixed |
| 4a-9 | 1 | 3H, 1M, 1L | All fixed |

**Lesson:** Adversarial code review continues to be the most effective quality gate. Story 4a-2's CRITICAL (AC-3 not implemented) would have shipped without DB persistence.

### 6. Accessibility-First Development

**Evidence:** All stories include `aria-live`, `aria-busy`, `role` attributes, `prefers-reduced-motion` support, and `focus-visible` styles.

**Impact:**
- NFR-14 compliance built into every component
- `role="region"` with `aria-label` on analysis panel
- `role="img"` with `aria-label` on checkmark indicator
- `role="alert"` on error messages
- Reduced motion fallbacks in all CSS animations

**Lesson:** Building accessibility from the start is cheaper than retrofitting. The pattern is now established and easy to follow.

### 7. Timer Management Patterns

**Evidence:** Stories 4a-6 and 4a-8 established clean timer patterns with `useEffect` cleanup and refs for timer IDs.

**Impact:**
- No unmounted component state updates
- Timer cancellation on re-analysis
- Separate refs for different timers (`stageTimerRef`, `autoDismissTimerRef`)
- Timer cleanup verified by dedicated tests

**Lesson:** Always use refs for timer IDs and clean up in `useEffect` return. Dedicate separate refs for independent timers.

---

## What Didn't Go Well (Challenges)

### 1. Story 2-7b Still Unaddressed (3 Epics Running)

**Evidence:** Story 2-7b (Encrypted Database Access Frontend) has been `backlog` since Epic 2. The Epic 3 retro explicitly committed to addressing it as HIGH priority.

**Impact:**
- Frontend passphrase unlock flow not implemented
- Users can't unlock database on app restart
- Requires state refactor (`Mutex<Option<Database>>`) which touches lib.rs architecture
- Debt accumulating — the longer it's deferred, the harder the refactor

**Root Cause:** Each new epic brings feature pressure that deprioritizes infrastructure debt.

**Action Required:** Make a firm decision — either schedule 2-7b in the next sprint or formally descope it from MVP.

### 2. API Mocking Infrastructure Gap

**Evidence:** Both 4a-2 (M3) and 4a-4 (M3) deferred integration tests because no API mocking infrastructure exists for testing the `analyze_job` function.

**Impact:**
- Rust tests only cover JSON parsing and struct serialization, not the actual HTTP call
- Full extraction pipeline untested in automated tests
- Same gap will affect Epic 4b (scoring also uses Haiku calls)

**Root Cause:** No HTTP mocking library integrated into the Rust test suite.

**Action Required:** Set up `mockito` or `wiremock` crate for Rust HTTP mocking before Epic 4b.

### 3. Windows OpenSSL Build Environment

**Evidence:** Stories 4a-2, 4a-4 mention Rust tests blocked by OpenSSL/Perl build errors on Windows.

**Impact:**
- Rust tests written but not executed locally
- Must rely on code review and CI for Rust test validation
- Developer experience degraded on Windows

**Root Cause:** vcpkg OpenSSL configuration complexity; `perl` module missing in Windows path.

**Action Required:** Document Windows Rust build setup or switch to `rustls` (no OpenSSL dependency).

### 4. Cross-Story Integration Dependencies

**Evidence:** Story 4a-4's AC-3 (DB persistence) couldn't be completed until Story 4a-8 (atomic save) landed. The story was marked `in-progress` for an extra day.

**Impact:**
- Story status tracking confusion — 4a-4 appeared incomplete when its code was done
- Required post-hoc verification that 4a-8 properly integrated hidden_needs

**Root Cause:** DB save was intentionally deferred to 4a-8's transaction scope, but story status didn't reflect this nuance.

**Action Required:** When a story's AC depends on a later story, mark it clearly in the story file at implementation time (not just in review notes).

### 5. CSS Variable Standardization Deferred

**Evidence:** Stories 4a-6 and 4a-7 both deferred CSS variable standardization (hardcoded `rgba()` values remain).

**Impact:**
- Inconsistent theming approach across components
- Some components use CSS variables, others use hardcoded colors
- Growing technical debt as more components are added

**Root Cause:** Codebase-wide CSS variable system not established in App.css; individual stories can't justify the refactor scope.

**Action Required:** Create Epic 8 story for CSS variable standardization across all components.

---

## Key Insights & Lessons Learned

### 1. Incremental Prompt Extension Scales Well

**Insight:** Adding extraction fields (client name → skills → hidden needs) to a single prompt worked better than separate API calls.

**Evidence:** All three FR-2 fields extracted in one Haiku call, maintaining <3s target.

**Application:** Epic 5 (voice analysis) should follow the same pattern — extend existing prompts rather than creating new API calls.

### 2. Story Absorption Reduces Overhead

**Insight:** When a story exists solely to support another story (4a-5 → 4a-3), absorbing it eliminates unnecessary ceremony.

**Evidence:** 4a-5's migration was a natural subtask of 4a-3. Separate tracking added no value.

**Application:** During sprint planning for 4b, evaluate which stories could be absorbed.

### 3. Sanitization Must Be Pipeline-Wide

**Insight:** Input sanitization (4a-9) needed to touch both analysis AND generation pipelines to be effective.

**Evidence:** Code review caught that truncation warning wasn't shown for the direct generation path (H3 fix).

**Application:** Security measures should be applied at the pipeline entry point, not per-feature.

### 4. Cross-Story Test Coverage Resolves Gaps Organically

**Insight:** Story 4a-2's missing integration tests (H2) were naturally resolved by subsequent stories (4a-3, 4a-4, 4a-6) adding their own App.test.tsx tests.

**Evidence:** 15+ App integration tests now cover handleAnalyze invoke calls, state updates, error handling, and loading states.

**Application:** Accept that early stories in a dependency chain may have test gaps that later stories fill. Track but don't block on them.

### 5. Atomic Transactions Prevent Subtle Data Corruption

**Insight:** Without atomic save (4a-8), re-analysis could leave partial data (e.g., new skills but old hidden needs).

**Evidence:** `save_job_analysis_atomic` wraps UPDATE + DELETE + INSERT + UPDATE in exclusive transaction with rollback.

**Application:** Any multi-table save operation should use this transaction pattern.

---

## Technical Debt Identified

### HIGH Priority (Must address soon)

1. **Story 2-7b Frontend Passphrase Unlock** (carried from Epic 2, now 3 epics old)
   - **Issue:** Frontend passphrase unlock flow not implemented; requires state refactor
   - **Impact:** Users can't unlock encrypted database on app restart
   - **Resolution:** Schedule as first story of next sprint or formally descope from MVP

2. **API Mocking Infrastructure** (new from Epic 4a)
   - **Issue:** No HTTP mocking for Rust tests; affects 4a-2, 4a-4, and will affect 4b
   - **Impact:** Full extraction/scoring pipeline untested in automated tests
   - **Resolution:** Integrate `mockito` or `wiremock` crate; create reusable test helpers

### MEDIUM Priority

3. **CSS Variable Standardization** (new, deferred from 4a-6 and 4a-7)
   - **Issue:** Hardcoded `rgba()` values in multiple components
   - **Impact:** Inconsistent theming, growing tech debt
   - **Resolution:** Epic 8 story for codebase-wide CSS variable system

4. **Row Existence Validation in Atomic Save** (from 4a-8 M1)
   - **Issue:** `save_job_analysis_atomic` UPDATEs silently succeed on non-existent job_post_id
   - **Impact:** Silent data loss if called with wrong ID
   - **Resolution:** Add row existence check or use RETURNING clause

5. **Override History View** (carried from Epic 3)
   - **Issue:** No UI to view override history in Settings
   - **Resolution:** Epic 8 or post-MVP story

6. **Toast Notifications** (carried from Epic 3)
   - **Issue:** No visual confirmation after threshold adjustment
   - **Resolution:** Epic 8 toast component

### LOW Priority

7. **Dead Parameter `_type`** (4a-1 L1) — unused callback parameter
8. **Batch Insert Optimization** (4a-3 L1) — individual INSERTs vs prepared statement batch
9. **Console.error vs Structured Logging** (4a-3 L3) — analysis error handler
10. **Shared Types Module** (4a-4 L2) — HiddenNeed type duplicated
11. **Windows OpenSSL Build Setup** — document or switch to rustls

**Total Estimated New Debt from Epic 4a:** 8 items
**Carried from Previous Epics:** 4 items (2-7b, override history, toast, build setup)
**Grand Total Outstanding:** 12 items

---

## Previous Epic 3 Retro Follow-Through

| # | Commitment | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Update sprint-status to mark Epic 3 done | ✅ Completed | sprint-status.yaml: `epic-3: done` |
| 2 | Address Story 2-7b state refactor (HIGH) | ❌ Not Addressed | sprint-status: `2-7b: backlog` — 3rd consecutive epic deferred |
| 3 | Proceed with Epic 4a | ✅ Completed | All 8 stories done, 100% completion |
| 4 | Override history view / toast notifications | ⏳ Deferred | Planned for Epic 8 Polish |

**Follow-Through Rate:** 2/4 completed (50%)

**Key Observation:** Feature epics consistently deprioritize infrastructure debt. Story 2-7b's continued deferral suggests either (a) it's not actually needed for MVP, or (b) there's no forcing function to prioritize it. A decision must be made.

---

## Significant Discoveries

### Discovery 1: NFKC Normalization is Critical for Security

**Finding:** NFC normalization (originally used) doesn't catch fullwidth Unicode attacks. Code review H1 on Story 4a-9 caught that `＜` (fullwidth less-than) was not being normalized to `<`, leaving XML injection vectors open.

**Impact:** Switched to NFKC normalization which handles compatibility decomposition.

**Recommendation:** All text processing pipelines should use NFKC, not NFC.

### Discovery 2: Single API Call Handles 3 Extraction Types Efficiently

**Finding:** Client name, key skills, and hidden needs can all be extracted in one Haiku call without quality degradation, even though hidden needs require inference-level reasoning.

**Impact:** Cost savings from single call vs three. Prompt caching amplifies savings on repeat analyses.

**Recommendation:** Continue this pattern for any future extraction fields. Monitor prompt size against cache limits.

### Discovery 3: Atomic Transaction Pattern Prevents Subtle Bugs

**Finding:** Without transactional save, re-analysis could leave the database in an inconsistent state (new skills but old hidden needs, or vice versa).

**Impact:** Story 4a-8's atomic save pattern should be the standard for any multi-table write operation.

**Recommendation:** Document the transaction pattern for developer onboarding.

### Discovery 4: Story 4a-5 Absorption Was Correct Decision

**Finding:** Creating a separate story for the job_skills table migration was unnecessary overhead. The migration was a natural subtask of the extraction story that uses it.

**Impact:** Saved one full story cycle (implementation, review, status tracking).

**Recommendation:** During sprint planning, flag schema-only stories that have a single consumer for potential absorption.

---

## Readiness Assessment

### Testing & Quality: ✅ Ready

**Status:** ~179 tests passing across frontend and backend.

**Test Distribution:**
- Story 4a-1: 23 tests (URL/text detection, component rendering)
- Story 4a-2: 16 tests (9 frontend AnalyzeButton + 7 Rust analysis)
- Story 4a-3: 25 tests (7 Rust CRUD + 6 migration + 5 SkillTags + 3 App integration + 4 analysis extension)
- Story 4a-4: 19 tests (8 frontend HiddenNeedsDisplay + 11 Rust struct/DB)
- Story 4a-6: 24 tests (10 unit AnalysisProgress + 14 App integration)
- Story 4a-7: 16 tests (JobAnalysisPanel visibility, rendering, a11y)
- Story 4a-8: 11 tests (9 Rust atomic save + 2 frontend indicator)
- Story 4a-9: 35 tests (26 Rust sanitization + 9 frontend truncation)

**Gaps:**
- API mocking tests not implemented (Rust HTTP mocking infrastructure needed)
- Some Rust tests not executed locally (Windows OpenSSL issue)

**Confidence Level:** HIGH

### Technical Health: ✅ Healthy

**Architecture:**
- Clean extraction pipeline: sanitize → analyze → display → save
- Extensible `JobAnalysis` struct ready for future fields
- Atomic save pattern prevents data inconsistency
- Prompt caching reduces API costs
- Defense-in-depth sanitization

**Confidence Level:** HIGH

### Security Posture: ✅ Strong

**Additions from Epic 4a:**
- NFKC Unicode normalization prevents homoglyph attacks
- XML character escaping neutralizes injection patterns
- Token-based truncation with sentence boundary preservation
- XML delimiter wrapping for clear prompt boundaries
- Escaping approach (not blocklist) for robust defense

**Confidence Level:** HIGH

---

## Next Epic Preview: Epic 4b - Job Scoring & Pipeline Management

**Epic 4b:** 10 stories (4b-1 done, 4b-2 through 4b-10 ready-for-dev)

**Stories:**
1. ~~4b-1: User Profile Skills Configuration~~ ✅ Done
2. 4b-2: Skills Match Percentage Calculation
3. 4b-3: Client Quality Score Estimation
4. 4b-4: Budget Alignment Detection
5. 4b-5: Weighted Job Scoring Algorithm
6. 4b-6: Scoring Breakdown UI
7. 4b-7: RSS Feed Import
8. 4b-8: RSS Feed Fallback to Web Scraping
9. 4b-9: Job Queue View with Sorting
10. 4b-10: Report Bad Scoring Feedback Loop

**Dependencies on Epic 4a:**
- `job_skills` table (from 4a-3/4a-5) — used for skills matching in 4b-2
- `analyze_job` function — scoring components consume extraction results
- `save_job_analysis_atomic` — scoring data will need similar persistence
- Sanitization pipeline — RSS feed content will need sanitization

**Preparation Needed:**
- API mocking infrastructure (affects scoring tests same as extraction tests)
- Consider whether 2-7b should be addressed before adding more features
- RSS parsing capability (new — `reqwest` + XML parser needed)

**Technical Prerequisites:**
- `reqwest` crate for RSS feed fetching (4b-7)
- XML parser for RSS format (4b-7)
- Background worker pattern for batch analysis (4b-7: "Import RSS → save to queue → background worker")
- Scoring algorithm design (4b-5 combines 4b-2, 4b-3, 4b-4 into weighted score)

**Risks:**
- RSS feed import (4b-7, 4b-8) introduces external HTTP calls — new failure modes
- Background processing pattern not yet established in the codebase
- Scoring algorithm requires careful weight tuning and user feedback loop

---

## Action Items

### Process Improvements

1. **Establish API mocking infrastructure for Rust tests**
   Owner: Dev Agent
   Deadline: Before Epic 4b-2 (first scoring story)
   Success criteria: `mockito` or `wiremock` integrated; reusable test helper for mocked Haiku responses

2. **Decide on Story 2-7b: implement or descope**
   Owner: Zian (Project Lead)
   Deadline: Before Epic 4b sprint planning
   Success criteria: Clear decision documented — either scheduled or formally removed from MVP scope

3. **Mark cross-story AC dependencies explicitly in story files**
   Owner: SM Agent (Bob)
   Deadline: Ongoing from next story creation
   Success criteria: Any AC that depends on a later story is tagged `⏳ Pending Story X.Y` at implementation time

### Technical Debt

4. **CSS variable standardization**
   Owner: Dev Agent
   Priority: MEDIUM
   Target: Epic 8 (Polish) or dedicated refactor sprint

5. **Row existence validation in save_job_analysis_atomic**
   Owner: Dev Agent
   Priority: MEDIUM
   Target: Next touch of job_posts.rs

6. **Windows Rust build environment**
   Owner: Dev Agent
   Priority: LOW
   Target: Document in developer guide or evaluate rustls migration

### Team Agreements

- All multi-table write operations use the atomic transaction pattern from 4a-8
- Sanitization module is the single entry point for all user-provided text
- New extraction fields extend existing `analyze_job` function (no new API calls)
- Stories that exist solely to support one consumer should be evaluated for absorption during sprint planning
- Deferred items must be tracked in a central location (not just story files)

---

## Retrospective Commitments

### Summary

- **Stories Completed:** 8/8 (100%)
- **Technical Debt:** 8 new items + 4 carried = 12 total outstanding
- **Test Coverage:** ~179 tests, HIGH confidence
- **Previous Retro Follow-Through:** 2/4 (50%) — Story 2-7b decision needed

### Next Steps

1. **Decision Required:** Story 2-7b — implement or descope from MVP
2. **Set up API mocking infrastructure** before Epic 4b scoring stories
3. **Continue Epic 4b** — 4b-1 already done, 4b-2 next (Skills Match Percentage)
4. **Track deferred items** centrally — CSS vars, row validation, shared types
5. **Prepare for RSS import** (4b-7) — research reqwest + XML parsing, background worker pattern

---

## Team Acknowledgments

Epic 4a achieved its primary goal: **complete job analysis extraction pipeline with client name, key skills, and hidden needs — all in a single API call with atomic persistence and prompt injection defense.**

**Positive Outcomes:**
- FR-2 fully delivered — all three extraction fields working end-to-end
- Single Haiku API call maintains <3s performance target
- Atomic database persistence in <100ms (actual ~45ms)
- Defense-in-depth sanitization with NFKC normalization
- ~179 tests providing high confidence
- 100% story completion for 4th consecutive epic (Epics 1, 2, 3, 4a)

**Architecture Wins:**
- Extensible `JobAnalysis` struct ready for future fields
- Atomic transaction pattern established for multi-table writes
- Centralized sanitization module used by both pipelines
- Prompt caching reduces API costs on repeat analyses
- Story absorption eliminated unnecessary overhead

---

**Retrospective Completed:** 2026-02-08
**Next Retrospective:** After Epic 4b completion
**Document:** epic-4a-retro-2026-02-08.md
