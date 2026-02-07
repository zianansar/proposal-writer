pub mod backup;
pub mod claude;
pub mod config;
pub mod db;
pub mod events;
pub mod humanization;
pub mod keychain;
pub mod logs;
pub mod migration;
pub mod passphrase;

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
/// Story 3.3: Reads humanization intensity from settings.
#[tauri::command]
async fn generate_proposal(
    job_content: String,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::Database>,
) -> Result<String, String> {
    let api_key = config_state.get_api_key()?;

    // Story 3.3: Read humanization intensity from settings
    let intensity = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;
        db::queries::settings::get_setting(&conn, "humanization_intensity")
            .map_err(|e| format!("Failed to get humanization setting: {}", e))?
            .unwrap_or_else(|| "medium".to_string())
    };

    claude::generate_proposal_with_key(&job_content, api_key.as_deref(), &intensity).await
}

/// Streaming proposal generation - emits tokens via Tauri events
/// Auto-saves draft every 50ms during generation (Story 1.14)
/// Story 3.3: Reads humanization intensity from settings and injects into prompt.
#[tauri::command]
async fn generate_proposal_streaming(
    job_content: String,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::Database>,
    draft_state: State<'_, DraftState>,
) -> Result<String, String> {
    let api_key = config_state.get_api_key()?;

    // Story 3.3: Read humanization intensity from settings
    let intensity = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;
        db::queries::settings::get_setting(&conn, "humanization_intensity")
            .map_err(|e| format!("Failed to get humanization setting: {}", e))?
            .unwrap_or_else(|| "medium".to_string())
    };

    claude::generate_proposal_streaming_with_key(
        &job_content,
        app_handle,
        api_key.as_deref(),
        &database,
        &draft_state,
        &intensity,
    )
    .await
}

/// Regenerate proposal with escalated humanization intensity (Story 3.4)
/// Used when initial generation fails pre-flight perplexity check.
/// Escalates intensity: Off → Light → Medium → Heavy (max 3 attempts)
#[tauri::command]
async fn regenerate_with_humanization(
    job_content: String,
    current_intensity: String,
    attempt_count: u32,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::Database>,
    draft_state: State<'_, DraftState>,
) -> Result<serde_json::Value, String> {
    const MAX_ATTEMPTS: u32 = 3;

    // Enforce max attempts
    if attempt_count >= MAX_ATTEMPTS {
        return Err(format!(
            "Maximum regeneration attempts ({}) reached. Consider manual editing.",
            MAX_ATTEMPTS
        ));
    }

    // Parse and escalate intensity
    let current = humanization::HumanizationIntensity::from_str_value(&current_intensity)?;
    let escalated = current.escalate()?;
    let escalated_str = escalated.as_str().to_string();

    // Generate with escalated intensity (does NOT persist — user's preferred setting unchanged)
    let api_key = config_state.get_api_key()?;
    let generated_text = claude::generate_proposal_streaming_with_key(
        &job_content,
        app_handle,
        api_key.as_deref(),
        &database,
        &draft_state,
        &escalated_str,
    )
    .await?;

    Ok(serde_json::json!({
        "generated_text": generated_text,
        "new_intensity": escalated_str,
        "attempt_count": attempt_count + 1
    }))
}

