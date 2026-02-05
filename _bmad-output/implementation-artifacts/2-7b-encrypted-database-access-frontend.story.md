---
status: backlog
assignedTo: null
splitFrom: "2-7-encrypted-database-access-on-app-restart"
prerequisiteStory: "2-7a-encrypted-database-access-backend"
blockedBy: "state-refactor-mutex-option-database"
relatedStory: "2-7a-encrypted-database-access-backend"
---

# Story 2.7b: Encrypted Database Access on App Restart (Frontend)

**SPLIT NOTICE:** Original Story 2.7 split into 2.7a (backend, DONE) and 2.7b (frontend, BACKLOG) after code review on 2026-02-05. This story contains frontend integration work that requires state refactoring prerequisite.

## Story

As a freelancer,
I want to enter my passphrase when restarting the app,
So that I can access my encrypted data.

**Scope:** Frontend integration only (Tasks 5-7, 10). Backend functions completed in Story 2.7a.

## Acceptance Criteria (Frontend Scope)

**AC-1:** Given the app is restarting with encrypted database,
When the app opens,
Then I'm prompted for my passphrase before any database access.

**AC-7:** Given I want to see what I'm typing,
When I click the show/hide toggle,
Then the passphrase field switches between password and text visibility.

**Backend ACs (completed in Story 2.7a):**
- AC-2: Argon2id key derivation ✅
- AC-3: Database opens with correct passphrase ✅
- AC-4: Error for incorrect passphrase ✅
- AC-5: Recovery after 5 failures ✅
- AC-6: Constant-time comparison ✅

## Prerequisites

**BLOCKER:** This story requires database state refactoring before implementation can begin:

### Subtask 3.3: Database State Refactoring

**Current Architecture:**
```rust
// lib.rs - Current (blocking)
app.manage(database);  // Type: db::Database

// Commands expect Database always available
fn some_command(database: State<db::Database>) { ... }
```

**Required Architecture:**
```rust
// lib.rs - Required for Story 2.7b
app.manage(Mutex::new(None::<db::Database>));  // Type: Mutex<Option<db::Database>>

// Commands must handle database not yet unlocked
fn some_command(database: State<Mutex<Option<db::Database>>>) -> Result<...> {
    let db = database.lock()?
        .as_ref()
        .ok_or("Database not unlocked - passphrase required")?;
    // ... use db
}
```

**Impact:** ~30 Tauri commands need updates to handle `Option<Database>` case.

**Effort Estimate:** 4-6 hours (update all commands, test all flows, handle error cases).

**Recommendation:** Create separate story "Database State Refactor for Lazy Initialization" before starting Story 2.7b.

## Tasks / Subtasks

### State Refactoring Prerequisite

- [ ] **PREREQUISITE:** Refactor database state to Mutex<Option<Database>> (Subtask 3.3 from Story 2.7a)
  - [ ] Change managed state type: `app.manage(Mutex::new(None::<db::Database>))`
  - [ ] Update ~30 Tauri commands to handle `None` case (database not yet unlocked)
  - [ ] Add error handling: "Database not unlocked - passphrase required"
  - [ ] Update `verify_passphrase_on_restart` to populate state: `*database.lock()? = Some(db)`
  - [ ] Test all commands in both locked and unlocked states
  - [ ] Update database health check to handle None case

### Initialization Sequence Integration

