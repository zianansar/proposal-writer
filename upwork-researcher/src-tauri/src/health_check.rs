//! Health check module for post-update verification.
//!
//! Provides version tracking, health checks, and rollback capabilities
//! to ensure app stability after updates.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

// ═══════════════════════════════════════════════════════════
// Version Detection & Tracking
// ═══════════════════════════════════════════════════════════

/// Get the current app version from Cargo.toml (compile-time constant).
pub fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get the installed version from settings database.
/// Returns None if no version is recorded (first launch).
pub fn get_installed_version(conn: &Connection) -> Result<Option<String>, String> {
    crate::db::queries::settings::get_setting(conn, "installed_version")
        .map_err(|e| format!("Failed to get installed version: {}", e))
}

/// Compare two semver version strings (major.minor.patch).
/// Returns true if `current` is strictly greater than `installed`.
/// Used by Story 9.9 (health checks) and Story 10.2 (remote config version comparison).
pub fn is_version_newer(current: &str, installed: &str) -> bool {
    let parse = |v: &str| -> (u32, u32, u32) {
        let parts: Vec<u32> = v.split('.').filter_map(|p| p.parse().ok()).collect();
        (
            parts.first().copied().unwrap_or(0),
            parts.get(1).copied().unwrap_or(0),
            parts.get(2).copied().unwrap_or(0),
        )
    };
    parse(current) > parse(installed)
}

/// Detect if an update has occurred by comparing current vs installed version.
/// Returns true if current version is strictly newer than installed version (Task 1.4).
pub fn detect_update(conn: &Connection) -> Result<bool, String> {
    let current = get_current_version();
    let installed = get_installed_version(conn)?;

    match installed {
        None => {
            // First launch - no version recorded yet
            Ok(false)
        }
        Some(installed_ver) => {
            // Task 1.4: Only detect update if current > installed (not just !=)
            Ok(is_version_newer(&current, &installed_ver))
        }
    }
}

/// Record the current version as installed in the settings database.
pub fn set_installed_version(conn: &Connection) -> Result<(), String> {
    let current = get_current_version();
    crate::db::queries::settings::set_setting(conn, "installed_version", &current)
        .map_err(|e| format!("Failed to set installed version: {}", e))
}

/// Mark that an update was detected, storing the previous version.
pub fn mark_update_detected(conn: &Connection, previous_version: &str) -> Result<(), String> {
    crate::db::queries::settings::set_setting(conn, "update_detected", "true")
        .map_err(|e| format!("Failed to set update_detected: {}", e))?;

    crate::db::queries::settings::set_setting(conn, "previous_version", previous_version)
        .map_err(|e| format!("Failed to set previous_version: {}", e))?;

    // Store timestamp of update detection
    let timestamp = chrono::Utc::now().to_rfc3339();
    crate::db::queries::settings::set_setting(conn, "last_update_timestamp", &timestamp)
        .map_err(|e| format!("Failed to set last_update_timestamp: {}", e))?;

    Ok(())
}

/// Clear the update_detected flag after successful health check.
pub fn clear_update_detected(conn: &Connection) -> Result<(), String> {
    crate::db::queries::settings::set_setting(conn, "update_detected", "false")
        .map_err(|e| format!("Failed to clear update_detected: {}", e))
}