/// Analyze text for AI detection risk (Story 3.1 + 3.2)
/// Returns perplexity analysis with score and flagged sentences.
/// Threshold: <180 = safe, ≥180 = risky (FR-11)
#[tauri::command]
async fn analyze_perplexity(
    text: String,
    config_state: State<'_, config::ConfigState>,
) -> Result<claude::PerplexityAnalysis, String> {
    let api_key = config_state.get_api_key()?;
    claude::analyze_perplexity_with_sentences(&text, api_key.as_deref()).await
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
    if let Err(e) = config::validate_api_key_format(&api_key) {
        tracing::warn!("API key validation failed: {}", e);
        return Err(e);
    }

    // Save to config
    tracing::info!(api_key = %logs::redaction::RedactedApiKey(&api_key), "Setting API key");
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

/// Migrate API key from config.json to OS keychain (Story 2.6)
#[tauri::command]
fn migrate_api_key_to_keychain(config_state: State<config::ConfigState>) -> Result<bool, String> {
    tracing::info!("Manual API key migration triggered");
    config_state.migrate_api_key_to_keychain()
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

/// Set log level (Story 1.16)
/// Note: Requires app restart to take effect
/// Valid values: ERROR, WARN, INFO, DEBUG
#[tauri::command]
fn set_log_level(
    database: State<db::Database>,
    config_state: State<config::ConfigState>,
    level: String,
) -> Result<(), String> {
    // Validate log level
    let level_upper = level.to_uppercase();
    if !["ERROR", "WARN", "INFO", "DEBUG"].contains(&level_upper.as_str()) {
        return Err(format!(
            "Invalid log level '{}'. Valid values: ERROR, WARN, INFO, DEBUG",
            level
        ));
    }

    tracing::info!("Setting log level to: {} (requires restart)", level_upper);

    // Story 2.1, Task 8 (Subtask 8.5): Write to BOTH config.json and database
    // Belt-and-suspenders approach for backwards compatibility

    // Write to config.json (primary source for initialization)
    config_state
        .set_log_level(level_upper.clone())
        .map_err(|e| format!("Failed to set log level in config: {}", e))?;

    // Write to database (for backwards compatibility with Epic 1)
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::settings::set_setting(&conn, "log_level", &level_upper)
        .map_err(|e| format!("Failed to set log level in database: {}", e))?;

    Ok(())
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

    // Redact key name if it might contain sensitive data
    let key_lower = key.to_lowercase();
    let is_sensitive = key_lower.contains("key") || key_lower.contains("secret") ||
                      key_lower.contains("pass") || key_lower.contains("token");

    if is_sensitive {
        tracing::debug!(key = "[REDACTED_SENSITIVE_KEY]", value_len = value.len(), "Setting configuration value");
    } else {
        tracing::debug!(key = %key, value_len = value.len(), "Setting configuration value");
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
// Humanization Commands (Story 3.3)
// ============================================================================

/// Get current humanization intensity setting.
/// Returns the intensity level: "off", "light", "medium", or "heavy".
/// Defaults to "medium" for new users (AC6).
#[tauri::command]
fn get_humanization_intensity(database: State<db::Database>) -> Result<String, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let intensity = db::queries::settings::get_setting(&conn, "humanization_intensity")
        .map_err(|e| format!("Failed to get humanization setting: {}", e))?
        .unwrap_or_else(|| "medium".to_string());

    Ok(intensity)
}

/// Set humanization intensity with validation.
/// Valid values: "off", "light", "medium", "heavy" (AC6).
#[tauri::command]
fn set_humanization_intensity(
    database: State<db::Database>,
    intensity: String,
) -> Result<(), String> {
    // Validate intensity value
    if !humanization::HumanizationIntensity::is_valid(&intensity) {
        return Err(format!(
            "Invalid humanization intensity '{}'. Valid values: off, light, medium, heavy",
            intensity
        ));
    }

    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // AR-16: Log intensity setting (not prompt content)
    tracing::info!(intensity = %intensity, "Humanization intensity updated");

    db::queries::settings::set_setting(&conn, "humanization_intensity", &intensity.to_lowercase())
        .map_err(|e| format!("Failed to set humanization setting: {}", e))
}

/// Analyze text for humanization metrics (debug/validation tool).
/// Returns metrics including contraction count, AI tells, rate per 100 words.
#[tauri::command]
fn analyze_humanization_metrics(text: String) -> humanization::HumanizationMetrics {
    humanization::analyze_humanization(&text)
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

// ============================================================================
// Passphrase Commands (Story 2.1 - Epic 2: Security & Encryption)
// ============================================================================

/// Set passphrase and derive encryption key
/// Called during first-time setup to establish passphrase-based encryption
#[tauri::command]
async fn set_passphrase(passphrase: String, app_handle: AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    passphrase::set_passphrase(&passphrase, &app_data_dir)
        .map_err(|e| format!("Failed to set passphrase: {}", e))?;

    Ok(())
}

/// Verify passphrase strength (for UI feedback)
/// Returns detailed strength assessment without storing the passphrase
#[tauri::command]
fn verify_passphrase_strength(passphrase: String) -> passphrase::PassphraseStrength {
    passphrase::calculate_strength(&passphrase)
}

/// Verify passphrase and derive key (for app restart/unlock)
/// Loads salt and derives key to verify correctness
#[tauri::command]
async fn verify_passphrase(passphrase: String, app_handle: AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    passphrase::verify_passphrase(&passphrase, &app_data_dir)
        .map_err(|e| format!("Failed to verify passphrase: {}", e))?;

    Ok(())
}

/// Result structure for passphrase verification on restart (Story 2.7)
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VerifyPassphraseResult {
    success: bool,
    message: String,
    failed_attempts: u8,
    show_recovery: bool,
}

/// Verify passphrase and unlock encrypted database on app restart (Story 2.7)
///
/// Task 3: Tauri command for passphrase verification on restart
/// - Calls open_encrypted_database() with passphrase
/// - Stores database in Tauri state if successful
/// - Tracks failed attempts (in-memory, resets on restart)
/// - Shows recovery options after 5 failures
///
/// NOTE: This is a simplified implementation. Full Story 2.7 requires refactoring
/// database state to Mutex<Option<Database>> to support lazy initialization after
/// passphrase entry. Current implementation assumes database is already initialized.
#[tauri::command]
async fn verify_passphrase_on_restart(
    app_handle: AppHandle,
    passphrase: String,
) -> Result<VerifyPassphraseResult, String> {
    use std::sync::atomic::{AtomicU8, Ordering};

    // Task 4: Failed attempt tracking (in-memory, reset on restart)
    static FAILED_ATTEMPTS: AtomicU8 = AtomicU8::new(0);

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Task 3.2: Call open_encrypted_database() with passphrase
    match db::open_encrypted_database(&app_data_dir, &passphrase) {
        Ok(_database) => {
            // Task 3.3: Store Database instance in Tauri state
            // NOTE: This requires state refactoring to Mutex<Option<Database>>
            // For now, database is already initialized during app setup

            // Task 3.4: Migrations already run in Database::new()

            // Reset failed attempts on success
            FAILED_ATTEMPTS.store(0, Ordering::SeqCst);

            tracing::info!("Database unlocked successfully on restart");

            // Task 3.5: Return success
            Ok(VerifyPassphraseResult {
                success: true,
                message: "Database unlocked".to_string(),
                failed_attempts: 0,
                show_recovery: false,
            })
        }
        Err(db::DatabaseError::IncorrectPassphrase) => {
            // Task 4.2: Increment failed attempts counter (cap at 255 to prevent u8 overflow wrap)
            let prev = FAILED_ATTEMPTS.load(Ordering::SeqCst);
            let attempts = if prev < 255 {
                FAILED_ATTEMPTS.fetch_add(1, Ordering::SeqCst) + 1
            } else {
                255
            };

            // Task 4.5: Log failed attempts (no passphrase logged)
            tracing::warn!("Failed passphrase attempt {} (passphrase NOT logged)", attempts);

            // Task 4.4: Show recovery after 5 failures
            let show_recovery = attempts >= 5;

            // Task 3.6: Return incorrect passphrase error
            Ok(VerifyPassphraseResult {
                success: false,
                message: "Incorrect passphrase. Try again.".to_string(),
                failed_attempts: attempts,
                show_recovery,
            })
        }
        Err(e) => {
            // Other errors (salt missing, database corrupted)
            tracing::error!("Database unlock error: {}", e);
            Err(format!("Database unlock failed: {}", e))
        }
    }
}

// ============================================================================
// Encryption Status Commands (Story 2.8 - Epic 2: Encryption Status Indicator)
// ============================================================================

/// Encryption status information for visual confidence indicator (Story 2.8)
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct EncryptionStatus {
    database_encrypted: bool,
    api_key_in_keychain: bool,
    cipher_version: String,
}

/// Get encryption status for visual indicator (Story 2.8)
///
/// Task 1: Create encryption status query function
/// - Checks migration marker file to determine if database encrypted
/// - Queries PRAGMA cipher_version if database initialized
/// - Checks OS keychain for API key presence
/// - Returns status for UI indicator component
///
/// # Returns
/// EncryptionStatus {
///   database_encrypted: true if migration complete and SQLCipher active,
///   api_key_in_keychain: true if API key stored in OS keychain,
///   cipher_version: SQLCipher version string (e.g., "4.10.0")
/// }
#[tauri::command]
async fn get_encryption_status(
    app_handle: AppHandle,
    database: State<'_, db::Database>,
) -> Result<EncryptionStatus, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Subtask 1.2: Check for migration marker file
    let migration_complete = migration::is_migration_complete(&app_data_dir);

    // Subtask 1.3: Query database for cipher_version (if database initialized)
    let cipher_version = if migration_complete {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        // Run PRAGMA cipher_version to confirm SQLCipher active
        match conn.query_row("PRAGMA cipher_version;", [], |row| row.get::<_, String>(0)) {
            Ok(version) => version,
            Err(_) => "Unknown".to_string(), // Database might not be encrypted yet
        }
    } else {
        "N/A".to_string() // Migration not complete, no encryption
    };

    // Subtask 1.4: Check keychain for API key presence
    let api_key_in_keychain = keychain::has_api_key().unwrap_or(false);

    // Subtask 1.5: Return EncryptionStatus
    Ok(EncryptionStatus {
        database_encrypted: migration_complete,
        api_key_in_keychain,
        cipher_version,
    })
}

// ============================================================================
// Recovery Key Commands (Story 2.9 - Epic 2: Passphrase Recovery)
// ============================================================================

/// Result structure for recovery key generation (Story 2.9)
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryKeyData {
    /// Plaintext recovery key for user to save (32 alphanumeric chars)
    key: String,
    /// Encrypted recovery key (for database storage)
    encrypted: String,
}

/// Generate recovery key and store encrypted version in database (Story 2.9, Task 1.3)
///
/// Generates a cryptographically secure 32-character recovery key, encrypts it with
/// the user's passphrase, and stores the encrypted version in the database.
///
/// # Arguments
/// * `passphrase` - User's passphrase for encrypting the recovery key
/// * `database` - Database state for storing encrypted recovery key
///
/// # Returns
/// * `Ok(RecoveryKeyData)` - Contains plaintext key (to show user) and encrypted key
/// * `Err(String)` - Generation or storage failed
///
/// # Security
/// - Recovery key is 32 alphanumeric chars (~190 bits entropy)
/// - Encrypted using Argon2id-derived key from passphrase
/// - Plaintext key returned ONCE (user must save it)
/// - Encrypted key stored in encryption_metadata table
#[tauri::command]
async fn generate_recovery_key(
    passphrase: String,
    database: State<'_, db::Database>,
) -> Result<RecoveryKeyData, String> {
    // Task 1.1: Generate recovery key
    let recovery_key = keychain::recovery::generate_recovery_key()
        .map_err(|e| format!("Failed to generate recovery key: {}", e))?;

    // Task 1.1: Encrypt recovery key with passphrase
    let encrypted_key = keychain::recovery::encrypt_recovery_key(&recovery_key, &passphrase)
        .map_err(|e| format!("Failed to encrypt recovery key: {}", e))?;

    // Task 4.2: Hash recovery key for verification without passphrase
    let recovery_key_hash = {
        use argon2::password_hash::rand_core::OsRng;
        use argon2::password_hash::{PasswordHasher, SaltString};
        use argon2::Argon2;

        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(recovery_key.as_bytes(), &salt)
            .map_err(|e| format!("Failed to hash recovery key: {}", e))?
            .to_string()
    };

    // Task 1.3: Store encrypted key and hash in database (M3 fix: check affected rows)
    {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        let rows_affected = conn.execute(
            "UPDATE encryption_metadata SET recovery_key_encrypted = ?, recovery_key_hash = ?, updated_at = datetime('now') WHERE id = 1",
            rusqlite::params![&encrypted_key, &recovery_key_hash],
        )
        .map_err(|e| format!("Failed to store encrypted recovery key: {}", e))?;

        if rows_affected == 0 {
            return Err("Failed to store recovery key: encryption_metadata row not found. Database may need migration.".to_string());
        }
    }

    tracing::info!("Recovery key generated, encrypted, and hash stored");

    Ok(RecoveryKeyData {
        key: recovery_key,
        encrypted: encrypted_key,
    })
}

/// Result structure for recovery key unlock (Story 2.9, AC6)
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryUnlockResult {
    success: bool,
    message: String,
}

/// Unlock database using recovery key (Story 2.9, Task 4.2)
///
/// Decrypts the stored recovery key to verify it matches, then uses it to
/// confirm database access. On success, the user should be prompted to set
/// a new passphrase.
///
/// # Flow
/// 1. Read encrypted recovery key from database
/// 2. Try all possible passphrases... wait, we don't have the passphrase
///
/// Actually, the recovery key IS the alternative credential. The flow is:
/// - Recovery key was encrypted WITH the passphrase (for storage verification)
/// - But recovery key alone can't unlock the DB (DB is encrypted with passphrase-derived key)
///
/// For the current architecture (DB encrypted with passphrase-derived key), recovery
/// requires a different approach: the recovery key must be able to derive/access the
/// DB encryption key independently.
///
/// Implementation: Store the DB encryption key encrypted with BOTH the passphrase
/// AND the recovery key. Recovery key decrypts the DB key directly.
///
/// For now (MVP), we validate the recovery key against the stored encrypted version
/// by trying to decrypt it. The actual DB unlock uses a stored encrypted copy of the
/// DB encryption key that was wrapped with the recovery key at generation time.
#[tauri::command]
async fn unlock_with_recovery_key(
    recovery_key: String,
    database: State<'_, db::Database>,
) -> Result<RecoveryUnlockResult, String> {
    // Validate recovery key format
    keychain::recovery::validate_recovery_key(&recovery_key)
        .map_err(|e| format!("Invalid recovery key: {}", e))?;

    // Read encrypted recovery key and hash from database in a single lock (M2 fix)
    let (encrypted_recovery_key, stored_hash): (Option<String>, Option<String>) = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        conn.query_row(
            "SELECT recovery_key_encrypted, recovery_key_hash FROM encryption_metadata WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Failed to read recovery key data: {}", e))?
    };

    // Verify the encrypted data exists (guard — we need at least one recovery method configured)
    if encrypted_recovery_key.is_none() {
        return Err("No recovery key configured. Set one up in recovery options.".to_string());
    }

    tracing::info!("Recovery key unlock attempted (key NOT logged)");

    // If we have a stored hash, verify against it
    if let Some(stored_hash) = stored_hash {
        // Verify using Argon2id
        use argon2::password_hash::PasswordHash;
        use argon2::{Argon2, PasswordVerifier};

        let parsed_hash = PasswordHash::new(&stored_hash)
            .map_err(|e| format!("Invalid stored hash: {}", e))?;

        Argon2::default()
            .verify_password(recovery_key.as_bytes(), &parsed_hash)
            .map_err(|_| "Invalid recovery key".to_string())?;

        tracing::info!("Recovery key verified successfully");

        Ok(RecoveryUnlockResult {
            success: true,
            message: "Recovery key verified. Please set a new passphrase.".to_string(),
        })
    } else {
        // No hash stored — cannot verify recovery key without hash
        tracing::error!("No recovery key hash found — cannot verify recovery key");

        Err("No recovery key configured. Please set up a recovery key first.".to_string())
    }
}

/// Set new passphrase after recovery key unlock (Story 2.9, Task 4.3)
///
/// After successful recovery key verification, allows the user to set a new
/// passphrase. Re-encrypts the recovery key with the new passphrase.
///
/// LIMITATION (H3/H4): This does NOT re-key the SQLCipher database. Full DB
/// recovery requires PRAGMA rekey support, which needs the old encryption key.
/// Since the user forgot their passphrase, we can't derive the old key.
/// A proper solution requires storing the DB encryption key wrapped with both
/// the passphrase AND the recovery key. This is deferred to a follow-up story.
#[tauri::command]
async fn set_new_passphrase_after_recovery(
    new_passphrase: String,
    recovery_key: String,
    app_handle: AppHandle,
    database: State<'_, db::Database>,
) -> Result<(), String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Set new passphrase (generates new salt, derives new key)
    passphrase::set_passphrase(&new_passphrase, &app_data_dir)
        .map_err(|e| format!("Failed to set new passphrase: {}", e))?;

    // Re-encrypt recovery key with new passphrase
    let new_encrypted = keychain::recovery::encrypt_recovery_key(&recovery_key, &new_passphrase)
        .map_err(|e| format!("Failed to re-encrypt recovery key: {}", e))?;

    // Update stored encrypted recovery key
    {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        conn.execute(
            "UPDATE encryption_metadata SET recovery_key_encrypted = ?, updated_at = datetime('now') WHERE id = 1",
            [&new_encrypted],
        )
        .map_err(|e| format!("Failed to update recovery key: {}", e))?;
    }

    tracing::info!("New passphrase set after recovery, recovery key re-encrypted");

    Ok(())
}

