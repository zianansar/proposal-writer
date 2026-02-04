pub mod claude;
pub mod config;
pub mod db;
pub mod events;

// Encryption spike module (Story 1.6)
// Validates Argon2id key derivation and keyring integration for Epic 2
// SQLCipher validation deferred to Epic 2 (requires crate-wide feature migration)
#[cfg(test)]
pub mod encryption_spike;

use tauri::{AppHandle, Manager, State};

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
#[tauri::command]
async fn generate_proposal_streaming(
    job_content: String,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
) -> Result<String, String> {
    let api_key = config_state.get_api_key()?;
    claude::generate_proposal_streaming_with_key(&job_content, app_handle, api_key.as_deref()).await
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

    let id = db::queries::proposals::insert_proposal(&conn, &job_content, &generated_text)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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

            // Store in managed state
            app.manage(database);
            app.manage(config_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_proposal,
            generate_proposal_streaming,
            check_database,
            save_proposal,
            get_proposals,
            has_api_key,
            set_api_key,
            get_api_key_masked,
            validate_api_key,
            clear_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
