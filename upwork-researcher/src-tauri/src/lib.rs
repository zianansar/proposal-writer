// Architecture requirement AR-21: No unwrap() in production code
// NOTE: Using warn (not deny) until 8 pre-existing unwrap() calls are fixed
// TODO: Upgrade to #![deny(clippy::unwrap_used)] after fixing: claude.rs:473,503 rss.rs:634 migration/mod.rs:500-502 lib.rs:206,222
#![warn(clippy::unwrap_used)]

pub mod ab_testing;
pub mod analysis;
pub mod archive;
pub mod archive_export;
pub mod archive_import;
pub mod backup;
pub mod claude;
pub mod commands;
pub mod config;
pub mod db;
pub mod events;
pub mod health_check;
pub mod http;
pub mod humanization;
pub mod job;
pub mod keychain;
pub mod logs;
pub mod migration;
pub mod network;
pub mod passphrase;
pub mod remote_config;
pub mod sanitization;
pub mod scoring;
pub mod voice;

// Encryption spike module (Story 1.6)
// Validates Argon2id key derivation and keyring integration for Epic 2
// SQLCipher validation deferred to Epic 2 (requires crate-wide feature migration)
#[cfg(test)]
pub mod encryption_spike;

use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, State};
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

// ============================================================================
// Voice Cache State (Story 5.8: Voice Profile Caching)
// ============================================================================

/// Voice profile cache for generation optimization (AR-5: Prompt Caching)
/// In-memory only — resets on app restart or manual invalidation
/// Story 5.8 Subtask 4.1: Cache to avoid repeated DB queries per generation
pub struct VoiceCache {
    pub cached_profile: Mutex<Option<voice::VoiceProfile>>,
    /// Timestamp of last cache update (for potential TTL support)
    pub cached_at: Mutex<Option<Instant>>,
}

impl Default for VoiceCache {
    fn default() -> Self {
        Self::new()
    }
}

impl VoiceCache {
    pub fn new() -> Self {
        Self {
            cached_profile: Mutex::new(None),
            cached_at: Mutex::new(None),
        }
    }

    /// Get cached voice profile (Subtask 4.3)
    /// Returns None if cache is empty or lock fails
    pub fn get(&self) -> Option<voice::VoiceProfile> {
        match self.cached_profile.lock() {
            Ok(guard) => guard.clone(),
            Err(poisoned) => {
                // M1 fix: Log warning instead of silently returning None
                tracing::warn!("VoiceCache mutex poisoned, recovering: {}", poisoned);
                poisoned.into_inner().clone()
            }
        }
    }

    /// Set cached voice profile (Subtask 4.2)
    pub fn set(&self, profile: voice::VoiceProfile) {
        match self.cached_profile.lock() {
            Ok(mut guard) => *guard = Some(profile),
            Err(poisoned) => {
                tracing::warn!("VoiceCache mutex poisoned during set, recovering");
                *poisoned.into_inner() = Some(profile);
            }
        }
        // Update cached_at timestamp
        match self.cached_at.lock() {
            Ok(mut guard) => *guard = Some(Instant::now()),
            Err(poisoned) => {
                *poisoned.into_inner() = Some(Instant::now());
            }
        }
    }

    /// Invalidate cache (Subtask 4.4)
    /// Called after recalibration (Story 5-4/5-7)
    pub fn invalidate(&self) {
        match self.cached_profile.lock() {
            Ok(mut guard) => *guard = None,
            Err(poisoned) => {
                tracing::warn!("VoiceCache mutex poisoned during invalidate, recovering");
                *poisoned.into_inner() = None;
            }
        }
        // Clear cached_at timestamp
        match self.cached_at.lock() {
            Ok(mut guard) => *guard = None,
            Err(poisoned) => {
                *poisoned.into_inner() = None;
            }
        }
    }

    /// Get cache age in seconds (for TTL checks)
    pub fn age_seconds(&self) -> Option<u64> {
        match self.cached_at.lock() {
            Ok(guard) => guard.map(|t| t.elapsed().as_secs()),
            Err(poisoned) => poisoned.into_inner().map(|t| t.elapsed().as_secs()),
        }
    }
}

// ============================================================================
// Blocked Requests State (Story 8.13: Network Allowlist Enforcement)
// ============================================================================

/// Blocked network request for debugging and transparency
#[derive(Debug, Clone, serde::Serialize)]
pub struct BlockedRequest {
    pub domain: String,
    pub url: String,
    pub timestamp: String,
}

/// In-memory tracking of blocked network requests (Story 8.13 Task 4.4)
/// Not persisted — debugging aid only
pub struct BlockedRequestsState {
    pub requests: Arc<Mutex<Vec<BlockedRequest>>>,
}

impl Default for BlockedRequestsState {
    fn default() -> Self {
        Self::new()
    }
}