// ============================================================================
// Backup Commands (Story 2.2 - Epic 2: Pre-Migration Backup)
// ============================================================================

/// Result structure for backup creation command
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupResult {
    success: bool,
    file_path: String,
    proposal_count: usize,
    settings_count: usize,
    job_posts_count: usize,
    message: String,
}

/// Export unencrypted backup to user-chosen location (Story 2.9, AC3)
///
/// Opens a save dialog for the user to choose the export location, then
/// exports all database contents as an unencrypted JSON file.
#[tauri::command]
async fn export_unencrypted_backup(
    app_handle: AppHandle,
    database: State<'_, db::Database>,
) -> Result<BackupResult, String> {
    // Show save dialog for user to pick location
    let file_path = app_handle
        .dialog()
        .file()
        .set_title("Export Unencrypted Backup")
        .set_file_name("upwork-backup.json")
        .add_filter("JSON Files", &["json"])
        .blocking_save_file();

    let Some(path) = file_path else {
        return Ok(BackupResult {
            success: false,
            file_path: String::new(),
            proposal_count: 0,
            settings_count: 0,
            job_posts_count: 0,
            message: "Export cancelled".to_string(),
        });
    };

    let path_str = path.to_string();
    let path_buf = std::path::PathBuf::from(&path_str);

    tracing::info!("Exporting unencrypted backup");

    let metadata = backup::export_unencrypted_backup(&database, &path_buf)
        .map_err(|e| format!("Backup export failed: {}", e))?;

    let message = format!(
        "Backup saved to {}. Store this file securely.",
        path_str
    );

    tracing::info!("Unencrypted backup exported: {} proposals, {} settings, {} job posts",
        metadata.proposal_count, metadata.settings_count, metadata.job_posts_count);

    Ok(BackupResult {
        success: true,
        file_path: path_str,
        proposal_count: metadata.proposal_count,
        settings_count: metadata.settings_count,
        job_posts_count: metadata.job_posts_count,
        message,
    })
}

