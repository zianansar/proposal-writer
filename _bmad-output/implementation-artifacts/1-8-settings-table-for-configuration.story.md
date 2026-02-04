---
status: done
assignedTo: "dev-agent"
tasksCompleted: 4
totalTasks: 4
testsWritten: true
fileList:
  - upwork-researcher/src-tauri/src/db/migrations/V2__create_settings_table.sql
  - upwork-researcher/src-tauri/src/db/queries/settings.rs
  - upwork-researcher/src-tauri/src/db/queries/mod.rs
  - upwork-researcher/src-tauri/src/db/mod.rs
---

# Story 1.8: Settings Table for Configuration

## Story

As a developer,
I want a settings table to store app configuration,
So that user preferences persist across sessions.

## Acceptance Criteria

**AC-1:** Given the database exists, When the settings table migration runs, Then a `settings` table is created with columns: key (TEXT PRIMARY KEY), value (TEXT), updated_at (TIMESTAMP).

**AC-2:** Given the settings table exists, Then default settings are seeded (e.g., theme: "dark", api_provider: "anthropic").

## Technical Notes

### Architecture Requirements

From epics-stories.md:
- Key-value store pattern
- Migration includes seed data for defaults (AR-18)

### Table Schema

```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Default Settings

| Key | Default Value | Description |
|:----|:--------------|:------------|
| theme | dark | UI theme preference |
| api_provider | anthropic | AI provider |

### File Structure

```
upwork-researcher/
├── src-tauri/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   └── V2__create_settings_table.sql  # NEW
│   │   │   ├── queries/
│   │   │   │   ├── mod.rs                         # Export settings
│   │   │   │   └── settings.rs                    # NEW: CRUD operations
```

## Tasks/Subtasks

- [x] Task 1: Create settings table migration (AC: 1)
  - [x] Subtask 1.1: Create V2__create_settings_table.sql
  - [x] Subtask 1.2: Add columns: key, value, updated_at
  - [x] Subtask 1.3: Add trigger for updated_at auto-update

- [x] Task 2: Seed default settings (AC: 2)
  - [x] Subtask 2.1: Insert default theme setting
  - [x] Subtask 2.2: Insert default api_provider setting

- [x] Task 3: Create settings query module (AC: 1, 2)
  - [x] Subtask 3.1: Create settings.rs with get/set functions
  - [x] Subtask 3.2: Add to queries/mod.rs exports

- [x] Task 4: Write tests (AC: all)
  - [x] Subtask 4.1: Test migration creates table
  - [x] Subtask 4.2: Test default settings seeded
  - [x] Subtask 4.3: Test get/set operations

## Dev Notes

### NFR Targets

| NFR | Target | Validation Method |
|:----|:-------|:------------------|
| AR-18 | Default settings seeded | Query after migration |

### Scope Boundaries

**In scope:**
- Settings table schema
- Default seed data
- Basic CRUD operations

**Out of scope:**
- Settings UI (Story 1-9)
- Tauri commands for settings (Story 1-9)

## References

- [Source: epics-stories.md#Story 1.8: Settings Table for Configuration]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log
- Created V2__create_settings_table.sql migration
- Added settings table with key (PK), value, updated_at columns
- Added trigger to auto-update updated_at on changes
- Added index on updated_at for sorting
- Seeded default settings: theme=dark, api_provider=anthropic
- Created settings.rs with get_setting, set_setting, delete_setting, list_settings
- Added 8 unit tests for settings module
- Added 3 database-level tests for settings table schema and seed data

### Completion Notes
- 35 Rust tests passing (11 new tests)
- 106 frontend tests passing (unchanged)
- Migration V2 runs after V1 (proposals table)
- Key-value store pattern with UPSERT support
- Default settings available immediately after database creation

### Implementation Summary
**Database:**
- `V2__create_settings_table.sql`: Settings table with trigger and default data
- Schema: key (TEXT PK), value (TEXT), updated_at (TEXT with auto-update)
- Defaults: theme=dark, api_provider=anthropic

**Query Module:**
- `settings.rs`: CRUD operations for settings
- Functions: get_setting, set_setting, delete_setting, list_settings
- Uses UPSERT pattern for atomic insert-or-update

## File List
- `upwork-researcher/src-tauri/src/db/migrations/V2__create_settings_table.sql` — NEW: Settings schema + seed
- `upwork-researcher/src-tauri/src/db/queries/settings.rs` — NEW: Settings CRUD
- `upwork-researcher/src-tauri/src/db/queries/mod.rs` — Export settings module
- `upwork-researcher/src-tauri/src/db/mod.rs` — Added settings table tests

## Change Log
- 2026-02-04: Story created
- 2026-02-04: Implementation complete — Settings table with defaults, 35 Rust tests
