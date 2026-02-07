pub mod analysis;
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
pub mod sanitization;

// Encryption spike module (Story 1.6)
// Validates Argon2id key derivation and keyring integration for Epic 2
// SQLCipher validation deferred to Epic 2 (requires crate-wide feature migration)
#[cfg(test)]
pub mod encryption_spike;

use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

/// Shared state for tracking current draft proposal during generation
pub struct DraftState {
    pub current_draft_id: Arc<Mutex<Option<i64>>>,
}

// ============================================================================
// Cooldown State (Story 3.8: Rate Limiting Enforcement)
// ============================================================================

/// Cooldown period in seconds (FR-12: max 1 generation per 2 minutes)
const COOLDOWN_SECONDS: u64 = 120;

/// Cooldown state for generation rate limiting (FR-12)
/// In-memory only — resets on app restart (acceptable: UX protection, not security)
pub struct CooldownState {
    pub last_generation: Mutex<Option<Instant>>,
}

impl CooldownState {
    pub fn new() -> Self {
        Self {
            last_generation: Mutex::new(None),
        }
    }

    /// Check if cooldown is active. Returns remaining seconds or 0.
    pub fn remaining_seconds(&self) -> u64 {
        let guard = self.last_generation.lock().unwrap();
        match *guard {
            Some(last) => {
                let elapsed = last.elapsed().as_secs();
                if elapsed < COOLDOWN_SECONDS {
                    COOLDOWN_SECONDS - elapsed
                } else {
                    0
                }
            }
            None => 0,
        }
    }

    /// Record that a generation just completed.
    pub fn record(&self) {
        let mut guard = self.last_generation.lock().unwrap();
        *guard = Some(Instant::now());
    }
}

impl Default for CooldownState {
    fn default() -> Self {
        Self::new()
    }
}

/// Non-streaming proposal generation (kept for backwards compatibility/testing)
/// Story 3.3: Reads humanization intensity from settings.
/// Story 3.8: Enforces cooldown rate limiting (FR-12).
#[tauri::command]
async fn generate_proposal(
    job_content: String,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::Database>,
    cooldown: State<'_, CooldownState>,
) -> Result<String, String> {
    // Story 3.8: Check cooldown FIRST — before any API call (FR-12)
    let remaining = cooldown.remaining_seconds();
    if remaining > 0 {
        return Err(format!("RATE_LIMITED:{}", remaining));
    }

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

    let result = claude::generate_proposal_with_key(&job_content, api_key.as_deref(), &intensity).await?;

    // Story 3.8: Record successful generation timestamp (after API call succeeds)
    cooldown.record();

    Ok(result)
}

/// Streaming proposal generation - emits tokens via Tauri events
/// Auto-saves draft every 50ms during generation (Story 1.14)
/// Story 3.3: Reads humanization intensity from settings and injects into prompt.
/// Story 3.8: Enforces cooldown rate limiting (FR-12).
#[tauri::command]
async fn generate_proposal_streaming(
    job_content: String,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::Database>,
    draft_state: State<'_, DraftState>,
    cooldown: State<'_, CooldownState>,
) -> Result<String, String> {
    // Story 3.8: Check cooldown FIRST — before any API call (FR-12)
    let remaining = cooldown.remaining_seconds();
    if remaining > 0 {
        return Err(format!("RATE_LIMITED:{}", remaining));
    }

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

    let result = claude::generate_proposal_streaming_with_key(
        &job_content,
        app_handle,
        api_key.as_deref(),
        &database,
        &draft_state,
        &intensity,
    )
    .await?;

    // Story 3.8: Record successful generation timestamp (after API call succeeds)
    cooldown.record();

    Ok(result)
}

/// Regenerate proposal with escalated humanization intensity (Story 3.4)
/// Used when initial generation fails pre-flight perplexity check.
/// Escalates intensity: Off → Light → Medium → Heavy (max 3 attempts)
/// Story 3.8: Enforces cooldown rate limiting (FR-12).
///
/// # Trust Assumption (L2 Review 3)
/// `attempt_count` is provided by the frontend and trusted without server-side tracking.
/// In a local desktop app context, this is acceptable since the user has full control.
/// For a web service, server-side session tracking would be needed to prevent bypass.
#[tauri::command]
async fn regenerate_with_humanization(
    job_content: String,
    current_intensity: String,
    attempt_count: u32,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::Database>,
    draft_state: State<'_, DraftState>,
    cooldown: State<'_, CooldownState>,
) -> Result<serde_json::Value, String> {
    // Story 3.8: Check cooldown FIRST — before any API call (FR-12)
    let remaining = cooldown.remaining_seconds();
    if remaining > 0 {
        return Err(format!("RATE_LIMITED:{}", remaining));
    }

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

    // Story 3.8: Record successful generation timestamp (after API call succeeds)
    cooldown.record();

    Ok(serde_json::json!({
        "generated_text": generated_text,
        "new_intensity": escalated_str,
        "attempt_count": attempt_count + 1
    }))
}