impl BlockedRequestsState {
    pub fn new() -> Self {
        Self {
            requests: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn add(&self, domain: String, url: String) {
        let blocked_request = BlockedRequest {
            domain,
            url,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        const MAX_BLOCKED_ENTRIES: usize = 100;

        match self.requests.lock() {
            Ok(mut guard) => {
                if guard.len() >= MAX_BLOCKED_ENTRIES {
                    guard.remove(0); // Evict oldest entry
                }
                guard.push(blocked_request);
            }
            Err(poisoned) => {
                tracing::warn!("BlockedRequestsState mutex poisoned, recovering");
                let mut guard = poisoned.into_inner();
                if guard.len() >= MAX_BLOCKED_ENTRIES {
                    guard.remove(0);
                }
                guard.push(blocked_request);
            }
        }
    }

    pub fn get_all(&self) -> Vec<BlockedRequest> {
        match self.requests.lock() {
            Ok(guard) => guard.clone(),
            Err(poisoned) => {
                tracing::warn!("BlockedRequestsState mutex poisoned during read, recovering");
                poisoned.into_inner().clone()
            }
        }
    }
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
                COOLDOWN_SECONDS.saturating_sub(elapsed)
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
/// Task 4.2: Added AppHandle for network event emission
#[tauri::command]
async fn generate_proposal(
    job_content: String,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::AppDatabase>,
    cooldown: State<'_, CooldownState>,
) -> Result<String, String> {
    let database = database.get()?;
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

    // Story 5.8 Subtask 2.1: voice_profile parameter (loaded in Task 3)
    // Task 4.2: Pass AppHandle for network event emission
    let result = claude::generate_proposal_with_key(
        &job_content,
        api_key.as_deref(),
        &intensity,
        Some(&app_handle),
    )
    .await?;

    // Story 3.8: Record successful generation timestamp (after API call succeeds)
    cooldown.record();

    Ok(result)
}

/// Streaming proposal generation - emits tokens via Tauri events
/// Auto-saves draft every 50ms during generation (Story 1.14)
/// Story 3.3: Reads humanization intensity from settings and injects into prompt.
/// Story 3.8: Enforces cooldown rate limiting (FR-12).
/// Story 5.2 Subtask 5.7: Accepts hook strategy ID to customize generation prompt.
/// Story 10.4: If user_selected_strategy_id is None, A/B assigns a strategy via weighted random.
#[tauri::command]
async fn generate_proposal_streaming(
    job_content: String,
    _strategy_id: Option<i64>,
    user_selected_strategy_id: Option<String>,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::AppDatabase>,
    draft_state: State<'_, DraftState>,
    cooldown: State<'_, CooldownState>,
    voice_cache: State<'_, VoiceCache>, // Story 5.8 Subtask 4.1: Voice cache state
) -> Result<serde_json::Value, String> {
    let database = database.get()?;
    // Story 3.8: Check cooldown FIRST — before any API call (FR-12)
    let remaining = cooldown.remaining_seconds();
    if remaining > 0 {
        return Err(format!("RATE_LIMITED:{}", remaining));
    }

    let api_key = config_state.get_api_key()?;

    // Story 5.8 Subtask 3.3: Optimized parallel loading (AC-2)
    let load_start = std::time::Instant::now();

    // Story 5.8 Subtask 4.3: Check voice cache first (AC-6)
    let cached_profile = voice_cache.get();
    let use_cache = cached_profile.is_some();

    // Single lock acquisition for voice, intensity, and A/B strategy selection (Story 10.4)
    let (voice_profile, intensity, selected_hook_strategy_id, ab_assigned, ab_weight_at_assignment) = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        // Query 1: Voice profile (skip if cached)
        let voice_profile = if use_cache {
            tracing::debug!("Using cached voice profile");
            cached_profile
        } else {
            tracing::debug!("Voice cache miss, loading from database");
            let voice_profile_row = db::queries::voice_profile::get_voice_profile(&conn, "default")
                .map_err(|e| format!("Failed to get voice profile: {}", e))?;

            let profile_opt = voice_profile_row.as_ref().map(|row| row.to_voice_profile());

            if let Some(ref profile) = profile_opt {
                voice_cache.set(profile.clone());
                tracing::debug!("Voice profile cached");
            }

            profile_opt
        };

        // Query 2: Humanization intensity (always load fresh for settings changes)
        let intensity = db::queries::settings::get_setting(&conn, "humanization_intensity")
            .map_err(|e| format!("Failed to get humanization setting: {}", e))?
            .unwrap_or_else(|| "medium".to_string());

        // Story 10.4 Task 3: A/B strategy selection (AC-2, AC-3)
        let (selected_hook_strategy_id, ab_assigned, ab_weight_at_assignment) =
            if let Some(ref key) = user_selected_strategy_id {
                // AC-2: User explicit selection bypasses A/B
                tracing::info!(strategy = %key, "Using user-selected hook strategy (bypassing A/B)");
                (Some(key.clone()), false, None)
            } else {
                // Load strategies and apply weighted random A/B selection
                let strategies = db::queries::hook_strategies::get_all_hook_strategies(&conn)
                    .map_err(|e| format!("Failed to load hook strategies: {}", e))?;

                match ab_testing::select_hook_strategy_ab(&strategies) {
                    Ok((strategy_name, weight)) => {
                        tracing::info!(strategy = %strategy_name, weight = %weight, "A/B assigned hook strategy");
                        (Some(strategy_name), true, Some(weight))
                    }
                    Err(ab_testing::ABTestingError::NoActiveWeights) => {
                        // AC-6: All weights are 0.0 → emit toast, no A/B assignment
                        tracing::warn!("A/B testing: all strategy weights are 0.0, emitting fallback toast");
                        if let Err(e) = app_handle.emit("ab:no-active-weights", ()) {
                            tracing::warn!("Failed to emit ab:no-active-weights event: {}", e);
                        }
                        return Err("AB_NO_ACTIVE_WEIGHTS: No strategies are currently in A/B testing. Please select a strategy manually.".to_string());
                    }
                }
            };

        (voice_profile, intensity, selected_hook_strategy_id, ab_assigned, ab_weight_at_assignment)
    }; // Lock released here

    let load_elapsed = load_start.elapsed();
    tracing::debug!(elapsed_ms = load_elapsed.as_millis(), "Context loading complete");

    if let Some(ref profile) = voice_profile {
        tracing::info!(
            calibration_source = ?profile.calibration_source,
            sample_count = profile.sample_count,
            "Generating with calibrated voice profile"
        );
    } else {
        tracing::info!("Generating with default voice (no calibration)");
    }

    let result = claude::generate_proposal_streaming_with_key(
        &job_content,
        app_handle,
        api_key.as_deref(),
        database,
        &draft_state,
        &intensity,
        None, // rehumanization_attempt (Story TD-1)
    )
    .await?;

    // Story 3.8: Record successful generation timestamp (after API call succeeds)
    cooldown.record();

    // Story 10.4 AC-3: Return A/B metadata so frontend can pass to save_proposal
    Ok(serde_json::json!({
        "proposalText": result,
        "hookStrategyId": selected_hook_strategy_id,
        "abAssigned": ab_assigned,
        "abWeightAtAssignment": ab_weight_at_assignment,
    }))
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
    database: State<'_, db::AppDatabase>,
    draft_state: State<'_, DraftState>,
    cooldown: State<'_, CooldownState>,
) -> Result<serde_json::Value, String> {
    let database = database.get()?;
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

    // Story 5.8 Subtask 3.3: Load voice profile for regeneration
    let voice_profile_row = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;
        db::queries::voice_profile::get_voice_profile(&conn, "default")
            .map_err(|e| format!("Failed to get voice profile: {}", e))?
    };
    let _voice_profile = voice_profile_row.as_ref().map(|row| row.to_voice_profile());

    let generated_text = claude::generate_proposal_streaming_with_key(
        &job_content,
        app_handle,
        api_key.as_deref(),
        database,
        &draft_state,
        &escalated_str,
        None, // rehumanization_attempt (Story TD-1)
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
/// Task 4.2: Added AppHandle for network event emission
#[tauri::command]
async fn analyze_perplexity(
    text: String,
    threshold: i32,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
) -> Result<claude::PerplexityAnalysis, String> {
    let api_key = config_state.get_api_key()?;
    claude::analyze_perplexity_with_sentences(
        &text,
        threshold,
        api_key.as_deref(),
        Some(&app_handle),
    )
    .await
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

// ============================================================================
// Voice Cache Commands (Story 5.8: Voice Profile Caching)
// ============================================================================

/// Invalidate voice profile cache (Story 5.8 Subtask 4.4, AC-6)
/// Called after recalibration (Story 5-4/5-7) to force reload from database
#[tauri::command]
fn invalidate_voice_cache(voice_cache: State<VoiceCache>) {
    voice_cache.invalidate();
    tracing::info!("Voice profile cache invalidated");
}

/// Database health check - returns database path and status
#[tauri::command]
fn check_database(database: State<'_, db::AppDatabase>) -> Result<serde_json::Value, String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
    job_content: String,
    generated_text: String,
    hook_strategy_id: Option<String>,
    ab_assigned: Option<bool>,
    ab_weight_at_assignment: Option<f32>,
) -> Result<serde_json::Value, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let id = db::queries::proposals::insert_proposal_with_ab_context(
        &conn,
        &job_content,
        &generated_text,
        None,
        hook_strategy_id.as_deref(),
        None,
        ab_assigned.unwrap_or(false),
        ab_weight_at_assignment,
    )
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
    database: State<'_, db::AppDatabase>,
) -> Result<Vec<db::queries::proposals::ProposalSummary>, String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
) -> Result<serde_json::Value, String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
    content: String,
) -> Result<(), String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::proposals::update_proposal_text(&conn, proposal_id, &content)
        .map_err(|e| format!("Failed to update proposal: {}", e))?;

    tracing::debug!(proposal_id = proposal_id, "Proposal content auto-saved");

    Ok(())
}

/// Create a revision (Story 6.3: Proposal Revision History)
/// Called on auto-save from TipTap editor to track version history
/// Triggers archiving if revision count exceeds threshold (Story 6.7)
#[tauri::command]
async fn create_revision(
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
    content: String,
    revision_type: Option<String>,
) -> Result<i64, String> {
    let database = database.get()?;
    let mut conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let rev_type = revision_type.unwrap_or_else(|| "edit".to_string());

    let revision_id =
        db::queries::revisions::create_revision(&conn, proposal_id, &content, &rev_type, None)
            .map_err(|e| format!("Failed to create revision: {}", e))?;

    // Archive old revisions if threshold exceeded (AC1, AC4)
    // This is fast (<100ms) so we do it synchronously to avoid lifetime complications
    if let Err(e) = db::queries::revisions::archive_old_revisions(&mut conn, proposal_id) {
        // Log but don't fail the revision creation (AC4)
        tracing::warn!(
            proposal_id = proposal_id,
            error = %e,
            "Archiving failed after revision creation"
        );
    }

    Ok(revision_id)
}

/// Get revision summaries for history panel (Story 6.3)
#[tauri::command]
fn get_proposal_revisions(
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
) -> Result<Vec<db::queries::revisions::RevisionSummary>, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::revisions::get_revisions(&conn, proposal_id)
        .map_err(|e| format!("Failed to get revisions: {}", e))
}

/// Get full revision content for preview (Story 6.3)
#[tauri::command]
fn get_revision_content(
    database: State<'_, db::AppDatabase>,
    revision_id: i64,
) -> Result<db::queries::revisions::ProposalRevision, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::revisions::get_revision(&conn, revision_id)
        .map_err(|e| format!("Failed to get revision: {}", e))
}

/// Restore a previous revision (Story 6.3)
/// Creates a NEW revision with type='restore' and updates the proposal
/// Triggers archiving if revision count exceeds threshold (Story 6.7 fix)
#[tauri::command]
fn restore_revision(
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
    source_revision_id: i64,
) -> Result<i64, String> {
    let database = database.get()?;
    let mut conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Get the source revision content
    let source = db::queries::revisions::get_revision(&conn, source_revision_id)
        .map_err(|e| format!("Failed to get source revision: {}", e))?;

    // Create new "restore" revision
    let new_revision_id = db::queries::revisions::create_revision(
        &conn,
        proposal_id,
        &source.content,
        "restore",
        Some(source_revision_id),
    )
    .map_err(|e| format!("Failed to create restore revision: {}", e))?;

    // Archive old revisions if threshold exceeded (AC1 fix)
    if let Err(e) = db::queries::revisions::archive_old_revisions(&mut conn, proposal_id) {
        tracing::warn!(
            proposal_id = proposal_id,
            error = %e,
            "Archiving failed after restore revision creation"
        );
    }

    // Update the proposal's current content
    db::queries::proposals::update_proposal_text(&conn, proposal_id, &source.content)
        .map_err(|e| format!("Failed to update proposal: {}", e))?;

    tracing::info!(
        proposal_id = proposal_id,
        source_revision_id = source_revision_id,
        new_revision_id = new_revision_id,
        "Restored proposal to previous revision"
    );

    Ok(new_revision_id)
}

// ============================================================================
// Archived Revision Commands (Story 6-7: Archive Old Revisions)
// ============================================================================

/// Get archived revisions for a proposal (Story 6.7)
#[tauri::command]
async fn get_archived_revisions(
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
) -> Result<Vec<archive::ArchivedRevision>, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::revisions::get_archived_revisions(&conn, proposal_id)
        .map_err(|e| format!("Failed to get archived revisions: {}", e))
}

/// Get count of archived revisions (Story 6.7)
#[tauri::command]
async fn get_archived_revision_count(
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
) -> Result<i64, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::revisions::get_archived_revision_count(&conn, proposal_id)
        .map_err(|e| format!("Failed to get archived revision count: {}", e))
}