// ═══════════════════════════════════════════════════════════
// Health Check Framework
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckFailure {
    pub check: String,
    pub error: String,
    pub critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckReport {
    pub passed: bool,
    pub checks_run: usize,
    pub failures: Vec<HealthCheckFailure>,
    pub duration_ms: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum HealthCheckError {
    #[error("Database unreachable: {0}")]
    DatabaseUnreachable(String),

    #[error("Database corrupted: {0}")]
    DatabaseCorrupted(String),

    #[error("Schema version mismatch: {0}")]
    SchemaMismatch(String),

    #[error("Settings not loadable: {0}")]
    SettingsError(String),

    #[error("Integrity check failed: {0}")]
    IntegrityCheckFailed(String),

    #[error("Health check timeout")]
    Timeout,
}

/// Check database connectivity (< 1s timeout).
pub async fn check_database_connection(
    app_handle: &AppHandle,
) -> Result<(), HealthCheckError> {
    // Get database from app state
    let db = app_handle
        .state::<crate::db::Database>()
        .inner();

    // Try to execute a simple query
    let conn = db
        .conn
        .lock()
        .map_err(|e| HealthCheckError::DatabaseUnreachable(e.to_string()))?;

    conn.execute_batch("SELECT 1")
        .map_err(|e| HealthCheckError::DatabaseUnreachable(e.to_string()))?;

    Ok(())
}

/// Check database integrity using SQLCipher PRAGMA (< 2s timeout).
pub async fn check_database_integrity(
    app_handle: &AppHandle,
) -> Result<(), HealthCheckError> {
    let db = app_handle
        .state::<crate::db::Database>()
        .inner();

    let conn = db
        .conn
        .lock()
        .map_err(|e| HealthCheckError::DatabaseUnreachable(e.to_string()))?;

    // SQLCipher-specific integrity check
    let result: String = conn
        .query_row("PRAGMA cipher_integrity_check", [], |row| row.get(0))
        .map_err(|e| HealthCheckError::IntegrityCheckFailed(e.to_string()))?;

    if result != "ok" {
        return Err(HealthCheckError::DatabaseCorrupted(result));
    }

    Ok(())
}

/// Check schema version matches expected (< 1s timeout).
pub async fn check_schema_version(app_handle: &AppHandle) -> Result<(), HealthCheckError> {
    let db = app_handle
        .state::<crate::db::Database>()
        .inner();

    let conn = db
        .conn
        .lock()
        .map_err(|e| HealthCheckError::DatabaseUnreachable(e.to_string()))?;

    // Check that refinery_schema_history table exists
    let table_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='refinery_schema_history')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| HealthCheckError::SchemaMismatch(format!("Failed to check schema table: {}", e)))?;

    if !table_exists {
        return Err(HealthCheckError::SchemaMismatch(
            "refinery_schema_history table not found".to_string(),
        ));
    }

    // Check that we have at least one migration applied
    let migration_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM refinery_schema_history",
            [],
            |row| row.get(0),
        )
        .map_err(|e| HealthCheckError::SchemaMismatch(format!("Failed to count migrations: {}", e)))?;

    if migration_count == 0 {
        return Err(HealthCheckError::SchemaMismatch(
            "No migrations applied".to_string(),
        ));
    }

    Ok(())
}

/// Check settings are loadable (< 1s timeout).
pub async fn check_settings_loadable(app_handle: &AppHandle) -> Result<(), HealthCheckError> {
    let db = app_handle
        .state::<crate::db::Database>()
        .inner();

    let conn = db
        .conn
        .lock()
        .map_err(|e| HealthCheckError::DatabaseUnreachable(e.to_string()))?;

    // Try to load all settings
    crate::db::queries::settings::list_settings(&conn)
        .map_err(|e| HealthCheckError::SettingsError(e.to_string()))?;

    Ok(())
}

