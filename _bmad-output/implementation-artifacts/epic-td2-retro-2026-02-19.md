# Epic TD2 Retrospective - Tech Debt 2: Post-Project Hardening

**Project:** Upwork Research Agent
**Epic:** Epic TD2 - Tech Debt 2: Post-Project Hardening
**Retrospective Date:** 2026-02-19
**Facilitator:** Bob (Scrum Master)
**Participants:** Zian (Project Lead), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev)

---

## Executive Summary

Epic TD2 delivered **3/3 stories completed (100%)** in a single day (2026-02-19), resolving the three HIGH-priority tech debt items carried forward from the Epic 10 retrospective. This is the **14th consecutive epic at 100% completion**.

**Most significant outcome:** During the retro itself, Zian diagnosed and fixed the Windows DLL test execution issue (`STATUS_ENTRYPOINT_NOT_FOUND`) that had blocked all Rust test execution since Epic 8. This unlocked **813 Rust tests** that had never been able to run, the single biggest quality improvement in the project's history.

**Key Metrics:**
- **Stories Completed:** 3/3 (100%) — 14th consecutive epic at 100%
- **Duration:** 1 day (2026-02-19)
- **Code Review Rounds:** 7 total (TD2-1: R2, TD2-2: R2, TD2-3: R3)
- **Issues Found & Fixed:** ~23 across all stories (5 + 5 + 13)
- **New Tests Added:** ~36 (8 Node.js + 5 Rust + 14 React + 9 App integration)
- **Production Incidents:** 0
- **Debt Resolved:** 3 HIGH items from Epic 10 retro + 1 MEDIUM (Windows DLL)
- **New Debt Introduced:** 0

**Key Achievement:** First time in project history that retro action items were executed at meaningful rate (75%, up from 0% across Epics 7, 9, and 10). The lesson "only items encoded as stories get done" was finally applied — and it worked.

---

## What Went Well (Successes)

### 1. Retro Action Items Finally Executed (75% Follow-Through)

Epic 10's retro had 4 commitments. TD2 encoded 3 of them as stories and all 3 were completed. The only item NOT done (Windows DLL) was NOT encoded as a story — perfectly validating the pattern observed across 4 consecutive retros: "only items encoded as stories get done."

Then Zian went ahead and fixed the Windows DLL issue during this retrospective session, bringing the effective follow-through to **100%**.

### 2. Command Registration Verification Test (TD2-1) — Three-Epic Saga Resolved

The command registration bug was flagged in Epic 7's retro, carried forward in Epic 9's retro, observed again in Epic 10 (10.2 had 3 unregistered commands, 10.4 had 1). TD2-1 finally created the automated verification:

- **121-command baseline verified** (0 mismatches)
- **Pre-commit hook** blocks commits with unregistered commands
- **CI gate** in `e2e.yml` fails PRs with registration mismatches
- **8 tests** covering baseline, detection, stacked attributes, module-qualified names

This bug class — commands that silently fail at runtime — is now permanently prevented.

### 3. macOS Backup/Rollback Implementation (TD2-2) — Clean Execution

The macOS stubs in `health_check.rs` were replaced with real tarball backup/restore in a single clean implementation pass:

- `create_app_bundle_tarball()` and `extract_app_bundle_tarball()` helper functions
- `.app` bundle path resolution (3-level navigation from `current_exe()`)
- 5 cross-platform unit tests (roundtrip, structure preservation, error handling, path resolution)
- No blocking issues encountered

### 4. Story 9-9 Remaining Tasks Completion (TD2-3) — End-to-End Health Check Flow

The health check system went from "dormant stubs" to fully operational:

- `HealthCheckModal` with animated progress through 4 checks
- `RollbackDialog` with proper failure display and restart trigger
- Success toast "Updated to v{version} successfully" with keyboard dismiss (Escape)
- Focus traps and `aria-live` regions for accessibility
- 19 new tests (7 HealthCheckModal + 7 RollbackDialog + 3 App integration + 2 a11y)

### 5. Windows DLL Fix — The Retro That Fixed Itself

The most impactful debugging session in the project:

