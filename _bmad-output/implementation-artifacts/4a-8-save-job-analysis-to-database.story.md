---
status: ready-for-dev
---

# Story 4a.8: Save Job Analysis to Database

## Story

As a freelancer,
I want analyzed jobs saved to my database,
So that I can reference them later.

## Acceptance Criteria

**AC-1:** Given job analysis has completed successfully, When the save operation runs, Then all extracted data is persisted atomically in a single database transaction:

- `job_posts.client_name` updated with extracted client name
- `job_skills` rows inserted (old skills deleted first for re-analysis)
- `job_posts.hidden_needs` updated with serialized JSON

**AC-2:** Given the transaction is in progress, When any single write operation fails, Then the entire transaction rolls back and no partial data is saved (all-or-nothing semantics).

**AC-3:** Given normal conditions, When the save completes, Then total save time is <100ms (NFR-4 target).

**AC-4:** Given the save succeeds, Then the UI shows a subtle "Saved" indicator (transient, auto-dismissing after ~2s).

**AC-5:** Given the save fails (e.g., database locked, disk full), Then the error is surfaced inline and the extracted analysis data remains visible in the UI (not lost).

**AC-6:** Given the user re-analyzes the same job post, When the save runs, Then existing skills are replaced (delete + insert) and client_name/hidden_needs are overwritten — no duplicate data.

## Technical Notes

### Requirements Traceability

- **NFR-4:** UI response <100ms — save operation budget
- **NFR-19:** Atomic persistence — all related data saved in single transaction
- **FR-2:** Client Name, Key Skills, Hidden Needs — all three fields saved together

### Architecture: Atomic Transaction Consolidation

Stories 4a-2, 4a-3, and 4a-4 each perform isolated saves after extraction. Without 4a-8, these are separate operations that can fail independently, leaving the database in an inconsistent state.

**4a-8 replaces the individual save calls with a single atomic transaction function.**

**What changes:**

- Before 4a-8: `analyze_job_post` command calls `update_job_post_client_name()`, then `delete_job_skills()` + `insert_job_skills()`, then `update_job_post_hidden_needs()` — three independent operations
- After 4a-8: `analyze_job_post` command calls `save_job_analysis_atomic()` — one transaction wrapping all operations

**Existing transaction pattern to follow:** `migration/mod.rs` → `copy_data_atomic()` demonstrates working `BEGIN EXCLUSIVE TRANSACTION` / `COMMIT` / `ROLLBACK` pattern with `&Connection` (not `&mut Connection`).

**Note:** A comment in `proposals.rs` states "Explicit transactions would require &mut Connection which breaks the API." This is **outdated** — the migration module proves `&Connection` works fine for explicit transactions via `execute()`.

### Transaction Implementation

```rust
pub fn save_job_analysis_atomic(
    conn: &Connection,
    job_post_id: i64,
    client_name: Option<&str>,
    key_skills: &[String],
    hidden_needs_json: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])?;

    let result = (|| {
        // 1. Update client_name
        conn.execute(
            "UPDATE job_posts SET client_name = ?1 WHERE id = ?2",
            params![client_name, job_post_id],
        )?;

        // 2. Delete old skills (re-analysis safe)
        conn.execute(
            "DELETE FROM job_skills WHERE job_post_id = ?1",
            params![job_post_id],
        )?;

        // 3. Insert new skills
        let mut stmt = conn.prepare(
            "INSERT INTO job_skills (job_post_id, skill_name) VALUES (?1, ?2)"
        )?;
        for skill in key_skills {
            stmt.execute(params![job_post_id, skill])?;
        }

        // 4. Update hidden_needs JSON
        conn.execute(
            "UPDATE job_posts SET hidden_needs = ?1 WHERE id = ?2",
            params![hidden_needs_json, job_post_id],
        )?;

        Ok::<(), rusqlite::Error>(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", [])?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}
```

**Why `BEGIN EXCLUSIVE`:** Prevents other threads from writing during the transaction. Since the Tauri `Database` struct uses `Mutex<Connection>`, this is belt-and-suspenders — the lock already serializes access, but EXCLUSIVE ensures SQLite-level safety.

### "Saved" Indicator

The "Saved" indicator is a transient UI confirmation after the database write succeeds. Options:

- Extend the `AnalysisProgress` component (from 4a-6) to show a "Saved" sub-stage after "Complete ✓"
- Or add a separate lightweight toast/notification

**Recommended:** Extend `AnalysisProgress` — add a `saved` sub-state after `complete`. The indicator appears as small muted text below the "Complete ✓" message, auto-dismisses with the progress indicator.

### Timing Budget

All four database operations must complete within <100ms combined:

| Operation | Estimated Time | Notes |
| :--- | :--- | :--- |
| UPDATE client_name | <5ms | Single row UPDATE |
| DELETE old skills | <5ms | Index on job_post_id |
| INSERT skills (batch) | <20ms | 3-7 rows typical |
| UPDATE hidden_needs | <5ms | Single row UPDATE |
| Transaction overhead | <10ms | BEGIN + COMMIT |
| **Total** | **<45ms** | Well within 100ms budget |

## Tasks / Subtasks

- [ ] Task 1: Create atomic save function (AC: 1, 2, 3, 6)
  - [ ] 1.1: Create `save_job_analysis_atomic()` in `src-tauri/src/db/queries/job_posts.rs` — accepts `conn`, `job_post_id`, `client_name`, `key_skills`, `hidden_needs_json`
  - [ ] 1.2: Use `BEGIN EXCLUSIVE TRANSACTION` / `COMMIT` / `ROLLBACK` pattern (follow `migration/mod.rs` → `copy_data_atomic`)
  - [ ] 1.3: Operations in order: UPDATE client_name → DELETE old skills → INSERT new skills → UPDATE hidden_needs
  - [ ] 1.4: Use prepared statement for skills batch insert (avoid re-parsing SQL per row)
  - [ ] 1.5: On any error: execute ROLLBACK, return error (ignore ROLLBACK errors with `let _ =`)

- [ ] Task 2: Update `analyze_job_post` Tauri command to use atomic save (AC: 1, 5)
  - [ ] 2.1: In `lib.rs`, replace individual save calls (update_client_name, delete/insert_skills, update_hidden_needs) with single `save_job_analysis_atomic()` call
  - [ ] 2.2: Serialize `hidden_needs` to JSON string before passing to save function (`serde_json::to_string`)
  - [ ] 2.3: On save success: return `JobAnalysis` result to frontend with `saved: true` flag
  - [ ] 2.4: On save failure: return error to frontend but include the analysis results (extraction succeeded even if save failed)
  - [ ] 2.5: Log save timing via `std::time::Instant` to validate <100ms target

- [ ] Task 3: Remove individual save functions (AC: 1)
  - [ ] 3.1: Remove or deprecate standalone `update_job_post_client_name()`, `delete_job_skills()` + `insert_job_skills()`, `update_job_post_hidden_needs()` calls from the `analyze_job_post` command flow
  - [ ] 3.2: Keep the individual query functions available in `job_posts.rs` (they may be needed elsewhere), but the Tauri command no longer calls them directly
  - [ ] 3.3: Update any imports if function signatures changed

- [ ] Task 4: Add "Saved" indicator to frontend (AC: 4, 5)
  - [ ] 4.1: Extend analysis flow in App.tsx: after invoke resolves successfully, show "Saved" indicator
  - [ ] 4.2: Indicator appears as subtle muted text (e.g., "Analysis saved" with checkmark) below the progress area
  - [ ] 4.3: Auto-dismiss after 2 seconds
  - [ ] 4.4: On save failure: show inline error message instead of "Saved" indicator
  - [ ] 4.5: Analysis results remain visible in UI even if save fails (data is in component state, not only in DB)

- [ ] Task 5: Write tests (AC: All)
  - [ ] 5.1: Rust unit test: `save_job_analysis_atomic` saves all three data types (client_name, skills, hidden_needs) in one call
  - [ ] 5.2: Rust unit test: verify client_name updated in job_posts after atomic save
  - [ ] 5.3: Rust unit test: verify skills inserted in job_skills with correct job_post_id after atomic save
  - [ ] 5.4: Rust unit test: verify hidden_needs JSON stored correctly in job_posts after atomic save
  - [ ] 5.5: Rust unit test: re-analysis replaces old skills (delete + insert) — no duplicates
  - [ ] 5.6: Rust unit test: transaction rollback on simulated failure — verify NO data persisted (inject error between operations)
  - [ ] 5.7: Rust unit test: save completes in <100ms (timing assertion)
  - [ ] 5.8: Rust unit test: empty skills array saves successfully (0 rows inserted, no error)
  - [ ] 5.9: Rust unit test: null client_name saves successfully (UPDATE sets NULL)
  - [ ] 5.10: Frontend test: "Saved" indicator appears after successful analysis
  - [ ] 5.11: Frontend test: "Saved" indicator auto-dismisses after 2 seconds
  - [ ] 5.12: Frontend test: error message appears when save fails (mock invoke rejection)