/// Restore an archived revision (Story 6.7)
/// Creates a new revision from archived content
/// Triggers archiving if revision count exceeds threshold (AC1 fix)
#[tauri::command]
async fn restore_archived_revision(
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
    archived_index: usize,
) -> Result<i64, String> {
    let database = database.get()?;
    let (new_revision_id, content) = {
        let mut conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        // Get archived revisions
        let archived = db::queries::revisions::get_archived_revisions(&conn, proposal_id)
            .map_err(|e| format!("Failed to get archived revisions: {}", e))?;

        let source = archived
            .get(archived_index)
            .ok_or_else(|| format!("Archived revision at index {} not found", archived_index))?;

        // Create new "restore" revision with archived content
        let new_revision_id = db::queries::revisions::create_revision(
            &conn,
            proposal_id,
            &source.content,
            "restore",
            Some(source.id), // Reference the original archived revision ID
        )
        .map_err(|e| format!("Failed to create restore revision: {}", e))?;

        // Archive old revisions if threshold exceeded (AC1 fix)
        if let Err(e) = db::queries::revisions::archive_old_revisions(&mut conn, proposal_id) {
            tracing::warn!(
                proposal_id = proposal_id,
                error = %e,
                "Archiving failed after archived restore revision creation"
            );
        }

        (new_revision_id, source.content.clone())
    }; // conn lock released here

    // Update proposal content
    {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        db::queries::proposals::update_proposal_text(&conn, proposal_id, &content)
            .map_err(|e| format!("Failed to update proposal: {}", e))?;
    }

    tracing::info!(
        proposal_id = proposal_id,
        archived_index = archived_index,
        new_revision_id = new_revision_id,
        "Restored proposal from archived revision"
    );

    Ok(new_revision_id)
}

/// Check for draft proposal from previous session (Story 1.14)
/// Returns the latest draft if exists, None otherwise
#[tauri::command]
fn check_for_draft(
    database: State<'_, db::AppDatabase>,
) -> Result<Option<db::queries::proposals::SavedProposal>, String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
    proposal_id: i64,
    status: String,
) -> Result<serde_json::Value, String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
    job_content: String,
    url: Option<String>,
    client_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
    config_state: State<'_, config::ConfigState>,
) -> Result<analysis::JobAnalysis, String> {
    let database = database.get()?;
    // AC-5: Retrieve API key from keychain (follows existing pattern)
    let api_key = config_state.get_api_key()?;

    // AC-1: Call analysis function with Haiku (extracts client_name, key_skills, and hidden_needs)
    let mut analysis =
        analysis::analyze_job(&raw_content, api_key.as_deref().ok_or("API key not found")?).await?;

    // Story 4b.4 Task 6: Extract budget and calculate alignment (Subtask 6.1-6.5)
    // Extract budget from job post
    let budget_info =
        analysis::extract_budget(&raw_content, api_key.as_deref().ok_or("API key not found")?)
            .await
            .unwrap_or_else(|e| {
                tracing::warn!("Budget extraction failed, defaulting to unknown: {}", e);
                analysis::BudgetInfo {
                    min: None,
                    max: None,
                    budget_type: "unknown".to_string(),
                }
            });

    // Get user rate configuration (Subtask 6.2)
    let user_rate_config = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        // Get hourly rate
        let hourly_rate = match db::queries::settings::get_setting(&conn, "user_hourly_rate") {
            Ok(Some(value)) => value.parse::<f64>().ok(),
            _ => None,
        };

        // Get project rate minimum
        let project_rate_min =
            match db::queries::settings::get_setting(&conn, "user_project_rate_min") {
                Ok(Some(value)) => value.parse::<f64>().ok(),
                _ => None,
            };

        RateConfig {
            hourly_rate,
            project_rate_min,
        }
    };

    // Calculate budget alignment (Subtask 6.3)
    let alignment = analysis::calculate_budget_alignment(&budget_info, &user_rate_config);

    // Update analysis with budget fields (Subtask 6.5)
    analysis.budget_min = budget_info.min;
    analysis.budget_max = budget_info.max;
    analysis.budget_type = budget_info.budget_type.clone();
    // H1 Fix: Include alignment in response for frontend (AC-2)
    analysis.budget_alignment_pct = alignment.percentage;
    analysis.budget_alignment_status = alignment.status.clone();

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
            tracing::warn!("Save exceeded NFR-4 target: {:?} > 100ms", save_duration);
        }

        // Story 4b.3: Store client quality score in job_scores table (AC-1)
        if let Some(score) = analysis.client_quality_score {
            db::queries::scoring::store_client_quality_score(&conn, job_id, Some(score))
                .map_err(|e| {
                    tracing::warn!("Failed to store client quality score: {}", e);
                    // Non-blocking: don't fail analysis if score storage fails
                    e
                })
                .ok(); // Swallow error — score storage is non-critical
            tracing::info!(
                "Stored client quality score {} for job_post_id {}",
                score,
                job_id
            );
        }

        // Story 4b.4: Save budget fields to database (AC-5, Subtask 6.4)
        db::queries::job_posts::update_job_post_budget(
            &conn,
            job_id,
            analysis.budget_min,
            analysis.budget_max,
            &analysis.budget_type,
            alignment.percentage,
            &alignment.status,
        )
        .map_err(|e| {
            tracing::warn!("Failed to store budget data: {}", e);
            // Non-blocking: don't fail analysis if budget storage fails (Subtask 6.6)
            e
        })
        .ok(); // Swallow error — budget storage is non-critical

        tracing::info!(
            "Stored budget data for job_post_id {}: type={}, min={:?}, alignment={}%",
            job_id,
            analysis.budget_type,
            analysis.budget_min,
            alignment
                .percentage
                .map_or("N/A".to_string(), |p| p.to_string())
        );

        // Story 4b.5 Review Fix: Store budget alignment score in job_scores table
        // This enables the weighted scoring formula to include the 20% budget component
        if let Some(pct) = alignment.percentage {
            db::queries::scoring::store_budget_alignment_score(&conn, job_id, Some(pct))
                .map_err(|e| {
                    tracing::warn!("Failed to store budget alignment score: {}", e);
                    e
                })
                .ok(); // Non-blocking
        }

        // Story 4b.5 Task 5.3: Calculate overall job score after analysis completes
        // Read component scores from job_scores table
        let job_score = db::queries::scoring::get_job_score(&conn, job_id)
            .ok()
            .flatten();

        let (skills_match, client_quality, budget_alignment_score) = match job_score {
            Some(score) => (
                score.skills_match_percentage,
                score.client_quality_score,
                score.budget_alignment_score,
            ),
            None => (None, None, None),
        };

        // Calculate overall score
        let scoring_result =
            scoring::calculate_overall_score(skills_match, client_quality, budget_alignment_score);

        // Store overall score and color flag
        db::queries::scoring::upsert_overall_score(
            &conn,
            job_id,
            scoring_result.overall_score,
            &scoring_result.color_flag,
        )
        .map_err(|e| {
            tracing::warn!("Failed to store overall score: {}", e);
            e
        })
        .ok(); // Non-blocking: don't fail analysis if overall score storage fails

        tracing::info!(
            "Calculated overall score for job_post_id {}: score={:?}, flag={}",
            job_id,
            scoring_result.overall_score,
            scoring_result.color_flag
        );
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
fn get_setting(
    database: State<'_, db::AppDatabase>,
    key: String,
) -> Result<Option<String>, String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
    config_state: State<config::ConfigState>,
    level: String,
) -> Result<(), String> {
    let database = database.get()?;
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
fn set_setting(
    database: State<'_, db::AppDatabase>,
    key: String,
    value: String,
) -> Result<(), String> {
    let database = database.get()?;
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
    let is_sensitive = key_lower.contains("key")
        || key_lower.contains("secret")
        || key_lower.contains("pass")
        || key_lower.contains("token");

    if is_sensitive {
        tracing::debug!(
            key = "[REDACTED_SENSITIVE_KEY]",
            value_len = value.len(),
            "Setting configuration value"
        );
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
    database: State<'_, db::AppDatabase>,
) -> Result<Vec<db::queries::settings::Setting>, String> {
    let database = database.get()?;
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

    suggestions.sort_by_key(|a| a.to_lowercase());
    suggestions.truncate(10); // Max 10 suggestions

    Ok(suggestions)
}

/// Add a new skill to user's profile (Story 4b.1)
/// Returns skill ID on success, error if duplicate (case-insensitive)
/// Story 4b.5 Task 5.1: Triggers recalculation of all job scores
#[tauri::command]
fn add_user_skill(database: State<'_, db::AppDatabase>, skill: String) -> Result<i64, String> {
    let database = database.get()?;
    let skill_id = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        db::queries::user_skills::add_user_skill(&conn, &skill)
            .map_err(|e| format!("Failed to add skill: {}", e))?
    };

    // Story 4b.5 Task 5.1: Recalculate all scores after skill added
    let _ = recalculate_all_scores_internal(database);

    Ok(skill_id)
}

/// Remove a skill from user's profile (Story 4b.1)
/// Story 4b.5 Task 5.1: Triggers recalculation of all job scores
#[tauri::command]
fn remove_user_skill(database: State<'_, db::AppDatabase>, skill_id: i64) -> Result<(), String> {
    let database = database.get()?;
    {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        db::queries::user_skills::remove_user_skill(&conn, skill_id)
            .map_err(|e| format!("Failed to remove skill: {}", e))?;
    }

    // Story 4b.5 Task 5.1: Recalculate all scores after skill removed
    let _ = recalculate_all_scores_internal(database);

    Ok(())
}

/// Get all user skills ordered by added_at DESC (Story 4b.1)
#[tauri::command]
fn get_user_skills(
    database: State<'_, db::AppDatabase>,
) -> Result<Vec<db::queries::user_skills::UserSkill>, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::user_skills::get_user_skills(&conn)
        .map_err(|e| format!("Failed to get skills: {}", e))
}

