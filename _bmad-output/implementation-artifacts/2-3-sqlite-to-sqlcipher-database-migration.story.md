# Story 2.3: SQLite to SQLCipher Database Migration

Status: done

## Story

As a developer,
I want to migrate the unencrypted SQLite database to encrypted SQLCipher,
So that user data is protected at rest.

## Acceptance Criteria

**AC-1:** Given backup is complete and passphrase is set,
When migration executes,
Then the system:
1. Creates new SQLCipher database with Argon2id-derived key
2. Copies all tables and data from old SQLite database
3. Verifies row counts match (proposals, settings, job_posts)
4. Renames old database to .old extension
5. Sets new database as primary

**AC-2:** Given migration starts,
When any step of the migration process executes,
Then all database operations occur in a single atomic transaction.

**AC-3:** Given migration fails at any step,
When the failure is detected,
Then the system rolls back changes and restores from backup (Story 2.2).

**AC-4:** Given the database has been successfully migrated,
When the application restarts,
Then it opens the encrypted database using the same passphrase without re-migration.

## Tasks / Subtasks

### Backend Implementation (Rust)

- [ ] Task 1: Create migration module with atomic ATTACH DATABASE approach (AC: #1, #2)
  - [ ] Subtask 1.1: Create `src-tauri/src/migration/mod.rs` module
  - [ ] Subtask 1.2: Implement `migrate_to_encrypted_database(app_data_dir: &Path, passphrase: &str, backup_path: &Path) -> Result<MigrationMetadata, MigrationError>`
  - [ ] Subtask 1.3: Open old unencrypted database with rusqlite
  - [ ] Subtask 1.4: Create new SQLCipher database with derived Argon2id key
  - [ ] Subtask 1.5: Set SQLCipher PRAGMAs (PRAGMA key, PRAGMA cipher_compatibility = 4)
  - [ ] Subtask 1.6: Execute `ATTACH DATABASE` to connect old_db to encrypted connection

- [ ] Task 2: Implement atomic table copy in single transaction (AC: #2)
  - [ ] Subtask 2.1: Begin explicit transaction: `BEGIN EXCLUSIVE TRANSACTION`
  - [ ] Subtask 2.2: Copy proposals: `INSERT INTO proposals SELECT * FROM old_db.proposals`
  - [ ] Subtask 2.3: Copy settings: `INSERT INTO settings SELECT * FROM old_db.settings`
  - [ ] Subtask 2.4: Copy job_posts: `INSERT INTO job_posts SELECT * FROM old_db.job_posts`
  - [ ] Subtask 2.5: Copy refinery_schema_history: `INSERT INTO refinery_schema_history SELECT * FROM old_db.refinery_schema_history`
  - [ ] Subtask 2.6: Commit transaction (all-or-nothing)
  - [ ] Subtask 2.7: If any INSERT fails, ROLLBACK transaction and return error

- [ ] Task 3: Verify data integrity after migration (AC: #1, #3)
  - [ ] Subtask 3.1: Query row counts: `SELECT COUNT(*) FROM proposals` (old vs new)
  - [ ] Subtask 3.2: Query row counts: `SELECT COUNT(*) FROM settings` (old vs new)
  - [ ] Subtask 3.3: Query row counts: `SELECT COUNT(*) FROM job_posts` (old vs new)
  - [ ] Subtask 3.4: Query row counts: `SELECT COUNT(*) FROM refinery_schema_history` (old vs new)
  - [ ] Subtask 3.5: Compare all counts - if mismatch, return verification error
  - [ ] Subtask 3.6: DETACH old_db after verification passes
  - [ ] Subtask 3.7: Close old database connection

- [ ] Task 4: Finalize migration and cleanup (AC: #1, #4)
  - [ ] Subtask 4.1: Rename old database file: `upwork-researcher.db` → `upwork-researcher.db.old`
  - [ ] Subtask 4.2: Create migration marker file: `{app_data}/.migration_complete` with timestamp
  - [ ] Subtask 4.3: Return `MigrationMetadata` with counts, duration, timestamp
  - [ ] Subtask 4.4: Log migration success with metadata

- [ ] Task 5: Implement rollback and recovery on failure (AC: #3)
  - [ ] Subtask 5.1: Define `MigrationError` enum with specific failure types (AttachFailed, CopyFailed, VerificationFailed, etc.)
  - [ ] Subtask 5.2: On transaction failure, execute ROLLBACK automatically
  - [ ] Subtask 5.3: Delete incomplete encrypted database file
  - [ ] Subtask 5.4: Restore from backup using Story 2.2 backup file
  - [ ] Subtask 5.5: Log detailed error with failure step and recovery action

- [ ] Task 6: Create Tauri command for migration (AC: #1, #2, #3)
  - [ ] Subtask 6.1: `#[tauri::command] async fn migrate_database(app_handle: AppHandle, passphrase: String, backup_path: String, database: State<'_, db::Database>) -> Result<MigrationResult, String>`
  - [ ] Subtask 6.2: Return `MigrationResult` struct: { success: bool, proposals_migrated: usize, settings_migrated: usize, job_posts_migrated: usize, duration_ms: u64, message: String }
  - [ ] Subtask 6.3: Register command in lib.rs `invoke_handler`
  - [ ] Subtask 6.4: Add comprehensive error handling with user-friendly messages

### Initialization Sequence Refactoring (Story 1-16 Deferred Task)

- [ ] Task 7: Fix log level initialization from external config (Story 1-16, Epic 1 Retrospective)
  - [ ] Subtask 7.1: Create `src-tauri/src/config.rs` with `Config` struct for external config.json
  - [ ] Subtask 7.2: Implement `read_config_json(app_data_dir: &Path) -> Result<Config, ConfigError>` with defaults if missing
  - [ ] Subtask 7.3: Implement `write_config_json(app_data_dir: &Path, config: &Config) -> Result<(), ConfigError>`
  - [ ] Subtask 7.4: Update `lib.rs` setup sequence: read config.json BEFORE logging initialization
  - [ ] Subtask 7.5: Pass `log_level` from config.json to `logs::init_logging(&app_data_dir, Some(&log_level))`
  - [ ] Subtask 7.6: Update `set_log_level` command to write to BOTH config.json AND database (belt-and-suspenders)
  - [ ] Subtask 7.7: Add one-time migration: read log_level from database, write to config.json if config.json missing
  - [ ] Subtask 7.8: Remove hardcoded "INFO" from lib.rs:413

- [ ] Task 8: Refactor lib.rs setup sequence for Epic 2 initialization (AC: #4)
  - [ ] Subtask 8.1: Document new initialization order in lib.rs comments
  - [ ] Subtask 8.2: Phase 1 (Pre-Database): app_data_dir → config.json read → logging init → passphrase entry
  - [ ] Subtask 8.3: Check for migration marker file `{app_data}/.migration_complete`
  - [ ] Subtask 8.4: If marker exists → open encrypted database with passphrase (Story 2-7 flow)
  - [ ] Subtask 8.5: If marker missing → check if unencrypted DB exists → trigger migration flow (Stories 2-1, 2-2, 2-3)
  - [ ] Subtask 8.6: Phase 2 (Post-Database): migrations run → config state init → draft state init → ready
  - [ ] Subtask 8.7: Add error handling for database open failure (incorrect passphrase, corruption)
  - [ ] Subtask 8.8: Emit Tauri event when migration needed vs normal encrypted startup

### Frontend Integration (React)

- [ ] Task 9: Create DatabaseMigration component (AC: #1, #2, #3)
  - [ ] Subtask 9.1: Create `src/components/DatabaseMigration.tsx` component
  - [ ] Subtask 9.2: Display migration progress message: "Migrating database to encrypted storage..."
  - [ ] Subtask 9.3: Show progress bar (indeterminate - SQLite ATTACH migration doesn't report progress)
  - [ ] Subtask 9.4: Display success message with counts: "Migration complete: {count} proposals, {count} settings, {count} job posts"
  - [ ] Subtask 9.5: Display duration: "Completed in {duration}s"
  - [ ] Subtask 9.6: Handle errors with user-friendly messages and recovery instructions

- [ ] Task 10: Integrate migration into app flow (AC: #1, #3, #4)
  - [ ] Subtask 10.1: Update App.tsx state machine: backup → migration → verification (Story 2.4) → complete
  - [ ] Subtask 10.2: Call `migrate_database` command with passphrase and backup_path from Story 2.2
  - [ ] Subtask 10.3: If migration fails → show DatabaseMigration error state with "Restore from Backup" button
  - [ ] Subtask 10.4: If migration succeeds → proceed to Story 2.4 verification UI
  - [ ] Subtask 10.5: Add loading state during migration (block all other UI interactions)

### Testing

- [ ] Task 11: Write unit tests for migration module
  - [ ] Subtask 11.1: Test successful migration with mock data (5 proposals, 10 settings, 3 job_posts)
  - [ ] Subtask 11.2: Test ATTACH DATABASE works across encryption boundary (SQLCipher-specific behavior)
  - [ ] Subtask 11.3: Test row count verification (matching counts pass, mismatched counts fail)
  - [ ] Subtask 11.4: Test transaction rollback on copy failure (simulate constraint violation)
  - [ ] Subtask 11.5: Test encrypted database opens correctly after migration
  - [ ] Subtask 11.6: Test old database renamed to .old extension
  - [ ] Subtask 11.7: Test migration marker file created

- [ ] Task 12: Write integration tests
  - [ ] Subtask 12.1: Test end-to-end migration: unencrypted DB → backup → migration → verification → encrypted DB open
  - [ ] Subtask 12.2: Test migration failure recovery: copy fails → rollback → restore from backup → retry succeeds
  - [ ] Subtask 12.3: Test large database migration (150+ proposals, verify performance <10 seconds)
  - [ ] Subtask 12.4: Test re-migration detection (migration marker exists → skip migration, open encrypted DB)
  - [ ] Subtask 12.5: Test incorrect passphrase on restart (encrypted DB, wrong passphrase → error)
  - [ ] Subtask 12.6: Cross-platform test (Windows 10/11 all versions per Epic 1.6 findings)

- [ ] Task 13: Integration test for log level initialization fix (Story 1-16)
  - [ ] Subtask 13.1: Set log_level="DEBUG" via UI → save to config.json and database
  - [ ] Subtask 13.2: Restart app → verify config.json read before logging init
  - [ ] Subtask 13.3: Generate proposal (triggers DEBUG logs in claude.rs)
  - [ ] Subtask 13.4: Verify app-{date}.log contains DEBUG entries (not INFO)
  - [ ] Subtask 13.5: Test default log level (config.json missing → defaults to INFO)

## Dev Notes

### Architecture Requirements

**AR-2: SQLCipher Database Integration**
- **Database Library:** rusqlite 0.38 + bundled-sqlcipher-vendored-openssl feature
- **SQLCipher Version:** 4.10.0 (based on SQLite 3.50.4)
- **Encryption:** AES-256 (NFR-7 compliance)
- **Connection Setup:** PRAGMA key = x'{hex_encoded_key}', PRAGMA cipher_compatibility = 4
- **ATTACH Boundary:** Test that ATTACH DATABASE works from encrypted to unencrypted (SQLCipher allows this)

**AR-3: Argon2id Key Derivation**
- **Algorithm:** Argon2id (RustCrypto `argon2` crate 0.5.3)
- **Parameters:** 64MB memory, 3 iterations, 4 parallelism (OWASP recommended minimums)
- **Derivation Time:** ~200ms (within NFR-1 startup budget)
- **Salt:** Read from {app_data}/.salt file (created in Story 2-1)

**AR-Migration-Safety (Architecture Decision):**
- Migration MUST be atomic (single transaction)
- ATTACH DATABASE enables cross-database transaction (all-or-nothing)
- On failure: ROLLBACK transaction, delete incomplete encrypted DB, restore from backup
- Migration marker file prevents re-migration on restart

### Non-Functional Requirements

**NFR-1: Startup Performance**
- Migration is one-time operation (not startup cost)
- Acceptable migration time: <10 seconds for 10,000 proposals (NFR-9: query perf <500ms)
- Argon2id derivation: ~200ms (same as Story 2-1)
- After migration, encrypted DB startup <2 seconds (NFR-1 compliance)

**NFR-7: AES-256 Encryption**
- SQLCipher 4.10 provides AES-256 encryption at rest for all database contents

**NFR-19: Atomic Persistence**
- Migration uses explicit BEGIN EXCLUSIVE TRANSACTION
- All INSERT operations in single transaction (rollback on failure)
- Story 1-14 deferred task (transaction wrapping) resolved by migration to explicit transactions

### Migration Flow Context

**Story 2.3 Position in Migration Sequence:**
1. **Story 2-1 (DONE):** User sets passphrase → Argon2id key derived
2. **Story 2-2 (DONE):** Automatic backup created → verified
3. **→ Story 2.3 (THIS STORY):** SQLite → SQLCipher atomic migration with ATTACH DATABASE
4. **Story 2-4 (NEXT):** Verify migration success → prompt user confirmation → delete backup
5. **Story 2-5:** If migration fails → restore from backup → retry or cancel

**Critical Handoff from Story 2.2:**
- Story 2.2 returns `BackupMetadata` with file path
- Story 2.3 receives backup file path for fallback restore
- Backup file NOT deleted until Story 2-4 verification complete

**Critical Handoff to Story 2.4:**
- Story 2.3 returns `MigrationMetadata` with row counts and duration
- Story 2.4 displays counts for user verification
- Story 2.4 prompts user to confirm data looks correct before deleting backup

### ATTACH DATABASE Atomic Migration Approach

**From Round 6 Rubber Duck (Architecture Planning):**

The ATTACH DATABASE approach enables a true atomic migration:

```sql
-- 1. Open new encrypted database (with PRAGMA key)
PRAGMA key = x'...hex_encoded_key...';
PRAGMA cipher_compatibility = 4;

-- 2. Run migrations on encrypted database (refinery)
-- Creates: proposals, settings, job_posts, refinery_schema_history tables

-- 3. ATTACH old unencrypted database
ATTACH DATABASE '/path/to/old.db' AS old_db;

-- 4. Single atomic transaction for all data
BEGIN EXCLUSIVE TRANSACTION;

INSERT INTO proposals SELECT * FROM old_db.proposals;
INSERT INTO settings SELECT * FROM old_db.settings;
INSERT INTO job_posts SELECT * FROM old_db.job_posts;
INSERT INTO refinery_schema_history SELECT * FROM old_db.refinery_schema_history;

COMMIT; -- All-or-nothing

-- 5. Verify counts
SELECT COUNT(*) FROM proposals; -- Must match old_db.proposals count

-- 6. DETACH and cleanup
DETACH DATABASE old_db;
```

**Why This Works:**
- SQLCipher allows ATTACH from encrypted to unencrypted database
- Single transaction ensures all INSERTs succeed or all rollback
- No partial migration state possible
- Faster than row-by-row copy (~10x performance)

**Test on Windows Required:**
Epic 1.6 encryption spike validated ATTACH DATABASE on macOS. Must verify Windows 10/11 behavior is identical.

### Story 1-16 Deferred Task Integration

**From Epic 1 Retrospective, Epic 2 Deferred Tasks:**

Story 2.3 is the correct place to fix Story 1-16's log level initialization issue because:
1. Epic 2 refactors lib.rs setup sequence for passphrase entry
2. Initialization order must be redesigned anyway
3. External config.json avoids circular dependency (logging needs DB, DB needs logging)

**Solution: External Config File (Recommended by initialization-sequence-epic2.md):**

```rust
// New initialization order (lib.rs setup)
1. Create app_data directory
2. Read config.json for log_level (default: INFO if not exists)
3. Initialize logging with read level (not hardcoded "INFO")
4. Passphrase entry (Story 2-1)
5. Open database (encrypted if migration complete, trigger migration if not)
6. Run migrations
7. Continue normal initialization
```

**Config File Structure:** `{app_data}/config.json`
```json
{
  "log_level": "INFO",
  "last_updated": "2026-02-05T12:00:00Z"
}
```

**Settings UI Update:**
When user changes log level, write to BOTH config.json AND database (belt-and-suspenders approach).

**One-Time Migration:**
First run after Epic 2: read log_level from database settings, write to config.json if config.json missing.

### Previous Story Intelligence

**Story 2-1 (Passphrase Entry UI):**
- Argon2id key derivation pattern established
- Salt storage in {app_data}/.salt file
- Passphrase validation (≥12 chars, complexity checks)
- Database::new() signature: `Database::new(db_path: PathBuf, encryption_key: Option<Vec<u8>>)`
- SQLCipher PRAGMAs: `PRAGMA key`, `PRAGMA cipher_compatibility = 4`
- Environment: vcpkg OpenSSL configuration in .cargo/config.toml (Windows builds)

**Story 2-2 (Pre-Migration Automated Backup):**
- Backup module pattern: `backup::create_pre_migration_backup(app_data_dir, db)`
- Backup verification: atomic write (temp → rename), JSON validation
- Backup location: `{app_data}/backups/pre-encryption-backup-{timestamp}.json`
- BackupMetadata includes file path for restoration
- Backup file immutable after creation (no modifications)

**Key Learnings from Epic 1:**
1. **Async Operations (Epic 1 Retrospective):** Race conditions found in Stories 1-13 and 1-14. Migration must carefully order async operations.
2. **Transaction Wrapping (Story 1-14 Deferred):** Explicit transactions deferred to Epic 2. Story 2.3 implements explicit BEGIN/COMMIT for atomicity.
3. **Initialization Order (Story 1-16 Code Review):** Circular dependency resolved by external config.json read before DB init.
4. **Windows Testing (Epic 1.6 Spike):** SQLCipher works on Windows 10/11 all versions. Must validate ATTACH DATABASE behavior.

### Project Structure Notes

**New Files to Create:**
- `upwork-researcher/src-tauri/src/migration/mod.rs` — Migration module
- `upwork-researcher/src-tauri/src/migration/tests.rs` — Unit tests
- `upwork-researcher/src-tauri/tests/migration_integration.rs` — Integration tests
- `upwork-researcher/src/components/DatabaseMigration.tsx` — React component
- `upwork-researcher/src/components/DatabaseMigration.css` — Styling (dark theme)

**Files to Modify:**
- `upwork-researcher/src-tauri/src/lib.rs` — Add migration module, refactor setup sequence, fix log level init
- `upwork-researcher/src-tauri/src/config.rs` — Create new file for config.json operations
- `upwork-researcher/src-tauri/src/logs/mod.rs` — Update to use log_level from config (may not need changes if init_logging already accepts parameter)
- `upwork-researcher/src/App.tsx` — Add DatabaseMigration component to migration flow
- `upwork-researcher/src-tauri/Cargo.toml` — No new dependencies (reuse argon2, rusqlite, serde_json)

**Files to Reference:**
- `upwork-researcher/src-tauri/src/backup/mod.rs` — Backup restore pattern for rollback
- `upwork-researcher/src-tauri/src/passphrase/mod.rs` — Argon2id key derivation pattern
- `upwork-researcher/src-tauri/src/db/mod.rs` — Database::new() usage pattern
- `upwork-researcher/src-tauri/src/logs/mod.rs` — init_logging signature

### References

- [Source: epics-stories.md#Epic 2: Security & Encryption / Story 2.3]
- [Source: architecture.md#AR-2: SQLCipher Database]
- [Source: architecture.md#AR-Migration-Safety: Atomic migration with backup fallback]
- [Source: architecture.md#Migrations: refinery 0.9 with no rollback]
- [Source: prd.md#NFR-7: AES-256 Encryption]
- [Source: prd.md#NFR-19: Atomic Persistence Across Crashes]
- [Source: Story 2-1: Passphrase Entry UI — Argon2id key derivation]
- [Source: Story 2-2: Pre-Migration Automated Backup — backup/restore pattern]
- [Source: Story 1-16: Logging Infrastructure — deferred log level initialization task]
- [Source: epic-1-retro-2026-02-05.md#Discovery 2: Initialization Order More Complex Than Expected]
- [Source: epic-2-deferred-tasks.md#Story 1-16: Fix Log Level Initialization from Database]
- [Source: initialization-sequence-epic2.md#Recommendation: Option 2 (External Config File)]

### Technical Context from Planning Rounds

**Round 4 Red Team (Migration Safety Protocol):**
- Pre-migration backup is step 1 (Story 2.2 - DONE)
- Atomic migration is step 2 (THIS STORY)
- Verification is step 3 (Story 2.4)
- Rollback/recovery is contingency (Story 2.5)

**Round 6 Rubber Duck (Atomic Migration):**
- ATTACH DATABASE enables single transaction across unencrypted→encrypted
- Faster than row-by-row copy (~10x performance for large datasets)
- Must test ATTACH works on Windows (not just macOS)

**Epic 1 Retrospective:**
- Race conditions in async operations require careful testing (Stories 1-13, 1-14)
- Initialization order must be designed, not discovered (Story 1-16 lesson)
- Code review catches critical issues (continue for all Epic 2 stories)
- Manual NFR validation often skipped (add explicit checklists)

### Security Considerations

**Passphrase Never Stored:**
- Passphrase passed from frontend → backend for migration
- Immediately derive Argon2id key
- Clear passphrase from memory after derivation (zeroize crate - Story 2-1 deferred task)

**Old Database Cleanup:**
- Rename to .old extension (not delete) until Story 2.4 verification complete
- User explicitly confirms deletion after verification
- If user never confirms, .old file remains as safety backup

**Migration Marker File:**
- Prevents accidental re-migration if encrypted DB exists
- Timestamp helps diagnose migration issues
- Not security-critical (just prevents duplicate work)

### Initialization Sequence Design

**Phase 1: Pre-Database (Console Logging)**
```
1. app.path().app_data_dir() → create directory
2. Read config.json → log_level (default: "INFO" if missing)
3. logs::init_logging(&app_data_dir, Some(&log_level))
4. Check for migration marker: {app_data}/.migration_complete
5. If marker exists → encrypted database path
6. If marker missing → check for unencrypted database
```

**Phase 2: Migration Flow (First Run After Epic 2)**
```
7. Show PassphraseEntry UI (Story 2-1)
8. User enters passphrase → derive Argon2id key
9. Create pre-migration backup (Story 2-2)
10. Migrate database (THIS STORY - Story 2.3)
11. Verify migration (Story 2.4)
12. Create migration marker file
```

**Phase 3: Normal Encrypted Startup (Subsequent Runs)**
```
7. Migration marker exists → skip Stories 2-1, 2-2, 2-3
8. Prompt for passphrase (Story 2-7)
9. Derive Argon2id key from passphrase
10. Open encrypted database with key
11. Run migrations (refinery - schema updates only)
12. Continue normal initialization
```

**Phase 4: Post-Database**
```
13. Initialize config state (API key from keychain)
14. Initialize draft state
15. Emit ready event
```

### Story Dependencies

**Blocked By:**
- Story 2-1: Passphrase Entry UI (DONE) — passphrase required for Argon2id key derivation
- Story 2-2: Pre-Migration Automated Backup (DONE) — backup required for rollback safety

**Blocks:**
- Story 2-4: Migration Verification and User Confirmation — needs MigrationMetadata for display
- Story 2-5: Migration Failure Recovery — needs rollback/restore logic from this story
- Story 2-6: API Key Migration to OS Keychain — happens after encrypted database ready
- Story 2-7: Encrypted Database Access on Restart — uses migration marker to detect encrypted DB

### Async Testing Guidelines (Epic 1 Retrospective Action Item)

**From Epic 1 Retrospective - Action 2:**
Create async testing patterns guide before Story 2.3 implementation.

**Key Patterns for Story 2.3:**
1. **Transaction Testing:** Verify BEGIN → INSERT → COMMIT sequence
2. **Rollback Testing:** Simulate failures mid-transaction, verify ROLLBACK executed
3. **Concurrent Access:** Test migration blocks other database operations (EXCLUSIVE lock)
4. **Channel Draining:** If using async channels, drain before assertions
5. **tokio::time:** Use `pause()` for deterministic async timing tests

**Reference:** async-testing-guide.md (if created by Senior Dev Charlie before Story 2.3)

### Manual Test Checklist (Epic 1 Retrospective Action Item)

**From Epic 1 Retrospective - Action 1:**
Add manual test checklist to story template.

**Story 2.3 Manual Tests:**
- [ ] NFR-1: Verify migration completes in <10 seconds for 1,000 proposals
- [ ] NFR-1: Verify encrypted database opens in <2 seconds on subsequent startup
- [ ] Cross-platform: Test migration on Windows 10 (various builds) and Windows 11
- [ ] Cross-platform: Test ATTACH DATABASE on Windows matches macOS behavior
- [ ] User experience: Migration progress visible during 5+ second migrations
- [ ] Recovery: Simulate disk full mid-migration, verify rollback and restore
- [ ] Recovery: Simulate app crash mid-migration, verify incomplete DB cleaned up on restart

**Sign-off:** QA Engineer (Dana) or Senior Dev (Charlie)

## Dev Agent Record

### Agent Model Used

[To be filled during implementation]

### Debug Log References

[To be filled during implementation]

### Completion Notes

[To be filled during implementation]

### File List

**Backend (Rust):**
[To be filled during implementation]

**Frontend (React):**
[To be filled during implementation]

**Tests:**
[To be filled during implementation]