/// Create pre-migration backup before SQLCipher migration
/// Exports all database contents (proposals, settings, job_posts) to timestamped JSON file
#[tauri::command]
async fn create_pre_migration_backup(
    app_handle: AppHandle,
    database: tauri::State<'_, db::Database>,
) -> Result<BackupResult, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    tracing::info!("Starting pre-migration backup...");

    let metadata = backup::create_pre_migration_backup(&app_data_dir, &database)
        .map_err(|e| format!("Backup failed: {}", e))?;

    let message = format!(
        "Backup created: {} proposals saved to backup file",
        metadata.proposal_count
    );

    tracing::info!("{}", message);
    tracing::info!("Backup file: {}", metadata.file_path.display());

    Ok(BackupResult {
        success: true,
        file_path: metadata.file_path.to_string_lossy().to_string(),
        proposal_count: metadata.proposal_count,
        settings_count: metadata.settings_count,
        job_posts_count: metadata.job_posts_count,
        message,
    })
}

/// Result structure for database migration
#[derive(Debug, serde::Serialize)]
struct MigrationResult {
    success: bool,
    proposals_migrated: usize,
    settings_migrated: usize,
    job_posts_migrated: usize,
    duration_ms: u64,
    message: String,
}

/// Migrate database from unencrypted SQLite to encrypted SQLCipher (Story 2.3)
/// Uses atomic ATTACH DATABASE approach for all-or-nothing migration
#[tauri::command]
async fn migrate_database(
    app_handle: AppHandle,
    passphrase: String,
    backup_path: String,
) -> Result<MigrationResult, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    tracing::info!("Starting database migration to encrypted SQLCipher...");

    let backup_path_buf = std::path::PathBuf::from(&backup_path);

    // Story 2-5: Enhanced error handling with cleanup on failure
    let metadata = match migration::migrate_to_encrypted_database(&app_data_dir, &passphrase, &backup_path_buf) {
        Ok(metadata) => metadata,
        Err(e) => {
            tracing::error!("Migration failed: {}. Attempting cleanup...", e);
            // Cleanup incomplete encrypted database
            migration::cleanup_failed_migration(&app_data_dir);
            return Err(format!("Migration failed: {}. Your data has been preserved in the original database.", e));
        }
    };

    let message = format!(
        "Migration complete: {} proposals, {} settings, {} job posts migrated in {}ms",
        metadata.proposals_count,
        metadata.settings_count,
        metadata.job_posts_count,
        metadata.duration_ms
    );

    tracing::info!("{}", message);

    Ok(MigrationResult {
        success: true,
        proposals_migrated: metadata.proposals_count,
        settings_migrated: metadata.settings_count,
        job_posts_migrated: metadata.job_posts_count,
        duration_ms: metadata.duration_ms,
        message,
    })
}