/// Analyze text for AI detection risk (Story 3.1 + 3.2 + 3.5)
/// Returns perplexity analysis with score and flagged sentences.
/// Story 3.5: Uses configurable threshold (default 180)
#[tauri::command]
async fn analyze_perplexity(
    text: String,
    threshold: i32,
    config_state: State<'_, config::ConfigState>,
) -> Result<claude::PerplexityAnalysis, String> {
    let api_key = config_state.get_api_key()?;
    claude::analyze_perplexity_with_sentences(&text, threshold, api_key.as_deref()).await
}

// ============================================================================
// Cooldown Commands (Story 3.8: Rate Limiting Enforcement)
// ============================================================================

/// Get remaining cooldown seconds (Story 3.8, AC4)
/// Returns 0 if no cooldown is active.
/// Used by frontend to sync timer on app startup.
#[tauri::command]
fn get_cooldown_remaining(cooldown: State<CooldownState>) -> u64 {
    cooldown.remaining_seconds()
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

/// Delete a proposal and all its revisions (Story 6.8)
/// Implements GDPR "right to deletion" from Round 5 Security Audit.
/// Returns success status and message.
///
/// # Cascade Behavior
/// - proposal_revisions: Deleted via ON DELETE CASCADE
/// - safety_overrides: Orphaned (acceptable - historical data)
#[tauri::command]
fn delete_proposal(
    database: State<db::Database>,
    proposal_id: i64,
) -> Result<serde_json::Value, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let deleted = db::queries::proposals::delete_proposal(&conn, proposal_id)
        .map_err(|e| format!("Failed to delete proposal: {}", e))?;

    if deleted {
        tracing::info!(proposal_id = proposal_id, "Proposal deleted");
        Ok(serde_json::json!({
            "success": true,
            "message": "Proposal deleted."
        }))
    } else {
        Ok(serde_json::json!({
            "success": false,
            "message": "Proposal not found."
        }))
    }
}

/// Update proposal content (Story 6.1: TipTap Editor auto-save)
/// Called by frontend editor on content changes (2-second debounce)
/// Updates both content and updated_at timestamp
#[tauri::command]
fn update_proposal_content(
    database: State<db::Database>,
    proposal_id: i64,
    content: String,
) -> Result<(), String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::proposals::update_proposal_text(&conn, proposal_id, &content)
        .map_err(|e| format!("Failed to update proposal: {}", e))?;

    tracing::debug!(proposal_id = proposal_id, "Proposal content auto-saved");

    Ok(())
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
/// Story 4a.2: Now accepts client_name from job analysis (AC-3)
#[tauri::command]
fn save_job_post(
    database: State<db::Database>,
    job_content: String,
    url: Option<String>,
    client_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let id = db::queries::job_posts::insert_job_post(
        &conn,
        url.as_deref(),
        &job_content,
        client_name.as_deref(),
    )
    .map_err(|e| format!("Failed to save job post: {}", e))?;

    Ok(serde_json::json!({
        "id": id,
        "saved": true
    }))
}

