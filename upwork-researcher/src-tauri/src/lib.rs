pub mod claude;
pub mod config;
pub mod db;
pub mod events;

// Encryption spike module (Story 1.6)
// Validates Argon2id key derivation and keyring integration for Epic 2
// SQLCipher validation deferred to Epic 2 (requires crate-wide feature migration)
#[cfg(test)]
pub mod encryption_spike;

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

/// Shared state for tracking current draft proposal during generation
pub struct DraftState {
    pub current_draft_id: Arc<Mutex<Option<i64>>>,
}

/// Non-streaming proposal generation (kept for backwards compatibility/testing)
#[tauri::command]
async fn generate_proposal(
    job_content: String,
    config_state: State<'_, config::ConfigState>,
) -> Result<String, String> {
    let api_key = config_state.get_api_key()?;
    claude::generate_proposal_with_key(&job_content, api_key.as_deref()).await
}

/// Streaming proposal generation - emits tokens via Tauri events
/// Auto-saves draft every 50ms during generation (Story 1.14)
#[tauri::command]
async fn generate_proposal_streaming(
    job_content: String,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::Database>,
    draft_state: State<'_, DraftState>,
) -> Result<String, String> {
    let api_key = config_state.get_api_key()?;
    claude::generate_proposal_streaming_with_key(
        &job_content,
        app_handle,
        api_key.as_deref(),
        &database,
        &draft_state,
    )
    .await
}

/// Database health check - returns database path and status
#[tauri::command]
fn check_database(database: State<db::Database>) -> Result<serde_json::Value, String> {
    let is_healthy = database.health_check()?;
    let path = database.get_path().to_string_lossy().to_string();

    Ok(serde_json::json!({
        "healthy": is_healthy,
        "path": path
    }))
}

/// Save a generated proposal to the database
/// Returns the ID of the saved proposal
#[tauri::command]
fn save_proposal(
    database: State<db::Database>,
    job_content: String,
    generated_text: String,
) -> Result<serde_json::Value, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let id = db::queries::proposals::insert_proposal(&conn, &job_content, &generated_text, None)
        .map_err(|e| format!("Failed to save proposal: {}", e))?;

    Ok(serde_json::json!({
        "id": id,
        "saved": true
    }))
}

/// Get list of past proposals (summaries only, for performance)
/// Returns proposals ordered by created_at DESC, limited to 100
#[tauri::command]
fn get_proposals(
    database: State<db::Database>,
) -> Result<Vec<db::queries::proposals::ProposalSummary>, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::proposals::list_proposals(&conn)
        .map_err(|e| format!("Failed to get proposals: {}", e))
}

/// Check for draft proposal from previous session (Story 1.14)
/// Returns the latest draft if exists, None otherwise
#[tauri::command]
fn check_for_draft(
    database: State<db::Database>,
) -> Result<Option<db::queries::proposals::SavedProposal>, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::proposals::get_latest_draft(&conn)
        .map_err(|e| format!("Failed to check for draft: {}", e))
}

/// Update proposal status (Story 1.14)
/// Used to mark drafts as completed or discard them
#[tauri::command]
fn update_proposal_status(
    database: State<db::Database>,
    proposal_id: i64,
    status: String,
) -> Result<serde_json::Value, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::proposals::update_proposal_status(&conn, proposal_id, &status)
        .map_err(|e| format!("Failed to update proposal status: {}", e))?;

    Ok(serde_json::json!({
        "success": true
    }))
}

/// Save a job post for later (Story 1.13: API Error Handling)
/// Used when API errors occur and user wants to save job to process later
#[tauri::command]
fn save_job_post(
    database: State<db::Database>,
    job_content: String,
    url: Option<String>,
) -> Result<serde_json::Value, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let id = db::queries::job_posts::insert_job_post(
        &conn,
        url.as_deref(),
        &job_content,
        None, // client_name will be extracted in Epic 4a
    )
    .map_err(|e| format!("Failed to save job post: {}", e))?;

    Ok(serde_json::json!({
        "id": id,
        "saved": true
    }))
}

/// Check if API key is configured
#[tauri::command]
fn has_api_key(config_state: State<config::ConfigState>) -> Result<bool, String> {
    config_state.has_api_key()
}

/// Set the API key (with format validation)
#[tauri::command]
fn set_api_key(config_state: State<config::ConfigState>, api_key: String) -> Result<(), String> {
    // Validate format first
    config::validate_api_key_format(&api_key)?;

    // Save to config
    config_state.set_api_key(api_key.trim().to_string())
}

/// Get masked API key for display (shows sk-ant-...XXXX)
#[tauri::command]
fn get_api_key_masked(config_state: State<config::ConfigState>) -> Result<Option<String>, String> {
    let api_key = config_state.get_api_key()?;
    Ok(api_key.map(|k| config::mask_api_key(&k)))
}

/// Validate API key format without saving
#[tauri::command]
fn validate_api_key(api_key: String) -> Result<(), String> {
    config::validate_api_key_format(&api_key)
}

