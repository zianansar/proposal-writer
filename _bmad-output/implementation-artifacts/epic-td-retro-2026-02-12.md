# Epic TD Retrospective - Tech Debt & Hardening

**Project:** Upwork Research Agent
**Epic:** Epic TD - Tech Debt & Hardening
**Retrospective Date:** 2026-02-12
**Facilitator:** Bob (Scrum Master)
**Participants:** Zian (Project Lead), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev)

---

## Executive Summary

Epic TD delivered **5/5 stories completed (100%)** in a single day, resolving **10 previously-deferred tech debt items** accumulated across Epics 0, 2, 4a, 4b, 5, and 8. The epic cleared both release gates identified in the Epic 8 retrospective: AI detection validation (Story 0-5 → TD-1) and recovery key re-key (Story 2-9 AC-6 → TD-2).

**Key Metrics:**
- **Stories Completed:** 5/5 (100%) — 9th consecutive epic at 100%
- **Duration:** 1 day (2026-02-12) — fastest epic in project history
- **Code Review Rounds:** 10 (2 per story, 100% multi-round)
- **Issues Found & Fixed:** 35 total (avg 7/story)
- **Debt Items Resolved:** 10 (from 6 different source epics)
- **Release Gates Cleared:** 2/2 (AI detection, recovery re-key)
- **Test Coverage:** 598+ Rust / 1298+ frontend tests passing
- **Production Incidents:** 0
- **New Technical Debt:** 3 items (AC-3 creative domain gap, 3 LOW deferred from TD-4 R2, pre-existing test failures remain)

**Key Achievement:** Cleared all MVP release blockers. Hardened security posture (zeroize, PRAGMA rekey, cross-platform file permissions). Transformed AI detection from 0/5 to 4/5 pass rate with re-humanization recovery.

---

## What Went Well (Successes)

### 1. Core Product Risk Mitigated — AI Detection (TD-1)

**Evidence:** Story 0-5 Round 2 had 0/5 proposals passing AI detection. TD-1 achieved 4/5 passing (exceeded 3/5 target). Re-humanization recovered the single failure (74.28% -> 16.28%).

**Impact:**
- Product's core value proposition now validated
- Root cause analysis identified 6 specific failure modes (vague prompts, formulaic structure, small forbidden list, conflicting quality constraints, no domain adaptation, missing personal elements)
- Forbidden word list expanded from 12 -> 35 words, hedging phrases from 4 -> 15
- Re-humanization boost system provides recovery path for failures

**Lesson:** Research-driven fixes produce dramatically better results than incremental tweaking. TD-1's investigation of perplexity distribution, burstiness, and token probability led to a fundamentally different approach, not just parameter tuning.

### 2. Security Posture Hardened — Recovery & Memory Safety (TD-2, TD-3)

**Evidence:**
- TD-2: Implemented actual SQLCipher `PRAGMA rekey` (previously a stub). Recovery key now fully re-encrypts database with new passphrase.
- TD-3: Integrated `zeroize` crate across all 7 Tauri commands handling secrets. Cross-platform file permissions (Unix 0o600, Windows icacls).

**Impact:**
- Recovery key flow is complete — users can forget passphrase, use recovery key, set new passphrase, and database is re-encrypted
- Passphrase never persists in memory after key derivation
- Recovery files have restricted OS-level permissions
- Atomic salt update with rollback prevents data loss during re-key

**Lesson:** Security features need to be complete end-to-end, not partially implemented. The "stub" pattern (implementing the UI but not the crypto) creates false confidence.

### 3. Focused Tech Debt Sprint Model Validated

**Evidence:** 10 debt items from 6 different source epics resolved in 1 day. Stories ranged from CRITICAL (TD-1) to MEDIUM (TD-4, TD-5).

**Impact:**
- Demonstrated that batching related debt items is more efficient than sprinkling fixes across feature epics
- 2 of 5 tasks were already done (voice.rs modularization, PreMigrationBackup fixes) — inventory was partially stale
- Prioritization (CRITICAL -> HIGH -> MEDIUM) ensured highest-impact items addressed first

**Lesson:** Tech debt sprints should be a regular cadence after every 2-3 epics. Debt inventories go stale — some items self-resolve during feature work.

### 4. Codebase Consolidation — CSS Tokens & Build Config (TD-5)

**Evidence:**
- 253 hardcoded hex colors replaced with `var(--token-name, #fallback)` across 26 CSS files
- Calibration mapping deduplicated — frontend mapper deleted, backend is single source of truth
- Platform-conditional `Cargo.toml` + `build.rs` detection replaces manual `.cargo/config.toml` toggling

