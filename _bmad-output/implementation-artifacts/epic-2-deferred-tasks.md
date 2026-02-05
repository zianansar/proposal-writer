# Epic 2: Deferred Tasks from Previous Epics

This file tracks tasks deferred to Epic 2 (Database Encryption & Migration) due to architectural dependencies.

## From Story 1-16: Logging Infrastructure

### Task: Fix Log Level Initialization from Database

**Priority:** HIGH
**Deferred From:** Story 1-16 Code Review (2026-02-05)
**Reason:** Conflicts with Epic 2 database initialization refactoring

#### Current Behavior (Broken)
- Log level setting can be changed via SettingsPanel UI
- Setting is saved to database successfully
- **BUT:** On app restart, hardcoded "INFO" is always used
- `lib.rs:413` calls `logs::init_logging(&app_data_dir, Some("INFO"))` with hardcoded value

#### Why It's Broken
Chicken-and-egg problem with initialization order:
```rust
// Current order in lib.rs setup():
1. init_logging() ← needs log level from DB, but DB not initialized yet!
2. Database::new() ← DB created AFTER logging initialized
3. Read settings ← too late, logging already initialized
```

The `tracing` subscriber can only be initialized ONCE per process, so changing the log level at runtime is impossible.

#### Fix Required in Epic 2

When refactoring `lib.rs` setup sequence for SQLCipher integration, implement one of these options:

**Option A: Database First (Recommended)**
```rust
// 1. Create app data directory
let app_data_dir = app.path().app_data_dir()?;
std::fs::create_dir_all(&app_data_dir)?;

// 2. Initialize database FIRST (with fallback console logging for errors)
let db_path = app_data_dir.join("upwork-researcher.db");
let database = db::Database::new(db_path)?;

// 3. Read log level from settings
let log_level = {
    let conn = database.conn.lock().unwrap();
    db::queries::settings::get_setting(&conn, "log_level")
        .ok()
        .flatten()
        .unwrap_or_else(|| "INFO".to_string())
};

// 4. Initialize logging with actual setting
let logs_dir = logs::init_logging(&app_data_dir, Some(&log_level))?;
```

**Trade-off:** Early database errors (before logging init) will only go to stderr, not log files.

**Option B: Two-Phase Logging**
- Phase 1: Basic console-only logging during early init
- Phase 2: Reload with file logging after DB initialized
- **Complexity:** Requires making tracing subscriber replaceable (non-trivial)

**Option C: Separate Config File**
- Move log_level out of database into `config.json`
- Load before both DB and logging init
- **Downside:** Settings split across two storage locations

#### Acceptance Criteria for Fix
- [ ] Log level setting is read from database on startup
- [ ] Setting value (not hardcoded "INFO") is used for logging initialization
- [ ] User changes log level → restart → new level takes effect immediately
- [ ] Integration test: set log_level="DEBUG" → restart → verify DEBUG logs appear
- [ ] Update lib.rs:412 comment to reflect actual behavior

#### Files to Modify
- `src-tauri/src/lib.rs` - Reorder setup sequence
- `src-tauri/src/logs/mod.rs` - Possibly add two-phase init if needed
- Add integration test for log level persistence

#### Testing Checklist
- [ ] Set log level to DEBUG via UI
- [ ] Restart app
- [ ] Generate a proposal (triggers DEBUG logs in claude.rs)
- [ ] Open log file and verify DEBUG entries are present
- [ ] Verify app-{date}.log exists and contains expected level entries

---

**Created:** 2026-02-05
**Linked Stories:** 1-16-logging-infrastructure (done with deferral)
**Epic:** 2 (Database Encryption & Migration)