// ============================================================================
// User Rate Configuration Commands (Story 4b.4)
// ============================================================================

use serde::{Deserialize, Serialize};

/// User rate configuration for budget alignment (Story 4b.4)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateConfig {
    pub hourly_rate: Option<f64>,
    pub project_rate_min: Option<f64>,
}

/// Get user rate configuration from settings (Story 4b.4, Task 2)
/// Returns hourly rate and minimum project rate (null if not configured)
#[tauri::command]
fn get_user_rate_config(database: State<'_, db::AppDatabase>) -> Result<RateConfig, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Get hourly rate
    let hourly_rate = match db::queries::settings::get_setting(&conn, "user_hourly_rate") {
        Ok(Some(value)) => value.parse::<f64>().ok(),
        _ => None,
    };

    // Get project rate minimum
    let project_rate_min = match db::queries::settings::get_setting(&conn, "user_project_rate_min")
    {
        Ok(Some(value)) => value.parse::<f64>().ok(),
        _ => None,
    };

    Ok(RateConfig {
        hourly_rate,
        project_rate_min,
    })
}

/// Set user hourly rate (Story 4b.4, Task 2)
/// Validates: must be positive, max 6 digits
/// Story 4b.5 Task 5.2: Triggers recalculation of all job scores
#[tauri::command]
fn set_user_hourly_rate(database: State<'_, db::AppDatabase>, rate: f64) -> Result<(), String> {
    let database = database.get()?;
    // Validate rate
    if rate <= 0.0 {
        return Err("Hourly rate must be positive".to_string());
    }
    if rate > 999999.0 {
        return Err("Hourly rate too large (max 999999)".to_string());
    }

    tracing::debug!(rate = rate, "Setting user hourly rate");

    {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        // Store as string with 2 decimal precision
        let rate_str = format!("{:.2}", rate);
        db::queries::settings::set_setting(&conn, "user_hourly_rate", &rate_str)
            .map_err(|e| format!("Failed to set hourly rate: {}", e))?;
    }

    // Story 4b.5 Task 5.2: Recalculate all scores after rate changed
    let _ = recalculate_all_scores_internal(database);

    Ok(())
}

/// Set user minimum project rate (Story 4b.4, Task 2)
/// Validates: must be positive, max 6 digits
/// Story 4b.5 Task 5.2: Triggers recalculation of all job scores
#[tauri::command]
fn set_user_project_rate_min(
    database: State<'_, db::AppDatabase>,
    rate: f64,
) -> Result<(), String> {
    let database = database.get()?;
    // Validate rate
    if rate <= 0.0 {
        return Err("Project rate must be positive".to_string());
    }
    if rate > 999999.0 {
        return Err("Project rate too large (max 999999)".to_string());
    }

    tracing::debug!(rate = rate, "Setting user project rate minimum");

    {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        // Store as string with 2 decimal precision
        let rate_str = format!("{:.2}", rate);
        db::queries::settings::set_setting(&conn, "user_project_rate_min", &rate_str)
            .map_err(|e| format!("Failed to set project rate: {}", e))?;
    }

    // Story 4b.5 Task 5.2: Recalculate all scores after rate changed
    let _ = recalculate_all_scores_internal(database);

    Ok(())
}

// ============================================================================
// Job Scoring Commands (Story 4b.2)
// ============================================================================

/// Calculate skills match percentage and store in job_scores table (AC-1)
/// Returns the calculated percentage or null if edge case (AC-3)
#[tauri::command]
fn calculate_and_store_skills_match(
    database: State<'_, db::AppDatabase>,
    job_post_id: i64,
) -> Result<Option<f64>, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let percentage = db::queries::scoring::calculate_skills_match(job_post_id, &conn)?;

    db::queries::scoring::store_skills_match(&conn, job_post_id, percentage)?;

    Ok(percentage)
}

/// Retrieve stored job score for a job post (Task 4)
#[tauri::command]
fn get_job_score(
    database: State<'_, db::AppDatabase>,
    job_post_id: i64,
) -> Result<Option<db::queries::scoring::JobScore>, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::scoring::get_job_score(&conn, job_post_id)
}

/// Get detailed scoring breakdown for UI display (Story 4b.6)
/// Returns all component scores, matched/missing skills, and recommendation text
#[tauri::command]
fn get_scoring_breakdown(
    database: State<'_, db::AppDatabase>,
    job_post_id: i64,
) -> Result<scoring::ScoringBreakdown, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    scoring::assemble_scoring_breakdown(&conn, job_post_id)
}

/// Calculate and store overall job score (Story 4b.5 Task 3.1)
/// Orchestrates: read component scores → calculate weighted score → store → return
#[tauri::command]
fn calculate_overall_job_score(
    database: State<'_, db::AppDatabase>,
    job_post_id: i64,
) -> Result<scoring::ScoringResult, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Read component scores from job_scores table
    let job_score = db::queries::scoring::get_job_score(&conn, job_post_id)?;

    let (skills_match, client_quality, budget_alignment) = match job_score {
        Some(score) => (
            score.skills_match_percentage,
            score.client_quality_score,
            score.budget_alignment_score,
        ),
        None => (None, None, None),
    };

    // Calculate overall score using weighted formula
    let result = scoring::calculate_overall_score(skills_match, client_quality, budget_alignment);

    // Store overall score and color flag
    db::queries::scoring::upsert_overall_score(
        &conn,
        job_post_id,
        result.overall_score,
        &result.color_flag,
    )?;

    Ok(result)
}

/// Internal helper: Recalculate all job scores (Story 4b.5 Task 3.2)
fn recalculate_all_scores_internal(database: &db::Database) -> Result<usize, String> {
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT DISTINCT job_post_id FROM job_scores")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let job_ids: Vec<i64> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query job IDs: {}", e))?
        .collect::<Result<Vec<i64>, _>>()
        .map_err(|e| format!("Failed to collect job IDs: {}", e))?;

    let mut recalculated = 0;

    for job_id in job_ids {
        let job_score = db::queries::scoring::get_job_score(&conn, job_id)?;

        if let Some(score) = job_score {
            let result = scoring::calculate_overall_score(
                score.skills_match_percentage,
                score.client_quality_score,
                score.budget_alignment_score,
            );

            db::queries::scoring::upsert_overall_score(
                &conn,
                job_id,
                result.overall_score,
                &result.color_flag,
            )?;

            recalculated += 1;
        }
    }

    Ok(recalculated)
}