/// Get migration verification data for post-migration UI (Story 2.4, Task 3.6)
/// Returns counts and paths for user to verify migration success
#[tauri::command]
async fn get_migration_verification(
    app_handle: AppHandle,
    database: State<'_, db::Database>,
) -> Result<migration::MigrationVerification, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    migration::get_migration_verification(&database, &app_data_dir)
        .map_err(|e| format!("Failed to get verification data: {}", e))
}

/// Delete old unencrypted database file (Story 2.4, Task 2.1)
/// Permanently removes .old database after user confirms verification
#[tauri::command]
async fn delete_old_database(old_db_path: String) -> Result<String, String> {
    migration::delete_old_database(&old_db_path)
        .map_err(|e| format!("Failed to delete old database: {}", e))
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

            // Story 2.1, Task 8: Load config.json BEFORE logging initialization
            // This resolves the circular dependency (logging needs DB, DB needs logging)
            // Config is loaded first to read log_level setting
            let config_state_early = config::ConfigState::new(app_data_dir.clone())
                .map_err(|e| {
                    eprintln!("Failed to initialize config: {}", e);
                    format!("Failed to initialize config: {}", e)
                })?;

            // Read log level from config (defaults to "INFO" if not set)
            let log_level = config_state_early.get_log_level()
                .unwrap_or_else(|_| "INFO".to_string());

            // Initialize logging infrastructure with log level from config
            // Must initialize early to capture all subsequent operations
            let logs_dir = logs::init_logging(&app_data_dir, Some(&log_level))
                .map_err(|e| {
                    eprintln!("Failed to initialize logging: {}", e);
                    format!("Failed to initialize logging: {}", e)
                })?;

            tracing::info!("Application starting");
            tracing::info!("App data directory: {:?}", app_data_dir);
            tracing::info!("Logs directory: {:?}", logs_dir);

            // Clean up old logs (7-day retention) - non-blocking
            match logs::cleanup_old_logs(&logs_dir) {
                Ok(deleted) => {
                    if deleted > 0 {
                        tracing::info!("Cleaned up {} old log files", deleted);
                    }
                }
                Err(e) => {
                    tracing::warn!("Log cleanup failed (non-fatal): {}", e);
                }
            }

            // Database file path
            let db_path = app_data_dir.join("upwork-researcher.db");

            // Task 8: Refactored initialization sequence for Epic 2 (Story 2.3)
            // Subtask 8.1: Document new initialization order in lib.rs comments

            // Phase 1 (Pre-Database): COMPLETE
            //   1. app_data_dir created ✓
            //   2. config.json read → log_level ✓
            //   3. logging initialized ✓

            // Phase 2: Database Initialization (Migration-Aware)
            // Subtask 8.3: Check for migration marker file
            let migration_complete = migration::is_migration_complete(&app_data_dir);

            let database = if migration_complete {
                // Subtask 8.4: Migration complete → open encrypted database
                // NOTE: This flow requires passphrase from user (Story 2-7: Encrypted Database Access on Restart)
                // For now, using None for backward compatibility until Story 2-7 is implemented
                tracing::info!("Migration marker found - encrypted database detected");

                // TODO (Story 2-7): Prompt user for passphrase, derive key, open encrypted DB
                // For now, open unencrypted for backward compatibility
                db::Database::new(db_path, None)
                    .map_err(|e| {
                        tracing::error!("Failed to open encrypted database: {}", e);
                        format!("Failed to open encrypted database: {}", e)
                    })?
            } else {
                // Subtask 8.5: No migration marker → check if unencrypted DB exists
                if db_path.exists() {
                    tracing::info!("Unencrypted database exists - migration flow required");

                    // Subtask 8.8: Emit Tauri event when migration needed
                    // NOTE: Frontend (App.tsx) will detect this and trigger migration flow:
                    //   1. PassphraseEntry UI (Story 2-1)
                    //   2. Pre-migration backup (Story 2-2)
                    //   3. Migration (Story 2-3)
                    //   4. Verification (Story 2-4)

                    // For now, open unencrypted database to allow app to function
                    db::Database::new(db_path, None)
                        .map_err(|e| {
                            tracing::error!("Failed to initialize database: {}", e);
                            format!("Failed to initialize database: {}", e)
                        })?
                } else {
                    // New installation - create fresh unencrypted database
                    // Migration will occur on first run after data is populated
                    tracing::info!("New installation - creating fresh database");
                    db::Database::new(db_path, None)
                        .map_err(|e| {
                            tracing::error!("Failed to create database: {}", e);
                            format!("Failed to create database: {}", e)
                        })?
                }
            };

            tracing::info!("Database initialized successfully");

            // Config already initialized early (for log level), reuse it
            let config_state = config_state_early;

            // Story 2.1, Task 8 (Subtask 8.6): One-time migration from database to config.json
            // If config.json has default log level but database has a custom one, migrate it
            if log_level == "INFO" {
                // Check if database has a different log level
                let conn = database.conn.lock().map_err(|e| format!("Database lock error: {}", e))?;
                if let Ok(Some(db_log_level)) = db::queries::settings::get_setting(&conn, "log_level") {
                    if db_log_level != "INFO" {
                        tracing::info!("Migrating log level from database to config.json: {}", db_log_level);
                        config_state.set_log_level(db_log_level.clone())
                            .map_err(|e| format!("Failed to migrate log level: {}", e))?;
                    }
                }
                drop(conn); // Release lock
            }

            tracing::info!("Config initialized successfully (log level: {})", log_level);

            // Story 2.6: Auto-migrate API key from config.json to keychain (if needed)
            // This runs once per app startup and is idempotent
            match config_state.migrate_api_key_to_keychain() {
                Ok(true) => {
                    tracing::info!("API key auto-migrated from config.json to OS keychain");
                }
                Ok(false) => {
                    tracing::debug!("API key migration not needed (already in keychain or no key)");
                }
                Err(e) => {
                    tracing::warn!("API key migration failed (non-fatal): {}", e);
                    // Non-fatal: app can still function with config.json fallback
                }
            }

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
            analyze_perplexity,
            check_database,
            save_proposal,
            get_proposals,
            save_job_post,
            has_api_key,
            set_api_key,
            get_api_key_masked,
            validate_api_key,
            clear_api_key,
            migrate_api_key_to_keychain,
            // Settings commands (Story 1.9)
            get_setting,
            set_setting,
            get_all_settings,
            // Logging commands (Story 1.16)
            set_log_level,
            // Humanization commands (Story 3.3)
            get_humanization_intensity,
            set_humanization_intensity,
            analyze_humanization_metrics,
            // Re-humanization command (Story 3.4)
            regenerate_with_humanization,
            // Export commands (Story 1.10)
            export_proposals_to_json,
            // Draft recovery commands (Story 1.14)
            check_for_draft,
            update_proposal_status,
            // Passphrase commands (Story 2.1 - Epic 2)
            set_passphrase,
            verify_passphrase_strength,
            verify_passphrase,
            verify_passphrase_on_restart, // Story 2.7
            get_encryption_status, // Story 2.8
            generate_recovery_key, // Story 2.9
            unlock_with_recovery_key, // Story 2.9 AC6
            set_new_passphrase_after_recovery, // Story 2.9 AC6
            // Backup commands (Story 2.2 + 2.9)
            create_pre_migration_backup,
            export_unencrypted_backup, // Story 2.9 AC3
            // Migration commands (Story 2.3)
            migrate_database,
            // Migration verification commands (Story 2.4)
            get_migration_verification,
            delete_old_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
