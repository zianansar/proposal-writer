---
status: done
assignedTo: "dev-agent"
tasksCompleted: 3
totalTasks: 3
testsWritten: true
codeReviewCompleted: true
fileList:
  - upwork-researcher/src-tauri/migrations/V3__add_job_posts_table.sql
  - upwork-researcher/src-tauri/src/db/mod.rs
---

# Story 1.12: Job Posts Table Schema

## Story

As a developer,
I want a table to store job posts separately from proposals,
So that users can analyze jobs before generating proposals (Epic 4).

## Acceptance Criteria

**AC-1:** Given the database exists, When the job_posts table migration runs, Then a `job_posts` table is created with columns:
- id (INTEGER PRIMARY KEY)
- url (TEXT)
- raw_content (TEXT NOT NULL)
- client_name (TEXT)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

**AC-2:** And the migration is idempotent (can run multiple times safely)

**AC-3:** And appropriate indexes are created for performance

## Tasks/Subtasks

- [x] Task 1: Create V3 migration for job_posts table (AC-1, AC-2)
  - [x] Subtask 1.1: Create V3__add_job_posts_table.sql in migrations/ directory
  - [x] Subtask 1.2: Define job_posts table schema with all required columns
  - [x] Subtask 1.3: Use CREATE TABLE IF NOT EXISTS for idempotency
  - [x] Subtask 1.4: Add appropriate column constraints (PRIMARY KEY, NOT NULL)

- [x] Task 2: Add performance indexes (AC-3)
  - [x] Subtask 2.1: Add index on created_at for chronological sorting
  - [x] Subtask 2.2: Add index on url for duplicate detection (if url is populated)
  - [x] Subtask 2.3: Use CREATE INDEX IF NOT EXISTS for idempotency

- [x] Task 3: Add tests for job_posts table (AC-1, AC-2, AC-3)
  - [x] Subtask 3.1: Test that job_posts table is created after migrations run
  - [x] Subtask 3.2: Test that job_posts table has all required columns
  - [x] Subtask 3.3: Test that indexes exist (created_at, url)
  - [x] Subtask 3.4: Verify migration is idempotent (run twice, no errors)

### Code Review Follow-ups

- [ ] [Code-Review][MEDIUM] Consider partial index on url column (V3__add_job_posts_table.sql:16)
  - Current: `CREATE INDEX ... ON job_posts(url)` indexes NULL values
  - Recommended: `CREATE INDEX ... ON job_posts(url) WHERE url IS NOT NULL`
  - Rationale: NULL urls can't be duplicates, excluding them improves index efficiency

- [ ] [Code-Review][MEDIUM] Add test for NULL url index behavior (db/mod.rs)
  - Test inserting multiple job posts with NULL urls
  - Verify no unique constraint violation (expected behavior)
  - Verify index still works for non-NULL urls

- [ ] [Code-Review][LOW] Add column-level documentation to migration (V3__add_job_posts_table.sql)
  - Document why url and client_name are nullable
  - Add inline SQL comments explaining use cases

## Dev Notes

### Architecture Requirements

**AR-18: Database Migrations with refinery 0.8**
- Embedded SQL migration files compiled into binary
- Versioned, forward-only migrations (no rollback — pre-migration backup instead)
- Migration file naming: `V{VERSION}__{description}.sql` (e.g., `V3__add_job_posts_table.sql`)
- rusqlite feature integration
- Migrations in: `src-tauri/migrations/`

**AR-2: Database (rusqlite 0.38)**
- SQLite for local data persistence
- Unencrypted in Epic 1 (SQLCipher encryption in Epic 2)
- Location: OS-specific app data folder

**NFR-1: App Startup Time <2 seconds**
- Migrations must execute quickly
- Keep migrations minimal and incremental
- This is migration V3, joining V1 (proposals) and V2 (settings)

### File Structure

```
upwork-researcher/
  src-tauri/
    migrations/
      V1__initial_schema.sql           # Existing: proposals table
      V2__add_settings_table.sql       # Existing: settings table
      V3__add_job_posts_table.sql      # NEW: job_posts table (THIS STORY)
    src/
      db/
        mod.rs                          # Migration runner (already configured)
        queries/
          proposals.rs                  # Existing
          settings.rs                   # Existing
          job_posts.rs                  # Future (Epic 4a)
```

### Migration Strategy

**From Story 1.11 Implementation:**
- Migrations run automatically on app startup in `Database::new()` via `migrations::runner().run()`
- refinery 0.8 with rusqlite feature already configured in Cargo.toml:32
- embed_migrations!("migrations") at db/mod.rs:14
- Atomic execution: refinery handles transactions automatically
- Forward-only: V1 → V2 → V3 (no down migrations)

**This Story's Migration (V3):**
- Create job_posts table ONLY (single responsibility)
- Use `CREATE TABLE IF NOT EXISTS` for idempotency
- Use `CREATE INDEX IF NOT EXISTS` for index idempotency
- No seed data (table will be populated in Epic 4a stories)

