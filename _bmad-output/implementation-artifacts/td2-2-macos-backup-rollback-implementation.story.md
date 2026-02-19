# Story TD2.2: macOS Backup/Rollback Implementation

Status: done

## Story

As a macOS user,
I want the app to back up the current `.app` bundle before updating and restore it if health checks fail,
So that a bad update never bricks my workflow tool on macOS (parity with the existing Windows implementation).

## Acceptance Criteria

**AC-1:** Given the app is running on macOS and an update is about to be applied,
When `create_pre_update_backup()` is called,
Then the entire `.app` bundle is compressed into a `.tar.gz` tarball at `version_backups/v{version}-macos.app.tar.gz`
And backup metadata (from_version, platform, backup_path, timestamp) is stored in the settings database
And the function returns `Ok(VersionBackupMetadata)`.

**AC-2:** Given a macOS `.app` tarball backup exists in `version_backups/`,
When `rollback_to_previous_version()` is called on macOS,
Then the tarball is extracted over the existing install directory (replacing the `.app` bundle)
And file permissions are preserved during extraction
And the app restarts using `app_handle.restart()`.

**AC-3:** Given the helper functions `create_app_bundle_tarball()` and `extract_app_bundle_tarball()` are implemented,
When unit tests run a backup → extract roundtrip,
Then the extracted directory tree matches the original directory tree byte-for-byte
And the functions work on any platform in tests (they are pure I/O, not macOS-specific).

**AC-4:** Given the backup path resolution logic navigates from `current_exe()` up 3 levels to the `.app` bundle,
When tested with a mock path `/Applications/MyApp.app/Contents/MacOS/my-app`,
Then the resolved bundle path is `/Applications/MyApp.app/`
And the install directory is `/Applications/`.

**AC-5:** Given a `tar` crate dependency is added to `Cargo.toml`,
When the crate compiles with `cargo build --lib`,
Then the build succeeds with zero new errors.

## Tasks / Subtasks