/// Run all health checks with timeouts.
/// Total timeout: 5 seconds (1s + 2s + 1s + 1s).
pub async fn run_health_checks(app_handle: &AppHandle) -> Result<HealthCheckReport, HealthCheckError> {
    let start = Instant::now();
    let mut failures = Vec::new();

    // Check 1: Database connectivity (< 1s)
    match tokio::time::timeout(
        Duration::from_secs(1),
        check_database_connection(app_handle),
    )
    .await
    {
        Err(_) => {
            // Timeout occurred
            failures.push(HealthCheckFailure {
                check: "database_connection".to_string(),
                error: "Timeout after 1s".to_string(),
                critical: true,
            });
            return Err(HealthCheckError::Timeout);
        }
        Ok(Err(e)) => {
            // Check failed
            failures.push(HealthCheckFailure {
                check: "database_connection".to_string(),
                error: e.to_string(),
                critical: true,
            });
            return Err(e);
        }
        Ok(Ok(())) => {
            // Check passed
        }
    }

    // Check 2: Database integrity (< 2s)
    match tokio::time::timeout(
        Duration::from_secs(2),
        check_database_integrity(app_handle),
    )
    .await
    {
        Err(_) => {
            failures.push(HealthCheckFailure {
                check: "database_integrity".to_string(),
                error: "Timeout after 2s".to_string(),
                critical: true,
            });
            return Err(HealthCheckError::Timeout);
        }
        Ok(Err(e)) => {
            failures.push(HealthCheckFailure {
                check: "database_integrity".to_string(),
                error: e.to_string(),
                critical: true,
            });
            return Err(e);
        }
        Ok(Ok(())) => {
            // Check passed
        }
    }

    // Check 3: Schema version (< 1s)
    match tokio::time::timeout(
        Duration::from_secs(1),
        check_schema_version(app_handle),
    )
    .await
    {
        Err(_) => {
            failures.push(HealthCheckFailure {
                check: "schema_version".to_string(),
                error: "Timeout after 1s".to_string(),
                critical: true,
            });
            return Err(HealthCheckError::Timeout);
        }
        Ok(Err(e)) => {
            failures.push(HealthCheckFailure {
                check: "schema_version".to_string(),
                error: e.to_string(),
                critical: true,
            });
            return Err(e);
        }
        Ok(Ok(())) => {
            // Check passed
        }
    }

    // Check 4: Settings loadable (< 1s, non-critical)
    match tokio::time::timeout(
        Duration::from_secs(1),
        check_settings_loadable(app_handle),
    )
    .await
    {
        Err(_) => {
            failures.push(HealthCheckFailure {
                check: "settings".to_string(),
                error: "Timeout after 1s".to_string(),
                critical: false,
            });
        }
        Ok(Err(e)) => {
            failures.push(HealthCheckFailure {
                check: "settings".to_string(),
                error: e.to_string(),
                critical: false,
            });
        }
        Ok(Ok(())) => {
            // Check passed
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(HealthCheckReport {
        passed: failures.iter().all(|f| !f.critical),
        checks_run: 4,
        failures,
        duration_ms,
    })
}

// ═══════════════════════════════════════════════════════════
// Pre-Update Backup & Rollback (Tasks 3-4)
// ═══════════════════════════════════════════════════════════

/// Metadata for a version backup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionBackupMetadata {
    pub from_version: String,
    pub platform: String,
    pub backup_path: PathBuf,
    pub timestamp: String,
}

#[derive(Debug, thiserror::Error)]
pub enum BackupError {
    #[error("App path not found: {0}")]
    AppPathNotFound(String),

    #[error("Backup directory creation failed: {0}")]
    BackupDirFailed(String),

    #[error("Binary copy failed: {0}")]
    CopyFailed(String),

    #[error("Settings update failed: {0}")]
    SettingsFailed(String),
}

#[derive(Debug, thiserror::Error)]
pub enum RollbackError {
    #[error("No backup found")]
    NoBackupFound,

    #[error("Backup file missing at path: {0}")]
    BackupMissing(PathBuf),

    #[error("Exe path not found: {0}")]
    ExePathNotFound(String),

    #[error("File operation failed: {0}")]
    FileOpFailed(String),

    #[error("Settings operation failed: {0}")]
    SettingsFailed(String),
}

/// Get the version_backups directory path.
/// Creates the directory if it doesn't exist.
pub fn get_backup_dir(app_handle: &AppHandle) -> Result<PathBuf, BackupError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| BackupError::AppPathNotFound(e.to_string()))?;

    let backup_dir = app_data_dir.join("version_backups");

    if !backup_dir.exists() {
        std::fs::create_dir_all(&backup_dir)
            .map_err(|e| BackupError::BackupDirFailed(e.to_string()))?;
    }

    Ok(backup_dir)
}

// ═══════════════════════════════════════════════════════════
// macOS Tarball Helpers (TD2-2)
// ═══════════════════════════════════════════════════════════

/// Compress an `.app` bundle directory into a `.tar.gz` tarball at `tarball_path`.
/// The tarball root entry is named after the bundle's directory name (e.g., `"MyApp.app"`).
/// Works on any platform — the `#[cfg(target_os = "macos")]` guard is on the callers only.
fn create_app_bundle_tarball(app_bundle: &Path, tarball_path: &Path) -> std::io::Result<()> {
    let bundle_name = app_bundle
        .file_name()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "app_bundle has no file name"))?;

    let result = (|| {
        let file = std::fs::File::create(tarball_path)?;
        let gz = flate2::write::GzEncoder::new(BufWriter::new(file), flate2::Compression::default());
        let mut ar = tar::Builder::new(gz);
        ar.append_dir_all(bundle_name, app_bundle)?;
        ar.finish()?;
        // Explicitly finish the GzEncoder to flush the gzip trailer (CRC32 + size).
        // Without this, the trailer is only written in Drop which silently swallows I/O errors.
        ar.into_inner()?.finish()?;
        Ok(())
    })();

    if result.is_err() {
        // Clean up partial tarball so a corrupt file isn't left on disk
        let _ = std::fs::remove_file(tarball_path);
    }

    result
}

