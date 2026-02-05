# Story 2.5: Migration Failure Recovery

Status: ready-for-dev

## Story

As a freelancer,
I want the app to recover gracefully if migration fails,
So that I don't lose my data.

## Acceptance Criteria

**AC-1:** Given migration encounters an error (e.g., disk full, corruption),
When the error is detected,
Then the system halts migration immediately.

**AC-2:** Given migration has halted due to error,
When the system begins recovery,
Then it rolls back any partial changes.

**AC-3:** Given rollback is complete,
When the system restores from pre-migration backup,
Then all data is restored and the app continues to function with unencrypted database.

**AC-4:** Given migration failed and recovery succeeded,
When the user sees the error screen,
Then I see error: "Migration failed: {reason}. Your data has been restored."

**AC-5:** Given recovery is complete,
When the user decides what to do next,
Then user can retry migration after fixing issue.

## Tasks / Subtasks

### Backend Implementation (Rust)

- [x] Task 1: Enhance MigrationError with recovery context
  - [x] Add specific error types for each failure point
  - [x] Include recovery state in error messages

- [x] Task 2: Implement rollback logic in migration module
  - [x] Detect transaction failures
  - [x] Execute ROLLBACK on transaction errors
  - [x] Delete incomplete encrypted database file
  - [x] Verify old database is intact

- [x] Task 3: Implement backup restore function
  - [x] Read backup JSON file
  - [x] Restore data to unencrypted database
  - [x] Verify restoration success

- [x] Task 4: Add recovery logging
  - [x] Log detailed error with failure step
  - [x] Log recovery actions taken
  - [x] Log restoration success/failure

### Frontend Implementation (React)

- [x] Task 5: Enhance DatabaseMigration error state
  - [x] Display detailed error message
  - [x] Show recovery status
  - [x] Provide retry button

### Testing

- [x] Task 6: Test recovery scenarios
  - [x] Test disk full simulation
  - [x] Test transaction failure recovery
  - [x] Test backup restoration
  - [x] Test retry after recovery

## Dev Notes

Migration rollback is already implemented in Story 2.3 via atomic transactions. This story adds explicit recovery handling and user communication.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Implementation Summary

Implemented comprehensive migration failure recovery system with:

1. **Enhanced Error Messages (AC-4)**: Added recovery context to all MigrationError variants
   - Each error now includes safety information ("Your data is safe", "Migration rolled back")
   - New error types: DiskSpaceError, TransactionFailed

2. **Rollback & Verification (AC-1, AC-2)**:
   - Transaction rollback already existed from Story 2.3
   - Added `verify_old_database_intact()` function to verify DB readable after rollback
   - Added WAL checkpoint and journal mode cleanup before rename operations

3. **Backup Restore Function (AC-3)**:
   - Implemented `restore_from_backup()` in backup/mod.rs
   - Atomic restore with transaction support
   - Handles all table schemas correctly (proposals, settings, job_posts)

4. **Recovery Logging (AC-2, AC-3)**:
   - Added detailed tracing throughout rollback path
   - Log verification results and recovery actions
   - Log restore success/failure with record counts

5. **Enhanced UI (AC-4, AC-5)**:
   - Added recovery status indicator (green checkmark) showing data is safe
   - Display detailed error with recovery context
   - Show "What Happened" and "Next Steps" guidance
   - Backup path displayed with proper styling
   - Retry button properly wired with onRetry callback

6. **Comprehensive Testing (AC-5)**:
   - 4 new Story 2.5 recovery tests in migration/tests.rs
   - 5 new backup restore tests in backup/tests.rs
   - All 25 tests passing (12 migration + 13 backup)

### Technical Decisions

- Used `INSERT OR REPLACE` for settings and refinery_schema_history to handle default values
- Added explicit column names in migration copy to handle schema evolution
- SQLCipher `KEY ''` syntax for attaching unencrypted databases
- WAL checkpoint + journal mode cleanup to prevent file lock issues
- RFC3339 timestamps and u64 checksums for refinery compatibility

### File List

**Modified:**
- upwork-researcher/src-tauri/src/migration/mod.rs
- upwork-researcher/src-tauri/src/backup/mod.rs
- upwork-researcher/src-tauri/src/migration/tests.rs
- upwork-researcher/src-tauri/src/backup/tests.rs
- upwork-researcher/src/components/DatabaseMigration.tsx
- upwork-researcher/src/components/DatabaseMigration.css
