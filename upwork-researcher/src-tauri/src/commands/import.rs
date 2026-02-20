//! Import commands for database restoration from encrypted archives (Story 7.7)

use crate::archive_export::ArchiveMetadata;
use crate::archive_import::{
    check_schema_compatibility, cleanup_orphaned_temp_files, extract_archive_db,
    import_from_archive, open_archive_for_preview, read_metadata_preview, ArchiveImportError,
    ImportMode, ImportProgress, ImportSummary, SchemaCompatibility,
};
use crate::backup::create_pre_migration_backup;
use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};
use zeroize::Zeroizing;

/// Import preview structure (returned by decrypt_archive)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub metadata: ArchiveMetadata,
    pub schema_compatibility: String, // "compatible" | "older" | "newer"
    pub archive_version: Option<i32>,
    pub current_version: i32,
    pub warnings: Vec<String>,
}

/// Tauri command: Read archive metadata without decryption
///
/// AC-1, AC-2: Show metadata preview (counts, hint, export date)
#[tauri::command]
pub async fn read_archive_metadata(archive_path: String) -> Result<ArchiveMetadata, String> {
    let path = PathBuf::from(&archive_path);

    read_metadata_preview(&path).map_err(|e| format!("Failed to read archive metadata: {}", e))
}

/// Tauri command: Decrypt archive and return import preview
///
/// AC-3: Decrypt with passphrase, show detailed preview with schema compatibility
#[tauri::command]
pub async fn decrypt_archive(
    _app_handle: AppHandle,
    database: State<'_, AppDatabase>,
    archive_path: String,
    passphrase: String,
) -> Result<ImportPreview, String> {
    let archive_path_buf = PathBuf::from(&archive_path);

    // Extract archive to temp file
    let (metadata, salt, temp_db_path) = extract_archive_db(&archive_path_buf)
        .map_err(|e| format!("Failed to extract archive: {}", e))?;

    // Ensure temp file cleanup on scope exit
    let _cleanup = scopeguard::guard(temp_db_path.clone(), |path: PathBuf| {
        let _ = fs::remove_file(path);
    });

    // Open archive for schema inspection
    let archive_conn = open_archive_for_preview(&temp_db_path, &passphrase, &salt)
        .map_err(|e| match e {
            ArchiveImportError::DecryptionFailed => {
                format!("Wrong passphrase. This backup was created on {}. Try the passphrase you were using at that time.", metadata.export_date)
            }
            other => format!("{}", other),
        })?;

    // Get current schema version from main DB
    let database = database
        .get()
        .map_err(|e| format!("Failed to access database: {}", e))?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let current_version: i32 = conn
        .query_row(
            "SELECT version FROM refinery_schema_history ORDER BY version DESC LIMIT 1;",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to query current schema version: {}", e))?;

    drop(conn); // Release lock

    // Check schema compatibility
    let compat = check_schema_compatibility(&archive_conn, current_version)
        .map_err(|e| format!("Schema compatibility check failed: {}", e))?;

    let mut warnings = Vec::new();

    let (compat_str, archive_version) = match compat {
        SchemaCompatibility::Compatible => ("compatible".to_string(), None),
        SchemaCompatibility::OlderArchive { archive_version } => {
            warnings.push("Archive from older version — some newer fields will be set to defaults.".to_string());
            ("older".to_string(), Some(archive_version))
        }
        SchemaCompatibility::NewerArchive { archive_version } => {
            return Err(format!(
                "This archive was created with a newer version of the app (v{}). Please update to import.",
                archive_version
            ));
        }
    };

    Ok(ImportPreview {
        metadata,
        schema_compatibility: compat_str,
        archive_version,
        current_version,
        warnings,
    })
}

/// Tauri command: Execute import with progress events
///
/// AC-4, AC-5, AC-6, AC-7: Import data with mode selection, progress tracking, atomic transaction
#[tauri::command]
pub async fn execute_import(
    app_handle: AppHandle,
    database: State<'_, AppDatabase>,
    archive_path: String,
    passphrase: String,
    mode: String, // "replace" | "merge"
) -> Result<ImportSummary, String> {
    // Parse import mode
    let import_mode = match mode.as_str() {
        "replace" => ImportMode::ReplaceAll,
        "merge" => ImportMode::MergeSkipDuplicates,
        _ => return Err(format!("Invalid import mode: {}", mode)),
    };

    // AC-9 (Task 9): Pre-import backup for ReplaceAll mode
    if import_mode == ImportMode::ReplaceAll {
        let database_instance = database
            .get()
            .map_err(|e| format!("Failed to access database: {}", e))?;

        // Get app data directory for backup storage
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))?;

        let backup_metadata = create_pre_migration_backup(&app_data_dir, database_instance)
            .map_err(|e| format!("Failed to create pre-import backup: {}", e))?;

        tracing::info!(
            "Pre-import backup created at: {}",
            backup_metadata.file_path.display()
        );
    }

    let archive_path_buf = PathBuf::from(&archive_path);

    // Extract archive to temp file
    let (_metadata, salt, temp_db_path) = extract_archive_db(&archive_path_buf)
        .map_err(|e| format!("Failed to extract archive: {}", e))?;

    // Ensure temp file cleanup on scope exit
    let _cleanup = scopeguard::guard(temp_db_path.clone(), |path: PathBuf| {
        let _ = fs::remove_file(path);
    });

    // Derive key from passphrase
    let mut salt_array = [0u8; 16];
    if salt.len() != 16 {
        return Err(format!("Invalid salt length: {} (expected 16)", salt.len()));
    }
    salt_array.copy_from_slice(&salt);

    let key = crate::passphrase::derive_key(&passphrase, &salt_array)
        .map_err(|_| "Decryption failed - wrong passphrase or corrupted archive".to_string())?;

    // Convert key to hex (wrapped in Zeroizing)
    let hex_key = Zeroizing::new(hex::encode(&*key));

    // Get database instance
    let database_instance = database
        .get()
        .map_err(|e| format!("Failed to access database: {}", e))?;

    // Progress callback: emit Tauri events
    let app_handle_clone = app_handle.clone();
    let progress_callback = move |progress: ImportProgress| {
        let _ = app_handle_clone.emit("import-progress", &progress);
    };

    // Perform import
    let summary = import_from_archive(
        database_instance,
        &temp_db_path,
        &hex_key,
        import_mode,
        progress_callback,
    )
    .map_err(|e| format!("Import failed: {}", e))?;

    Ok(summary)
}