**Impact:**
- Design token system now actually applied (not just defined)
- Calibration logic has single source of truth (eliminated frontend/backend drift risk)
- Windows and macOS developers can build without manual config toggling

**Lesson:** Consolidation work has outsized impact on maintainability. The 253-replacement CSS pass was tedious but eliminates an entire class of theming bugs.

### 5. Test Infrastructure Improvements (TD-4)

**Evidence:** Created shared `settingsPanelMocks.ts` factory. Added row existence validation to `save_job_analysis_atomic`. Fixed TOCTOU race (existence check moved inside transaction). Full suite documented.

**Impact:**
- New settings tabs can be added without breaking existing tests
- Database operations properly validate input before modification
- Rollback test rewritten to verify real failure scenarios (DROP TABLE approach)

**Lesson:** Test infrastructure improvements (shared mocks, validation patterns) are force multipliers — they make every future test easier to write correctly.

---

## What Didn't Go Well (Challenges)

### 1. 23 Pre-Existing Test Failures Not Addressed

**Evidence:** TD-4 documented 9 Rust failures and 14 frontend failures that predate the TD epic. These include keychain tests (no OS context), encrypted migration tests (DB setup prerequisite), timing-sensitive perf tests, and frontend mock drift.

**Impact:**
- Test suite green bar is not truly green — false sense of security
- Regressions in keychain, migration, or timing areas would be invisible
- New developers would see failures and not know which are "expected"

**Root Cause:** Fixing these requires infrastructure investment (Tauri test harness, keychain mocking, migration test setup) that was out of TD-4's scope.

**Recommendation:** Create a dedicated "test infrastructure" story if post-MVP work begins.

### 2. AC-3 Creative Domain Detection Gap

**Evidence:** TD-1 achieved 100% pass rate for technical domains (SaaS, Automation, UI/UX, ML) but only 50% for creative/copywriting. On strict interpretation, AC-3 ("no domain has >2x failure rate") is not fully met.

**Impact:**
- Creative/copywriting proposals remain higher risk for AI detection
- Recoverable via re-humanization, but ideally shouldn't need recovery
- Documents a genuine limitation of the humanization approach

**Root Cause:** Creative writing has higher baseline detectability — AI detection tools are better calibrated for creative text than technical proposals. Domain-specific humanization (defaulting to Heavy intensity for creative domains) would help.

**Recommendation:** If creative domain is a significant use case, consider domain-specific intensity defaults.

### 3. Code Review Burden Unchanged — 100% Multi-Round

**Evidence:** Every TD story needed 2 review rounds. 35 total issues found including:
- 1 CRITICAL: Missing failure test (TD-2)
- 1 HIGH: Undefined behavior in zeroize tests (TD-3)
- 1 HIGH: Rollback test neutered by existence check (TD-4)
- 1 HIGH: build.rs Windows warning incorrect (TD-5)
- 1 HIGH: Prompt sync gap — 3 words missing from FORBIDDEN lists (TD-1)

**Impact:**
- Code review remains the primary quality gate
- No upstream gates (lint, CI checks, automated verification) reduce reviewer burden
- 7 issues/story is consistent across all 9 MVP epics — not improving

**Root Cause:** Systemic — development produces code that passes tests but has subtle correctness, security, or design issues that only human review catches. Automated tooling could catch hardcoded colors, sync mismatches, and test coverage gaps.

### 4. Process Improvement Follow-Through — 0/5 (Carried Pattern)

**Evidence:** Epic 8 retro made 7 commitments. 2/7 completed (both were actual stories). 5 process improvements (renderWithProviders, lint checks, E2E decision, no raw render, vitest output) — none happened.

**Impact:** Confirms the meta-insight from Epic 8: standalone process improvements have a 0% execution rate. Only items encoded as stories or code changes get done.

**Follow-Through Rate Across Epics:** 17% -> 17% -> 10% -> 0% -> 29% (TD). The 29% improvement is entirely from story-based items.

---

## Key Insights & Lessons Learned

### 1. Research-First Problem Solving Produces Step-Change Improvements

**Insight:** TD-1 didn't just tweak prompts — it investigated detection methodologies (perplexity, burstiness, token probability, structural regularity) and redesigned the approach from first principles. Result: 0/5 -> 4/5, a step-change that no amount of incremental tuning would have achieved.

**Evidence:** Key discoveries: forbidden word list size matters enormously (12->35), quality constraints actively fight humanization, structural variation (paragraph/sentence length variety) + personal details are the most impactful anti-detection signals.