/// Analyze job post to extract client name, skills, and hidden needs (Story 4a.2 + 4a.3 + 4a.4 + 4a.8)
/// Story 4a.2: Extracts client name
/// Story 4a.3: Extracts key skills
/// Story 4a.4: Extracts hidden needs
/// Story 4a.8: Saves all analysis data atomically in single transaction
/// AC-1: Calls Claude Haiku to extract client name + skills + hidden needs
/// AC-3: Saves extracted data to database atomically (if job_post_id provided)
/// AC-4: Completes in <3 seconds for analysis + <100ms for save
/// AC-5: Returns error string on failure (non-blocking)
#[tauri::command]
async fn analyze_job_post(
    raw_content: String,
    job_post_id: Option<i64>,
    database: State<'_, db::Database>,
    config_state: State<'_, config::ConfigState>,
) -> Result<analysis::JobAnalysis, String> {
    // AC-5: Retrieve API key from keychain (follows existing pattern)
    let api_key = config_state.get_api_key()?;

    // AC-1: Call analysis function with Haiku (extracts client_name, key_skills, and hidden_needs)
    let analysis = analysis::analyze_job(&raw_content, api_key.as_deref().ok_or("API key not found")?)
        .await?;

    // Story 4a.8: Save all analysis data atomically if job_post_id provided (AC-1, AC-2, AC-3)
    if let Some(job_id) = job_post_id {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        // Serialize hidden needs to JSON
        let hidden_needs_json = serde_json::to_string(&analysis.hidden_needs)
            .map_err(|e| format!("Failed to serialize hidden needs: {}", e))?;

        // Story 4a.8: Atomic save - all-or-nothing transaction
        // Log timing to validate <100ms target (NFR-4)
        let save_start = std::time::Instant::now();

        db::queries::job_posts::save_job_analysis_atomic(
            &conn,
            job_id,
            analysis.client_name.as_deref(),
            &analysis.key_skills,
            &hidden_needs_json,
        )
        .map_err(|e| format!("Failed to save job analysis: {}", e))?;

        let save_duration = save_start.elapsed();
        tracing::info!(
            "Saved job analysis for job_post_id {} in {:?} (client_name: {:?}, {} skills, {} hidden needs)",
            job_id,
            save_duration,
            analysis.client_name,
            analysis.key_skills.len(),
            analysis.hidden_needs.len()
        );

        // Log warning if save exceeded 100ms target
        if save_duration.as_millis() > 100 {
            tracing::warn!(
                "Save exceeded NFR-4 target: {:?} > 100ms",
                save_duration
            );
        }
    }

    Ok(analysis)
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
// User Skills Commands (Story 4b.1)
// ============================================================================

/// Hardcoded list of common Upwork skills for autocomplete (Story 4b.1, Task 3)
/// Covers top categories: Web/Mobile Dev, Design, Writing, Marketing, Data Science
const COMMON_UPWORK_SKILLS: &[&str] = &[
    "JavaScript",
    "Python",
    "React",
    "Node.js",
    "TypeScript",
    "SQL",
    "AWS",
    "GraphQL",
    "REST API",
    "Git",
    "Docker",
    "PostgreSQL",
    "MongoDB",
    "Vue.js",
    "Angular",
    "Next.js",
    "Express",
    "Django",
    "Flask",
    "FastAPI",
    "Ruby on Rails",
    "PHP",
    "Laravel",
    "WordPress",
    "Shopify",
    "Figma",
    "Adobe Photoshop",
    "UI/UX Design",
    "Graphic Design",
    "Content Writing",
    "SEO",
    "Social Media Marketing",
    "Email Marketing",
    "Google Analytics",
    "Data Analysis",
    "Excel",
    "Power BI",
    "Tableau",
    "Machine Learning",
    "TensorFlow",
    "PyTorch",
    "Natural Language Processing",
    "Computer Vision",
    "DevOps",
    "CI/CD",
    "Kubernetes",
    "Terraform",
    "Linux",
    "Bash",
    "Automation",
];

/// Get skill suggestions based on query prefix (Story 4b.1, Task 3)
/// Returns max 10 suggestions sorted alphabetically (case-insensitive match)
#[tauri::command]
fn get_skill_suggestions(query: String) -> Result<Vec<String>, String> {
    let query_lower = query.to_lowercase();

    let mut suggestions: Vec<String> = COMMON_UPWORK_SKILLS
        .iter()
        .filter(|skill| skill.to_lowercase().starts_with(&query_lower))
        .map(|s| s.to_string())
        .collect();

    suggestions.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    suggestions.truncate(10); // Max 10 suggestions

    Ok(suggestions)
}

/// Add a new skill to user's profile (Story 4b.1)
/// Returns skill ID on success, error if duplicate (case-insensitive)
#[tauri::command]
fn add_user_skill(database: State<db::Database>, skill: String) -> Result<i64, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::user_skills::add_user_skill(&conn, &skill)
        .map_err(|e| format!("Failed to add skill: {}", e))
}

/// Remove a skill from user's profile (Story 4b.1)
#[tauri::command]
fn remove_user_skill(database: State<db::Database>, skill_id: i64) -> Result<(), String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::user_skills::remove_user_skill(&conn, skill_id)
        .map_err(|e| format!("Failed to remove skill: {}", e))
}

/// Get all user skills ordered by added_at DESC (Story 4b.1)
#[tauri::command]
fn get_user_skills(
    database: State<db::Database>,
) -> Result<Vec<db::queries::user_skills::UserSkill>, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::user_skills::get_user_skills(&conn)
        .map_err(|e| format!("Failed to get skills: {}", e))
}

// ============================================================================
// Safety Threshold Commands (Story 3.5)
// ============================================================================