/// Recalculate all job scores (Story 4b.5 Task 3.2)
/// Bulk recalculation when user updates skills or rate configuration
#[tauri::command]
fn recalculate_all_scores(database: State<'_, db::AppDatabase>) -> Result<usize, String> {
    let database = database.get()?;
    recalculate_all_scores_internal(database)
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
fn get_safety_threshold(database: State<'_, db::AppDatabase>) -> Result<i32, String> {
    let database = database.get()?;
    get_safety_threshold_internal(database)
}

// ============================================================================
// Voice Learning Progress Commands (Story 8.6)
// ============================================================================

/// Get the current proposals edited count for voice learning progress.
/// Returns 0 if not yet tracked (code-level default).
#[tauri::command]
fn get_proposals_edited_count(database: State<'_, db::AppDatabase>) -> Result<i32, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::settings::get_proposals_edited_count(&conn)
        .map_err(|e| format!("Failed to get proposals edited count: {}", e))
}

/// Increment the proposals edited count by 1.
/// Called after user copies a proposal (indicating they edited it).
/// Returns the new count after incrementing.
#[tauri::command]
fn increment_proposals_edited(database: State<'_, db::AppDatabase>) -> Result<i32, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    db::queries::settings::increment_proposals_edited(&conn)
        .map_err(|e| format!("Failed to increment proposals edited count: {}", e))
}

// ============================================================================
// Humanization Commands (Story 3.3)
// ============================================================================

/// Get current humanization intensity setting.
/// Returns the intensity level: "off", "light", "medium", or "heavy".
/// Defaults to "medium" for new users (AC6).
#[tauri::command]
fn get_humanization_intensity(database: State<'_, db::AppDatabase>) -> Result<String, String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
    intensity: String,
) -> Result<(), String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
) -> Result<ExportResult, String> {
    let database = database.get()?;
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
    std::fs::write(&path_str, json).map_err(|e| format!("Failed to write file: {}", e))?;

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

/// Verify passphrase and unlock encrypted database on app restart (Story 2-7b)
///
/// - Calls open_encrypted_database() with passphrase
/// - Stores Database instance in AppDatabase state via OnceLock
/// - Runs deferred database-dependent initialization
/// - Tracks failed attempts (in-memory, resets on restart)
/// - Shows recovery options after 5 failures
/// - Emits database-ready event on success for frontend state transition
#[tauri::command]
async fn verify_passphrase_on_restart(
    app_handle: AppHandle,
    passphrase: String,
    app_database: State<'_, db::AppDatabase>,
    config_state: State<'_, config::ConfigState>,
) -> Result<VerifyPassphraseResult, String> {
    use std::sync::atomic::{AtomicU8, Ordering};

    // Task 4: Failed attempt tracking (in-memory, reset on restart)
    static FAILED_ATTEMPTS: AtomicU8 = AtomicU8::new(0);

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Call open_encrypted_database() with passphrase
    match db::open_encrypted_database(&app_data_dir, &passphrase) {
        Ok(database) => {
            // Story 2-7b: Store Database instance in AppDatabase via OnceLock
            app_database
                .set(database)
                .map_err(|_| "Database already initialized".to_string())?;

            // Run deferred initialization (log level migration, override cleanup)
            let log_level = config_state
                .get_log_level()
                .unwrap_or_else(|_| "INFO".to_string());
            if let Err(e) = run_deferred_db_init(&app_database, &config_state, &log_level) {
                tracing::warn!("Deferred init warning (non-fatal): {}", e);
            }

            // Reset failed attempts on success
            FAILED_ATTEMPTS.store(0, Ordering::SeqCst);

            tracing::info!("Database unlocked successfully on restart");

            // Emit database-ready event for frontend state transition
            let _ = app_handle.emit("database-ready", ());

            Ok(VerifyPassphraseResult {
                success: true,
                message: "Database unlocked".to_string(),
                failed_attempts: 0,
                show_recovery: false,
            })
        }
        Err(db::DatabaseError::IncorrectPassphrase) => {
            // Increment failed attempts counter (cap at 255 to prevent u8 overflow wrap)
            let prev = FAILED_ATTEMPTS.load(Ordering::SeqCst);
            let attempts = if prev < 255 {
                FAILED_ATTEMPTS.fetch_add(1, Ordering::SeqCst) + 1
            } else {
                255
            };

            tracing::warn!(
                "Failed passphrase attempt {} (passphrase NOT logged)",
                attempts
            );

            // Show recovery after 5 failures
            let show_recovery = attempts >= 5;

            Ok(VerifyPassphraseResult {
                success: false,
                message: "Incorrect passphrase. Try again.".to_string(),
                failed_attempts: attempts,
                show_recovery,
            })
        }
        Err(e) => {
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
    database: State<'_, db::AppDatabase>,
) -> Result<EncryptionStatus, String> {
    let database = database.get()?;
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
/// - Story 2-7b: Also stores recovery hash + wrapped DB key to external files for recovery flow
#[tauri::command]
async fn generate_recovery_key(
    passphrase: String,
    app_handle: AppHandle,
    database: State<'_, db::AppDatabase>,
) -> Result<RecoveryKeyData, String> {
    let database = database.get()?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

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

    // Story 2-7b: Derive DB encryption key from passphrase and wrap with recovery key
    // This enables recovery flow to actually unlock the database
    let db_key = passphrase::verify_passphrase(&passphrase, &app_data_dir)
        .map_err(|e| format!("Failed to derive DB key: {}", e))?;
    let wrapped_db_key = keychain::recovery::wrap_db_key(&db_key, &recovery_key)
        .map_err(|e| format!("Failed to wrap DB key: {}", e))?;

    // Story 2-7b: Store recovery hash and wrapped DB key to external files
    // These are needed when database is locked (can't read from encrypted DB)
    let recovery_hash_path = app_data_dir.join(".recovery_hash");
    let wrapped_key_path = app_data_dir.join(".recovery_wrapped_key");

    std::fs::write(&recovery_hash_path, &recovery_key_hash)
        .map_err(|e| format!("Failed to write recovery hash file: {}", e))?;
    std::fs::write(&wrapped_key_path, &wrapped_db_key)
        .map_err(|e| format!("Failed to write wrapped key file: {}", e))?;

    // M2 fix (Review 2): Restrict file permissions on Unix (sensitive recovery data)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let restricted = std::fs::Permissions::from_mode(0o600);
        let _ = std::fs::set_permissions(&recovery_hash_path, restricted.clone());
        let _ = std::fs::set_permissions(&wrapped_key_path, restricted);
    }

    tracing::info!("Recovery data stored to external files for locked-DB recovery");

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

/// Unlock database using recovery key (Story 2.9 + Story 2-7b fix)
///
/// Reads recovery data from external files (not from the locked DB), verifies
/// the recovery key, unwraps the DB encryption key, and fully unlocks the database.
///
/// # Story 2-7b Fix
/// The original implementation called `database.get()` which fails when the DB is locked.
/// Now reads from external files created during `generate_recovery_key`:
/// - `.recovery_hash` - Argon2id hash for verification
/// - `.recovery_wrapped_key` - DB encryption key wrapped with recovery key
///
/// # Flow
/// 1. Read recovery hash from `.recovery_hash` file
/// 2. Verify recovery key against hash (Argon2id)
/// 3. Read wrapped DB key from `.recovery_wrapped_key` file
/// 4. Unwrap DB key using recovery key (AES-256-GCM)
/// 5. Open database with unwrapped key
/// 6. Populate AppDatabase
/// 7. Run deferred initialization
/// 8. Emit database-ready event
#[tauri::command]
async fn unlock_with_recovery_key(
    recovery_key: String,
    app_handle: AppHandle,
    app_database: State<'_, db::AppDatabase>,
    config_state: State<'_, config::ConfigState>,
) -> Result<RecoveryUnlockResult, String> {
    // Validate recovery key format first
    keychain::recovery::validate_recovery_key(&recovery_key)
        .map_err(|e| format!("Invalid recovery key: {}", e))?;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Story 2-7b: Read recovery data from external files (not locked DB)
    let recovery_hash_path = app_data_dir.join(".recovery_hash");
    let wrapped_key_path = app_data_dir.join(".recovery_wrapped_key");

    // Check if recovery files exist
    if !recovery_hash_path.exists() || !wrapped_key_path.exists() {
        return Err("No recovery key configured. Set one up in recovery options before locking yourself out.".to_string());
    }

    // Read recovery hash from file
    let stored_hash = std::fs::read_to_string(&recovery_hash_path)
        .map_err(|e| format!("Failed to read recovery hash: {}", e))?;

    // Verify recovery key against stored hash using Argon2id
    {
        use argon2::password_hash::PasswordHash;
        use argon2::{Argon2, PasswordVerifier};

        let parsed_hash = PasswordHash::new(stored_hash.trim())
            .map_err(|e| format!("Invalid stored hash format: {}", e))?;

        Argon2::default()
            .verify_password(recovery_key.as_bytes(), &parsed_hash)
            .map_err(|_| "Invalid recovery key".to_string())?;
    }

    tracing::info!("Recovery key verified against stored hash (key NOT logged)");

    // Read wrapped DB key from file
    let wrapped_db_key = std::fs::read_to_string(&wrapped_key_path)
        .map_err(|e| format!("Failed to read wrapped key: {}", e))?;

    // Unwrap DB key using recovery key
    let db_key = keychain::recovery::unwrap_db_key(wrapped_db_key.trim(), &recovery_key)
        .map_err(|e| format!("Failed to unwrap DB key: {}", e))?;

    tracing::info!("DB key unwrapped successfully");

    // Open encrypted database with unwrapped key
    let db_path = app_data_dir.join("upwork-researcher.db");
    let database = db::Database::new(db_path, Some(db_key))
        .map_err(|e| format!("Failed to open database with recovery key: {}", e))?;

    // Populate AppDatabase
    app_database
        .set(database)
        .map_err(|_| "Database already initialized".to_string())?;

    // Run deferred initialization
    let log_level = config_state
        .get_log_level()
        .unwrap_or_else(|_| "INFO".to_string());
    if let Err(e) = run_deferred_db_init(&app_database, &config_state, &log_level) {
        tracing::warn!("Deferred init warning (non-fatal): {}", e);
    }

    tracing::info!("Database unlocked via recovery key");

    // Emit database-ready event for frontend
    let _ = app_handle.emit("database-ready", ());

    Ok(RecoveryUnlockResult {
        success: true,
        message: "Database unlocked. You may want to set a new passphrase.".to_string(),
    })
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
    database: State<'_, db::AppDatabase>,
) -> Result<(), String> {
    let database = database.get()?;
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
    database: State<'_, db::AppDatabase>,
) -> Result<BackupResult, String> {
    let database = database.get()?;
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

    let metadata = backup::export_unencrypted_backup(database, &path_buf)
        .map_err(|e| format!("Backup export failed: {}", e))?;

    let message = format!("Backup saved to {}. Store this file securely.", path_str);

    tracing::info!(
        "Unencrypted backup exported: {} proposals, {} settings, {} job posts",
        metadata.proposal_count,
        metadata.settings_count,
        metadata.job_posts_count
    );

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
    database: State<'_, db::AppDatabase>,
) -> Result<BackupResult, String> {
    let database = database.get()?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    tracing::info!("Starting pre-migration backup...");

    let metadata = backup::create_pre_migration_backup(&app_data_dir, database)
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
    let metadata = match migration::migrate_to_encrypted_database(
        &app_data_dir,
        &passphrase,
        &backup_path_buf,
    ) {
        Ok(metadata) => metadata,
        Err(e) => {
            tracing::error!("Migration failed: {}. Attempting cleanup...", e);
            // Cleanup incomplete encrypted database
            migration::cleanup_failed_migration(&app_data_dir);
            return Err(format!(
                "Migration failed: {}. Your data has been preserved in the original database.",
                e
            ));
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
    database: State<'_, db::AppDatabase>,
) -> Result<migration::MigrationVerification, String> {
    let database = database.get()?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    migration::get_migration_verification(database, &app_data_dir)
        .map_err(|e| format!("Failed to get verification data: {}", e))
}

/// Delete old unencrypted database file (Story 2.4, Task 2.1)
/// Permanently removes .old database after user confirms verification
#[tauri::command]
async fn delete_old_database(old_db_path: String) -> Result<String, String> {
    migration::delete_old_database(&old_db_path)
        .map_err(|e| format!("Failed to delete old database: {}", e))
}

/// Story 2-7b: Run database-dependent initialization that must be deferred
/// when the encrypted database hasn't been unlocked yet.
/// Called during setup for unencrypted databases, or after passphrase unlock for encrypted ones.
fn run_deferred_db_init(
    app_database: &db::AppDatabase,
    config_state: &config::ConfigState,
    log_level: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let database = app_database
        .get()
        .map_err(|e| format!("Database not ready: {}", e))?;

    // Story 2.1, Task 8 (Subtask 8.6): One-time migration from database to config.json
    if log_level == "INFO" {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;
        if let Ok(Some(db_log_level)) = db::queries::settings::get_setting(&conn, "log_level") {
            if db_log_level != "INFO" {
                tracing::info!(
                    "Migrating log level from database to config.json: {}",
                    db_log_level
                );
                config_state
                    .set_log_level(db_log_level.clone())
                    .map_err(|e| format!("Failed to migrate log level: {}", e))?;
            }
        }
        drop(conn);
    }

    tracing::info!("Config initialized successfully (log level: {})", log_level);

    // Story 3.7: Auto-confirm successful overrides on startup (Task 3.1)
    {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        match db::queries::safety_overrides::get_pending_overrides_older_than_7_days(&conn) {
            Ok(pending_overrides) => {
                let mut successful_count = 0;
                let mut unsuccessful_count = 0;

                for override_record in pending_overrides {
                    match db::queries::safety_overrides::proposal_exists(
                        &conn,
                        override_record.proposal_id,
                    ) {
                        Ok(true) => {
                            if let Err(e) = db::queries::safety_overrides::update_override_status(
                                &conn,
                                override_record.id,
                                db::queries::safety_overrides::STATUS_SUCCESSFUL,
                            ) {
                                tracing::warn!(
                                    "Failed to update override {} to successful: {}",
                                    override_record.id,
                                    e
                                );
                            } else {
                                successful_count += 1;
                            }
                        }
                        Ok(false) => {
                            if let Err(e) = db::queries::safety_overrides::update_override_status(
                                &conn,
                                override_record.id,
                                db::queries::safety_overrides::STATUS_UNSUCCESSFUL,
                            ) {
                                tracing::warn!(
                                    "Failed to update override {} to unsuccessful: {}",
                                    override_record.id,
                                    e
                                );
                            } else {
                                unsuccessful_count += 1;
                            }
                        }
                        Err(e) => {
                            tracing::warn!(
                                "Failed to check proposal existence for override {}: {}",
                                override_record.id,
                                e
                            );
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
            }
        }
    }

    tracing::info!("Database-dependent initialization complete");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            let config_state_early =
                config::ConfigState::new(app_data_dir.clone()).map_err(|e| {
                    eprintln!("Failed to initialize config: {}", e);
                    format!("Failed to initialize config: {}", e)
                })?;

            // Read log level from config (defaults to "INFO" if not set)
            let log_level = config_state_early
                .get_log_level()
                .unwrap_or_else(|_| "INFO".to_string());

            // Initialize logging infrastructure with log level from config
            // Must initialize early to capture all subsequent operations
            let logs_dir = logs::init_logging(&app_data_dir, Some(&log_level)).map_err(|e| {
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

            // Story 2-7b: Use AppDatabase with OnceLock for lazy initialization
            // Encrypted databases require passphrase before opening
            let app_database = if migration_complete {
                // Subtask 8.4: Migration complete → encrypted database detected
                // Database cannot be opened until user provides passphrase
                tracing::info!(
                    "Migration marker found - encrypted database requires passphrase unlock"
                );
                db::AppDatabase::new_empty()
            } else {
                // Subtask 8.5: No migration marker → open unencrypted database immediately
                let database = if db_path.exists() {
                    tracing::info!("Unencrypted database exists - opening directly");
                    db::Database::new(db_path, None).map_err(|e| {
                        tracing::error!("Failed to initialize database: {}", e);
                        format!("Failed to initialize database: {}", e)
                    })?
                } else {
                    // New installation - create fresh unencrypted database
                    tracing::info!("New installation - creating fresh database");
                    db::Database::new(db_path, None).map_err(|e| {
                        tracing::error!("Failed to create database: {}", e);
                        format!("Failed to create database: {}", e)
                    })?
                };
                db::AppDatabase::new_with(database)
            };

            // Config already initialized early (for log level), reuse it
            let config_state = config_state_early;

            // Story 2-7b: Database-dependent initialization runs only when DB is available
            // For encrypted databases, this runs after passphrase unlock via run_deferred_db_init()
            if app_database.is_ready() {
                run_deferred_db_init(&app_database, &config_state, &log_level)?;
            } else {
                tracing::info!(
                    "Deferring database-dependent initialization until passphrase unlock"
                );
            }

            // Story 2.6: Auto-migrate API key from config.json to keychain (if needed)
            // This runs once per app startup and is idempotent (no DB dependency)
            match config_state.migrate_api_key_to_keychain() {
                Ok(true) => {
                    tracing::info!("API key auto-migrated from config.json to OS keychain");
                }
                Ok(false) => {
                    tracing::debug!("API key migration not needed (already in keychain or no key)");
                }
                Err(e) => {
                    tracing::warn!("API key migration failed (non-fatal): {}", e);
                }
            }

            // Initialize draft state for tracking current draft during generation
            let draft_state = DraftState {
                current_draft_id: Arc::new(Mutex::new(None)),
            };

            // Story 3.8: Initialize cooldown state for rate limiting (FR-12)
            let cooldown_state = CooldownState::new();

            // Story 5.8 Subtask 4.1: Initialize voice cache for prompt caching (AC-6)
            let voice_cache = VoiceCache::new();

            // Story 8.13: Initialize blocked requests state for network security transparency
            let blocked_requests_state = BlockedRequestsState::new();

            // Store in managed state
            app.manage(app_database);
            app.manage(config_state);
            app.manage(draft_state);
            app.manage(cooldown_state);
            app.manage(voice_cache);
            app.manage(blocked_requests_state);

            // Story 7.6: Export rate limiting state (AC-6: 60s cooldown)
            app.manage(commands::export::ExportRateLimitState::new());

            // Story 7.7: Clean up orphaned import temp files from previous crashes
            if let Err(e) = commands::import::cleanup_import_temp_files() {
                tracing::warn!("Failed to cleanup orphaned import temp files: {}", e);
            }

            // Story 10.2: Load cached remote config on startup (AC-3)
            // Returns immediately from cache (no network delay), spawns background fetch if stale
            let _startup_config = remote_config::load_config_on_startup(app.handle());
            tracing::info!("Remote config loaded on startup");

            // Story 10.2: Start periodic config refresh every 4 hours (AC-6)
            let _config_refresh_handle = remote_config::start_periodic_config_refresh(app.handle().clone());

            // Story 2-7b: Emit passphrase-required event after state is registered
            if migration_complete {
                let handle = app.handle().clone();
                // Brief delay to ensure frontend is ready to listen
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    let _ = handle.emit("passphrase-required", ());
                    tracing::info!("Emitted passphrase-required event to frontend");
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_proposal,
            generate_proposal_streaming,
            analyze_perplexity,
            // Cooldown commands (Story 3.8)
            get_cooldown_remaining,
            // Voice cache commands (Story 5.8)
            invalidate_voice_cache,
            check_database,
            save_proposal,
            get_proposals,
            commands::proposals::get_proposal_history, // Story 8.7: Memory Optimization
            commands::proposals::search_proposals,     // Story 7.3: Search & Filter
            commands::proposals::get_distinct_hook_strategies, // Story 7.3: Hook strategy filter
            commands::proposals::get_proposal_detail,  // Story 7.4: Full proposal detail view
            commands::proposals::update_proposal_outcome, // Story 7.1/7.2: Outcome status mutation
            delete_proposal,                           // Story 6.8: Delete Proposal & All Revisions
            update_proposal_content,                   // Story 6.1: TipTap Editor auto-save
            // Revision commands (Story 6.3: Proposal Revision History)
            create_revision,
            get_proposal_revisions,
            get_revision_content,
            restore_revision,
            // Archived revision commands (Story 6.7: Archive Old Revisions)
            get_archived_revisions,
            get_archived_revision_count,
            restore_archived_revision,
            save_job_post,
            analyze_job_post,                   // Story 4a.2: Client Name Extraction
            job::rss::import_rss_feed,          // Story 4b.7: RSS Feed Import
            commands::job_queue::get_job_queue, // Story 4b.9: Job Queue View with Sorting
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
            // User rate configuration commands (Story 4b.4)
            get_user_rate_config,
            set_user_hourly_rate,
            set_user_project_rate_min,
            // Job scoring commands (Story 4b.2, 4b.5, 4b.6)
            calculate_and_store_skills_match,
            get_job_score,
            get_scoring_breakdown,       // Story 4b.6
            calculate_overall_job_score, // Story 4b.5
            recalculate_all_scores,      // Story 4b.5
            // Scoring feedback commands (Story 4b.10)
            commands::scoring_feedback::submit_scoring_feedback,
            commands::scoring_feedback::check_can_report_score,
            // Hook strategies commands (Story 5.2)
            commands::hooks::get_hook_strategies,
            // Golden set voice learning commands (Story 5.3, 5.4)
            commands::voice::add_golden_proposal_command,
            commands::voice::get_golden_proposals_command,
            commands::voice::delete_golden_proposal_command,
            commands::voice::get_golden_proposal_count_command,
            commands::voice::pick_and_read_file,
            commands::voice::calibrate_voice, // Story 5.4: Voice calibration
            // Voice profile persistence commands (Story 5-5b)
            commands::voice::get_voice_profile,
            commands::voice::save_voice_profile,
            commands::voice::delete_voice_profile,
            // Manual voice parameter adjustments (Story 6.2)
            commands::voice::update_voice_parameters,
            // Quick calibration command (Story 5-7)
            commands::voice::quick_calibrate,
            // Safety threshold commands (Story 3.5)
            get_safety_threshold,
            // Voice learning progress commands (Story 8.6)
            get_proposals_edited_count,
            increment_proposals_edited,
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
            commands::export::export_encrypted_archive, // Story 7.6: Encrypted archive export
            // Draft recovery commands (Story 1.14)
            check_for_draft,
            update_proposal_status,
            // Passphrase commands (Story 2.1 - Epic 2)
            set_passphrase,
            verify_passphrase_strength,
            verify_passphrase,
            verify_passphrase_on_restart,      // Story 2.7
            get_encryption_status,             // Story 2.8
            generate_recovery_key,             // Story 2.9
            unlock_with_recovery_key,          // Story 2.9 AC6
            set_new_passphrase_after_recovery, // Story 2.9 AC6
            // Backup commands (Story 2.2 + 2.9)
            create_pre_migration_backup,
            export_unencrypted_backup, // Story 2.9 AC3
            // Migration commands (Story 2.3)
            migrate_database,
            // Migration verification commands (Story 2.4)
            get_migration_verification,
            delete_old_database,
            // System/performance commands (Story 8.10)
            commands::system::get_memory_usage,
            commands::system::signal_ready,
            // Network security commands (Story 8.13)
            commands::system::get_blocked_requests,
            // Test data seeding commands (Story 8.10)
            commands::test_data::seed_proposals,
            commands::test_data::seed_job_posts,
            commands::test_data::clear_test_data,
            // Analytics commands (Story 7.5)
            commands::proposals::get_proposal_analytics_summary,
            commands::proposals::get_outcome_distribution,
            commands::proposals::get_response_rate_by_strategy,
            commands::proposals::get_weekly_activity,
            // Import commands (Story 7.7)
            commands::import::read_archive_metadata,
            commands::import::decrypt_archive,
            commands::import::execute_import,
            // Health check & version tracking commands (Story 9.9, TD2.3)
            health_check::get_installed_version_command,
            health_check::set_installed_version_command,
            health_check::detect_update_command,
            health_check::run_health_checks_command,
            // Backup & rollback commands (Story 9.9)
            health_check::create_pre_update_backup_command,
            health_check::rollback_to_previous_version_command,
            health_check::get_failed_update_versions_command,
            health_check::clear_failed_update_versions_command,
            health_check::cleanup_old_backups_command,
            health_check::check_and_clear_rollback_command,
            // A/B testing analytics (Story 10.4)
            commands::proposals::get_strategy_effectiveness,
            // Remote config commands (Story 10.1)
            remote_config::fetch_remote_config_command,
            remote_config::get_bundled_config_command,
            // Remote config storage commands (Story 10.2)
            remote_config::get_cached_config_command,
            remote_config::force_config_refresh_command,
            // Config update check command (Story 10.5)
            remote_config::check_for_config_updates,
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
    database: State<'_, db::AppDatabase>,
) -> Result<(), String> {
    let database = database.get()?;
    log_safety_override_internal(score, threshold, database).await
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

    let override_id =
        db::queries::safety_overrides::record_override(&conn, proposal_id, ai_score, threshold)
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
    database: State<'_, db::AppDatabase>,
) -> Result<i64, String> {
    let database = database.get()?;
    record_safety_override_internal(proposal_id, ai_score, threshold, database).await
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
#[allow(dead_code)] // Reserved for Story 3.7 threshold decrease feature
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
    database: State<'_, db::AppDatabase>,
) -> Result<Option<ThresholdSuggestion>, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Get current threshold
    let current_threshold = match db::queries::settings::get_setting(&conn, "safety_threshold") {
        Ok(Some(value)) => value
            .parse::<i32>()
            .unwrap_or(THRESHOLD_DEFAULT)
            .clamp(140, THRESHOLD_MAX),
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
    let dismissal_timestamp =
        db::queries::settings::get_setting(&conn, "threshold_suggestion_dismissed_at")
            .ok()
            .flatten();

    // Get successful overrides from last 30 days
    let successful_overrides =
        db::queries::safety_overrides::get_successful_overrides_last_30_days(&conn)
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
    database: State<'_, db::AppDatabase>,
) -> Result<Option<ThresholdSuggestion>, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Get current threshold
    let current_threshold = match db::queries::settings::get_setting(&conn, "safety_threshold") {
        Ok(Some(value)) => value
            .parse::<i32>()
            .unwrap_or(THRESHOLD_DEFAULT)
            .clamp(140, THRESHOLD_MAX),
        Ok(None) => THRESHOLD_DEFAULT,
        Err(e) => {
            tracing::warn!("Failed to get threshold: {}", e);
            THRESHOLD_DEFAULT
        }
    };

    // Only suggest decrease if above default
    if current_threshold <= THRESHOLD_DEFAULT {
        tracing::debug!(
            "Threshold at default ({}), no decrease suggestion",
            THRESHOLD_DEFAULT
        );
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
    database: State<'_, db::AppDatabase>,
) -> Result<(), String> {
    let database = database.get()?;
    // Validate threshold range
    if !(140..=THRESHOLD_MAX).contains(&new_threshold) {
        return Err(format!(
            "Threshold must be between 140 and {}",
            THRESHOLD_MAX
        ));
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
    let _ = conn.execute(
        "DELETE FROM settings WHERE key = 'threshold_suggestion_dismissed_at'",
        [],
    );

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
async fn dismiss_threshold_suggestion(database: State<'_, db::AppDatabase>) -> Result<(), String> {
    let database = database.get()?;
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

    // =========================================================================
    // Story 4b.4: User Rate Configuration Tests
    // =========================================================================

    #[test]
    fn test_user_hourly_rate_saves_correctly() {
        // Subtask 9.4: Test hourly rate saves correctly
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");
        let conn = db.conn.lock().unwrap();

        // Validate and save rate
        let rate = 75.0;
        assert!(
            rate > 0.0 && rate <= 999999.0,
            "Rate should be positive and <= 999999"
        );
        let rate_str = format!("{:.2}", rate);
        db::queries::settings::set_setting(&conn, "user_hourly_rate", &rate_str).unwrap();

        // Verify saved
        let saved = db::queries::settings::get_setting(&conn, "user_hourly_rate").unwrap();
        assert_eq!(saved, Some("75.00".to_string()));

        // Verify parses back correctly
        let parsed = saved.unwrap().parse::<f64>().unwrap();
        assert_eq!(parsed, 75.0);
    }

    #[test]
    fn test_user_project_rate_min_saves_correctly() {
        // Subtask 9.4: Test project rate saves correctly
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");
        let conn = db.conn.lock().unwrap();

        // Validate and save rate
        let rate = 2000.0;
        assert!(
            rate > 0.0 && rate <= 999999.0,
            "Rate should be positive and <= 999999"
        );
        let rate_str = format!("{:.2}", rate);
        db::queries::settings::set_setting(&conn, "user_project_rate_min", &rate_str).unwrap();

        // Verify saved
        let saved = db::queries::settings::get_setting(&conn, "user_project_rate_min").unwrap();
        assert_eq!(saved, Some("2000.00".to_string()));

        // Verify parses back correctly
        let parsed = saved.unwrap().parse::<f64>().unwrap();
        assert_eq!(parsed, 2000.0);
    }

    #[test]
    fn test_rate_config_returns_none_when_not_set() {
        // Subtask 9.4: Test get_user_rate_config logic returns None for unset rates
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");
        let conn = db.conn.lock().unwrap();

        // Get hourly rate (should be None)
        let hourly_rate = match db::queries::settings::get_setting(&conn, "user_hourly_rate") {
            Ok(Some(value)) => value.parse::<f64>().ok(),
            _ => None,
        };

        // Get project rate (should be None)
        let project_rate_min =
            match db::queries::settings::get_setting(&conn, "user_project_rate_min") {
                Ok(Some(value)) => value.parse::<f64>().ok(),
                _ => None,
            };

        assert_eq!(hourly_rate, None);
        assert_eq!(project_rate_min, None);
    }

    #[test]
    fn test_rate_config_returns_set_values() {
        // Subtask 9.4: Test get_user_rate_config logic returns configured rates
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");
        let conn = db.conn.lock().unwrap();

        // Set rates
        db::queries::settings::set_setting(&conn, "user_hourly_rate", "75.00").unwrap();
        db::queries::settings::set_setting(&conn, "user_project_rate_min", "2000.00").unwrap();

        // Retrieve
        let hourly_rate = match db::queries::settings::get_setting(&conn, "user_hourly_rate") {
            Ok(Some(value)) => value.parse::<f64>().ok(),
            _ => None,
        };

        let project_rate_min =
            match db::queries::settings::get_setting(&conn, "user_project_rate_min") {
                Ok(Some(value)) => value.parse::<f64>().ok(),
                _ => None,
            };

        assert_eq!(hourly_rate, Some(75.0));
        assert_eq!(project_rate_min, Some(2000.0));
    }

    // Story 3.5, Task 6.1: Test get_safety_threshold returns 180 if not set
    #[test]
    fn test_get_safety_threshold_default() {
        // Create in-memory database
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");

        // Query threshold (should return default 180)
        let result = get_safety_threshold_internal(&db);
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert_eq!(result.unwrap(), 180, "Default threshold should be 180");
    }

    // Story 3.5, Task 6.2: Test get_safety_threshold returns stored custom value
    #[test]
    fn test_get_safety_threshold_custom() {
        // Create in-memory database
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");

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
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");

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
        assert_eq!(
            result.unwrap(),
            180,
            "Non-numeric value should default to 180"
        );
    }

    // =========================================================================
    // Story 3.6: log_safety_override tests
    // =========================================================================

    // Story 3.6, Task 5.11: Test override count increments from 0 to 1
    #[tokio::test]
    async fn test_log_safety_override_increments_count() {
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");

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
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");

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
        let db =
            db::Database::new(":memory:".into(), None).expect("Failed to create test database");

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
            assert!(
                timestamp.contains("-"),
                "Timestamp should contain date separators"
            );
        }
    }

    // =========================================================================
    // Story 3.8: CooldownState tests
    // =========================================================================

    // Story 3.8, Task 7.5: Test get_cooldown_remaining returns 0 when no cooldown active
    #[test]
    fn test_cooldown_remaining_no_active() {
        let cooldown = CooldownState::new();
        assert_eq!(
            cooldown.remaining_seconds(),
            0,
            "Should return 0 with no prior generation"
        );
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
        assert!(
            remaining > 0,
            "Should block within 120s window, got {} remaining",
            remaining
        );
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
        assert_eq!(
            remaining, 0,
            "Should allow after 120s expiry, got {} remaining",
            remaining
        );
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
        assert_eq!(
            cooldown.remaining_seconds(),
            0,
            "Default should have no cooldown"
        );
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
        assert_eq!(
            suggestions.len(),
            0,
            "Should return empty array for no matches"
        );
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

    // =========================================================================
    // Story 5.8: VoiceCache tests (Task 4, Subtasks 6.7, 6.8)
    // =========================================================================

    /// Subtask 6.7: Test voice profile caching behavior
    #[test]
    fn test_voice_cache_get_returns_none_initially() {
        let cache = VoiceCache::new();
        assert!(cache.get().is_none(), "Cache should return None when empty");
    }

    /// Subtask 6.7: Test voice profile caching - set and get
    #[test]
    fn test_voice_cache_set_and_get() {
        use voice::{CalibrationSource, StructurePreference, VoiceProfile};

        let cache = VoiceCache::new();

        let profile = VoiceProfile {
            tone_score: 7.5,
            avg_sentence_length: 18.0,
            vocabulary_complexity: 11.2,
            structure_preference: StructurePreference {
                paragraphs_pct: 60,
                bullets_pct: 40,
            },
            technical_depth: 8.0,
            length_preference: 5.0,
            common_phrases: vec!["test phrase".to_string()],
            sample_count: 10,
            calibration_source: CalibrationSource::GoldenSet,
        };

        // Set profile
        cache.set(profile.clone());

        // Get should return the profile
        let cached = cache.get();
        assert!(cached.is_some(), "Cache should return profile after set");

        let cached_profile = cached.unwrap();
        assert_eq!(cached_profile.tone_score, 7.5);
        assert_eq!(cached_profile.sample_count, 10);
    }

    /// Subtask 6.8: Test cache invalidation
    #[test]
    fn test_voice_cache_invalidate() {
        use voice::{CalibrationSource, StructurePreference, VoiceProfile};

        let cache = VoiceCache::new();

        let profile = VoiceProfile {
            tone_score: 7.5,
            avg_sentence_length: 18.0,
            vocabulary_complexity: 11.2,
            structure_preference: StructurePreference {
                paragraphs_pct: 60,
                bullets_pct: 40,
            },
            technical_depth: 8.0,
            length_preference: 5.0,
            common_phrases: vec![],
            sample_count: 10,
            calibration_source: CalibrationSource::QuickCalibration,
        };

        // Set profile
        cache.set(profile.clone());
        assert!(cache.get().is_some(), "Profile should be cached");

        // Invalidate
        cache.invalidate();

        // Get should return None after invalidation
        assert!(
            cache.get().is_none(),
            "Cache should return None after invalidation"
        );
    }

    /// Subtask 6.7: Test cache reuse on subsequent requests
    #[test]
    fn test_voice_cache_reuse() {
        use voice::{CalibrationSource, StructurePreference, VoiceProfile};

        let cache = VoiceCache::new();

        let profile = VoiceProfile {
            tone_score: 5.0,
            avg_sentence_length: 15.0,
            vocabulary_complexity: 9.0,
            structure_preference: StructurePreference {
                paragraphs_pct: 70,
                bullets_pct: 30,
            },
            technical_depth: 6.0,
            length_preference: 5.0,
            common_phrases: vec![],
            sample_count: 5,
            calibration_source: CalibrationSource::GoldenSet,
        };

        // First request: set profile
        cache.set(profile.clone());

        // Second request: get profile (simulates subsequent generation)
        let cached1 = cache.get();
        assert!(cached1.is_some(), "First get should return profile");

        // Third request: get profile again (simulates another generation)
        let cached2 = cache.get();
        assert!(cached2.is_some(), "Second get should still return profile");

        // Verify same profile
        assert_eq!(cached1.unwrap().tone_score, cached2.unwrap().tone_score);
    }

    /// M2 fix: Test parallel loading performance (<150ms target per AC-2)
    /// Tests that voice profile + settings queries complete within target time.
    #[test]
    fn test_context_loading_performance_target() {
        use tempfile::TempDir;

        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("perf_test.db");
        let database = db::Database::new(db_path, None).unwrap();

        // Measure loading time for voice profile + settings query
        let start = std::time::Instant::now();

        {
            let conn = database.conn.lock().unwrap();

            // Query 1: Voice profile (will return None, but measures query time)
            let _voice_profile =
                db::queries::voice_profile::get_voice_profile(&conn, "default").unwrap();

            // Query 2: Humanization intensity setting
            let _intensity =
                db::queries::settings::get_setting(&conn, "humanization_intensity").unwrap();
        }

        let elapsed = start.elapsed();

        // AC-2: Total parallel loading takes <150ms
        assert!(
            elapsed.as_millis() < 150,
            "Context loading took {}ms, should be <150ms (AC-2)",
            elapsed.as_millis()
        );

        // Bonus: Verify it's actually fast (should be <10ms for empty DB)
        assert!(
            elapsed.as_millis() < 50,
            "Context loading took {}ms, expected <50ms for indexed queries",
            elapsed.as_millis()
        );
    }

    // =========================================================================
    // Story 9.6: Updater Plugin Registration (Task 6.5)
    // =========================================================================

    #[test]
    #[ignore = "Compile-time verification only — runtime requires full Tauri app context (DLLs)"]
    fn test_updater_plugin_builds_without_panic() {
        // The real value of this test is compilation: if tauri_plugin_updater
        // dependency is misconfigured or incompatible, this won't compile.
        // Runtime execution requires Tauri DLLs which aren't available in `cargo test`.
        let _plugin = tauri_plugin_updater::Builder::new().build::<tauri::Wry>();
    }

    #[test]
    #[ignore = "Compile-time verification only — runtime requires full Tauri app context (DLLs)"]
    fn test_all_plugins_build_without_panic() {
        // Verifies the full plugin chain compiles with compatible types.
        // If any plugin breaks the chain, this will fail to compile.
        let _opener = tauri_plugin_opener::init::<tauri::Wry>();
        let _clipboard = tauri_plugin_clipboard_manager::init::<tauri::Wry>();
        let _dialog = tauri_plugin_dialog::init::<tauri::Wry>();
        let _updater = tauri_plugin_updater::Builder::new().build::<tauri::Wry>();
    }
}