**Application:** For any "core product promise" issue, invest in research before implementation. The investigation phase of TD-1 (Tasks 1-2) was more valuable than the code changes (Tasks 3-4).

### 2. Tech Debt Sprints Are Highly Efficient When Properly Prioritized

**Insight:** Batching 5 debt items into a focused sprint with CRITICAL->HIGH->MEDIUM prioritization resolved them in 1 day. Context switching between debt and feature work is the real productivity killer.

**Evidence:** 10 debt items from 6 epics resolved. 2 items found to be already done (stale inventory). All 5 stories completed with full code review.

**Application:** Schedule tech debt sprints after every 2-3 feature epics. Audit the debt inventory first — some items self-resolve during feature work.

### 3. The Retro Action Item System Is Definitively Broken

**Insight:** Across 9 epics, process-improvement action items have a near-0% completion rate. Only items that become stories or code changes get executed. This is not a discipline problem — it's a system design problem.

**Evidence:** Follow-through trend: 17% -> 17% -> 10% -> 0% -> 29%. The 29% in TD was entirely from story-based items (2-7b completion, 0-5 re-validation).

**Application:** Stop writing process-improvement action items entirely. Every improvement must be one of: (a) a story with acceptance criteria, (b) a CI check or lint rule, (c) a code change. If it can't be encoded as one of these, accept that it won't happen.

### 4. Security Code Needs Specialized Review (UB Pattern)

**Insight:** TD-3's zeroize tests contained undefined behavior (reading freed memory) that was syntactically valid Rust, passed all tests, and looked correct. Only specialized security review caught it.

**Evidence:** The test read a pointer after `drop()` to verify the memory was zeroed. Under sanitizers or different allocators, this would crash or return stale data. Fixed to use safe `zeroize()` calls on live buffers.

**Application:** Security-sensitive code (cryptography, memory safety, permissions) needs reviewers with domain expertise, not just general code review skills.

### 5. Stale Debt Inventories Waste Investigation Time

**Insight:** 2 of 5 TD stories included tasks that were already resolved: voice.rs was modularized during Epic 5, and PreMigrationBackup was fixed during Epic 2 code review.

**Evidence:** TD-4 Task 1 and TD-5 Task 1 were both no-ops.

**Application:** Before creating a tech debt epic, verify each item is still an actual problem. Cross-reference with recent code changes and reviews.

---

## Previous Epic 8 Retro Follow-Through

| # | Commitment | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Story 2-7b completion (RELEASE BLOCKER) | ✅ Done | Sprint-status: `done` (Feb 11) |
| 2 | Story 0-5 completion (core promise) | ✅ Done | TD-1: 4/5 pass, re-humanization works |
| 3 | Shared renderWithProviders() utility | ❌ Not Done | TD-4 created settingsPanelMocks only |
| 4 | Design token lint/CI check | ❌ Not Done | TD-5 did manual pass (253 replacements) but no automation |
| 5 | E2E/perf test strategy decision | ❌ Not Done | No decision documented |
| 6 | No raw render() in tests | ❌ Not Done | Not applied |
| 7 | Story completion requires vitest output | ❌ Not Done | Not applied |

**Follow-Through Rate:** 2/7 (29%) — improvement from 0%, but only because the 2 completed items were actual stories/code changes. Process items: 0/5 (0%).

**Conclusion:** The pattern is now established across 5 retrospectives. Process agreements do not get executed. The only reliable mechanism is encoding improvements as stories, CI checks, or code changes.

---

## Technical Debt Status — Post-TD

### Resolved by Epic TD (10 items)

| # | Item | Source | Resolution |
|---|------|--------|------------|
| 1 | AI detection 0/5 failure | Epic 0 (CRITICAL) | TD-1: 4/5 pass + re-humanization |
| 2 | Recovery key re-key gap (AC-6) | Epic 2 (HIGH) | TD-2: PRAGMA rekey implemented |
| 3 | Memory zeroing deferred | Epic 2 (MEDIUM) | TD-3: zeroize crate integrated |
| 4 | Secure IPC passphrase transport | Epic 2 (MEDIUM) | TD-3: Zeroizing wraps 7 commands |
| 5 | PreMigrationBackup test failures | Epic 2 (MEDIUM) | TD-4: confirmed already fixed |
| 6 | SettingsPanel mock breakage | Epic 4b (MEDIUM) | TD-4: shared mock factory |
| 7 | voice.rs modularization | Epic 5 (MEDIUM) | TD-5: confirmed already modular |
| 8 | Duplicate calibration mapping | Epic 5 (MEDIUM) | TD-5: frontend mapper deleted |
| 9 | Windows build environment | Epic 4a (LOW) | TD-5: platform-conditional Cargo |
| 10 | CSS token enforcement | Epic 8 (MEDIUM) | TD-5: 253 manual replacements |