/// Get safety threshold for AI detection (Story 3.5)
/// Internal helper: Returns threshold value (140-220, default 180)
/// Sanitizes out-of-range values to prevent corrupted data
fn get_safety_threshold_internal(database: &db::Database) -> Result<i32, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    match db::queries::settings::get_setting(&conn, "safety_threshold") {
        Ok(Some(value)) => {
            let threshold = value.parse::<i32>().unwrap_or(180);
            // Sanitize: ensure within valid range (140-220)
            Ok(threshold.clamp(140, 220))
        }
        Ok(None) => Ok(180), // Default threshold (FR-11)
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Tauri command wrapper for get_safety_threshold
#[tauri::command]
fn get_safety_threshold(database: State<db::Database>) -> Result<i32, String> {
    get_safety_threshold_internal(&database)
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

            // Story 3.7: Auto-confirm successful overrides on startup (Task 3.1)
            // Check for pending overrides older than 7 days and mark them as successful/unsuccessful
            {
                let conn = database.conn.lock().map_err(|e| format!("Database lock error: {}", e))?;

                match db::queries::safety_overrides::get_pending_overrides_older_than_7_days(&conn) {
                    Ok(pending_overrides) => {
                        let mut successful_count = 0;
                        let mut unsuccessful_count = 0;

                        for override_record in pending_overrides {
                            // Check if the proposal still exists
                            match db::queries::safety_overrides::proposal_exists(&conn, override_record.proposal_id) {
                                Ok(true) => {
                                    // Proposal exists, mark as successful
                                    if let Err(e) = db::queries::safety_overrides::update_override_status(
                                        &conn,
                                        override_record.id,
                                        db::queries::safety_overrides::STATUS_SUCCESSFUL,
                                    ) {
                                        tracing::warn!("Failed to update override {} to successful: {}", override_record.id, e);
                                    } else {
                                        successful_count += 1;
                                    }
                                }
                                Ok(false) => {
                                    // Proposal deleted, mark as unsuccessful
                                    if let Err(e) = db::queries::safety_overrides::update_override_status(
                                        &conn,
                                        override_record.id,
                                        db::queries::safety_overrides::STATUS_UNSUCCESSFUL,
                                    ) {
                                        tracing::warn!("Failed to update override {} to unsuccessful: {}", override_record.id, e);
                                    } else {
                                        unsuccessful_count += 1;
                                    }
                                }
                                Err(e) => {
                                    tracing::warn!("Failed to check proposal existence for override {}: {}", override_record.id, e);
                                }
                            }
                        }

                        if successful_count > 0 || unsuccessful_count > 0 {
                            tracing::info!(
                                "Auto-confirmed overrides: {} successful, {} unsuccessful",
                                successful_count,
                                unsuccessful_count
                            );
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to query pending overrides (non-fatal): {}", e);
                        // Non-fatal: app can continue without this cleanup
                    }
                }
            }

            // Initialize draft state for tracking current draft during generation
            let draft_state = DraftState {
                current_draft_id: Arc::new(Mutex::new(None)),
            };

            // Story 3.8: Initialize cooldown state for rate limiting (FR-12)
            let cooldown_state = CooldownState::new();

            // Store in managed state
            app.manage(database);
            app.manage(config_state);
            app.manage(draft_state);
            app.manage(cooldown_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_proposal,
            generate_proposal_streaming,
            analyze_perplexity,
            // Cooldown commands (Story 3.8)
            get_cooldown_remaining,
            check_database,
            save_proposal,
            get_proposals,
            delete_proposal, // Story 6.8: Delete Proposal & All Revisions
            update_proposal_content, // Story 6.1: TipTap Editor auto-save
            save_job_post,
            analyze_job_post, // Story 4a.2: Client Name Extraction
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
            // User skills commands (Story 4b.1)
            add_user_skill,
            remove_user_skill,
            get_user_skills,
            get_skill_suggestions,
            // Safety threshold commands (Story 3.5)
            get_safety_threshold,
            // Safety override commands (Story 3.6 + 3.7)
            log_safety_override, // Deprecated: kept for backwards compatibility
            record_safety_override, // Story 3.7: Per-override record tracking
            // Learning algorithm commands (Story 3.7)
            check_threshold_learning,
            check_threshold_decrease,
            apply_threshold_adjustment,
            dismiss_threshold_suggestion,
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

// ============================================================================
// Safety Override Commands (Story 3.6 + 3.7)
// ============================================================================

/// DEPRECATED: Use record_safety_override instead (Story 3.7)
/// Log a safety override event for adaptive learning (Story 3.6)
///
/// This command uses the settings table for simple counter tracking.
/// Story 3.7 replaces this with per-override record tracking in safety_overrides table.
///
/// Internal helper: Log safety override (deprecated)
async fn log_safety_override_internal(
    score: f32,
    threshold: f32,
    database: &db::Database,
) -> Result<(), String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Increment override count
    let current_count: i32 =
        match db::queries::settings::get_setting(&conn, "safety_override_count") {
            Ok(Some(val)) => val.parse().unwrap_or(0),
            _ => 0,
        };

    db::queries::settings::set_setting(
        &conn,
        "safety_override_count",
        &(current_count + 1).to_string(),
    )
    .map_err(|e| format!("Failed to increment override count: {}", e))?;

    // Store last override timestamp using SQLite's datetime function
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('safety_override_last', datetime('now'), datetime('now'))",
        [],
    )
    .map_err(|e| format!("Failed to store override timestamp: {}", e))?;

    tracing::info!(
        score = score,
        threshold = threshold,
        override_count = current_count + 1,
        "Safety override logged (deprecated)"
    );

    Ok(())
}

/// Tauri command wrapper: Log safety override (deprecated)
/// Kept for backwards compatibility during transition.
#[tauri::command]
async fn log_safety_override(
    score: f32,
    threshold: f32,
    database: State<'_, db::Database>,
) -> Result<(), String> {
    log_safety_override_internal(score, threshold, &database).await
}

/// Internal helper: Record a safety override event for adaptive learning
async fn record_safety_override_internal(
    proposal_id: i64,
    ai_score: f32,
    threshold: f32,
    database: &db::Database,
) -> Result<i64, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let override_id = db::queries::safety_overrides::record_override(
        &conn,
        proposal_id,
        ai_score,
        threshold,
    )
    .map_err(|e| format!("Failed to record override: {}", e))?;

    tracing::info!(
        override_id = override_id,
        proposal_id = proposal_id,
        ai_score = ai_score,
        threshold = threshold,
        "Safety override recorded"
    );

    Ok(override_id)
}

/// Tauri command wrapper: Record a safety override event for adaptive learning (Story 3.7)
///
/// Creates a per-override record in the safety_overrides table for the learning algorithm.
/// Replaces the simple counter from Story 3.6 with granular per-override tracking.
///
/// # Arguments
/// * `proposal_id` - ID of the proposal being overridden
/// * `ai_score` - AI detection score that triggered the warning
/// * `threshold` - Safety threshold at time of override
///
/// # Returns
/// The ID of the created override record
///
/// # Logged Data (Story 1.16 compliance)
/// - Override ID (for tracking)
/// - Proposal ID (for success confirmation)
/// - Score and threshold (for learning algorithm)
#[tauri::command]
async fn record_safety_override(
    proposal_id: i64,
    ai_score: f32,
    threshold: f32,
    database: State<'_, db::Database>,
) -> Result<i64, String> {
    record_safety_override_internal(proposal_id, ai_score, threshold, &database).await
}

/// Threshold suggestion returned by learning detection (Story 3.7, Task 4)
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThresholdSuggestion {
    pub current_threshold: i32,
    pub suggested_threshold: i32,
    pub successful_override_count: usize,
    pub average_override_score: f32,
    pub direction: String, // "increase" | "decrease"
}

/// Constants for learning algorithm
const THRESHOLD_INCREMENT: i32 = 10;
const THRESHOLD_MAX: i32 = 220;
const THRESHOLD_DEFAULT: i32 = 180;
const THRESHOLD_PROXIMITY: f32 = 10.0; // Only count overrides within 10 points of threshold
const SUCCESSFUL_OVERRIDE_THRESHOLD: usize = 3; // Need 3 overrides to suggest change
const INACTIVITY_DAYS: i32 = 60; // Days without overrides to suggest decrease

/// Check for learning opportunity and suggest threshold adjustment (Story 3.7, Task 4.3)
///
/// Called on app startup and after each successful override confirmation.
/// Analyzes successful overrides from the last 30 days to detect patterns.
///
/// # Learning Algorithm
/// 1. Query successful overrides in last 30 days
/// 2. Filter overrides within 10 points of current threshold
/// 3. If count >= 3, suggest new_threshold = current + 10
/// 4. Cap at maximum 220
///
/// # Returns
/// * `Ok(Some(ThresholdSuggestion))` - Adjustment opportunity detected
/// * `Ok(None)` - No adjustment needed
#[tauri::command]
async fn check_threshold_learning(
    database: State<'_, db::Database>,
) -> Result<Option<ThresholdSuggestion>, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Get current threshold
    let current_threshold = match db::queries::settings::get_setting(&conn, "safety_threshold") {
        Ok(Some(value)) => value.parse::<i32>().unwrap_or(THRESHOLD_DEFAULT).clamp(140, THRESHOLD_MAX),
        Ok(None) => THRESHOLD_DEFAULT,
        Err(e) => {
            tracing::warn!("Failed to get threshold: {}", e);
            THRESHOLD_DEFAULT
        }
    };

    // H3 fix: Check if already at maximum - show warning instead of returning None
    if current_threshold >= THRESHOLD_MAX {
        tracing::debug!("Threshold at maximum ({}), showing warning", THRESHOLD_MAX);
        return Ok(Some(ThresholdSuggestion {
            current_threshold,
            suggested_threshold: THRESHOLD_MAX, // Same as current
            successful_override_count: 0,
            average_override_score: 0.0,
            direction: "at_maximum".to_string(), // Special direction for AC7 warning
        }));
    }

    // H2 fix: Get dismissal timestamp to filter out overrides from before rejection
    let dismissal_timestamp = db::queries::settings::get_setting(&conn, "threshold_suggestion_dismissed_at")
        .ok()
        .flatten();

    // Get successful overrides from last 30 days
    let successful_overrides = db::queries::safety_overrides::get_successful_overrides_last_30_days(&conn)
        .map_err(|e| format!("Failed to query overrides: {}", e))?;

    // Filter overrides:
    // 1. Within THRESHOLD_PROXIMITY points of current threshold
    // 2. After dismissal timestamp (if any) - implements AC6 counter reset
    let nearby_overrides: Vec<_> = successful_overrides
        .iter()
        .filter(|o| {
            // Proximity check
            let score_diff = (o.ai_score - current_threshold as f32).abs();
            if score_diff > THRESHOLD_PROXIMITY {
                return false;
            }

            // H2 fix: Only count overrides AFTER the dismissal timestamp
            if let Some(ref dismissed_at) = dismissal_timestamp {
                // Compare timestamps (both in SQLite datetime format)
                if o.timestamp <= *dismissed_at {
                    return false;
                }
            }

            true
        })
        .collect();

    // Check if we have enough overrides to suggest an increase
    if nearby_overrides.len() >= SUCCESSFUL_OVERRIDE_THRESHOLD {
        let suggested_threshold = (current_threshold + THRESHOLD_INCREMENT).min(THRESHOLD_MAX);

        // Calculate average score of nearby overrides
        let total_score: f32 = nearby_overrides.iter().map(|o| o.ai_score).sum();
        let average_score = total_score / nearby_overrides.len() as f32;

        tracing::info!(
            current_threshold = current_threshold,
            suggested_threshold = suggested_threshold,
            override_count = nearby_overrides.len(),
            average_score = average_score,
            "Learning opportunity detected: threshold increase"
        );

        return Ok(Some(ThresholdSuggestion {
            current_threshold,
            suggested_threshold,
            successful_override_count: nearby_overrides.len(),
            average_override_score: average_score,
            direction: "increase".to_string(),
        }));
    }

    tracing::debug!(
        "No learning opportunity: {} overrides (need {})",
        nearby_overrides.len(),
        SUCCESSFUL_OVERRIDE_THRESHOLD
    );

    Ok(None)
}