### Schema Design

**job_posts Table Purpose:**
- Store Upwork job posts for analysis BEFORE proposal generation
- Separate from proposals table (jobs are reusable, proposals are one-time)
- Enables Epic 4a (Job Intelligence) and Epic 4b (Job Scoring)

**Column Specifications:**

```sql
CREATE TABLE IF NOT EXISTS job_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,                                    -- Upwork job URL (nullable: user may paste text only)
    raw_content TEXT NOT NULL,                   -- Full job post text (required)
    client_name TEXT,                            -- Extracted client name (nullable: populated in Epic 4a-2)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))  -- Timestamp when job was saved
);
```

**Column Rationale:**
- `id`: Auto-incrementing primary key for internal references
- `url`: Optional URL to job post (user may manually paste job text without URL)
- `raw_content`: Required field for job analysis (even if URL is provided, store full text)
- `client_name`: Extracted in Epic 4a Story 4a-2 (Client Name Extraction), initially NULL
- `created_at`: TEXT format for consistency with proposals table (Story 1.2), uses SQLite datetime()

**Indexes for Performance:**
1. `idx_job_posts_created_at` on `created_at DESC` - for chronological job list (Epic 4b Story 4b-9: Job Queue View)
2. `idx_job_posts_url` on `url` - for duplicate detection when user adds same job twice

### Previous Story Intelligence

**From Story 1.11 (Database Migration Framework Setup) - JUST COMPLETED:**

Key Learnings:
- refinery 0.8 already in Cargo.toml:32 with rusqlite feature ✓
- Migrations directory: `src-tauri/migrations/` (created in 1.11)
- embed_migrations!("migrations") at db/mod.rs:14 (path is relative to Cargo.toml)
- Migrations auto-run on startup: db/mod.rs:41-43 via migrations::runner().run()
- Forward-only migrations with atomic execution (refinery handles transactions)

Migration File Patterns Established:
- V1__initial_schema.sql: proposals table + idx_proposals_created_at index
- V2__add_settings_table.sql: settings table + seed data (INSERT OR IGNORE pattern)
- Both use CREATE TABLE IF NOT EXISTS for idempotency
- Both use CREATE INDEX IF NOT EXISTS for indexes

Test Patterns Established (db/mod.rs tests):
- test_migrations_create_[table]_table: Verify table exists via sqlite_master
- test_[table]_table_has_correct_columns: Verify columns via PRAGMA table_info
- test_[table]_table_has_[index_name]_index: Verify index exists via sqlite_master
- test_migrations_are_idempotent: Run Database::new() twice on same path
- All tests use tempdir().unwrap() for isolated test databases

Code Review Findings from 1.11:
- Critical: Ensure migration files are added to git (not just embedded)
- High: Document version numbers accurately (refinery 0.8, not 0.9)
- Medium: V2 couples schema with seed data (acceptable for settings, avoid for data tables)
- Best Practice: Keep migrations minimal (single table per migration for clarity)

Test Results from 1.11:
- 51 Rust tests passed (12 db tests)
- All migrations tested for: existence, schema correctness, idempotency, error handling

