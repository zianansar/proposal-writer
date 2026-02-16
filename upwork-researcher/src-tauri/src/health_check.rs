//! Health check module for post-update verification.
//!
//! Provides version tracking, health checks, and rollback capabilities
//! to ensure app stability after updates.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
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

/// Detect if an update has occurred by comparing current vs installed version.
/// Returns true if current version is newer than installed version.
pub fn detect_update(conn: &Connection) -> Result<bool, String> {
    let current = get_current_version();
    let installed = get_installed_version(conn)?;

    match installed {
        None => {
            // First launch - no version recorded yet
            Ok(false)
        }
        Some(installed_ver) => {
            // Compare versions
            Ok(current != installed_ver)
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

    conn.execute("SELECT 1", [])
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

use std::path::PathBuf;

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
            backup_path: backup_path.clone(),
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
        // macOS: backup .app bundle
        // NOTE: Requires tarball creation logic
        // Placeholder for now
        return Err(BackupError::AppPathNotFound(
            "macOS backup not yet implemented".to_string(),
        ));
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
/// 5. Restart app with old binary
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
        // macOS: Extract tarball over existing bundle
        // Requires tarball extraction logic
        return Err(RollbackError::FileOpFailed(
            "macOS rollback not yet implemented".to_string(),
        ));
    }

    // 4. Add failed version to skip list (Task 5)
    let current_version = get_current_version();
    add_to_failed_versions_list(&conn, &current_version)
        .map_err(|e| RollbackError::SettingsFailed(e))?;

    // 5. Log rollback for diagnostics
    tracing::error!(
        "Rolled back from v{} to v{}",
        current_version,
        backup_meta.from_version
    );

    // 6. Restart app (using tauri API)
    // NOTE: This will terminate current process
    app_handle.restart();

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
pub async fn cleanup_old_backups_command(
    app_handle: AppHandle,
) -> Result<usize, String> {
    cleanup_old_backups(&app_handle)
        .await
        .map_err(|e| e.to_string())
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
}