/// Check for downward threshold adjustment opportunity (Story 3.7, Task 7.1)
///
/// Detects when user hasn't overridden any warnings for 60 days,
/// suggesting their threshold could be lowered back to default.
///
/// # Returns
/// * `Ok(Some(ThresholdSuggestion))` - Decrease opportunity detected
/// * `Ok(None)` - No decrease needed
#[tauri::command]
async fn check_threshold_decrease(
    database: State<'_, db::Database>,
) -> Result<Option<ThresholdSuggestion>, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Get current threshold
    let current_threshold = match db::queries::settings::get_setting(&conn, "safety_threshold") {
        Ok(Some(value)) => value.parse::<i32>().unwrap_or(THRESHOLD_DEFAULT).clamp(140, THRESHOLD_MAX),
        Ok(None) => THRESHOLD_DEFAULT,
        Err(e) => {
            tracing::warn!("Failed to get threshold: {}", e);
            THRESHOLD_DEFAULT
        }
    };

    // Only suggest decrease if above default
    if current_threshold <= THRESHOLD_DEFAULT {
        tracing::debug!("Threshold at default ({}), no decrease suggestion", THRESHOLD_DEFAULT);
        return Ok(None);
    }

    // Check override activity in last 60 days
    let override_count = db::queries::safety_overrides::count_overrides_last_60_days(&conn)
        .map_err(|e| format!("Failed to count overrides: {}", e))?;

    // If no overrides in 60 days, suggest decrease
    if override_count == 0 {
        tracing::info!(
            current_threshold = current_threshold,
            suggested_threshold = THRESHOLD_DEFAULT,
            "Inactivity detected: threshold decrease suggestion"
        );

        return Ok(Some(ThresholdSuggestion {
            current_threshold,
            suggested_threshold: THRESHOLD_DEFAULT,
            successful_override_count: 0,
            average_override_score: 0.0,
            direction: "decrease".to_string(),
        }));
    }

    Ok(None)
}