**From Story 1.2 (Proposals Table Schema):**
- proposals table uses TEXT for timestamps: `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- Pattern: created_at + updated_at columns (updated_at is nullable, created_at has default)
- Established convention: Use TEXT for dates in SQLite for consistency

**From Story 1.8 (Settings Table for Configuration):**
- settings table in V2 migration
- Pattern: updated_at TEXT NOT NULL DEFAULT (datetime('now')) for configuration tracking
- INSERT OR IGNORE for seed data in migrations (acceptable for config, not for user data)

### Testing Requirements

**Migration Tests (follow patterns from Story 1.11):**

1. **Table Creation Test:**
   ```rust
   #[test]
   fn test_migrations_create_job_posts_table() {
       let dir = tempdir().unwrap();
       let db_path = dir.path().join("test.db");
       let db = Database::new(db_path).unwrap();
       let conn = db.conn.lock().unwrap();

       let table_exists: i32 = conn.query_row(
           "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='job_posts'",
           [], |row| row.get(0)
       ).unwrap();

       assert_eq!(table_exists, 1);
   }
   ```

2. **Column Verification Test:**
   ```rust
   #[test]
   fn test_job_posts_table_has_correct_columns() {
       // Verify columns: id, url, raw_content, client_name, created_at
       // Use PRAGMA table_info(job_posts) pattern from existing tests
   }
   ```

3. **Index Verification Tests:**
   ```rust
   #[test]
   fn test_job_posts_table_has_created_at_index() {
       // Verify idx_job_posts_created_at exists
   }

   #[test]
   fn test_job_posts_table_has_url_index() {
       // Verify idx_job_posts_url exists
   }
   ```

4. **Idempotency Test:**
   - Already covered by existing test_migrations_are_idempotent in db/mod.rs
   - No new test needed (covers ALL migrations including V3)

**Test Location:** `upwork-researcher/src-tauri/src/db/mod.rs` (add to existing tests module)

**Expected Test Count After This Story:**
- Current: 12 db tests (from Story 1.11)
- Add: 4 new tests (table, columns, 2 indexes)
- New total: 16 db tests

### Scope Boundaries

**In Scope for Story 1.12:**
- V3__add_job_posts_table.sql migration file
- job_posts table schema with 5 columns
- 2 performance indexes (created_at, url)
- 4 new tests in db/mod.rs

**Out of Scope (Future Stories):**
- db/queries/job_posts.rs module (Epic 4a)
- Job post CRUD operations (Epic 4a Story 4a-1)
- Client name extraction (Epic 4a Story 4a-2)
- Job skills schema (Epic 4a Story 4a-5)
- Foreign key relationships (will be added in Epic 4a stories as needed)

**Design Decisions:**
- No foreign keys yet (proposals don't reference jobs in Epic 1)
- No job_skills join table (Epic 4a Story 4a-5)
- No hidden_needs or budget columns (Epic 4a stories)
- Minimal schema now, extend in Epic 4a when features are implemented

### Known Constraints

**NFR-1: App Startup Time <2 seconds**
- V3 migration adds 1 table + 2 indexes = minimal impact
- Current state: V1 + V2 migrations execute quickly (verified in Story 1.11)
- Expected: V3 adds <10ms to startup time

**Epic 4a Dependency:**
- This table is foundational for Epic 4a (Job Intelligence)
- Epic 4a stories will add:
  - job_skills join table (Story 4a-5)
  - Additional columns via migrations (if needed)
  - CRUD operations in db/queries/job_posts.rs

**Epic 4b Dependency:**
- Job scoring (Epic 4b) requires job_posts table
- Created_at index supports chronological job queue (Story 4b-9)

### References

- [Source: epics-stories.md#Story 1.12: Job Posts Table Schema]
- [Source: architecture.md#AR-18: Database Migrations (refinery 0.8)]
- [Source: architecture.md#AR-2: Database (rusqlite 0.38)]
- [Story 1.11: Database Migration Framework Setup - Migration patterns and test examples]
- [Story 1.2: Proposals Table Schema - Timestamp format conventions]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log

**Migration Created (Task 1):**
- Created V3__add_job_posts_table.sql in src-tauri/migrations/
- Table schema: 5 columns (id, url, raw_content, client_name, created_at)
- Used CREATE TABLE IF NOT EXISTS for idempotency (AC-2)
- All constraints applied: PRIMARY KEY (id), NOT NULL (raw_content, created_at)

**Indexes Added (Task 2):**
- idx_job_posts_created_at on created_at DESC for chronological sorting (Epic 4b-9)
- idx_job_posts_url on url for duplicate detection
- Both use CREATE INDEX IF NOT EXISTS for idempotency (AC-2)

**Tests Added (Task 3):**
- test_migrations_create_job_posts_table: Verify table exists via sqlite_master (AC-1)
- test_job_posts_table_has_correct_columns: Verify 5 columns via PRAGMA table_info (AC-1)
- test_job_posts_table_has_created_at_index: Verify created_at index exists (AC-3)
- test_job_posts_table_has_url_index: Verify url index exists (AC-3)

**Test Results:**
- 55 Rust tests passed (16 db tests, up from 12)
- 144 frontend tests passed (no regressions)
- **Total: 199 tests passed, 0 failed**

**Migration Applied Successfully:**
- V3 migration auto-applied on Database::new() via refinery runner
- Migration history verified via existing test_migration_history_tracked
- Idempotency verified via existing test_migrations_are_idempotent

### Completion Notes

✅ **All Acceptance Criteria Met:**
- **AC-1:** job_posts table created with all 5 required columns (verified by tests)
- **AC-2:** Migration is idempotent using CREATE IF NOT EXISTS (verified by existing test)
- **AC-3:** Performance indexes created for created_at and url (verified by new tests)

**Implementation Details:**
- V3 migration follows established patterns from V1 and V2
- Table schema supports Epic 4a (Job Intelligence) requirements
- Indexes optimized for Epic 4b (Job Queue View and duplicate detection)
- No seed data (table will be populated in Epic 4a stories)
- Migration executes quickly (<10ms estimated impact on startup time)

**Future Epic 4a Compatibility:**
- Schema ready for client_name extraction (Story 4a-2)
- Schema ready for job_skills join table (Story 4a-5)
- Indexes support chronological job queue (Story 4b-9)
- url column supports duplicate detection when user adds same job

### File List

- upwork-researcher/src-tauri/migrations/V3__add_job_posts_table.sql (NEW)
- upwork-researcher/src-tauri/src/db/mod.rs (4 new tests added)