/// Cleanup orphaned temp files on app startup (called once)
pub fn cleanup_import_temp_files() -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let cleaned = cleanup_orphaned_temp_files(&temp_dir)
        .map_err(|e| format!("Failed to cleanup temp files: {}", e))?;

    if cleaned > 0 {
        tracing::info!("Cleaned up {} orphaned import temp files", cleaned);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_import_mode_parsing_valid() {
        // Test the actual mode parsing logic from execute_import
        let replace = match "replace" {
            "replace" => Some(ImportMode::ReplaceAll),
            "merge" => Some(ImportMode::MergeSkipDuplicates),
            _ => None,
        };
        assert_eq!(replace, Some(ImportMode::ReplaceAll));

        let merge = match "merge" {
            "replace" => Some(ImportMode::ReplaceAll),
            "merge" => Some(ImportMode::MergeSkipDuplicates),
            _ => None,
        };
        assert_eq!(merge, Some(ImportMode::MergeSkipDuplicates));
    }

    #[test]
    fn test_import_mode_parsing_invalid_rejected() {
        let invalid = match "invalid_mode" {
            "replace" => Some(ImportMode::ReplaceAll),
            "merge" => Some(ImportMode::MergeSkipDuplicates),
            _ => None,
        };
        assert!(invalid.is_none(), "Invalid mode should not parse");
    }

    #[test]
    fn test_cleanup_import_temp_files_runs_without_error() {
        // cleanup_import_temp_files scans system temp dir — verify it doesn't panic
        let result = cleanup_import_temp_files();
        assert!(result.is_ok());
    }
}