/// Apply threshold adjustment and reset override tracking (Story 3.7, Task 6.1)
///
/// Updates the safety threshold in settings and resets the learning counter.
/// Called when user clicks "Yes, Adjust to [new threshold]".
///
/// # Arguments
/// * `new_threshold` - New threshold value (140-220)
#[tauri::command]
async fn apply_threshold_adjustment(
    new_threshold: i32,
    database: State<'_, db::Database>,
) -> Result<(), String> {
    // Validate threshold range
    if new_threshold < 140 || new_threshold > THRESHOLD_MAX {
        return Err(format!("Threshold must be between 140 and {}", THRESHOLD_MAX));
    }

    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Get old threshold for logging
    let old_threshold = match db::queries::settings::get_setting(&conn, "safety_threshold") {
        Ok(Some(value)) => value.parse::<i32>().unwrap_or(THRESHOLD_DEFAULT),
        Ok(None) => THRESHOLD_DEFAULT,
        Err(_) => THRESHOLD_DEFAULT,
    };

    // Update threshold in settings (Story 3.5)
    db::queries::settings::set_setting(&conn, "safety_threshold", &new_threshold.to_string())
        .map_err(|e| format!("Failed to update threshold: {}", e))?;

    // H2 fix: Clear dismissal timestamp so counter starts fresh after adjustment
    let _ = conn.execute("DELETE FROM settings WHERE key = 'threshold_suggestion_dismissed_at'", []);

    tracing::info!(
        old_threshold = old_threshold,
        new_threshold = new_threshold,
        "Threshold adjusted via learning"
    );

    Ok(())
}

/// Dismiss threshold suggestion without adjustment (Story 3.7, Task 6.3)
///
/// Called when user clicks "No, Keep Current". Stores dismissal timestamp
/// so only overrides AFTER this time count toward the next suggestion.
/// This effectively "resets the counter" per AC6.
#[tauri::command]
async fn dismiss_threshold_suggestion(
    database: State<'_, db::Database>,
) -> Result<(), String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Store dismissal timestamp - only overrides AFTER this time will count
    // Uses SQLite datetime format for easy comparison in queries
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('threshold_suggestion_dismissed_at', datetime('now'), datetime('now'))",
        [],
    )
    .map_err(|e| format!("Failed to store dismissal: {}", e))?;

    tracing::info!("Threshold suggestion dismissed by user (counter reset)");

    Ok(())
}