/// Extract a `.tar.gz` tarball created by `create_app_bundle_tarball` into `dest_dir`.
/// Preserves file permissions during extraction.
/// Works on any platform — the `#[cfg(target_os = "macos")]` guard is on the callers only.
fn extract_app_bundle_tarball(tarball_path: &Path, dest_dir: &Path) -> std::io::Result<()> {
    let file = std::fs::File::open(tarball_path)?;
    let gz = flate2::read::GzDecoder::new(BufReader::new(file));
    let mut ar = tar::Archive::new(gz);
    ar.set_preserve_permissions(true);
    ar.unpack(dest_dir)?;
    Ok(())
}

/// Create a pre-update backup of the current app binary/bundle.
/// Task 3: Pre-update backup (AC-4, AC-6)
///
/// This should be called before applying an update to preserve
/// the current working version for potential rollback.
///
/// Platform-specific behavior:
/// - macOS: Backs up entire .app bundle as tarball
/// - Windows: Backs up .exe only
///
/// NOTE: Full implementation requires integration with Tauri updater plugin
/// and cross-platform testing. This is a stub for structure.
pub async fn create_pre_update_backup(
    app_handle: &AppHandle,
) -> Result<VersionBackupMetadata, BackupError> {
    let current_version = get_current_version();
    let platform = std::env::consts::OS;

    let backup_dir = get_backup_dir(app_handle)?;

    #[cfg(target_os = "windows")]
    {
        // Windows: backup .exe
        let exe_path = std::env::current_exe()
            .map_err(|e| BackupError::AppPathNotFound(e.to_string()))?;

        let backup_filename = format!("v{}-windows.exe", current_version);
        let backup_path = backup_dir.join(&backup_filename);

        std::fs::copy(&exe_path, &backup_path)
            .map_err(|e| BackupError::CopyFailed(e.to_string()))?;

        let metadata = VersionBackupMetadata {
            from_version: current_version,
            platform: "windows".to_string(),
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

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err(BackupError::AppPathNotFound(
            format!("Unsupported platform: {}", platform),
        ))
    }
}

/// Cleanup old backups, retaining only the most recent one (AC-6).
pub async fn cleanup_old_backups(app_handle: &AppHandle) -> Result<usize, BackupError> {
    let backup_dir = get_backup_dir(app_handle)?;

    let mut backups: Vec<_> = std::fs::read_dir(&backup_dir)
        .map_err(|e| BackupError::BackupDirFailed(e.to_string()))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.file_type().map(|ft| ft.is_file()).unwrap_or(false)
        })
        .collect();

    // Sort by modification time (newest first)
    backups.sort_by(|a, b| {
        let a_time = a.metadata().and_then(|m| m.modified()).ok();
        let b_time = b.metadata().and_then(|m| m.modified()).ok();
        b_time.cmp(&a_time)
    });

    // Keep only the most recent, delete the rest
    let to_delete = backups.iter().skip(1);
    let mut deleted_count = 0;

    for backup in to_delete {
        if std::fs::remove_file(backup.path()).is_ok() {
            deleted_count += 1;
        }
    }

    Ok(deleted_count)
}