/// Clear the API key
#[tauri::command]
fn clear_api_key(config_state: State<config::ConfigState>) -> Result<(), String> {
    config_state.clear_api_key()
}

// ============================================================================
// Settings Commands (Story 1.9)
// ============================================================================

/// Get a setting value by key
/// Returns None if the setting doesn't exist
#[tauri::command]
fn get_setting(database: State<db::Database>, key: String) -> Result<Option<String>, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::settings::get_setting(&conn, &key)
        .map_err(|e| format!("Failed to get setting: {}", e))
}

/// Set a setting value (insert or update)
/// Uses UPSERT pattern for atomic operation
#[tauri::command]
fn set_setting(database: State<db::Database>, key: String, value: String) -> Result<(), String> {
    // Validate key
    let key = key.trim();
    if key.is_empty() {
        return Err("Setting key cannot be empty".to_string());
    }
    if key.len() > 255 {
        return Err("Setting key too long (max 255 characters)".to_string());
    }

    // Validate value length
    if value.len() > 10000 {
        return Err("Setting value too long (max 10000 characters)".to_string());
    }

    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::settings::set_setting(&conn, key, &value)
        .map_err(|e| format!("Failed to set setting: {}", e))
}

/// Get all settings as a list
/// Returns all settings ordered by key
#[tauri::command]
fn get_all_settings(
    database: State<db::Database>,
) -> Result<Vec<db::queries::settings::Setting>, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::settings::list_settings(&conn)
        .map_err(|e| format!("Failed to get settings: {}", e))
}

// ============================================================================
// Export Commands (Story 1.10)
// ============================================================================

/// Export result returned to frontend
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportResult {
    success: bool,
    file_path: Option<String>,
    proposal_count: usize,
    message: String,
}

/// Export metadata included in JSON file
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportMetadata {
    export_date: String,
    app_version: String,
    proposal_count: usize,
}

/// Full export structure
#[derive(serde::Serialize)]
struct ExportData {
    metadata: ExportMetadata,
    proposals: Vec<db::queries::proposals::SavedProposal>,
}

/// Export all proposals to a JSON file
/// Opens a save dialog and writes all proposals with metadata
#[tauri::command]
async fn export_proposals_to_json(
    app_handle: AppHandle,
    database: State<'_, db::Database>,
) -> Result<ExportResult, String> {
    // Get all proposals from database
    let proposals = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        db::queries::proposals::get_all_proposals(&conn)
            .map_err(|e| format!("Failed to get proposals: {}", e))?
    };

    let proposal_count = proposals.len();

    if proposal_count == 0 {
        return Ok(ExportResult {
            success: false,
            file_path: None,
            proposal_count: 0,
            message: "No proposals to export".to_string(),
        });
    }

    // Show save dialog
    let file_path = app_handle
        .dialog()
        .file()
        .set_title("Export Proposals")
        .set_file_name("proposals-backup.json")
        .add_filter("JSON Files", &["json"])
        .blocking_save_file();

    let Some(path) = file_path else {
        return Ok(ExportResult {
            success: false,
            file_path: None,
            proposal_count,
            message: "Export cancelled".to_string(),
        });
    };

    // Build export data with metadata
    let export_data = ExportData {
        metadata: ExportMetadata {
            export_date: chrono::Utc::now().to_rfc3339(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            proposal_count,
        },
        proposals,
    };

    // Serialize and write to file
    let json = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize proposals: {}", e))?;

    let path_str = path.to_string();
    std::fs::write(&path_str, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(ExportResult {
        success: true,
        file_path: Some(path_str.clone()),
        proposal_count,
        message: format!("Exported {} proposals to {}", proposal_count, path_str),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Get app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;

            // Create directory if it doesn't exist
            std::fs::create_dir_all(&app_data_dir)
                .map_err(|e| format!("Failed to create app data dir: {}", e))?;

            // Database file path
            let db_path = app_data_dir.join("upwork-researcher.db");

            // Initialize database
            let database = db::Database::new(db_path)
                .map_err(|e| format!("Failed to initialize database: {}", e))?;

            // Initialize config
            let config_state = config::ConfigState::new(app_data_dir)
                .map_err(|e| format!("Failed to initialize config: {}", e))?;

            // Initialize draft state for tracking current draft during generation
            let draft_state = DraftState {
                current_draft_id: Arc::new(Mutex::new(None)),
            };

            // Store in managed state
            app.manage(database);
            app.manage(config_state);
            app.manage(draft_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_proposal,
            generate_proposal_streaming,
            check_database,
            save_proposal,
            get_proposals,
            save_job_post,
            has_api_key,
            set_api_key,
            get_api_key_masked,
            validate_api_key,
            clear_api_key,
            // Settings commands (Story 1.9)
            get_setting,
            set_setting,
            get_all_settings,
            // Export commands (Story 1.10)
            export_proposals_to_json,
            // Draft recovery commands (Story 1.14)
            check_for_draft,
            update_proposal_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