## Dev Notes

### Dependencies

- **Story 4a-2 (HARD DEPENDENCY):** Creates `analyze_job_post` command, `update_job_post_client_name()` function, and `analysis.rs` module
- **Story 4a-3 (HARD DEPENDENCY):** Creates `job_skills` table (V6 migration), `insert_job_skills()`, `delete_job_skills()` functions
- **Story 4a-4 (HARD DEPENDENCY):** Creates `hidden_needs` column (V7 migration), `update_job_post_hidden_needs()` function
- **Story 4a-6 (SOFT DEPENDENCY):** Progress indicator that the "Saved" indicator can extend or sit beside

### Existing Code References

| File | What's There (after 4a-4) | What to Change |
| :--- | :--- | :--- |
| `src-tauri/src/db/queries/job_posts.rs` | Individual functions: `update_job_post_client_name`, `insert_job_skills`, `delete_job_skills`, `update_job_post_hidden_needs` | Add `save_job_analysis_atomic()` combining all operations in a transaction |
| `src-tauri/src/lib.rs` | `analyze_job_post` command calling individual save functions sequentially | Replace with single `save_job_analysis_atomic()` call |
| `src-tauri/src/migration/mod.rs` | `copy_data_atomic()` — reference implementation for `BEGIN/COMMIT/ROLLBACK` pattern | Reference only — follow this pattern |
| `src-tauri/src/db/queries/proposals.rs` | Outdated comment about `&mut Connection` being needed for transactions | Optional: update or remove misleading comment |
| `src/App.tsx` | Analysis state, progress indicator (from 4a-6) | Add "Saved" indicator state, auto-dismiss timer |

### Edge Cases

- **Empty skills array:** Valid scenario (vague job post). Transaction should still succeed with 0 skill inserts.
- **Null client_name:** Valid scenario. UPDATE should set `client_name = NULL`.
- **Very long hidden_needs JSON:** Unlikely to exceed SQLite TEXT limits, but should handle gracefully.
- **Re-analysis race condition:** Mutex on database connection serializes access. Two concurrent `analyze_job_post` calls queue — second waits for first transaction to complete.
- **Database locked by external process:** EXCLUSIVE lock will wait (default SQLite busy timeout). If timeout expires, transaction fails → rollback → error surfaced.
- **Save fails but extraction succeeded:** UI retains extracted data in component state. User sees results but gets "save failed" error. Can retry or proceed to generation.

### Scope Boundaries

**In scope:**

- `save_job_analysis_atomic()` transaction function
- Refactoring `analyze_job_post` command to use atomic save
- "Saved" indicator in frontend
- Save error handling with graceful degradation (keep analysis results visible)

**Out of scope:**

- Retry logic for failed saves (user can re-analyze)
- Queuing or background save (save is synchronous and fast)
- Save confirmation modal (too heavy for <100ms operation)
- Offline save/sync (desktop app, always has disk access)

### NFR Targets

| NFR | Target | Validation |
| :--- | :--- | :--- |
| Save time | <100ms atomic | Log timing in Tauri command, assert in test |
| Atomicity | All-or-nothing | Rollback test with injected failure |
| Data integrity | No orphaned skills | Verify FK cascade on delete, transaction rollback on partial failure |

### References

- [NFR-4: prd.md — UI response <100ms]
- [NFR-19: prd.md — Atomic persistence]
- [Story 4a-2: client_name save (individual)]
- [Story 4a-3: skills delete + insert (individual)]
- [Story 4a-4: hidden_needs save (explicitly delegates to 4a-8)]
- [Pattern: migration/mod.rs `copy_data_atomic()` — transaction reference implementation]
