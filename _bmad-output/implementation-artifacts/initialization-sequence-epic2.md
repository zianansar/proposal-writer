# Initialization Sequence Design - Epic 2

**Created:** 2026-02-05
**Purpose:** Resolve Story 1-16 deferred task (log level initialization) during Epic 2 setup refactoring
**Status:** Design Complete - Ready for Implementation

---

## Problem Statement

**From Epic 1 Retrospective / Story 1-16 Code Review:**

Current initialization has circular dependency:
- **Logging needs database** for log_level setting
- **Database needs logging** to log initialization errors

**Current Behavior (Broken):**
```rust
// lib.rs setup() - Epic 1
1. init_logging(Some("INFO"))        // Hardcoded INFO
2. Database::new()                   // DB errors logged at INFO
3. Read settings["log_level"]        // Too late - logging already initialized!
```

**Result:** User's log level setting is saved but never used. Always logs at INFO level.

---

## Design Constraints

### Technical Constraints

1. **Tracing subscriber can only be initialized ONCE per process** (Rust tracing limitation)
2. **Early errors must be visible** (can't skip logging during critical init phases)
3. **Passphrase required BEFORE database access** (Epic 2 encryption requirement)
4. **Log level setting stored IN database** (can't read it before DB is open)

### NFR Constraints

- **NFR-1:** App startup <2 seconds (can't add significant latency)
- **NFR-4:** UI response <100ms (init must be non-blocking where possible)
- **NFR-19:** Atomic persistence (passphrase, migration must be transactional)

---

## Proposed Solution: Two-Phase Logging with Early Console Fallback

### Phase 1: Console-Only Logging (Pre-Database)

**Purpose:** Capture errors during passphrase entry and database initialization.

**Configuration:**
- Console output only (stderr)
- Fixed level: WARN (errors + warnings only)
- No file output (can't write to app_data yet)
- Duration: ~200-500ms (passphrase entry → DB open)

**What's Logged:**
- Passphrase validation errors
- Keychain access failures
- Database open errors
- Migration failures
- Catastrophic startup errors

### Phase 2: Full Logging with User Settings (Post-Database)

**Purpose:** Normal operation logging with user's preferred log level.

**Configuration:**
- Read log_level from settings table
- File output to {app_data}/logs/app-{date}.log
- Console output (dev builds only)
- User-configured level (ERROR, WARN, INFO, DEBUG)
- Duration: Rest of app lifetime

---

## Detailed Initialization Sequence (Epic 2)

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Pre-Database Initialization (Console Logging)         │
└─────────────────────────────────────────────────────────────────┘

Step 1: Get app_data directory
   ├─ Use app.path().app_data_dir()
   ├─ Create directory if not exists
   └─ Store path for later use

Step 2: Initialize Phase 1 Logging (Console Only)
   ├─ Level: WARN (errors + warnings only)
   ├─ Output: stderr (console)
   ├─ Format: Simple text (timestamp + level + message)
   └─ No file output yet

Step 3: Passphrase Entry (Epic 2 Story 2-1)
   ├─ Show passphrase UI
   ├─ User enters passphrase
   ├─ Validate strength (≥12 chars, complexity)
   ├─ Derive Argon2id key (200ms)
   └─ Log errors if validation fails (Phase 1 logging)

Step 4: Keychain Retrieval (Epic 2 Story 2-6)
   ├─ Retrieve stored passphrase from OS keychain
   ├─ Derive encryption key
   └─ Log errors if keychain access fails (Phase 1 logging)

Step 5: Database Initialization
   ├─ Open SQLCipher database with derived key
   ├─ Enable WAL mode + foreign keys
   ├─ Run migrations (refinery)
   ├─ Verify database health
   └─ Log errors if DB open/migration fails (Phase 1 logging)

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Post-Database Initialization (Full Logging)           │
└─────────────────────────────────────────────────────────────────┘

Step 6: Read User Settings
   ├─ Query settings table for log_level
   ├─ Default to "INFO" if not found
   └─ Parse log level (ERROR, WARN, INFO, DEBUG)

Step 7: Upgrade Logging to Phase 2 (File + User Level)
   ├─ Create logs directory in app_data
   ├─ Initialize file appender (daily rotation)
   ├─ Apply user's log level setting
   ├─ Keep console output (dev builds)
   └─ Phase 1 console logger remains active (duplicate output acceptable)

Step 8: Cleanup Old Logs
   ├─ Run cleanup_old_logs (7-day retention)
   ├─ Non-blocking (errors logged but don't fail startup)
   └─ Log cleanup results

Step 9: Initialize Config State
   ├─ Create ConfigState with app_data path
   ├─ Load API key from keychain (if exists)
   └─ Store in Tauri managed state

Step 10: Initialize Draft State
   ├─ Create DraftState (Mutex for current draft tracking)
   └─ Store in Tauri managed state

Step 11: Emit Ready Event
   ├─ Tauri setup complete
   ├─ Frontend can now make commands
   └─ App window visible to user
```

---

## Implementation Details

### Phase 1 Logging Setup (Console Only)

```rust
// Early in setup(), before database
fn init_phase1_logging() -> Result<(), String> {
    // Simple console-only subscriber
    let console_layer = tracing_subscriber::fmt::layer()
        .with_target(true)
        .with_thread_ids(false)
        .with_file(true)
        .with_line_number(true)
        .with_writer(std::io::stderr); // Write to stderr

    let filter = EnvFilter::try_new("WARN")
        .map_err(|e| format!("Failed to create filter: {}", e))?;

    tracing_subscriber::registry()
        .with(filter)
        .with(console_layer)
        .init();

    Ok(())
}
```

**Called:** Immediately after app_data directory creation, before passphrase entry.

---

### Phase 2 Logging Setup (File + User Level)

**NOTE:** Since tracing subscriber can only be initialized once, we **cannot** reinitialize. Instead, we'll use a different approach:

### REVISED APPROACH: Single Initialization with Reload

Use `tracing_subscriber::reload` to change log level dynamically:

```rust
use tracing_subscriber::reload;

// In setup()
let filter = EnvFilter::try_new("WARN")?; // Start at WARN
let (filter_handle, reload_layer) = reload::Layer::new(filter);

let file_appender = /* create after DB loaded */;

tracing_subscriber::registry()
    .with(reload_layer)
    .with(file_layer)
    .with(console_layer)
    .init();

// Later, after reading settings
let user_level = get_setting(&conn, "log_level")?;
filter_handle.reload(EnvFilter::try_new(&user_level)?)?;
```

**Key Insight:** Use `reload::Layer` to change log level dynamically without re-initializing subscriber.

---

## Alternative Approach (Simpler): External Config File

**Rationale:** To completely avoid circular dependency, move log_level OUT of database into separate config file.

**Pros:**
- Simple - no two-phase logging
- Read before database initialization
- User can edit if needed

**Cons:**
- Settings split across two storage locations (file + database)
- Migration needed to move existing log_level settings

**File Location:** `{app_data}/config.json`

**Structure:**
```json
{
  "log_level": "INFO",
  "last_updated": "2026-02-05T12:00:00Z"
}
```

**Read Order:**
```rust
1. Create app_data directory
2. Read config.json for log_level (default: INFO if not exists)
3. Initialize logging with read level
4. Open database
5. Continue normal initialization
```

**Settings UI:** Update config.json when user changes log level (in addition to database for consistency).

---

## Recommendation: Option 2 (External Config File)

**Why:**
- **Simpler** - No reload complexity, no two-phase logic
- **Faster startup** - Read JSON is <1ms, no DB query overhead
- **More robust** - Works even if database is corrupted
- **Explicit separation** - Logging config is infrastructure, not app data

**Migration Path (Epic 2 Story 2-4 or 2-5):**
1. On first run after Epic 2, check if config.json exists
2. If not, read log_level from database settings
3. Write to config.json
4. Update settings UI to write to both locations (belt-and-suspenders)

**Implementation Effort:** 2-3 hours (Story 1-16 fix)

---

## Initialization Order Dependencies

```
app_data_dir
    ↓
config.json (log_level)
    ↓
logging initialization
    ↓
passphrase entry
    ↓
keychain retrieval
    ↓
database open (SQLCipher)
    ↓
migrations
    ↓
config state (API key)
    ↓
draft state
    ↓
ready
```

**Critical Path:**
- **passphrase → database:** Cannot open encrypted DB without passphrase
- **database → migrations:** Cannot use DB until migrations run
- **database → API key:** API key stored in keychain (separate from DB)

**No Blocking Dependencies:**
- Logging does NOT depend on database (if using config.json)
- Config state does NOT depend on database (API key in keychain)

---

## Testing Strategy

### Test 1: Verify Log Level from Config File Used on Startup

```rust
#[test]
fn test_log_level_from_config_used() {
    // Create temp config.json with DEBUG level
    let config = Config { log_level: "DEBUG" };
    write_config_json(&config);

    // Initialize logging
    init_logging_from_config(&config);

    // Emit DEBUG log
    tracing::debug!("test message");

    // Verify DEBUG log appears (capture stderr)
    // Assert log contains "test message"
}
```

### Test 2: Verify Config File Created if Missing

```rust
#[test]
fn test_config_file_created_with_defaults() {
    // Delete config.json if exists
    remove_config_if_exists();

    // Initialize logging (should create config with defaults)
    init_logging_with_defaults();

    // Verify config.json exists
    assert!(config_json_exists());

    // Verify default log_level = "INFO"
    let config = read_config_json();
    assert_eq!(config.log_level, "INFO");
}
```

### Test 3: Verify Early Errors Logged Before Database Open

```rust
#[test]
fn test_early_errors_logged() {
    // Initialize logging
    init_logging_from_config(&default_config());

    // Simulate error before database open
    tracing::error!("Database open failed: disk full");

    // Verify error appears in logs (capture stderr)
    // This validates Phase 1 logging works
}
```

---

## Rollout Plan

### Epic 2 Story 2-1 or 2-2 (Passphrase Entry / Pre-Migration Backup)

**When:** Early in Epic 2, before Story 2-3 (migration)

**Changes:**
1. Create `config::Config` struct and JSON read/write functions
2. Update `logs::init_logging()` to accept log level parameter (already done)
3. Modify `lib.rs setup()` to:
   - Read config.json for log_level (or create with defaults)
   - Pass log level to `init_logging()`
   - Remove hardcoded "INFO"
4. Update `set_log_level` command to write to BOTH config.json and database
5. Add migration: read log_level from database settings, write to config.json (one-time)

**Testing:**
- Verify log level from config.json is used
- Verify settings UI updates config.json
- Verify app restarts use correct log level

**Risk:** LOW - Config file approach is simple and well-tested pattern

---

## Success Criteria

- [ ] Log level setting from user is actually used on app startup
- [ ] Early errors (before DB open) are logged and visible
- [ ] Startup time remains <2 seconds (NFR-1)
- [ ] Log level changes take effect on next restart
- [ ] No circular dependency between logging and database
- [ ] Integration test validates complete flow
- [ ] Epic 1 Story 1-16 deferred task marked complete

---

## References

- **Story 1-16:** Logging Infrastructure (deferred task)
- **Epic 1 Retrospective:** Initialization order identified as critical issue
- **Architecture.md:** AR-19 (logging requirements), NFR-1 (startup time)
- **Epic 2 Stories:** 2-1 (Passphrase), 2-3 (Migration), 2-6 (Keychain)

---

**Status:** ✅ Design Complete
**Next Step:** Implement in Epic 2 Story 2-1 or 2-2
**Owner:** Senior Dev (Charlie)
**Estimated Implementation:** 2-3 hours