**Diagnosis chain:**
1. `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139) — binary crashes before any test runs
2. `dumpbin /dependents` showed only standard Windows DLLs — no exotic dependencies
3. `dumpbin /imports` revealed `TaskDialogIndirect` imported from `comctl32.dll`
4. `TaskDialogIndirect` only exists in comctl32 v6, which requires an application manifest
5. Test binaries don't get manifests from `tauri_build::build()` — only the main app binary does

**Fix:** 2 files — `test.manifest` (comctl32 v6 declaration) + `build.rs` (embed via `cargo:rustc-link-arg-tests`)

**Result:** 0 → 813 Rust tests now executing.

---

## What Didn't Go Well (Challenges)

### 1. RollbackDialog Was Unreachable (TD2-3, CR H-1)

The original Rust `rollback_to_previous_version()` called `app_handle.restart()` at the end, meaning the app would restart before the frontend could ever display the RollbackDialog. Code review caught this — the fix was to remove the restart from Rust and let the frontend control the restart flow via the dialog's "Restart App" button.

This is a variant of the "wiring" problem: backend and frontend had incompatible assumptions about control flow.

### 2. Pre-existing Migration Bug Uncovered (V28)

Once Rust tests could actually run, Migration V28 was revealed to have an invalid `ALTER TABLE ADD COLUMN ... UNIQUE` statement. SQLite does not support UNIQUE constraints in ALTER TABLE. This migration had "worked" in production only because it ran against existing databases where the column was empty — but test databases running all 30 migrations from scratch hit the error.

**Fix:** Changed to `ALTER TABLE ADD COLUMN remote_id TEXT` + separate `CREATE UNIQUE INDEX`. This was a latent bug from Epic 10 (Story 10.3) that was never caught because Rust tests couldn't run.

### 3. 9 Pre-existing Test Failures Exposed

With tests now running, 9 pre-existing failures were uncovered:
- 2 sanitization performance tests (timing-sensitive, flaky on debug builds)
- 5 migration tests (settings count mismatch: expected 12, got 14 — migration tests not updated for V28-V30)
- 1 config test (API key keychain test environment)
- 1 db test (encrypted DB query count assertion off)

These are all pre-existing issues, not caused by TD2 changes.

### 4. Scope Creep Pattern Continued (TD2-3)

Despite explicit "DO NOT implement anything from TD2-3 in this story" warnings in TD2-2, the Sonnet dev agent remained disciplined for TD2-2 but showed the familiar scope creep pattern in TD2-3 where it pre-implemented patterns beyond the story scope. Code review kept it in check.

---

## Key Insights & Lessons Learned

### 1. Encoding Retro Items as Stories Works — Nothing Else Does

5 consecutive retros of evidence. The execution rates:
- Epic 7 retro items → ~17% done
- Epic TD retro items → 0% done
- Epic 9 retro items → 0% done
- Epic 10 retro items → 0% done
- **Epic TD2 (encoded as stories) → 100% done**

The pattern is conclusive. If you want something done, it must be a story in sprint-status.

### 2. Infrastructure Bugs Hide Other Bugs

The Windows DLL issue masked every Rust test failure for 6+ epics. When 813 tests finally ran, they revealed a migration bug (V28 UNIQUE constraint), settings count mismatches, and performance test flakiness that were invisible for months. Infrastructure problems have multiplicative impact on quality — fixing them should always be top priority.

### 3. dumpbin Is the Windows DLL Debugger

The diagnostic chain that solved the DLL issue: `dumpbin /dependents` → `dumpbin /imports` → identify `TaskDialogIndirect` → trace to comctl32 v6 manifest requirement. This is the standard approach for any `STATUS_ENTRYPOINT_NOT_FOUND` on Windows.

### 4. The Two-Agent Dev+Review Model Remains Essential

Across 3 stories in TD2:
- TD2-1: 5 issues caught (hardcoded count, path handling, stacked attributes)
- TD2-2: 5 issues caught (GzEncoder not finished — data corruption risk, redundant syscall, partial cleanup)
- TD2-3: 13 issues caught across 3 rounds (unreachable dialog — critical UX bug, orphaned timers, missing test assertions)

The GzEncoder issue in TD2-2 would have produced corrupted backups. The unreachable RollbackDialog in TD2-3 would have made rollback invisible to users. Code review remains the project's most important quality mechanism.

---

## Previous Epic 10 Retro Follow-Through

| # | Commitment | Status | Evidence |
|---|-----------|--------|----------|
| 1 | macOS backup/rollback stubs | ✅ **Done** | TD2-2: tarball create/extract, 5 unit tests, build verified |
| 2 | Story 9-9 Tasks 6-8 completion | ✅ **Done** | TD2-3: App.tsx wiring, success toast, HealthCheckModal/RollbackDialog tests, a11y |
| 3 | Command registration verification test | ✅ **Done** | TD2-1: 121-command baseline, pre-commit + CI gate, 8 tests |
| 4 | Windows DLL test environment fix | ✅ **Done** | Fixed during retro: comctl32 v6 manifest in build.rs, 813 tests now run |

**Follow-Through Rate: 4/4 (100%)** — up from 0% in Epics 7, 9, and 10.

---

## Technical Debt Status — Post-Epic TD2

### Debt Resolved by TD2

| # | Item | Resolution |
|---|------|-----------|
| 1 | macOS backup/rollback stubs | TD2-2: Real tarball implementation |
| 2 | Story 9-9 Tasks 6-8 (toast, wiring, tests) | TD2-3: Full end-to-end health check flow |
| 3 | Command registration verification (x3 retros) | TD2-1: Automated pre-commit + CI gate |
| 4 | Windows DLL test execution | Retro fix: comctl32 v6 manifest in build.rs |
| 5 | Migration V28 UNIQUE constraint bug | Retro fix: Changed to CREATE UNIQUE INDEX |

### Remaining Technical Debt (Final State)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | 9 pre-existing Rust test failures | MEDIUM | 2 perf timing, 5 migration count, 1 config, 1 db |
| 2 | HMAC symmetric key (no real tamper protection) | LOW | Ed25519 asymmetric signatures recommended |
| 3 | `deny_unknown_fields` forward-compat risk | LOW | Must bump min_app_version when adding fields |
| 4 | 60+ pre-existing frontend test failures | MEDIUM | Accumulated across epics |
| 5 | 192 ESLint + 61 clippy warnings | LOW | Non-blocking |
| 6 | AC-3 creative domain detection gap | MEDIUM | Epic TD |
| 7 | E2E test stubs (no tauri-driver) | LOW | Scaffolding only |
| 8 | Performance benchmark stubs | LOW | Mocked/skipped |
| 9 | camelCase serde lint/check | LOW | Recurring miss |
| 10 | `tests/perplexity_analysis.rs` compile errors | LOW | Missing AppHandle args |

**Total Remaining Debt:** 10 items (0 HIGH, 3 MEDIUM, 7 LOW)
**Debt Trajectory:** DOWN — resolved 5 items (including 3 HIGH), reduced from 15 to 10. All HIGH-priority debt eliminated.

---

## TD2 Code Review Summary

| Story | R1 Issues | R2 Issues | R3 Issues | Total | Severity Highlights |
|-------|-----------|-----------|-----------|-------|---------------------|
| TD2-1 Command Registration | 5 | 0 (passed) | — | 5 | 1H (hardcoded count), 2M (docs, path handling), 2L (stacked attrs, parameterized) |
| TD2-2 macOS Backup/Rollback | 5 | 0 (passed) | — | 5 | 1H (GzEncoder not finished), 2M (redundant syscall, File List), 2L (return style, cleanup) |
| TD2-3 Story 9-9 Tasks | 6 | 3 | 0 (passed) | 9 | 1H (RollbackDialog unreachable), 3M (keyboard dismiss, test mock, orphaned timers), 2L (accepted) + R2: 1M 2L |
| **TOTAL** | — | — | — | **~19** | **3H 6M 6L** |

---

## Project Completion Summary — Final State

With Epic TD2 and the Windows DLL fix complete, the Upwork Research Agent has achieved:

- **14 epics completed** (14 consecutive at 100% completion rate)
- **~90+ stories delivered** across all epics
- **0 HIGH-priority tech debt remaining**
- **813 Rust tests + ~1700+ frontend tests** executing (Rust tests unlocked today)
- **Automated quality gates:** command registration verification in pre-commit + CI
- **Cross-platform deployment:** macOS backup/rollback now functional (was stub-only)
- **End-to-end update safety:** health check → success toast OR rollback dialog → restart

---

## Retrospective Commitments Summary

### Remaining Items (For Future Maintenance)

Since this is the final epic and no further development is planned:

1. **9 pre-existing Rust test failures** — now visible thanks to the DLL fix. The migration tests need settings count assertions updated for V28-V30. Performance tests are timing-sensitive and may need relaxed thresholds for debug builds.

2. **Frontend test health** — ~60+ accumulated failures across epics. Most are test isolation issues (shared mock state between tests).

3. **Lint cleanup** — 192 ESLint + 61 clippy warnings. Non-blocking but noisy.

### Process Observations (For Future Projects)

1. **Encode improvements as stories, not bullet points.** This is the single most validated process insight from the project — confirmed across 5 retrospectives.

2. **Fix infrastructure bugs first.** The comctl32 manifest issue hid 813 tests for 6+ epics. Every infrastructure bug has multiplicative cost.

3. **The two-agent dev+review model works.** No story across 14 epics has ever passed R1 without issues. Code review caught data corruption risks (GzEncoder), unreachable UI (RollbackDialog), and silent runtime failures (unregistered commands) in this epic alone.

4. **Scope creep is a systematic agent behavior, not a one-off.** Address it in story templates with explicit "DO NOT implement" boundaries and integration checklists.

---

## Team Acknowledgments

Epic TD2 closes out the Upwork Research Agent's technical debt backlog. The project is now feature-complete with all HIGH-priority debt resolved:

- **14 epics, 100% completion rate across all**
- **Complete proposal lifecycle** from job analysis to voice-informed generation
- **Defense-in-depth security** at every layer
- **Professional deployment pipeline** with self-healing updates and health checks
- **Dynamic configuration** for continuous improvement
- **Automated quality gates** preventing the most common bug classes
- **813 Rust tests finally running** after 6+ epics of silence

The most fitting way to close the final retrospective: the retro itself produced the project's biggest quality unlock.

---

**Retrospective Completed:** 2026-02-19
**Document:** epic-td2-retro-2026-02-19.md