### Remaining Outstanding (7 items)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | 23 pre-existing test failures (9 Rust + 14 frontend) | MEDIUM | Requires infrastructure: Tauri harness, keychain mocking, migration setup |
| 2 | AC-3 creative domain detection gap | MEDIUM | 50% vs 100% technical; recoverable via re-humanization |
| 3 | E2E test stubs (no tauri-driver) | LOW | Scaffolding in place; execution blocked by Tauri ecosystem |
| 4 | Performance benchmark stubs | LOW | Mocked/skipped; needs Tauri runtime or pure Rust benchmarks |
| 5 | renderWithProviders() shared utility | LOW | Not currently blocking any tests |
| 6 | Stylelint/CI for CSS token enforcement | LOW | Manual pass complete; automation prevents regression |
| 7 | PasswordHash residual gap (no Zeroize trait) | LOW | Upstream limitation; documented in TD-3 |

**Debt Trajectory:** 12 items before TD -> 7 remaining. Net reduction of 5 (resolved 10, added 3 new, 2 were stale).

---

## Readiness Assessment

| Dimension | Status | Notes |
|-----------|--------|-------|
| Testing & Quality | ⚠️ Adequate | 598 Rust + 1298 frontend tests. 23 pre-existing failures. E2E scaffolding only. |
| AI Detection (Core Promise) | ✅ Mitigated | 4/5 pass rate + re-humanization recovery. Creative domain weaker. |
| Security & Encryption | ✅ Strong | SQLCipher + Argon2id + zeroize + PRAGMA rekey + cross-platform permissions |
| Deployment | ⏳ Not Started | Epic 9 (Deployment) is post-MVP scope |
| Technical Health | ✅ Good | Consolidated build, CSS tokens, calibration dedup, modular voice |
| Unresolved Blockers | ✅ None | Both release gates from Epic 8 retro cleared |

**Overall Assessment:** The MVP is feature-complete and hardened. All 9 feature epics (0-6, 8) plus the tech debt sprint are done. No release blockers remain. The codebase is in the best shape it's been since project start.

---

## Retrospective Commitments Summary

- **Stories Completed:** 5/5 (100%) — 9th consecutive 100% epic
- **Technical Debt:** Resolved 10, 7 remaining (all MEDIUM or LOW)
- **Test Coverage:** ~1,900 tests across Rust and frontend
- **Previous Retro Follow-Through:** 2/7 (29%) — improvement, but only on story-based items
- **Meta-Insight Confirmed:** Process improvements succeed only when encoded as stories, CI checks, or code changes. 5 consecutive retrospectives confirm this pattern.

### Next Steps

1. **MVP is feature-complete** — all planned epics (0-6, 8, TD) are done
2. **Post-MVP planning** when ready:
   - Epic 7: Proposal History & Search
   - Epic 9: Deployment & Distribution
   - Epic 10: Dynamic Hook Configuration
3. **Remaining debt items** (7) are all MEDIUM/LOW and non-blocking
4. **If starting post-MVP work:** Create test infrastructure story to address 23 pre-existing failures

---

## Team Acknowledgments

Epic TD achieved its primary goal: **clearing all release blockers and hardening the MVP codebase.**

**Standout Achievements:**
- TD-1: Research-driven transformation of AI detection from 0/5 to 4/5 — the most impactful single story in the project
- TD-2: Complete recovery key flow — users can now fully recover from forgotten passphrases
- TD-3: Defense-in-depth memory security — passphrase handling now meets professional security standards
- TD-5: 253 CSS token replacements — tedious but transformative for maintainability

**Project Milestone:** With Epic TD complete, the Upwork Research Agent MVP has:
- 9 feature epics + 1 tech debt epic completed (100% completion rate across all)
- ~1,900 automated tests (598 Rust + 1298 frontend)
- Comprehensive security stack (SQLCipher, Argon2id, zeroize, PRAGMA rekey, OS keychain)
- AI humanization passing detection at 80%+ rate with recovery path
- Full accessibility infrastructure (WCAG AA, axe-core, LiveAnnouncer, focus traps)
- Design token system with 103 CSS custom properties applied across 26 component files

---

**Retrospective Completed:** 2026-02-12
**Document:** epic-td-retro-2026-02-12.md