- [x] Task 1: Add `tar` crate dependency (AC: #5)
  - [x] 1.1 Add `tar = "0.4"` to `[dependencies]` in `upwork-researcher/src-tauri/Cargo.toml` (after the existing `flate2` entry for readability)
  - [x] 1.2 Run `cargo build --lib` to verify the dependency resolves and compiles — fix any version conflicts if found

- [x] Task 2: Implement macOS tarball helper functions (AC: #3)
  - [x] 2.1 Add `create_app_bundle_tarball(app_bundle: &Path, tarball_path: &Path) -> std::io::Result<()>` as a private fn in `health_check.rs`:
    - Open `tarball_path` for writing (create file)
    - Wrap in `BufWriter` → `flate2::write::GzEncoder::new(writer, flate2::Compression::default())` → `tar::Builder::new(gz_encoder)`
    - Extract bundle name via `app_bundle.file_name()` (e.g., `"upwork-research-agent.app"`)
    - Call `tar_builder.append_dir_all(bundle_name, app_bundle)?` to recursively add all files with their relative path rooted at `bundle_name`
    - Call `tar_builder.finish()?` to flush and close
  - [x] 2.2 Add `extract_app_bundle_tarball(tarball_path: &Path, dest_dir: &Path) -> std::io::Result<()>` as a private fn in `health_check.rs`:
    - Open `tarball_path` for reading
    - Wrap in `BufReader` → `flate2::read::GzDecoder::new(reader)` → `tar::Archive::new(gz_decoder)`
    - Set `archive.set_preserve_permissions(true)`
    - Call `archive.unpack(dest_dir)?` to extract into `dest_dir`
  - [x] 2.3 Add required imports at top of `health_check.rs`: `use std::io::{BufWriter, BufReader};` and `use std::path::Path;` (already have `use std::path::PathBuf`)

- [x] Task 3: Replace macOS backup stub with real implementation (AC: #1)
  - [x] 3.1 In `create_pre_update_backup()` at line ~482 (current macOS stub), replace the stub with:
    ```rust
    #[cfg(target_os = "macos")]
    {
        let exe_path = std::env::current_exe()
            .map_err(|e| BackupError::AppPathNotFound(e.to_string()))?;

        // Navigate: exe → MacOS/ → Contents/ → AppName.app/
        let app_bundle = exe_path
            .parent()                   // MacOS/
            .and_then(|p| p.parent())   // Contents/
            .and_then(|p| p.parent())   // AppName.app/
            .ok_or_else(|| BackupError::AppPathNotFound(
                "Cannot resolve .app bundle path from executable".to_string()
            ))?;

        let backup_filename = format!("v{}-macos.app.tar.gz", current_version);
        let backup_path = backup_dir.join(&backup_filename);

        create_app_bundle_tarball(app_bundle, &backup_path)
            .map_err(|e| BackupError::CopyFailed(format!("Tarball creation failed: {}", e)))?;

        let metadata = VersionBackupMetadata {
            from_version: current_version,
            platform: "macos".to_string(),
            backup_path,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        // Store metadata in settings
        let db = app_handle.state::<crate::db::Database>().inner();
        let conn = db.conn.lock().map_err(|e| BackupError::SettingsFailed(e.to_string()))?;

        let metadata_json = serde_json::to_string(&metadata)
            .map_err(|e| BackupError::SettingsFailed(e.to_string()))?;

        crate::db::queries::settings::set_setting(&conn, "pre_update_backup", &metadata_json)
            .map_err(|e| BackupError::SettingsFailed(e.to_string()))?;

        Ok(metadata)
    }
    ```
  - [x] 3.2 Remove the `#[allow(unused_variables)]` or similar lint suppression that may have been added to the platform variable (check for `let platform = std::env::consts::OS;` — this is still valid and unchanged)

- [x] Task 4: Replace macOS rollback stub with real implementation (AC: #2)
  - [x] 4.1 In `rollback_to_previous_version()` at line ~590 (current macOS stub), replace the stub with:
    ```rust
    #[cfg(target_os = "macos")]
    {
        let exe_path = std::env::current_exe()
            .map_err(|e| RollbackError::ExePathNotFound(e.to_string()))?;

        // Navigate to .app bundle: exe → MacOS/ → Contents/ → AppName.app/
        let app_bundle = exe_path
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .ok_or_else(|| RollbackError::FileOpFailed(
                "Cannot resolve .app bundle path from executable".to_string()
            ))?;

        // Install dir is the parent of AppName.app (e.g., /Applications/)
        let install_dir = app_bundle
            .parent()
            .ok_or_else(|| RollbackError::FileOpFailed(
                "Cannot resolve install directory from bundle path".to_string()
            ))?;

        extract_app_bundle_tarball(&backup_meta.backup_path, install_dir)
            .map_err(|e| RollbackError::FileOpFailed(format!("Tarball extraction failed: {}", e)))?;
    }
    ```
  - [x] 4.2 Verify the rollback logic below the `#[cfg]` block is still correct: `add_to_failed_versions_list`, `mark_rollback_occurred`, logging, and `app_handle.restart()` are platform-agnostic and should remain unchanged after the cfg block

- [x] Task 5: Write unit tests for helper functions (AC: #3, #4)
  - [x] 5.1 Add tests to the `#[cfg(test)]` block in `health_check.rs`:
    - **`test_create_and_extract_tarball_roundtrip`**: Create a temp dir with 3 mock files (nested structure), call `create_app_bundle_tarball(src, tarball_path)`, then call `extract_app_bundle_tarball(tarball_path, dest_dir)`, verify all files exist in dest with same content
    - **`test_create_tarball_preserves_directory_structure`**: Verify nested subdirectories are correctly preserved in the tarball (e.g., `app.app/Contents/MacOS/binary`)
    - **`test_extract_tarball_fails_gracefully_on_missing_file`**: Call `extract_app_bundle_tarball` with a non-existent tarball path, verify `Err` is returned (not panic)
    - **`test_create_tarball_fails_gracefully_on_missing_src`**: Call `create_app_bundle_tarball` with a non-existent source dir, verify `Err` is returned
    - **`test_macos_backup_path_resolution`**: Test the 3-level navigation logic with a mock path using `Path::new("/fake/App.app/Contents/MacOS/binary")`, verify `.parent().parent().parent()` gives `"/fake/App.app"` (pure path arithmetic, no I/O)
  - [x] 5.2 Tests use `tempfile::tempdir()` from the existing `[dev-dependencies]` (already present)
  - [x] 5.3 Tests are NOT `#[cfg(target_os = "macos")]` — the helper functions work on any platform, so tests should run cross-platform. The `#[cfg]` guards are only on the caller functions in `create_pre_update_backup` and `rollback_to_previous_version`

- [x] Task 6: Verify build and register wiring (AC: #5)
  - [x] 6.1 Run `cargo build --lib` to confirm zero errors (warnings acceptable)
  - [x] 6.2 **WIRING CHECK:** Verify `create_pre_update_backup_command` and `rollback_to_previous_version_command` are already registered in `lib.rs` invoke_handler (they were registered in Story 9.9 — just verify they're still there, do NOT add duplicates)
  - [x] 6.3 **DO NOT IMPLEMENT** any of these out-of-scope items: App.tsx wiring (TD2-3), success toast (TD2-3), HealthCheckModal tests (TD2-3)

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] GzEncoder not explicitly finished in `create_app_bundle_tarball` — added `ar.into_inner()?.finish()?` after `ar.finish()?` to flush gzip trailer with error propagation
- [x] [AI-Review][MEDIUM] Redundant `current_exe()` syscall in macOS rollback block — replaced with reuse of existing `current_exe` variable
- [x] [AI-Review][MEDIUM] Non-TD2-2 Cargo.toml deps (hmac, sha2 from Story 10.1) in same dirty tree — File List updated with note
- [x] [AI-Review][LOW] Inconsistent return style — macOS block now uses implicit `Ok(metadata)` matching Windows block
- [x] [AI-Review][LOW] Partial tarball left on disk on failure — wrapped creation in closure with `remove_file` cleanup on error

## Dev Notes

### What This Story Is — And Is Not

**In scope (TD2-2):**
- Replace the two macOS stubs in `health_check.rs` with real tarball backup/restore
- Add the `tar` crate dependency
- Write unit tests for the helper functions

**Explicitly NOT in scope (belongs to TD2-3):**
- App.tsx health check integration wiring (Task 7.4 from Story 9-9)
- Success toast "Updated to v{version} successfully" (Task 6.2)
- React tests for HealthCheckModal and RollbackDialog (Tasks 7.6, 7.7)
- Windows DLL test environment fix

Do not implement anything from TD2-3 in this story. The Sonnet agent consistently over-implements adjacent tasks — resist the urge.

### Architecture Compliance

- **AR-2 (SQLCipher):** Backup does NOT touch the database — it backs up the binary/bundle only. Database is preserved as-is through rollback. This is intentional (AC-4 in 9.9: "database is not modified during rollback")
- **NFR-13 (Safe Updates):** This story completes the macOS side of the safe update guarantee established in Story 9.9
- **Windows-parity pattern:** The Windows implementation (already working) is the reference model. The macOS implementation follows the same metadata storage pattern but uses tarball instead of .exe copy

### Critical Technical Details

**macOS `.app` Bundle Path Resolution:**
```
/Applications/MyApp.app/Contents/MacOS/upwork-research-agent  ← current_exe()
                              ↑  └── .parent()  = MacOS/
                         ↑ └── .parent().parent()  = Contents/
              ↑ └── .parent().parent().parent()  = MyApp.app/  ← app_bundle
↑ └── app_bundle.parent()  = /Applications/  ← install_dir for extraction
```

**Tarball Structure Created:**
```
v0.1.1-macos.app.tar.gz
└── upwork-research-agent.app/       ← bundle name as tarball root
    └── Contents/
        ├── Info.plist
        ├── MacOS/
        │   └── upwork-research-agent
        ├── Resources/
        │   └── ...
        └── Frameworks/
            └── ...
```

**`tar` + `flate2` Integration Pattern (used together):**
```rust
// Creating (write path):
use flate2::write::GzEncoder;
use flate2::Compression;
use tar::Builder;
use std::io::BufWriter;

let file = std::fs::File::create(&tarball_path)?;
let gz = GzEncoder::new(BufWriter::new(file), Compression::default());
let mut ar = Builder::new(gz);
ar.append_dir_all("MyApp.app", &app_bundle_path)?;
ar.finish()?;

// Extracting (read path):
use flate2::read::GzDecoder;
use tar::Archive;
use std::io::BufReader;

let file = std::fs::File::open(&tarball_path)?;
let gz = GzDecoder::new(BufReader::new(file));
let mut ar = Archive::new(gz);
ar.set_preserve_permissions(true);
ar.unpack(&install_dir)?;
```

**Why `append_dir_all` vs `append_dir`:**
- `append_dir_all(name, path)` recursively walks the directory. Use this.
- `append_dir(name, path)` only adds the directory entry (not contents). Do NOT use.

**Important: The Windows cfg block must NOT have `return` after it:**
The current `create_pre_update_backup` function ends with the Windows block returning `Ok(metadata)`. The macOS block must also `return Ok(metadata)` or `Ok(metadata)` at the end of its block. The `#[cfg(not(any(...)))]` block (unsupported platform) returns `Err(...)`. Make sure all 3 platform branches are exhaustive — compiler should not see a path that falls through without returning.

**Current stub locations in `health_check.rs`:**

For `create_pre_update_backup()` (line ~482):
```rust
#[cfg(target_os = "macos")]
{
    // macOS: backup .app bundle
    // NOTE: Requires tarball creation logic
    // Placeholder for now
    return Err(BackupError::AppPathNotFound(
        "macOS backup not yet implemented".to_string(),
    ));
}
```

For `rollback_to_previous_version()` (line ~590):
```rust
#[cfg(target_os = "macos")]
{
    // macOS: Extract tarball over existing bundle
    // Requires tarball extraction logic
    return Err(RollbackError::FileOpFailed(
        "macOS rollback not yet implemented".to_string(),
    ));
}
```

### Previous Story Intelligence (TD2-1)

TD2-1 created the command registration verification script at `upwork-researcher/scripts/verify-command-registration.mjs`. This does not affect this story directly, but confirms the pre-commit hook and CI pipeline now enforce command registration. When you add any `#[tauri::command]` functions (this story adds none — the commands already exist), verify registration.

**Existing commands already registered (do NOT add again):**
- `health_check::create_pre_update_backup_command` — registered in lib.rs
- `health_check::rollback_to_previous_version_command` — registered in lib.rs
- All other health_check commands — already registered

### Git Intelligence Summary

Recent commit pattern: `fix(story-id): description` or `feat(story-id): description`. Use `feat(td2-2): implement macOS backup/rollback tarball logic` for this story.

### Existing Code Context

**Files to modify (ONLY these two):**
- `upwork-researcher/src-tauri/Cargo.toml` — add `tar = "0.4"` dependency
- `upwork-researcher/src-tauri/src/health_check.rs` — replace stubs, add helper fns, add tests

**Files to NOT touch:**
- `lib.rs` — commands already registered; touching risks breaking TD2-1's baseline
- Any `.tsx` files — those are TD2-3 scope
- Any migration files — no schema changes needed

**`cleanup_old_backups()` compatibility:** The existing cleanup function filters `is_file()` and sorts by mtime. macOS `.tar.gz` backups are files, so cleanup handles them correctly. Windows `.exe` backups also work. No changes needed to cleanup.

**`flate2` import note:** `flate2` is already in `Cargo.toml` (added for Story 6.7 compressed revisions). The `use flate2::...` imports needed here are:
- `use flate2::write::GzEncoder;`
- `use flate2::Compression;`
- `use flate2::read::GzDecoder;`

Check if any of these are already imported in the file before adding new `use` statements.

### Testing Strategy

**Approach:** Pure unit tests on the helper functions, cross-platform. No macOS-specific test infrastructure needed.

```rust
#[cfg(test)]
mod tests {
    // ... existing tests ...

    #[test]
    fn test_create_and_extract_tarball_roundtrip() {
        use tempfile::tempdir;
        use std::fs;

        // Create source directory with some files
        let src_dir = tempdir().unwrap();
        let bundle_name = "TestApp.app";
        let bundle_dir = src_dir.path().join(bundle_name);
        fs::create_dir_all(bundle_dir.join("Contents/MacOS")).unwrap();
        fs::write(bundle_dir.join("Contents/Info.plist"), b"<plist/>").unwrap();
        fs::write(bundle_dir.join("Contents/MacOS/binary"), b"fake binary").unwrap();

        // Create tarball
        let tar_dir = tempdir().unwrap();
        let tarball_path = tar_dir.path().join("backup.tar.gz");
        create_app_bundle_tarball(&bundle_dir, &tarball_path).unwrap();
        assert!(tarball_path.exists());

        // Extract tarball
        let dest_dir = tempdir().unwrap();
        extract_app_bundle_tarball(&tarball_path, dest_dir.path()).unwrap();

        // Verify structure
        let extracted_plist = dest_dir.path().join("TestApp.app/Contents/Info.plist");
        assert!(extracted_plist.exists());
        assert_eq!(fs::read(&extracted_plist).unwrap(), b"<plist/>");

        let extracted_binary = dest_dir.path().join("TestApp.app/Contents/MacOS/binary");
        assert!(extracted_binary.exists());
        assert_eq!(fs::read(&extracted_binary).unwrap(), b"fake binary");
    }

    #[test]
    fn test_macos_backup_path_resolution() {
        use std::path::Path;
        // Simulate: /fake/App.app/Contents/MacOS/binary
        let fake_exe = Path::new("/fake/App.app/Contents/MacOS/binary");
        let app_bundle = fake_exe
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent());
        assert_eq!(app_bundle, Some(Path::new("/fake/App.app")));

        let install_dir = app_bundle.unwrap().parent();
        assert_eq!(install_dir, Some(Path::new("/fake")));
    }
}
```

**Windows DLL issue:** All tests compile but may not execute due to `STATUS_ENTRYPOINT_NOT_FOUND` on Windows. This is a known pre-existing environment issue. Compile verification (`cargo build --lib`) is the primary quality signal.

### References

- [Source: upwork-researcher/src-tauri/src/health_check.rs:442-498] — `create_pre_update_backup()` with macOS stub at line ~482
- [Source: upwork-researcher/src-tauri/src/health_check.rs:544-617] — `rollback_to_previous_version()` with macOS stub at line ~590
- [Source: _bmad-output/implementation-artifacts/9-9-post-update-health-check-rollback.story.md#Completion Notes] — Documents what was deferred: "macOS: stub (needs tarball logic)"
- [Source: _bmad-output/implementation-artifacts/epic-10-retro-2026-02-18.md#Outstanding from Previous Epics] — "macOS backup/rollback stubs (no tarball impl) — HIGH"
- [Source: upwork-researcher/src-tauri/Cargo.toml:59] — `flate2 = "1.0"` already present
- [Source: tar crate docs] — `tar::Builder::append_dir_all()`, `tar::Archive::unpack()`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

None — implementation was straightforward with no blocking issues.

### Completion Notes List

- **Task 1:** Added `tar = "0.4"` to `Cargo.toml` after existing `flate2 = "1.0"` entry. `cargo build --lib` confirmed clean resolution (exit 0).
- **Task 2:** Added `create_app_bundle_tarball()` and `extract_app_bundle_tarball()` as private fns in `health_check.rs`. Added `use std::io::{BufReader, BufWriter};` and changed `use std::path::PathBuf` to `use std::path::{Path, PathBuf}`. Helper fns use `flate2::write::GzEncoder` / `flate2::read::GzDecoder` with `tar::Builder` / `tar::Archive` per story spec. `set_preserve_permissions(true)` applied on extraction.
- **Task 3:** Replaced macOS stub in `create_pre_update_backup()` with 3-level path navigation, tarball creation via `create_app_bundle_tarball()`, metadata construction, and settings DB write. Uses `return Ok(metadata)` explicitly for correctness with the exhaustive cfg pattern.
- **Task 4:** Replaced macOS stub in `rollback_to_previous_version()` with 3-level path navigation, install_dir resolution, and tarball extraction via `extract_app_bundle_tarball()`. Platform-agnostic post-rollback logic (add_to_failed_versions_list, mark_rollback_occurred, log, restart) unchanged.
- **Task 5:** Added 5 cross-platform unit tests: `test_create_and_extract_tarball_roundtrip`, `test_create_tarball_preserves_directory_structure`, `test_extract_tarball_fails_gracefully_on_missing_file`, `test_create_tarball_fails_gracefully_on_missing_src`, `test_macos_backup_path_resolution`. All are NOT `#[cfg(target_os = "macos")]` per story spec. Tests use `tempfile::tempdir()` from existing dev-dependencies.
- **Task 6:** `cargo build --lib` passed (exit 0, 0 errors, warnings pre-existing). Wiring verified: `create_pre_update_backup_command` and `rollback_to_previous_version_command` confirmed registered at lib.rs:3069-3070. No new commands added.
- **Dead code warnings:** `create_app_bundle_tarball` and `extract_app_bundle_tarball` emit dead_code warnings on Windows (current build platform) because the `#[cfg(target_os = "macos")]` callers don't compile on Windows. This is expected and correct — same as the existing Windows-only code pattern. Not errors.
- **Windows DLL test execution issue:** `cargo test --lib` compiled successfully but tests could not execute due to pre-existing `STATUS_ENTRYPOINT_NOT_FOUND`. `cargo build --lib` (exit 0) is the primary quality signal per story Dev Notes.

### File List

- `upwork-researcher/src-tauri/Cargo.toml` — added `tar = "0.4"` dependency (note: `hmac = "0.12"` and `sha2 = "0.10"` from Story 10.1 also present in same dirty tree — not TD2-2 scope)
- `upwork-researcher/src-tauri/Cargo.lock` — updated by cargo
- `upwork-researcher/src-tauri/src/health_check.rs` — added imports, helper fns, replaced macOS stubs, added 5 unit tests