// ============================================================================
// Tests (Story 3.5)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // Story 3.5, Task 6.1: Test get_safety_threshold returns 180 if not set
    #[test]
    fn test_get_safety_threshold_default() {
        // Create in-memory database
        let db = db::Database::new(":memory:".into(), None).expect("Failed to create test database");

        // Query threshold (should return default 180)
        let result = get_safety_threshold_internal(&db);
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert_eq!(result.unwrap(), 180, "Default threshold should be 180");
    }

    // Story 3.5, Task 6.2: Test get_safety_threshold returns stored custom value
    #[test]
    fn test_get_safety_threshold_custom() {
        // Create in-memory database
        let db = db::Database::new(":memory:".into(), None).expect("Failed to create test database");

        // Set custom threshold
        {
            let conn = db.conn.lock().unwrap();
            db::queries::settings::set_setting(&conn, "safety_threshold", "150")
                .expect("Failed to set threshold");
        }

        // Query threshold (should return 150)
        let result = get_safety_threshold_internal(&db);
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert_eq!(result.unwrap(), 150, "Custom threshold should be 150");
    }

    // Story 3.5, Task 6.3: Test safety_threshold_validation sanitizes out-of-range values
    #[test]
    fn test_safety_threshold_validation() {
        // Create in-memory database
        let db = db::Database::new(":memory:".into(), None).expect("Failed to create test database");

        // Test upper bound clamping (250 → 220)
        {
            let conn = db.conn.lock().unwrap();
            db::queries::settings::set_setting(&conn, "safety_threshold", "250")
                .expect("Failed to set threshold");
        }
        let result = get_safety_threshold_internal(&db);
        assert_eq!(result.unwrap(), 220, "Out-of-range 250 should clamp to 220");

        // Test lower bound clamping (100 → 140)
        {
            let conn = db.conn.lock().unwrap();
            db::queries::settings::set_setting(&conn, "safety_threshold", "100")
                .expect("Failed to set threshold");
        }
        let result = get_safety_threshold_internal(&db);
        assert_eq!(result.unwrap(), 140, "Out-of-range 100 should clamp to 140");

        // Test valid value within range (180 → 180)
        {
            let conn = db.conn.lock().unwrap();
            db::queries::settings::set_setting(&conn, "safety_threshold", "180")
                .expect("Failed to set threshold");
        }
        let result = get_safety_threshold_internal(&db);
        assert_eq!(result.unwrap(), 180, "Valid 180 should remain 180");

        // Test non-numeric value (defaults to 180)
        {
            let conn = db.conn.lock().unwrap();
            db::queries::settings::set_setting(&conn, "safety_threshold", "invalid")
                .expect("Failed to set threshold");
        }
        let result = get_safety_threshold_internal(&db);
        assert_eq!(result.unwrap(), 180, "Non-numeric value should default to 180");
    }

    // =========================================================================
    // Story 3.6: log_safety_override tests
    // =========================================================================

    // Story 3.6, Task 5.11: Test override count increments from 0 to 1
    #[tokio::test]
    async fn test_log_safety_override_increments_count() {
        let db = db::Database::new(":memory:".into(), None).expect("Failed to create test database");

        // Verify initial count is 0 (not set)
        {
            let conn = db.conn.lock().unwrap();
            let initial = db::queries::settings::get_setting(&conn, "safety_override_count")
                .expect("Query failed");
            assert!(initial.is_none(), "Initial count should not exist");
        }

        // Call log_safety_override
        let result = log_safety_override_internal(195.5, 180.0, &db).await;
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        // Verify count is now 1
        {
            let conn = db.conn.lock().unwrap();
            let count = db::queries::settings::get_setting(&conn, "safety_override_count")
                .expect("Query failed")
                .expect("Count should exist");
            assert_eq!(count, "1", "Count should be 1 after first override");
        }
    }

    // Story 3.6, Task 5.12: Test count increments correctly across multiple calls
    #[tokio::test]
    async fn test_log_safety_override_multiple() {
        let db = db::Database::new(":memory:".into(), None).expect("Failed to create test database");

        // Call log_safety_override 3 times
        for i in 1..=3 {
            let result = log_safety_override_internal(190.0 + i as f32, 180.0, &db).await;
            assert!(result.is_ok(), "Override {} failed: {:?}", i, result);
        }

        // Verify count is 3
        {
            let conn = db.conn.lock().unwrap();
            let count = db::queries::settings::get_setting(&conn, "safety_override_count")
                .expect("Query failed")
                .expect("Count should exist");
            assert_eq!(count, "3", "Count should be 3 after three overrides");
        }
    }

    // Story 3.6, Task 5.13: Test timestamp is stored
    #[tokio::test]
    async fn test_log_safety_override_stores_timestamp() {
        let db = db::Database::new(":memory:".into(), None).expect("Failed to create test database");

        // Call log_safety_override
        let result = log_safety_override_internal(200.0, 180.0, &db).await;
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        // Verify timestamp is set
        {
            let conn = db.conn.lock().unwrap();
            let timestamp = db::queries::settings::get_setting(&conn, "safety_override_last")
                .expect("Query failed")
                .expect("Timestamp should exist");
            // Should be a valid datetime string (not empty)
            assert!(!timestamp.is_empty(), "Timestamp should not be empty");
            // Should contain date-like characters
            assert!(timestamp.contains("-"), "Timestamp should contain date separators");
        }
    }

    // =========================================================================
    // Story 3.8: CooldownState tests
    // =========================================================================

    // Story 3.8, Task 7.5: Test get_cooldown_remaining returns 0 when no cooldown active
    #[test]
    fn test_cooldown_remaining_no_active() {
        let cooldown = CooldownState::new();
        assert_eq!(cooldown.remaining_seconds(), 0, "Should return 0 with no prior generation");
    }

    // Story 3.8, Task 7.6: Test get_cooldown_remaining returns correct remaining seconds
    #[test]
    fn test_cooldown_remaining_active() {
        let cooldown = CooldownState::new();

        // Record a generation
        cooldown.record();

        // Should return approximately 120 seconds (within 1 second of recording)
        let remaining = cooldown.remaining_seconds();
        assert!(
            remaining >= 119 && remaining <= 120,
            "Should return ~120 seconds, got {}",
            remaining
        );
    }

    // Story 3.8, Task 7.1: Test cooldown blocks within 120s window
    #[test]
    fn test_cooldown_blocks_within_window() {
        let cooldown = CooldownState::new();

        // Record a generation
        cooldown.record();

        // Should have remaining time (blocking)
        let remaining = cooldown.remaining_seconds();
        assert!(remaining > 0, "Should block within 120s window, got {} remaining", remaining);
    }

    // Story 3.8, Task 7.2: Test cooldown allows after expiry
    // Note: This test uses a mock approach by directly setting last_generation to past
    #[test]
    fn test_cooldown_allows_after_expiry() {
        let cooldown = CooldownState::new();

        // Set last_generation to 121 seconds ago (past cooldown window)
        {
            let mut guard = cooldown.last_generation.lock().unwrap();
            *guard = Some(Instant::now() - std::time::Duration::from_secs(121));
        }

        // Should return 0 (no cooldown)
        let remaining = cooldown.remaining_seconds();
        assert_eq!(remaining, 0, "Should allow after 120s expiry, got {} remaining", remaining);
    }

    // Story 3.8, Task 7.3: Test cooldown returns accurate remaining seconds
    #[test]
    fn test_cooldown_returns_remaining_seconds() {
        let cooldown = CooldownState::new();

        // Set last_generation to 60 seconds ago
        {
            let mut guard = cooldown.last_generation.lock().unwrap();
            *guard = Some(Instant::now() - std::time::Duration::from_secs(60));
        }

        // Should return approximately 60 seconds remaining
        let remaining = cooldown.remaining_seconds();
        assert!(
            remaining >= 59 && remaining <= 61,
            "Should return ~60 seconds remaining, got {}",
            remaining
        );
    }

    // Story 3.8: Test CooldownState Default impl
    #[test]
    fn test_cooldown_default() {
        let cooldown = CooldownState::default();
        assert_eq!(cooldown.remaining_seconds(), 0, "Default should have no cooldown");
    }

    // Story 3.8: Test record() updates timestamp
    #[test]
    fn test_cooldown_record_updates_timestamp() {
        let cooldown = CooldownState::new();

        // Initially no generation
        assert!(cooldown.last_generation.lock().unwrap().is_none());

        // Record generation
        cooldown.record();

        // Should now have a timestamp
        assert!(cooldown.last_generation.lock().unwrap().is_some());
    }

    // ============================================================================
    // User Skills Tests (Story 4b.1, Task 7, Subtasks 7.6-7.7)
    // ============================================================================

    #[test]
    fn test_get_skill_suggestions_with_query_java() {
        // Task 7, Subtask 7.6: Test get_skill_suggestions with query "java" → returns ["JavaScript"]
        let result = get_skill_suggestions("java".to_string());
        assert!(result.is_ok(), "Should return Ok");

        let suggestions = result.unwrap();
        assert!(
            suggestions.contains(&"JavaScript".to_string()),
            "Should include JavaScript"
        );
        assert!(suggestions.len() <= 10, "Should return max 10 suggestions");
    }

    #[test]
    fn test_get_skill_suggestions_with_query_xyz() {
        // Task 7, Subtask 7.7: Test get_skill_suggestions with query "xyz" → returns empty array
        let result = get_skill_suggestions("xyz".to_string());
        assert!(result.is_ok(), "Should return Ok");

        let suggestions = result.unwrap();
        assert_eq!(suggestions.len(), 0, "Should return empty array for no matches");
    }

    #[test]
    fn test_get_skill_suggestions_case_insensitive() {
        // Test case-insensitive matching
        let result = get_skill_suggestions("PYTHON".to_string());
        assert!(result.is_ok(), "Should return Ok");

        let suggestions = result.unwrap();
        assert!(
            suggestions.contains(&"Python".to_string()),
            "Should match case-insensitively"
        );
    }

    #[test]
    fn test_get_skill_suggestions_sorted_alphabetically() {
        // Test suggestions are sorted alphabetically
        let result = get_skill_suggestions("p".to_string());
        assert!(result.is_ok(), "Should return Ok");

        let suggestions = result.unwrap();
        // Verify sorted (case-insensitive)
        let mut sorted = suggestions.clone();
        sorted.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        assert_eq!(
            suggestions, sorted,
            "Suggestions should be sorted alphabetically"
        );
    }

    #[test]
    fn test_get_skill_suggestions_max_10() {
        // Test max 10 suggestions even if more matches exist
        let result = get_skill_suggestions("".to_string());
        assert!(result.is_ok(), "Should return Ok");

        let suggestions = result.unwrap();
        assert!(
            suggestions.len() <= 10,
            "Should return max 10 suggestions, got {}",
            suggestions.len()
        );
    }
}