- [ ] Task 5: Update lib.rs setup sequence for encrypted database startup (AC: #1)
  - [ ] Subtask 5.1: Check for migration marker file: {app_data}/.migration_complete
  - [ ] Subtask 5.2: If marker exists AND encrypted DB exists → encrypted startup path
  - [ ] Subtask 5.3: Emit Tauri event: `passphrase-required` to frontend
  - [ ] Subtask 5.4: Block database initialization until passphrase provided
  - [ ] Subtask 5.5: After successful passphrase verify → continue Phase 2 initialization (config state, draft state)
  - [ ] Subtask 5.6: Document initialization order in lib.rs comments

### Frontend Integration (React)

- [ ] Task 6: Create PassphraseUnlock component for restart (AC: #1, #4, #5, #7)
  - [ ] Subtask 6.1: Create `src/components/PassphraseUnlock.tsx` component
  - [ ] Subtask 6.2: Password input field (type="password")
  - [ ] Subtask 6.3: Show/hide toggle button for password visibility (AC-7)
  - [ ] Subtask 6.4: "Unlock Database" submit button
  - [ ] Subtask 6.5: Display error message if incorrect passphrase
  - [ ] Subtask 6.6: Display failed attempt counter: "Attempt 3/5"
  - [ ] Subtask 6.7: After 5 failed attempts, show "Restore from Backup" button
  - [ ] Subtask 6.8: Loading state during passphrase verification

- [ ] Task 7: Integrate PassphraseUnlock into app flow (AC: #1, #3)
  - [ ] Subtask 7.1: Listen for `passphrase-required` Tauri event in App.tsx
  - [ ] Subtask 7.2: Show PassphraseUnlock modal when event received
  - [ ] Subtask 7.3: Call `verify_passphrase_on_restart` command with passphrase
  - [ ] Subtask 7.4: If successful → close modal, continue app initialization
  - [ ] Subtask 7.5: If incorrect → display error, allow retry
  - [ ] Subtask 7.6: After 5 failures → enable "Restore from Backup" button (links to Story 2.5 recovery)

### End-to-End Testing

- [ ] Task 10: Manual NFR validation tests (Epic 1 Retrospective Action Item)
  - [ ] Subtask 10.1: NFR-1: Verify passphrase entry → database unlock completes in <2 seconds
  - [ ] Subtask 10.2: NFR-1: Verify Argon2id derivation takes ~200ms (release build)
  - [ ] Subtask 10.3: NFR-4: Verify passphrase incorrect error appears in <100ms
  - [ ] Subtask 10.4: NFR-7: Verify encrypted database remains encrypted at rest (cannot open without passphrase)
  - [ ] Subtask 10.5: Security: Verify passphrase not logged anywhere (grep logs for passphrase patterns)
  - [ ] Subtask 10.6: UX: Verify show/hide toggle works correctly (AC-7)
  - [ ] Subtask 10.7: UX: Verify failed attempt counter displays correctly (1/5, 2/5, ... 5/5)
  - [ ] Subtask 10.8: UX: Verify recovery options appear after 5 failures
  - [ ] Subtask 10.9: Cross-platform: Test on Windows 10/11, macOS 12+

## Dev Notes

### Backend Context (Completed in Story 2.7a)

**Available Backend Functions:**
- `passphrase::verify_passphrase_and_derive_key(passphrase, app_data_dir)` - Returns 32-byte key
- `db::open_encrypted_database(app_data_dir, passphrase)` - Opens encrypted DB, returns Database
- `verify_passphrase_on_restart` Tauri command - Returns VerifyPassphraseResult with failed_attempts and show_recovery

**Tests:** 11 backend tests passing (153 total):
- 4 passphrase tests (including timing attack resistance)
- 7 database tests (including retry flow, performance, query validation)

**See Story 2.7a for complete backend implementation details.**

### Initialization Sequence (Task 5 Context)

**Current Flow (Epic 1):**
```
1. app_data_dir created
2. config.json read → log_level
3. logging initialized
4. Database::new() - BLOCKING, app can't start without DB
5. config state initialized
6. draft state initialized
7. App ready
```

**Required Flow (Story 2.7b):**
```
1. app_data_dir created
2. config.json read → log_level
3. logging initialized
4. Check migration marker: {app_data}/.migration_complete
5. IF encrypted DB exists:
   a. Emit Tauri event: passphrase-required
   b. Database state: None (not yet unlocked)
   c. Frontend shows PassphraseUnlock modal
   d. User enters passphrase
   e. Backend: verify_passphrase_on_restart → populates database state
   f. Continue initialization (config state, draft state)
6. ELSE:
   a. Database::new(None) - unencrypted (Epic 1 compatibility)
   b. Continue normal flow
7. App ready
```

### PassphraseUnlock Component (Task 6 UX)

**Design (from UX-1):**
- **Title:** "Unlock Database"
- **Subtitle:** "Enter your passphrase to access your encrypted proposals"
- **Input:** Password field with show/hide toggle (eye icon)
- **Submit:** "Unlock" button (disabled while verifying)
- **Error:** Red error message below input: "Incorrect passphrase. Try again."
- **Counter:** "Attempt 3/5" displayed when >1 failed attempt
- **Recovery:** "Restore from Backup" button after 5 failures (high-contrast, secondary button)
- **Loading:** Show spinner, disable input during verification (~200ms Argon2id time)

**Dark Theme (UX-1):**
- Background: #1a1a1a
- Text: #e0e0e0
- Accents: #3b82f6 (blue)
- Error: #ef4444 (red)
- Contrast: WCAG AA compliant (4.5:1 minimum ratio)

### Story Position in Epic 2 Flow

**Story 2.7b Position:**
1. Story 2-1 (DONE): Passphrase entry UI (first-time setup)
2. Story 2-2 (DONE): Pre-migration backup
3. Story 2-3 (DONE): SQLite → SQLCipher migration
4. Story 2-4 (DONE): Migration verification
5. Story 2-5 (DONE): Migration failure recovery
6. Story 2-6 (DONE): API key migration to keychain
7. Story 2-7a (REVIEW): Backend functions (passphrase verification, DB opening)
8. **→ Story 2.7b (THIS STORY):** Frontend integration (every restart flow)
9. Story 2-8 (NEXT): Encryption status indicator
10. Story 2-9: Passphrase recovery options

### Dependencies

**Blocked By:**
- State refactor (Subtask 3.3) - Must complete before frontend work can begin
- Story 2-7a (Backend) - Must be in DONE status

**Blocks:**
- Story 2-8: Encryption Status Indicator - Shows lock icon after successful unlock
- Story 2-9: Passphrase Recovery Options - Provides backup restore for 5-failure scenario

### References

- [Source: Story 2-7a - Backend implementation]
- [Source: epics-stories.md#Epic 2: Security & Encryption / Story 2.7]
- [Source: architecture.md#AR-3: Argon2id Key Derivation]
- [Source: architecture.md#AR-2: SQLCipher Database]
- [Source: prd.md#NFR-1: Startup Performance <2 seconds]
- [Source: prd.md#NFR-4: UI Response <100ms]
- [Source: ux-design-specification.md#UX-1: Dark Mode by Default]
- [Source: initialization-sequence-epic2.md#Phase 2: Encrypted Database Startup]

## Change Log

- 2026-02-05: Story 2.7b created from Story 2.7 split
  - **Scope:** Frontend integration (Tasks 5-7, 10)
  - **Status:** Backlog (blocked by state refactor prerequisite)
  - **Backend:** Completed in Story 2.7a (11 tests passing)
  - **Prerequisite:** Subtask 3.3 state refactor required before implementation
  - **Effort:** 2-3 days (1 day state refactor + 1-2 days frontend implementation)