/// Rollback to the previous version by restoring the backup binary.
/// Task 4: Rollback mechanism (AC-3, AC-4)
///
/// Process:
/// 1. Load backup metadata from settings
/// 2. Verify backup file exists
/// 3. Replace current binary with backup
/// 4. Add failed version to skip list
/// 5. Return — caller (frontend) handles restart via user confirmation
///
/// NOTE: This requires elevated permissions and process management.
/// Full implementation needs integration testing with actual update scenarios.
pub async fn rollback_to_previous_version(
    app_handle: &AppHandle,
) -> Result<(), RollbackError> {
    // 1. Read backup metadata from settings
    let db = app_handle.state::<crate::db::Database>().inner();
    let conn = db.conn.lock()
        .map_err(|e| RollbackError::SettingsFailed(e.to_string()))?;

    let metadata_json = crate::db::queries::settings::get_setting(&conn, "pre_update_backup")
        .map_err(|e| RollbackError::SettingsFailed(e.to_string()))?
        .ok_or(RollbackError::NoBackupFound)?;

    let backup_meta: VersionBackupMetadata = serde_json::from_str(&metadata_json)
        .map_err(|e| RollbackError::SettingsFailed(e.to_string()))?;

    // 2. Verify backup exists
    if !backup_meta.backup_path.exists() {
        return Err(RollbackError::BackupMissing(backup_meta.backup_path.clone()));
    }

    // 3. Get current executable path
    let current_exe = std::env::current_exe()
        .map_err(|e| RollbackError::ExePathNotFound(e.to_string()))?;

    #[cfg(target_os = "windows")]
    {
        // Windows: Atomic replace (rename old, copy backup, delete old)
        let temp_path = current_exe.with_extension("exe.old");

        std::fs::rename(&current_exe, &temp_path)
            .map_err(|e| RollbackError::FileOpFailed(format!("Rename failed: {}", e)))?;

        std::fs::copy(&backup_meta.backup_path, &current_exe)
            .map_err(|e| {
                // Try to restore original on failure
                let _ = std::fs::rename(&temp_path, &current_exe);
                RollbackError::FileOpFailed(format!("Copy failed: {}", e))
            })?;

        // Delete old version (non-critical if it fails)
        let _ = std::fs::remove_file(&temp_path);
    }

    #[cfg(target_os = "macos")]
    {
        // Navigate to .app bundle: exe → MacOS/ → Contents/ → AppName.app/
        let app_bundle = current_exe
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

    // 4. Add failed version to skip list (Task 5)
    let current_version = get_current_version();
    add_to_failed_versions_list(&conn, &current_version)
        .map_err(|e| RollbackError::SettingsFailed(e))?;

    // 4b. Mark rollback for frontend toast on next launch (Task 5.5)
    mark_rollback_occurred(&conn, &current_version)
        .map_err(|e| RollbackError::SettingsFailed(e))?;

    // 5. Log rollback for diagnostics
    tracing::error!(
        "Rolled back from v{} to v{}",
        current_version,
        backup_meta.from_version
    );

    // 6. Return success — frontend handles restart via RollbackDialog button
    // (CR R1 H-1: removed app_handle.restart() which killed the process before
    // React could render the RollbackDialog, making the "Restart App" button unreachable)
    Ok(())
}

/// Add a version to the failed updates skip list (Task 5).
fn add_to_failed_versions_list(conn: &Connection, version: &str) -> Result<(), String> {
    // Get existing skip list
    let skip_list_json = crate::db::queries::settings::get_setting(conn, "failed_update_versions")
        .map_err(|e| format!("Failed to read skip list: {}", e))?
        .unwrap_or_else(|| "[]".to_string());

    let mut skip_list: Vec<String> = serde_json::from_str(&skip_list_json)
        .map_err(|e| format!("Failed to parse skip list: {}", e))?;

    // Add version if not already present
    if !skip_list.contains(&version.to_string()) {
        skip_list.push(version.to_string());
    }

    // Save updated skip list
    let updated_json = serde_json::to_string(&skip_list)
        .map_err(|e| format!("Failed to serialize skip list: {}", e))?;

    crate::db::queries::settings::set_setting(conn, "failed_update_versions", &updated_json)
        .map_err(|e| format!("Failed to save skip list: {}", e))?;

    Ok(())
}

/// Get the list of failed update versions to skip (Task 5).
pub fn get_failed_update_versions(conn: &Connection) -> Result<Vec<String>, String> {
    let skip_list_json = crate::db::queries::settings::get_setting(conn, "failed_update_versions")
        .map_err(|e| format!("Failed to read skip list: {}", e))?
        .unwrap_or_else(|| "[]".to_string());

    serde_json::from_str(&skip_list_json)
        .map_err(|e| format!("Failed to parse skip list: {}", e))
}

/// Clear the failed update versions skip list (for settings UI).
pub fn clear_failed_update_versions(conn: &Connection) -> Result<(), String> {
    crate::db::queries::settings::set_setting(conn, "failed_update_versions", "[]")
        .map_err(|e| format!("Failed to clear skip list: {}", e))
}

/// Mark that a rollback occurred so the frontend can show a toast on next launch (Task 5.5).
fn mark_rollback_occurred(conn: &Connection, failed_version: &str) -> Result<(), String> {
    crate::db::queries::settings::set_setting(conn, "last_rollback_version", failed_version)
        .map_err(|e| format!("Failed to mark rollback: {}", e))
}

/// Check if a rollback occurred on a previous launch.
/// Returns the failed version string if rollback happened, then clears the flag.
pub fn check_and_clear_rollback(conn: &Connection) -> Result<Option<String>, String> {
    let version = crate::db::queries::settings::get_setting(conn, "last_rollback_version")
        .map_err(|e| format!("Failed to check rollback flag: {}", e))?;

    if let Some(ref v) = version {
        if !v.is_empty() {
            // Clear the flag so toast only shows once
            crate::db::queries::settings::set_setting(conn, "last_rollback_version", "")
                .map_err(|e| format!("Failed to clear rollback flag: {}", e))?;
        }
    }

    // Return None for empty string (cleared flag)
    Ok(version.filter(|v| !v.is_empty()))
}

// ═══════════════════════════════════════════════════════════
// Tauri Commands
// ═══════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_installed_version_command(
    app_handle: AppHandle,
) -> Result<Option<String>, String> {
    let db = app_handle
        .state::<crate::db::Database>()
        .inner();

    let conn = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    get_installed_version(&conn)
}

#[tauri::command]
pub async fn detect_update_command(app_handle: AppHandle) -> Result<bool, String> {
    let db = app_handle
        .state::<crate::db::Database>()
        .inner();

    let conn = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    detect_update(&conn)
}

#[tauri::command]
pub async fn run_health_checks_command(
    app_handle: AppHandle,
) -> Result<HealthCheckReport, String> {
    run_health_checks(&app_handle)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_pre_update_backup_command(
    app_handle: AppHandle,
) -> Result<VersionBackupMetadata, String> {
    create_pre_update_backup(&app_handle)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rollback_to_previous_version_command(
    app_handle: AppHandle,
) -> Result<(), String> {
    rollback_to_previous_version(&app_handle)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_failed_update_versions_command(
    app_handle: AppHandle,
) -> Result<Vec<String>, String> {
    let db = app_handle.state::<crate::db::Database>().inner();
    let conn = db.conn.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    get_failed_update_versions(&conn)
}

#[tauri::command]
pub async fn clear_failed_update_versions_command(
    app_handle: AppHandle,
) -> Result<(), String> {
    let db = app_handle.state::<crate::db::Database>().inner();
    let conn = db.conn.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    clear_failed_update_versions(&conn)
}

#[tauri::command]
pub async fn check_and_clear_rollback_command(
    app_handle: AppHandle,
) -> Result<Option<String>, String> {
    let db = app_handle.state::<crate::db::Database>().inner();
    let conn = db.conn.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    check_and_clear_rollback(&conn)
}

#[tauri::command]
pub async fn cleanup_old_backups_command(
    app_handle: AppHandle,
) -> Result<usize, String> {
    cleanup_old_backups(&app_handle)
        .await
        .map_err(|e| e.to_string())
}

/// Record the current app version as installed (Story TD2.3 Task 1).
/// Called by frontend after successful health checks to advance the baseline version.
#[tauri::command]
pub async fn set_installed_version_command(app_handle: AppHandle) -> Result<(), String> {
    let db = app_handle.state::<crate::db::Database>().inner();
    let conn = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;
    set_installed_version(&conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    fn create_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        Database::new(db_path, None).unwrap()
    }

    #[test]
    fn test_get_current_version_returns_cargo_version() {
        let version = get_current_version();
        // Should match CARGO_PKG_VERSION at compile time
        assert!(!version.is_empty());
        assert!(version.contains('.'));
    }

    #[test]
    fn test_get_installed_version_none_on_first_launch() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let installed = get_installed_version(&conn).unwrap();
        assert_eq!(installed, None);
    }

    #[test]
    fn test_set_and_get_installed_version() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Set version
        set_installed_version(&conn).unwrap();

        // Get version
        let installed = get_installed_version(&conn).unwrap();
        assert_eq!(installed, Some(get_current_version()));
    }

    #[test]
    fn test_detect_update_false_on_first_launch() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let updated = detect_update(&conn).unwrap();
        assert_eq!(updated, false);
    }

    #[test]
    fn test_detect_update_false_when_versions_match() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Set current version
        set_installed_version(&conn).unwrap();

        // Should not detect update
        let updated = detect_update(&conn).unwrap();
        assert_eq!(updated, false);
    }

    #[test]
    fn test_detect_update_true_when_versions_differ() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Set old version
        crate::db::queries::settings::set_setting(&conn, "installed_version", "0.1.0").unwrap();

        // Should detect update (current version != 0.1.0)
        let updated = detect_update(&conn).unwrap();
        assert_eq!(updated, true);
    }

    #[test]
    fn test_mark_update_detected_stores_metadata() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        mark_update_detected(&conn, "0.1.0").unwrap();

        // Verify all fields set
        let update_detected = crate::db::queries::settings::get_setting(&conn, "update_detected")
            .unwrap()
            .unwrap();
        assert_eq!(update_detected, "true");

        let previous = crate::db::queries::settings::get_setting(&conn, "previous_version")
            .unwrap()
            .unwrap();
        assert_eq!(previous, "0.1.0");

        let timestamp = crate::db::queries::settings::get_setting(&conn, "last_update_timestamp")
            .unwrap();
        assert!(timestamp.is_some());
    }

    #[test]
    fn test_clear_update_detected() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Set flag
        mark_update_detected(&conn, "0.1.0").unwrap();

        // Clear flag
        clear_update_detected(&conn).unwrap();

        let update_detected = crate::db::queries::settings::get_setting(&conn, "update_detected")
            .unwrap()
            .unwrap();
        assert_eq!(update_detected, "false");
    }

    // ═══════════════════════════════════════════════════════════
    // Semver comparison tests (9.5)
    // ═══════════════════════════════════════════════════════════

    #[test]
    fn test_is_version_newer_major_bump() {
        assert!(is_version_newer("2.0.0", "1.0.0"));
    }

    #[test]
    fn test_is_version_newer_minor_bump() {
        assert!(is_version_newer("1.2.0", "1.1.0"));
    }

    #[test]
    fn test_is_version_newer_patch_bump() {
        assert!(is_version_newer("1.0.2", "1.0.1"));
    }

    #[test]
    fn test_is_version_newer_same_version() {
        assert!(!is_version_newer("1.0.0", "1.0.0"));
    }

    #[test]
    fn test_is_version_newer_downgrade_returns_false() {
        assert!(!is_version_newer("1.0.0", "2.0.0"));
    }

    #[test]
    fn test_is_version_newer_complex_comparison() {
        assert!(is_version_newer("1.10.0", "1.9.0"));
        assert!(is_version_newer("2.0.0", "1.99.99"));
    }

    #[test]
    fn test_detect_update_false_on_downgrade() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Set a version higher than current
        crate::db::queries::settings::set_setting(&conn, "installed_version", "99.99.99").unwrap();

        // Should NOT detect update (current < installed)
        let updated = detect_update(&conn).unwrap();
        assert!(!updated);
    }

    // ═══════════════════════════════════════════════════════════
    // Skip list tests (9.2)
    // ═══════════════════════════════════════════════════════════

    #[test]
    fn test_get_failed_update_versions_empty_default() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let versions = get_failed_update_versions(&conn).unwrap();
        assert!(versions.is_empty());
    }

    #[test]
    fn test_add_to_failed_versions_list_single() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        add_to_failed_versions_list(&conn, "1.2.0").unwrap();

        let versions = get_failed_update_versions(&conn).unwrap();
        assert_eq!(versions, vec!["1.2.0"]);
    }

    #[test]
    fn test_add_to_failed_versions_list_dedup() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        add_to_failed_versions_list(&conn, "1.2.0").unwrap();
        add_to_failed_versions_list(&conn, "1.2.0").unwrap();

        let versions = get_failed_update_versions(&conn).unwrap();
        assert_eq!(versions, vec!["1.2.0"]);
    }

    #[test]
    fn test_add_to_failed_versions_list_multiple() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        add_to_failed_versions_list(&conn, "1.2.0").unwrap();
        add_to_failed_versions_list(&conn, "1.3.0").unwrap();

        let versions = get_failed_update_versions(&conn).unwrap();
        assert_eq!(versions, vec!["1.2.0", "1.3.0"]);
    }

    #[test]
    fn test_clear_failed_update_versions() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        add_to_failed_versions_list(&conn, "1.2.0").unwrap();
        add_to_failed_versions_list(&conn, "1.3.0").unwrap();

        clear_failed_update_versions(&conn).unwrap();

        let versions = get_failed_update_versions(&conn).unwrap();
        assert!(versions.is_empty());
    }

    // ═══════════════════════════════════════════════════════════
    // Rollback flag tests (9.4)
    // ═══════════════════════════════════════════════════════════

    #[test]
    fn test_check_and_clear_rollback_none_by_default() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let result = check_and_clear_rollback(&conn).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn test_mark_and_check_rollback() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        mark_rollback_occurred(&conn, "1.5.0").unwrap();

        let result = check_and_clear_rollback(&conn).unwrap();
        assert_eq!(result, Some("1.5.0".to_string()));
    }

    #[test]
    fn test_check_and_clear_rollback_clears_flag() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        mark_rollback_occurred(&conn, "1.5.0").unwrap();

        // First check returns version
        let first = check_and_clear_rollback(&conn).unwrap();
        assert_eq!(first, Some("1.5.0".to_string()));

        // Second check returns None (flag cleared)
        let second = check_and_clear_rollback(&conn).unwrap();
        assert_eq!(second, None);
    }

    // ═══════════════════════════════════════════════════════════
    // macOS tarball helper tests (TD2-2, AC-3, AC-4)
    // These tests are NOT #[cfg(target_os = "macos")] — the helpers
    // are pure I/O and work cross-platform.
    // ═══════════════════════════════════════════════════════════

    #[test]
    fn test_create_and_extract_tarball_roundtrip() {
        use std::fs;

        // Create source directory with nested structure
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

        // Verify structure preserved
        let extracted_plist = dest_dir.path().join("TestApp.app/Contents/Info.plist");
        assert!(extracted_plist.exists(), "Info.plist should be extracted");
        assert_eq!(fs::read(&extracted_plist).unwrap(), b"<plist/>");

        let extracted_binary = dest_dir.path().join("TestApp.app/Contents/MacOS/binary");
        assert!(extracted_binary.exists(), "binary should be extracted");
        assert_eq!(fs::read(&extracted_binary).unwrap(), b"fake binary");
    }

    #[test]
    fn test_create_tarball_preserves_directory_structure() {
        use std::fs;

        let src_dir = tempdir().unwrap();
        let bundle_dir = src_dir.path().join("MyApp.app");
        // Nested: MyApp.app/Contents/MacOS/binary and MyApp.app/Contents/Resources/icon.png
        fs::create_dir_all(bundle_dir.join("Contents/MacOS")).unwrap();
        fs::create_dir_all(bundle_dir.join("Contents/Resources")).unwrap();
        fs::write(bundle_dir.join("Contents/MacOS/binary"), b"exe").unwrap();
        fs::write(bundle_dir.join("Contents/Resources/icon.png"), b"png").unwrap();

        let tar_dir = tempdir().unwrap();
        let tarball_path = tar_dir.path().join("test.tar.gz");
        create_app_bundle_tarball(&bundle_dir, &tarball_path).unwrap();

        let dest_dir = tempdir().unwrap();
        extract_app_bundle_tarball(&tarball_path, dest_dir.path()).unwrap();

        assert!(dest_dir.path().join("MyApp.app/Contents/MacOS/binary").exists());
        assert!(dest_dir.path().join("MyApp.app/Contents/Resources/icon.png").exists());
    }

    #[test]
    fn test_extract_tarball_fails_gracefully_on_missing_file() {
        use std::path::Path;
        let dest_dir = tempdir().unwrap();
        let result = extract_app_bundle_tarball(
            Path::new("/nonexistent/path/backup.tar.gz"),
            dest_dir.path(),
        );
        assert!(result.is_err(), "Should return Err for missing tarball");
    }

    #[test]
    fn test_create_tarball_fails_gracefully_on_missing_src() {
        use std::path::Path;
        let tar_dir = tempdir().unwrap();
        let tarball_path = tar_dir.path().join("out.tar.gz");
        let result = create_app_bundle_tarball(
            Path::new("/nonexistent/App.app"),
            &tarball_path,
        );
        assert!(result.is_err(), "Should return Err for missing source directory");
    }

    #[test]
    fn test_macos_backup_path_resolution() {
        use std::path::Path;
        // Simulate: /fake/App.app/Contents/MacOS/binary
        let fake_exe = Path::new("/fake/App.app/Contents/MacOS/binary");
        let app_bundle = fake_exe
            .parent()               // MacOS/
            .and_then(|p| p.parent()) // Contents/
            .and_then(|p| p.parent()); // App.app/
        assert_eq!(app_bundle, Some(Path::new("/fake/App.app")));

        // Install dir is parent of App.app
        let install_dir = app_bundle.unwrap().parent();
        assert_eq!(install_dir, Some(Path::new("/fake")));
    }
}
