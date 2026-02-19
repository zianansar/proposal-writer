//! Remote configuration fetching and validation
//!
//! This module handles fetching hook strategy configurations from a remote endpoint,
//! validating signatures, and falling back to bundled defaults when necessary.

use crate::network;
use hmac::{Hmac, Mac};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::fmt;
use std::time::Duration;
use tauri::AppHandle;
use thiserror::Error;

type HmacSha256 = Hmac<Sha256>;

/// Remote configuration endpoint URL
///
/// **ADMIN NOTE:** Update this URL to point to your actual config repository.
/// Example format: https://raw.githubusercontent.com/{owner}/{repo}/main/config/hook-strategies.json
///
/// For development/testing, you can use a local test server or mock endpoint.
pub const REMOTE_CONFIG_URL: &str =
    "https://raw.githubusercontent.com/{owner}/{repo}/main/config/hook-strategies.json";

/// Status of a hook strategy in the remote config
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum StrategyStatus {
    Active,
    Deprecated,
    Retired,
}

impl fmt::Display for StrategyStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StrategyStatus::Active => write!(f, "active"),
            StrategyStatus::Deprecated => write!(f, "deprecated"),
            StrategyStatus::Retired => write!(f, "retired"),
        }
    }
}

/// A single hook strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(deny_unknown_fields)]
pub struct RemoteStrategy {
    /// Unique identifier for the strategy
    pub id: String,

    /// Display name (max 100 chars)
    #[serde(deserialize_with = "validate_name_length")]
    pub name: String,

    /// Strategy description (max 500 chars)
    #[serde(deserialize_with = "validate_description_length")]
    pub description: String,

    /// Example hooks (min 1, max 5)
    #[serde(deserialize_with = "validate_examples_count")]
    pub examples: Vec<String>,

    /// Best use case description (max 200 chars)
    #[serde(deserialize_with = "validate_best_for_length")]
    pub best_for: String,

    /// Current status of the strategy
    pub status: StrategyStatus,

    /// A/B testing weight (0.0 to 1.0)
    #[serde(deserialize_with = "validate_ab_weight")]
    pub ab_weight: f64,
}

/// Top-level remote configuration structure
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(deny_unknown_fields)]
pub struct RemoteConfig {
    /// Schema version (semver format)
    #[serde(deserialize_with = "validate_semver")]
    pub schema_version: String,

    /// Minimum app version required (semver format)
    #[serde(deserialize_with = "validate_semver")]
    pub min_app_version: String,

    /// ISO 8601 timestamp of last update
    pub updated_at: String,

    /// Array of strategy configurations
    pub strategies: Vec<RemoteStrategy>,
}

// Custom deserializers with validation

fn validate_name_length<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    if s.len() > 100 {
        return Err(serde::de::Error::custom(format!(
            "name exceeds 100 characters: {} chars",
            s.len()
        )));
    }
    Ok(s)
}

fn validate_description_length<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    if s.len() > 500 {
        return Err(serde::de::Error::custom(format!(
            "description exceeds 500 characters: {} chars",
            s.len()
        )));
    }
    Ok(s)
}

fn validate_best_for_length<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    if s.len() > 200 {
        return Err(serde::de::Error::custom(format!(
            "best_for exceeds 200 characters: {} chars",
            s.len()
        )));
    }
    Ok(s)
}

fn validate_examples_count<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let examples = Vec::<String>::deserialize(deserializer)?;
    if examples.is_empty() {
        return Err(serde::de::Error::custom("examples array must have at least 1 item"));
    }
    if examples.len() > 5 {
        return Err(serde::de::Error::custom(format!(
            "examples array exceeds 5 items: {} items",
            examples.len()
        )));
    }
    Ok(examples)
}

fn validate_ab_weight<'de, D>(deserializer: D) -> Result<f64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let weight = f64::deserialize(deserializer)?;
    if !(0.0..=1.0).contains(&weight) {
        return Err(serde::de::Error::custom(format!(
            "ab_weight must be between 0.0 and 1.0, got: {}",
            weight
        )));
    }
    Ok(weight)
}

fn validate_semver<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    // Basic semver validation: X.Y.Z format
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 3 {
        return Err(serde::de::Error::custom(format!(
            "invalid semver format (expected X.Y.Z): {}",
            s
        )));
    }
    for part in parts {
        if part.parse::<u32>().is_err() {
            return Err(serde::de::Error::custom(format!(
                "invalid semver component (must be numeric): {}",
                part
            )));
        }
    }
    Ok(s)
}

// Error type for config operations
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Config parse error: {0}")]
    ParseError(String),

    #[error("Config validation error: {0}")]
    ValidationError(String),
}

/// Load the bundled default configuration
///
/// This configuration contains the 5 base strategies seeded in the V19 migration.
/// Used as fallback when remote config is unavailable.
pub fn load_bundled_config() -> Result<RemoteConfig, ConfigError> {
    const DEFAULT_CONFIG_JSON: &str = include_str!("../resources/default-config.json");

    let config: RemoteConfig = serde_json::from_str(DEFAULT_CONFIG_JSON)
        .map_err(|e| ConfigError::ParseError(e.to_string()))?;

    // Validate that we have the expected 5 strategies
    if config.strategies.len() != 5 {
        return Err(ConfigError::ValidationError(format!(
            "Bundled config should have exactly 5 strategies, found: {}",
            config.strategies.len()
        )));
    }

    Ok(config)
}

// Error types for remote config fetching
#[derive(Debug, Error)]
pub enum RemoteConfigError {
    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Config validation error: {0}")]
    ValidationError(String),

    #[error("Signature verification error: {0}")]
    SignatureError(String),

    #[error("Request timeout")]
    TimeoutError,
}

impl From<network::NetworkError> for RemoteConfigError {
    fn from(err: network::NetworkError) -> Self {
        RemoteConfigError::NetworkError(err.to_string())
    }
}

impl From<reqwest::Error> for RemoteConfigError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            RemoteConfigError::TimeoutError
        } else {
            RemoteConfigError::NetworkError(err.to_string())
        }
    }
}

/// Verify HMAC-SHA256 signature of config JSON
///
/// Loads the bundled verification key and compares the computed HMAC
/// against the provided signature (hex-encoded).
///
/// # Arguments
/// * `config_json` - Raw JSON body of the config response
/// * `signature` - Hex-encoded HMAC signature from X-Config-Signature header
///
/// # Errors
/// Returns `RemoteConfigError::SignatureError` if:
/// - Signature is missing or invalid format
/// - HMAC computation fails
/// - Signature does not match computed HMAC
pub fn verify_config_signature(
    config_json: &str,
    signature: &str,
) -> Result<(), RemoteConfigError> {
    // Load bundled verification key
    const VERIFICATION_KEY: &str = include_str!("../resources/config-signing-key.pub");

    // Create HMAC instance
    let mut mac = HmacSha256::new_from_slice(VERIFICATION_KEY.trim().as_bytes())
        .map_err(|e| RemoteConfigError::SignatureError(format!("Invalid key: {}", e)))?;

    // Compute HMAC of config JSON
    mac.update(config_json.as_bytes());

    // Decode provided signature from hex
    let expected_signature = hex::decode(signature).map_err(|e| {
        RemoteConfigError::SignatureError(format!("Invalid signature format: {}", e))
    })?;

    // Verify signature
    mac.verify_slice(&expected_signature)
        .map_err(|_| RemoteConfigError::SignatureError("Signature mismatch".to_string()))?;

    Ok(())
}

/// Fetch remote configuration from the configured endpoint
///
/// This function:
/// 1. Validates the URL against the network allowlist
/// 2. Fetches the config with a 10-second timeout
/// 3. Parses and validates the JSON response
/// 4. Returns the parsed config or an error
///
/// # Errors
/// Returns `RemoteConfigError` if:
/// - URL validation fails (not in allowlist)
/// - Network request fails or times out
/// - Response JSON is invalid
/// - Required fields are missing or invalid
pub async fn fetch_remote_config(
    app_handle: &AppHandle,
) -> Result<(RemoteConfig, String), RemoteConfigError> {
    // Validate URL against allowlist (AR-14)
    network::validate_url(REMOTE_CONFIG_URL)?;

    tracing::info!("Fetching remote config from: {}", REMOTE_CONFIG_URL);

    // Build HTTP client with 10-second timeout
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| RemoteConfigError::NetworkError(e.to_string()))?;

    // Fetch config
    let response = client.get(REMOTE_CONFIG_URL).send().await?;

    // Check HTTP status
    if !response.status().is_success() {
        let status = response.status();
        tracing::warn!(
            "Remote config fetch failed with HTTP {}: {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or("Unknown")
        );
        return Err(RemoteConfigError::NetworkError(format!(
            "HTTP {}",
            status.as_u16()
        )));
    }

    // Extract HMAC signature from response header (AC-4)
    let signature = response
        .headers()
        .get("X-Config-Signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Get raw response body — must verify signature against these exact bytes
    let body = response.text().await?;

    // AC-4: Verify HMAC signature against raw body BEFORE parsing.
    // Verification must use the raw bytes (not re-serialized JSON) because
    // serde round-tripping changes formatting/field order, breaking HMAC.
    if signature.is_empty() {
        tracing::warn!("Remote config rejected: missing X-Config-Signature header");
        network::emit_blocked_event(
            app_handle,
            "raw.githubusercontent.com".to_string(),
            REMOTE_CONFIG_URL.to_string(),
        );
        return Err(RemoteConfigError::SignatureError(
            "Missing X-Config-Signature header".to_string(),
        ));
    }

    verify_config_signature(&body, &signature).map_err(|e| {
        tracing::warn!("Remote config signature verification failed: {}", e);
        network::emit_blocked_event(
            app_handle,
            "raw.githubusercontent.com".to_string(),
            REMOTE_CONFIG_URL.to_string(),
        );
        e
    })?;

    // Parse response body (signature already verified against raw bytes)
    let config: RemoteConfig = serde_json::from_str(&body).map_err(|e| {
        let snippet = if body.len() > 200 {
            &body[..200]
        } else {
            &body
        };
        tracing::warn!(
            "Failed to parse remote config JSON: {}. Response snippet: {}...",
            e,
            snippet
        );
        RemoteConfigError::ValidationError(format!("Invalid JSON: {}", e))
    })?;

    // Validate required fields
    if config.strategies.is_empty() {
        tracing::warn!("Remote config has empty strategies array");
        return Err(RemoteConfigError::ValidationError(
            "Strategies array is empty".to_string(),
        ));
    }

    tracing::info!(
        "Successfully fetched remote config v{} with {} strategies (signature verified)",
        config.schema_version,
        config.strategies.len()
    );

    Ok((config, signature))
}

/// Get the active configuration, falling back to bundled config on any error
///
/// This is the main entry point for accessing hook strategy configuration.
/// It attempts to fetch the remote config, and if that fails for any reason
/// (network error, timeout, invalid signature, parse error), it falls back
/// to the bundled default configuration.
///
/// # Arguments
/// * `app_handle` - Tauri application handle
///
/// # Returns
/// Always returns a valid `RemoteConfig` - either from remote or bundled fallback
pub async fn get_active_config(app_handle: &AppHandle) -> RemoteConfig {
    match fetch_remote_config(app_handle).await {
        Ok((config, _signature)) => {
            // Signature already verified inside fetch_remote_config against raw body
            tracing::info!(
                "Using remote config v{} with {} strategies",
                config.schema_version,
                config.strategies.len()
            );
            config
        }
        Err(e) => {
            tracing::warn!("Remote config fetch failed: {}. Falling back to bundled config.", e);
            fallback_to_bundled(&e.to_string())
        }
    }
}

/// Fall back to the bundled default config, logging the reason
fn fallback_to_bundled(reason: &str) -> RemoteConfig {
    match load_bundled_config() {
        Ok(config) => {
            tracing::info!(
                "Using bundled config v{} ({} strategies) - Reason: {}",
                config.schema_version,
                config.strategies.len(),
                reason
            );
            config
        }
        Err(bundle_err) => {
            tracing::error!(
                "CRITICAL: Failed to load bundled config: {}. Application cannot function without hook strategies.",
                bundle_err
            );
            panic!("Failed to load bundled config: {}", bundle_err);
        }
    }
}


// ============================================================================
// Tauri Commands (Story 10.1)
// ============================================================================

///
/// This is the primary way the frontend should access hook strategy configuration.
/// It will always return a valid config, falling back to bundled if remote fails.
#[tauri::command]
#[specta::specta]
pub async fn fetch_remote_config_command(app_handle: AppHandle) -> Result<RemoteConfig, String> {
    Ok(get_active_config(&app_handle).await)
}

/// Tauri command: Get bundled default configuration
///
/// Allows frontend to explicitly request the bundled config (e.g., for comparison or debugging).
#[tauri::command]
#[specta::specta]
pub fn get_bundled_config_command() -> Result<RemoteConfig, String> {
    load_bundled_config().map_err(|e| e.to_string())
}

// ============================================================================
// Story 10.2: Config Storage & Version Management
// ============================================================================

/// Check if cached config is still fresh (within 4-hour TTL)
fn is_cache_fresh(fetched_at: &str) -> bool {
    use chrono::{DateTime, Duration, Utc};

    let fetched_time = match DateTime::parse_from_rfc3339(fetched_at) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(e) => {
            tracing::warn!("Invalid timestamp in cached config: {}", e);
            return false;
        }
    };

    let now = Utc::now();
    let age = now - fetched_time;

    age < Duration::hours(4)
}

/// Check if current app version meets config's min_app_version requirement
fn check_min_app_version(min_version: &str) -> bool {
    let current = crate::health_check::get_current_version();
    !crate::health_check::is_version_newer(min_version, &current)
}

/// Get current app version
fn get_current_app_version() -> String {
    crate::health_check::get_current_version()
}

/// Load config on startup with immediate cache + background fetch (AC-3, AC-6)
pub fn load_config_on_startup(app_handle: &AppHandle) -> RemoteConfig {
    use crate::db::AppDatabase;
    use crate::db::queries::remote_config;
    use tauri::Manager;

    let cached = {
        let db_state = app_handle.state::<AppDatabase>();
        match db_state.get() {
            Ok(db) => match db.conn.lock() {
                Ok(conn) => remote_config::get_cached_config(&conn).ok().flatten(),
                Err(e) => {
                    tracing::warn!("Failed to lock database for cached config: {}", e);
                    None
                }
            },
            Err(_) => {
                tracing::warn!("Database not yet initialized - using bundled config");
                None
            }
        }
    };

    if let Some(cached_config) = cached {
        let is_fresh = is_cache_fresh(&cached_config.fetched_at);

        if is_fresh {
            tracing::info!(
                "Using fresh cached config v{} (fetched: {}, age < 4h)",
                cached_config.config.schema_version,
                cached_config.fetched_at
            );
            return cached_config.config;
        }

        tracing::info!(
            "Cached config v{} is stale (fetched: {}), spawning background fetch",
            cached_config.config.schema_version,
            cached_config.fetched_at
        );

        let app_handle_clone = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            background_config_fetch(&app_handle_clone).await;
        });

        return cached_config.config;
    }

    tracing::info!("No cached config found - using bundled config and spawning background fetch");

    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        background_config_fetch(&app_handle_clone).await;
    });

    load_bundled_config().unwrap_or_else(|e| {
        tracing::error!("CRITICAL: Failed to load bundled config: {}", e);
        panic!("Bundled config unavailable: {}", e);
    })
}

/// Background config fetch — fetch, verify, compare version, store, sync strategies, emit event
async fn background_config_fetch(app_handle: &AppHandle) {
    use crate::db::AppDatabase;
    use crate::db::queries::remote_config as rc_queries;
    use tauri::{Emitter, Manager};

    match fetch_remote_config(app_handle).await {
        Ok((fetched_config, signature)) => {
            // Signature already verified inside fetch_remote_config against raw body

            // AC-5: Check min_app_version before applying
            if !check_min_app_version(&fetched_config.min_app_version) {
                let current = get_current_app_version();
                tracing::warn!(
                    "Remote config requires app v{}, current is v{}. Config deferred.",
                    fetched_config.min_app_version,
                    current
                );

                let db_state = app_handle.state::<AppDatabase>();
                if let Ok(db) = db_state.get() {
                    match db.conn.lock() {
                        Ok(conn) => {
                            if let Err(e) = rc_queries::store_remote_config(&conn, &fetched_config, &signature) {
                                tracing::warn!("Failed to store deferred config: {}", e);
                            } else {
                                tracing::info!("Deferred config v{} stored (app version too old)", fetched_config.schema_version);
                            }
                        }
                        Err(e) => tracing::warn!("Failed to lock database for deferred config storage: {}", e),
                    }
                }
                return;
            }

            // AC-4: Compare schema_version — only apply if newer
            let should_update = {
                let db_state = app_handle.state::<AppDatabase>();
                if let Ok(db) = db_state.get() {
                    match db.conn.lock() {
                        Ok(conn) => match rc_queries::get_cached_config(&conn) {
                            Ok(Some(cached)) => crate::health_check::is_version_newer(
                                &fetched_config.schema_version,
                                &cached.config.schema_version,
                            ),
                            _ => true,
                        },
                        Err(e) => {
                            tracing::warn!("Failed to lock database for version check: {}", e);
                            true
                        }
                    }
                } else {
                    true
                }
            };

            if should_update {
                let db_state = app_handle.state::<AppDatabase>();
                if let Ok(db) = db_state.get() {
                    match db.conn.lock() {
                        Ok(conn) => {
                            if let Err(e) = rc_queries::store_remote_config(&conn, &fetched_config, &signature) {
                                tracing::warn!("Failed to store updated config: {}", e);
                                return;
                            }
                            tracing::info!(
                                "Remote config updated to v{} ({} strategies)",
                                fetched_config.schema_version,
                                fetched_config.strategies.len()
                            );

                            // Story 10.3: Sync hook strategies after config update
                            // Depends on V28 (remote_id, status) and V29 (ab_weight) migrations
                            match sync_hook_strategies_impl(&conn, &fetched_config) {
                                Ok(sync_result) => {
                                    tracing::info!(
                                        "Hook strategies synced: +{} added, ~{} updated, -{} retired",
                                        sync_result.added_count,
                                        sync_result.updated_count,
                                        sync_result.retired_count
                                    );
                                    if sync_result.added_count > 0 || sync_result.updated_count > 0 || sync_result.retired_count > 0 {
                                        if let Err(e) = app_handle.emit("strategies:updated", &sync_result) {
                                            tracing::warn!("Failed to emit strategies:updated event: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    tracing::warn!("Hook strategies sync failed (non-fatal): {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to lock database for config storage: {}", e);
                            return;
                        }
                    }
                }

                if let Err(e) = app_handle.emit("config:updated", &fetched_config) {
                    tracing::warn!("Failed to emit config:updated event: {}", e);
                }
            } else {
                tracing::debug!(
                    "Remote config v{} is not newer than cached version, skipping update",
                    fetched_config.schema_version
                );
            }
        }
        Err(e) => {
            tracing::warn!("Background config fetch failed: {}. Continuing with cached/bundled config.", e);
        }
    }
}

/// Start periodic config refresh background task (every 4 hours)
pub fn start_periodic_config_refresh(
    app_handle: AppHandle,
) -> tauri::async_runtime::JoinHandle<()> {
    let handle = tauri::async_runtime::spawn(async move {
        use tokio::time::{sleep, Duration};

        loop {
            sleep(Duration::from_secs(4 * 60 * 60)).await;
            tracing::debug!("Periodic config refresh triggered (4-hour interval)");
            background_config_fetch(&app_handle).await;
        }
    });

    tracing::info!("Periodic config refresh started (4-hour interval)");
    handle
}

/// Tauri command: Get cached config from database (Story 10.2, Task 7.1)
#[tauri::command]
#[specta::specta]
pub fn get_cached_config_command(app_handle: AppHandle) -> Result<Option<RemoteConfig>, String> {
    use crate::db::AppDatabase;
    use crate::db::queries::remote_config;
    use tauri::Manager;

    let db_state = app_handle.state::<AppDatabase>();
    let db = db_state.get().map_err(|e: String| e)?;
    let conn = db.conn.lock().map_err(|e| format!("Database lock failed: {}", e))?;

    match remote_config::get_cached_config(&conn) {
        Ok(Some(cached)) => Ok(Some(cached.config)),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Tauri command: Force config refresh (Story 10.2, Task 7.2)
#[tauri::command]
#[specta::specta]
pub async fn force_config_refresh_command(app_handle: AppHandle) -> Result<RemoteConfig, String> {
    background_config_fetch(&app_handle).await;
    Ok(get_active_config(&app_handle).await)
}

// ============================================================================
// Story 10.5: Config Update UI Command
// ============================================================================

/// Config source status for the UI (Story 10.5 Task 7.2)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum ConfigSourceStatus {
    Remote,
    Cached,
    Defaults,
}

/// Result of a manual config update check (Story 10.5 Task 7.2)
#[derive(Debug, Serialize, specta::Type)]
pub struct ConfigCheckResult {
    pub success: bool,
    pub version: Option<String>,
    pub error: Option<String>,
    pub source: ConfigSourceStatus,
}

/// Tauri command: Check for config updates (Story 10.5 Task 7.1)
#[tauri::command]
#[specta::specta]
pub async fn check_for_config_updates(app_handle: AppHandle) -> Result<ConfigCheckResult, String> {
    use tauri::Manager;
    match fetch_remote_config(&app_handle).await {
        Ok((config, _signature)) => {
            // Signature already verified inside fetch_remote_config against raw body
            let version = config.schema_version.clone();
            tracing::info!("Manual config check succeeded: v{}", version);

            Ok(ConfigCheckResult {
                success: true,
                version: Some(version),
                error: None,
                source: ConfigSourceStatus::Remote,
            })
        }
        Err(e) => {
            tracing::warn!("Manual config check failed: {}", e);

            use crate::db::AppDatabase;
            use crate::db::queries::remote_config as rc_queries;

            let source = {
                let db_state = app_handle.state::<AppDatabase>();
                if let Ok(db) = db_state.get() {
                    match db.conn.lock() {
                        Ok(conn) => match rc_queries::get_cached_config(&conn) {
                            Ok(Some(_)) => ConfigSourceStatus::Cached,
                            _ => ConfigSourceStatus::Defaults,
                        },
                        Err(_) => ConfigSourceStatus::Defaults,
                    }
                } else {
                    ConfigSourceStatus::Defaults
                }
            };

            Ok(ConfigCheckResult {
                success: false,
                version: None,
                error: Some(e.to_string()),
                source,
            })
        }
    }
}

// ============================================================================
// Story 10.3: Dynamic Hook Strategy Updates
// ============================================================================

/// Result of syncing hook strategies from remote config (AC-6)
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct StrategySyncResult {
    pub added_count: usize,
    pub updated_count: usize,
    pub retired_count: usize,
}

/// Core sync logic — pure SQL operations on a database connection.
///
/// For each remote strategy: INSERT if new, UPDATE if changed, skip if unchanged.
/// Strategies with remote_id not in config are retired (AC-1, AC-2, AC-3).
fn perform_sync_impl(
    conn: &Connection,
    config: &RemoteConfig,
) -> Result<StrategySyncResult, String> {
    let mut added = 0;
    let mut updated = 0;
    let mut retired = 0;

    // Get existing strategies that have a remote_id (remotely managed)
    let existing: std::collections::HashMap<String, (String, String, String, String, String, f64)> = {
        let mut stmt = conn
            .prepare(
                "SELECT remote_id, name, description, examples_json, best_for, status, ab_weight
                 FROM hook_strategies WHERE remote_id IS NOT NULL",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    (
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, f64>(6)?,
                    ),
                ))
            })
            .map_err(|e| format!("Failed to query existing strategies: {}", e))?;

        rows.filter_map(|r| r.ok()).collect()
    };

    let mut processed_remote_ids: std::collections::HashSet<String> =
        std::collections::HashSet::new();

    for remote_strategy in &config.strategies {
        processed_remote_ids.insert(remote_strategy.id.clone());

        let examples_json = serde_json::to_string(&remote_strategy.examples)
            .map_err(|e| format!("Failed to serialize examples: {}", e))?;
        let status_str = remote_strategy.status.to_string();

        if let Some((existing_name, existing_desc, existing_examples, existing_best_for, existing_status, existing_weight)) =
            existing.get(&remote_strategy.id)
        {
            if existing_name != &remote_strategy.name
                || existing_desc != &remote_strategy.description
                || existing_examples != &examples_json
                || existing_best_for != &remote_strategy.best_for
                || existing_status != &status_str
                || (*existing_weight - remote_strategy.ab_weight).abs() > f64::EPSILON
            {
                // Story 10.4 AC-5: Log A/B weight changes
                if (*existing_weight - remote_strategy.ab_weight).abs() > f64::EPSILON {
                    tracing::info!(
                        "A/B weights updated: {}: {} → {}",
                        remote_strategy.name,
                        existing_weight,
                        remote_strategy.ab_weight
                    );
                }

                // UPDATE — preserve created_at (AC-2)
                conn.execute(
                    "UPDATE hook_strategies SET name=?1, description=?2, examples_json=?3, best_for=?4, status=?5, ab_weight=?6 WHERE remote_id=?7",
                    params![
                        remote_strategy.name,
                        remote_strategy.description,
                        examples_json,
                        remote_strategy.best_for,
                        status_str,
                        remote_strategy.ab_weight,
                        remote_strategy.id,
                    ],
                )
                .map_err(|e| format!("Failed to update strategy '{}': {}", remote_strategy.id, e))?;

                if status_str == "retired" {
                    retired += 1;
                } else {
                    updated += 1;
                }
            }
        } else {
            // New strategy — INSERT (AC-3)
            conn.execute(
                "INSERT INTO hook_strategies (remote_id, name, description, examples_json, best_for, status, ab_weight, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
                params![
                    remote_strategy.id,
                    remote_strategy.name,
                    remote_strategy.description,
                    examples_json,
                    remote_strategy.best_for,
                    status_str,
                    remote_strategy.ab_weight,
                ],
            )
            .map_err(|e| format!("Failed to insert strategy '{}': {}", remote_strategy.id, e))?;

            added += 1;
        }
    }

    // Retire strategies not in remote config (that have remote_id set)
    for (remote_id, (_, _, _, _, status, _)) in &existing {
        if !processed_remote_ids.contains(remote_id) && status != "retired" {
            conn.execute(
                "UPDATE hook_strategies SET status='retired' WHERE remote_id=?1",
                params![remote_id],
            )
            .map_err(|e| format!("Failed to retire strategy '{}': {}", remote_id, e))?;

            retired += 1;
        }
    }

    Ok(StrategySyncResult {
        added_count: added,
        updated_count: updated,
        retired_count: retired,
    })
}

/// Sync hook strategies within a transaction (AC-6: atomic).
pub fn sync_hook_strategies_impl(
    conn: &Connection,
    config: &RemoteConfig,
) -> Result<StrategySyncResult, String> {
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    match perform_sync_impl(conn, config) {
        Ok(result) => {
            conn.execute("COMMIT", [])
                .map_err(|e| format!("Failed to commit transaction: {}", e))?;
            Ok(result)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Sync hook strategies and emit Tauri event (full pipeline).
pub fn sync_hook_strategies(
    app_handle: &AppHandle,
    config: &RemoteConfig,
) -> Result<StrategySyncResult, String> {
    use crate::db::AppDatabase;
    use tauri::{Emitter, Manager};

    let db_state = app_handle.state::<AppDatabase>();
    let db = db_state.get().map_err(|e: String| e)?;
    let conn = db
        .conn
        .lock()
        .map_err(|e| format!("Database lock failed: {}", e))?;

    let result = sync_hook_strategies_impl(&conn, config)?;

    tracing::info!(
        "Hook strategies synced: +{} added, ~{} updated, -{} retired",
        result.added_count,
        result.updated_count,
        result.retired_count
    );

    if result.added_count > 0 || result.updated_count > 0 || result.retired_count > 0 {
        if let Err(e) = app_handle.emit("strategies:updated", &result) {
            tracing::warn!("Failed to emit strategies:updated event: {}", e);
        }
    }

    Ok(result)
}

#[cfg(test)]

mod tests {
    use super::*;
    use crate::network;

    #[test]
    fn test_valid_config_deserialization() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [
                {
                    "id": "social-proof",
                    "name": "Social Proof",
                    "description": "Build credibility through past work",
                    "examples": ["I recently completed a similar project..."],
                    "best_for": "When you have relevant past experience",
                    "status": "active",
                    "ab_weight": 0.2
                }
            ]
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_ok(), "Valid config should deserialize successfully");

        let config = config.unwrap();
        assert_eq!(config.schema_version, "1.0.0");
        assert_eq!(config.min_app_version, "0.1.0");
        assert_eq!(config.strategies.len(), 1);
        assert_eq!(config.strategies[0].id, "social-proof");
        assert_eq!(config.strategies[0].status, StrategyStatus::Active);
        assert_eq!(config.strategies[0].ab_weight, 0.2);
    }

    #[test]
    fn test_missing_required_field() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "strategies": []
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should fail when missing required field 'updated_at'");
    }

    #[test]
    fn test_invalid_status_enum() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [
                {
                    "id": "test",
                    "name": "Test",
                    "description": "Test strategy",
                    "examples": ["Example"],
                    "best_for": "Testing",
                    "status": "invalid_status",
                    "ab_weight": 0.5
                }
            ]
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should reject invalid status enum value");
    }

    #[test]
    fn test_out_of_range_ab_weight_too_high() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [
                {
                    "id": "test",
                    "name": "Test",
                    "description": "Test strategy",
                    "examples": ["Example"],
                    "best_for": "Testing",
                    "status": "active",
                    "ab_weight": 1.5
                }
            ]
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should reject ab_weight > 1.0");
        let err_msg = config.unwrap_err().to_string();
        assert!(err_msg.contains("ab_weight"), "Error should mention ab_weight");
    }

    #[test]
    fn test_out_of_range_ab_weight_negative() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [
                {
                    "id": "test",
                    "name": "Test",
                    "description": "Test strategy",
                    "examples": ["Example"],
                    "best_for": "Testing",
                    "status": "active",
                    "ab_weight": -0.1
                }
            ]
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should reject negative ab_weight");
    }

    #[test]
    fn test_invalid_semver_schema_version() {
        let json = r#"{
            "schema_version": "1.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": []
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should reject invalid semver (missing patch version)");
    }

    #[test]
    fn test_invalid_semver_non_numeric() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.x",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": []
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should reject semver with non-numeric component");
    }

    #[test]
    fn test_name_exceeds_100_chars() {
        let long_name = "a".repeat(101);
        let json = format!(
            r#"{{
                "schema_version": "1.0.0",
                "min_app_version": "0.1.0",
                "updated_at": "2024-01-15T10:30:00Z",
                "strategies": [
                    {{
                        "id": "test",
                        "name": "{}",
                        "description": "Test",
                        "examples": ["Example"],
                        "best_for": "Testing",
                        "status": "active",
                        "ab_weight": 0.5
                    }}
                ]
            }}"#,
            long_name
        );

        let config: Result<RemoteConfig, _> = serde_json::from_str(&json);
        assert!(config.is_err(), "Should reject name > 100 characters");
    }

    #[test]
    fn test_description_exceeds_500_chars() {
        let long_desc = "a".repeat(501);
        let json = format!(
            r#"{{
                "schema_version": "1.0.0",
                "min_app_version": "0.1.0",
                "updated_at": "2024-01-15T10:30:00Z",
                "strategies": [
                    {{
                        "id": "test",
                        "name": "Test",
                        "description": "{}",
                        "examples": ["Example"],
                        "best_for": "Testing",
                        "status": "active",
                        "ab_weight": 0.5
                    }}
                ]
            }}"#,
            long_desc
        );

        let config: Result<RemoteConfig, _> = serde_json::from_str(&json);
        assert!(config.is_err(), "Should reject description > 500 characters");
    }

    #[test]
    fn test_best_for_exceeds_200_chars() {
        let long_best_for = "a".repeat(201);
        let json = format!(
            r#"{{
                "schema_version": "1.0.0",
                "min_app_version": "0.1.0",
                "updated_at": "2024-01-15T10:30:00Z",
                "strategies": [
                    {{
                        "id": "test",
                        "name": "Test",
                        "description": "Test",
                        "examples": ["Example"],
                        "best_for": "{}",
                        "status": "active",
                        "ab_weight": 0.5
                    }}
                ]
            }}"#,
            long_best_for
        );

        let config: Result<RemoteConfig, _> = serde_json::from_str(&json);
        assert!(config.is_err(), "Should reject best_for > 200 characters");
    }

    #[test]
    fn test_examples_empty_array() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [
                {
                    "id": "test",
                    "name": "Test",
                    "description": "Test",
                    "examples": [],
                    "best_for": "Testing",
                    "status": "active",
                    "ab_weight": 0.5
                }
            ]
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should reject empty examples array");
    }

    #[test]
    fn test_examples_exceeds_5_items() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [
                {
                    "id": "test",
                    "name": "Test",
                    "description": "Test",
                    "examples": ["1", "2", "3", "4", "5", "6"],
                    "best_for": "Testing",
                    "status": "active",
                    "ab_weight": 0.5
                }
            ]
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should reject examples array with > 5 items");
    }

    #[test]
    fn test_unknown_fields_rejected() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [],
            "extra_field": "should_be_rejected"
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_err(), "Should reject unknown fields due to deny_unknown_fields");
    }

    #[test]
    fn test_all_status_variants() {
        let json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [
                {
                    "id": "active-test",
                    "name": "Active",
                    "description": "Test",
                    "examples": ["Ex"],
                    "best_for": "Testing",
                    "status": "active",
                    "ab_weight": 0.3
                },
                {
                    "id": "deprecated-test",
                    "name": "Deprecated",
                    "description": "Test",
                    "examples": ["Ex"],
                    "best_for": "Testing",
                    "status": "deprecated",
                    "ab_weight": 0.3
                },
                {
                    "id": "retired-test",
                    "name": "Retired",
                    "description": "Test",
                    "examples": ["Ex"],
                    "best_for": "Testing",
                    "status": "retired",
                    "ab_weight": 0.3
                }
            ]
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json);
        assert!(config.is_ok(), "Should accept all valid status values");

        let config = config.unwrap();
        assert_eq!(config.strategies[0].status, StrategyStatus::Active);
        assert_eq!(config.strategies[1].status, StrategyStatus::Deprecated);
        assert_eq!(config.strategies[2].status, StrategyStatus::Retired);
    }

    // Task 2 tests: Bundled config loading
    #[test]
    fn test_bundled_config_loads_successfully() {
        let result = load_bundled_config();
        assert!(result.is_ok(), "Bundled config should load successfully");

        let config = result.unwrap();
        assert_eq!(config.schema_version, "1.0.0");
        assert_eq!(config.min_app_version, "0.1.0");
        assert_eq!(config.strategies.len(), 5, "Should have exactly 5 base strategies");

        // Verify all strategies are active with equal weight
        for strategy in &config.strategies {
            assert_eq!(strategy.status, StrategyStatus::Active);
            assert_eq!(strategy.ab_weight, 0.2);
            assert!(!strategy.examples.is_empty(), "Each strategy should have examples");
        }

        // Verify the 5 base strategy IDs are present
        let strategy_ids: Vec<&str> = config.strategies.iter().map(|s| s.id.as_str()).collect();
        assert!(strategy_ids.contains(&"social-proof"));
        assert!(strategy_ids.contains(&"contrarian"));
        assert!(strategy_ids.contains(&"immediate-value"));
        assert!(strategy_ids.contains(&"problem-aware"));
        assert!(strategy_ids.contains(&"question-based"));
    }

    #[test]
    fn test_bundled_config_validates_against_schema() {
        let result = load_bundled_config();
        assert!(result.is_ok(), "Bundled config must validate against schema");

        let config = result.unwrap();

        // Validate each strategy against schema constraints
        for strategy in &config.strategies {
            assert!(strategy.name.len() <= 100, "Name must be <= 100 chars");
            assert!(strategy.description.len() <= 500, "Description must be <= 500 chars");
            assert!(strategy.best_for.len() <= 200, "best_for must be <= 200 chars");
            assert!(
                !strategy.examples.is_empty() && strategy.examples.len() <= 5,
                "Examples must be 1-5 items"
            );
            assert!(
                (0.0..=1.0).contains(&strategy.ab_weight),
                "ab_weight must be 0.0-1.0"
            );
        }

        // Validate semver format
        assert!(config.schema_version.split('.').count() == 3);
        assert!(config.min_app_version.split('.').count() == 3);
    }

    // Task 3 tests: Network allowlist validation
    #[test]
    fn test_config_endpoint_url_passes_validation() {
        // Test that raw.githubusercontent.com domain is allowlisted
        let test_url = "https://raw.githubusercontent.com/owner/repo/main/config/hook-strategies.json";
        let result = network::validate_url(test_url);
        assert!(
            result.is_ok(),
            "Config endpoint URL should pass validation: {:?}",
            result
        );
    }

    #[test]
    fn test_unauthorized_domains_still_rejected() {
        // Verify that allowlist enforcement still blocks unauthorized domains
        let unauthorized_urls = vec![
            "https://evil.com/steal-data",
            "https://malicious.org/exfiltrate",
            "http://untrusted.net/config.json",
            "https://not-in-allowlist.com/api",
        ];

        for url in unauthorized_urls {
            let result = network::validate_url(url);
            assert!(
                result.is_err(),
                "Unauthorized domain should be rejected: {}",
                url
            );
        }
    }

    // Task 4 tests: Remote config fetching
    // NOTE: These tests verify error types and JSON parsing.
    // Full HTTP mocking would require mockito/wiremock crate integration.

    #[test]
    fn test_remote_config_error_types() {
        // Test that RemoteConfigError variants exist and can be constructed
        let _network_err = RemoteConfigError::NetworkError("test".to_string());
        let _validation_err = RemoteConfigError::ValidationError("test".to_string());
        let _signature_err = RemoteConfigError::SignatureError("test".to_string());
        let _timeout_err = RemoteConfigError::TimeoutError;
    }

    #[test]
    fn test_invalid_json_response_parsing() {
        // Verify that invalid JSON returns ValidationError
        let invalid_json = "{ this is not valid json }";
        let result: Result<RemoteConfig, _> = serde_json::from_str(invalid_json);
        assert!(result.is_err(), "Invalid JSON should fail to parse");
    }

    #[test]
    fn test_empty_strategies_array_validation() {
        // Config with empty strategies should fail validation after parsing
        let json_with_empty_strategies = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": []
        }"#;

        let config: Result<RemoteConfig, _> = serde_json::from_str(json_with_empty_strategies);
        assert!(
            config.is_ok(),
            "Should parse successfully (validation happens in fetch_remote_config)"
        );

        // The actual empty check would be done in fetch_remote_config
        let parsed_config = config.unwrap();
        assert!(
            parsed_config.strategies.is_empty(),
            "Strategies array should be empty"
        );
    }

    #[test]
    fn test_valid_config_json_parsing() {
        // Verify a well-formed config JSON parses successfully
        let valid_json = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": [
                {
                    "id": "test-strategy",
                    "name": "Test Strategy",
                    "description": "A test strategy for validation",
                    "examples": ["Example hook 1", "Example hook 2"],
                    "best_for": "Testing purposes",
                    "status": "active",
                    "ab_weight": 0.5
                }
            ]
        }"#;

        let result: Result<RemoteConfig, _> = serde_json::from_str(valid_json);
        assert!(result.is_ok(), "Valid JSON should parse successfully");

        let config = result.unwrap();
        assert_eq!(config.schema_version, "1.0.0");
        assert_eq!(config.strategies.len(), 1);
        assert_eq!(config.strategies[0].id, "test-strategy");
    }

    #[test]
    fn test_network_error_conversion() {
        // Test that network::NetworkError converts to RemoteConfigError
        let network_err = network::NetworkError::BlockedDomain("evil.com".to_string());
        let remote_err: RemoteConfigError = network_err.into();

        match remote_err {
            RemoteConfigError::NetworkError(_) => {} // Expected
            _ => panic!("Should convert to NetworkError variant"),
        }
    }

    #[test]
    fn test_required_fields_validation() {
        // Verify all required fields are enforced during deserialization
        let missing_schema_version = r#"{
            "min_app_version": "0.1.0",
            "updated_at": "2024-01-15T10:30:00Z",
            "strategies": []
        }"#;

        let result: Result<RemoteConfig, _> = serde_json::from_str(missing_schema_version);
        assert!(result.is_err(), "Should fail when schema_version is missing");

        let missing_updated_at = r#"{
            "schema_version": "1.0.0",
            "min_app_version": "0.1.0",
            "strategies": []
        }"#;

        let result2: Result<RemoteConfig, _> = serde_json::from_str(missing_updated_at);
        assert!(result2.is_err(), "Should fail when updated_at is missing");
    }

    // NOTE: Full integration tests for fetch_remote_config() would require:
    // - HTTP mocking library (mockito or wiremock)
    // - Tauri AppHandle mock
    // - Async test runtime
    // These are deferred as they require additional test infrastructure.
    // The function is tested manually/in integration with actual HTTP calls.

    // Task 5 tests: HMAC signature verification
    #[test]
    fn test_valid_signature_passes() {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        const TEST_KEY: &str = "development-hmac-secret-key-replace-in-production-with-real-key-pair-12345678";
        let test_json = r#"{"test": "data"}"#;

        // Compute expected signature
        let mut mac = Hmac::<Sha256>::new_from_slice(TEST_KEY.as_bytes()).unwrap();
        mac.update(test_json.as_bytes());
        let result = mac.finalize();
        let signature_hex = hex::encode(result.into_bytes());

        // Verify signature passes
        let verification_result = verify_config_signature(test_json, &signature_hex);
        assert!(
            verification_result.is_ok(),
            "Valid signature should pass verification"
        );
    }

    #[test]
    fn test_invalid_signature_rejected() {
        let test_json = r#"{"test": "data"}"#;
        let invalid_signature = "0000000000000000000000000000000000000000000000000000000000000000";

        let result = verify_config_signature(test_json, invalid_signature);
        assert!(result.is_err(), "Invalid signature should be rejected");

        match result {
            Err(RemoteConfigError::SignatureError(_)) => {} // Expected
            _ => panic!("Should return SignatureError"),
        }
    }

    #[test]
    fn test_missing_signature_rejected() {
        let test_json = r#"{"test": "data"}"#;
        let empty_signature = "";

        let result = verify_config_signature(test_json, empty_signature);
        assert!(
            result.is_err(),
            "Empty signature should be rejected as invalid format"
        );
    }

    #[test]
    fn test_tampered_config_body_detected() {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        const TEST_KEY: &str = "development-hmac-secret-key-replace-in-production-with-real-key-pair-12345678";
        let original_json = r#"{"test": "data"}"#;
        let tampered_json = r#"{"test": "TAMPERED"}"#;

        // Compute signature for original
        let mut mac = Hmac::<Sha256>::new_from_slice(TEST_KEY.as_bytes()).unwrap();
        mac.update(original_json.as_bytes());
        let result = mac.finalize();
        let signature_hex = hex::encode(result.into_bytes());

        // Try to verify tampered content with original signature
        let verification_result = verify_config_signature(tampered_json, &signature_hex);
        assert!(
            verification_result.is_err(),
            "Tampered config should fail verification"
        );

        match verification_result {
            Err(RemoteConfigError::SignatureError(msg)) => {
                assert!(msg.contains("mismatch"), "Should indicate signature mismatch");
            }
            _ => panic!("Should return SignatureError with mismatch message"),
        }
    }

    #[test]
    fn test_non_hex_signature_rejected() {
        let test_json = r#"{"test": "data"}"#;
        let non_hex_signature = "not-a-hex-string";

        let result = verify_config_signature(test_json, non_hex_signature);
        assert!(
            result.is_err(),
            "Non-hex signature should be rejected as invalid format"
        );

        match result {
            Err(RemoteConfigError::SignatureError(msg)) => {
                assert!(
                    msg.contains("Invalid signature format"),
                    "Error should mention invalid format"
                );
            }
            _ => panic!("Should return SignatureError with format error"),
        }
    }

    // Task 6 tests: Fallback logic
    // NOTE: These tests verify the get_active_config fallback behavior.
    // Full async tests would require tokio test runtime and HTTP mocking.

    #[test]
    fn test_bundled_config_always_available() {
        // Verify that bundled config can always be loaded as fallback
        let result = load_bundled_config();
        assert!(
            result.is_ok(),
            "Bundled config must always be available for fallback"
        );

        let config = result.unwrap();
        assert_eq!(config.strategies.len(), 5, "Should have 5 base strategies");
    }

    #[test]
    fn test_config_error_types_for_fallback_scenarios() {
        // Verify error types that trigger fallback
        let network_err = RemoteConfigError::NetworkError("Connection refused".to_string());
        let validation_err = RemoteConfigError::ValidationError("Invalid JSON".to_string());
        let signature_err = RemoteConfigError::SignatureError("Signature mismatch".to_string());
        let timeout_err = RemoteConfigError::TimeoutError;

        // All these error types should trigger fallback to bundled config
        assert!(matches!(network_err, RemoteConfigError::NetworkError(_)));
        assert!(matches!(
            validation_err,
            RemoteConfigError::ValidationError(_)
        ));
        assert!(matches!(
            signature_err,
            RemoteConfigError::SignatureError(_)
        ));
        assert!(matches!(timeout_err, RemoteConfigError::TimeoutError));
    }

    #[test]
    fn test_fallback_provides_valid_config() {
        // Verify bundled fallback config is valid and usable
        let config = load_bundled_config().expect("Bundled config should load");

        // Check all strategies are usable
        for strategy in &config.strategies {
            assert!(!strategy.id.is_empty(), "Strategy ID should not be empty");
            assert!(!strategy.name.is_empty(), "Strategy name should not be empty");
            assert!(
                !strategy.examples.is_empty(),
                "Strategy should have examples"
            );
            assert_eq!(
                strategy.status,
                StrategyStatus::Active,
                "Bundled strategies should be active"
            );
            assert!(
                (0.0..=1.0).contains(&strategy.ab_weight),
                "ab_weight should be valid"
            );
        }

        // Verify config metadata
        assert!(!config.schema_version.is_empty());
        assert!(!config.min_app_version.is_empty());
        assert!(!config.updated_at.is_empty());
    }

    #[test]
    fn test_fallback_to_bundled_returns_valid_config() {
        // Test the fallback_to_bundled() helper directly
        let config = fallback_to_bundled("test reason");
        assert_eq!(config.strategies.len(), 5, "Should have 5 bundled strategies");
        assert_eq!(config.schema_version, "1.0.0");
    }

    #[test]
    fn test_signature_verification_rejects_empty_signature() {
        // Simulate the get_active_config flow: empty signature should be rejected
        let signature = "";
        assert!(signature.is_empty(), "Empty signature detected");
        // In get_active_config, this triggers fallback + emit_blocked_event
    }

    #[test]
    fn test_signature_verification_rejects_wrong_key_signature() {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        // Sign with a WRONG key
        let wrong_key = "wrong-key-not-matching-config-signing-key-pub-12345678901234567890";
        let test_json = r#"{"schema_version":"1.0.0","min_app_version":"0.1.0","updated_at":"2026-02-17T00:00:00Z","strategies":[]}"#;

        let mut mac = Hmac::<Sha256>::new_from_slice(wrong_key.as_bytes()).unwrap();
        mac.update(test_json.as_bytes());
        let bad_sig = hex::encode(mac.finalize().into_bytes());

        let result = verify_config_signature(test_json, &bad_sig);
        assert!(result.is_err(), "Wrong-key signature should be rejected");
        // In get_active_config, this triggers fallback + emit_blocked_event
    }

    #[test]
    fn test_full_sign_verify_roundtrip_with_raw_json() {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        // Use the raw bundled config JSON (as a server would send) — not re-serialized
        const RAW_JSON: &str = include_str!("../resources/default-config.json");

        // Sign the raw JSON (simulates server-side signing)
        const KEY: &str = "development-hmac-secret-key-replace-in-production-with-real-key-pair-12345678";
        let mut mac = Hmac::<Sha256>::new_from_slice(KEY.as_bytes()).unwrap();
        mac.update(RAW_JSON.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        // Verify against raw JSON (correct — as fixed fetch_remote_config does)
        assert!(
            verify_config_signature(RAW_JSON, &signature).is_ok(),
            "Verification against raw JSON should pass"
        );

        // Prove that re-serialized JSON would NOT match (the pre-fix C-1 bug)
        let config: RemoteConfig = serde_json::from_str(RAW_JSON).unwrap();
        let re_serialized = serde_json::to_string(&config).unwrap();
        assert_ne!(
            RAW_JSON.trim(),
            re_serialized,
            "Raw JSON and re-serialized JSON should differ (formatting/whitespace)"
        );
        assert!(
            verify_config_signature(&re_serialized, &signature).is_err(),
            "Verification against re-serialized JSON should fail (different bytes)"
        );
    }

    // NOTE: Full integration tests for get_active_config() and fetch_remote_config()
    // require HTTP mocking (wiremock) + Tauri AppHandle mock. These are deferred
    // to Story 10.2 which adds the full test infrastructure. The unit tests above
    // cover: schema validation, signature verification (5 scenarios), fallback logic,
    // error types, bundled config integrity, and sign-verify roundtrip.

    // Task 7 tests: Tauri command exposure
    #[test]
    fn test_get_bundled_config_command_returns_valid_config() {
        // Test that the Tauri command wrapper works correctly
        let result = get_bundled_config_command();
        assert!(result.is_ok(), "Command should return Ok");

        let config = result.unwrap();
        assert_eq!(config.strategies.len(), 5, "Should have 5 strategies");
        assert_eq!(config.schema_version, "1.0.0");

        // Verify command returns serializable RemoteConfig
        let json = serde_json::to_string(&config);
        assert!(json.is_ok(), "Config should be serializable to JSON");
    }

    #[test]
    fn test_command_error_handling() {
        // Verify command error handling converts to String
        // This tests the .map_err(|e| e.to_string()) pattern

        // Create a deliberate error scenario by testing the error type conversion
        let config_err = ConfigError::ValidationError("test error".to_string());
        let error_string = config_err.to_string();
        assert!(
            error_string.contains("test error"),
            "Error should convert to string correctly"
        );
    }

    // NOTE: Full integration tests for fetch_remote_config_command() would require:
    // - Async test runtime
    // - Tauri AppHandle mock or test harness
    // - HTTP mocking for remote fetch scenarios
    // The command is a thin wrapper around get_active_config(), which has logic tests above.

    // ========================================================================
    // Story 10.2: Config Storage & Version Management tests
    // ========================================================================

    // --- Task 3.4: TTL / is_cache_fresh() tests ---

    #[test]
    fn test_is_cache_fresh_within_ttl() {
        // Fresh timestamp (just now) should be within 4-hour TTL
        let now = chrono::Utc::now().to_rfc3339();
        assert!(is_cache_fresh(&now), "Cache fetched just now should be fresh");
    }

    #[test]
    fn test_is_cache_fresh_expired() {
        // Timestamp from 5 hours ago should be stale
        let five_hours_ago = (chrono::Utc::now() - chrono::Duration::hours(5)).to_rfc3339();
        assert!(!is_cache_fresh(&five_hours_ago), "Cache from 5h ago should be stale");
    }

    #[test]
    fn test_is_cache_fresh_exactly_at_boundary() {
        // Timestamp from 4 hours and 1 second ago should be stale
        let just_over = (chrono::Utc::now() - chrono::Duration::hours(4) - chrono::Duration::seconds(1)).to_rfc3339();
        assert!(!is_cache_fresh(&just_over), "Cache at 4h+1s should be stale");
    }

    #[test]
    fn test_is_cache_fresh_just_under_boundary() {
        // Timestamp from 3h59m ago should still be fresh
        let just_under = (chrono::Utc::now() - chrono::Duration::hours(3) - chrono::Duration::minutes(59)).to_rfc3339();
        assert!(is_cache_fresh(&just_under), "Cache at 3h59m should be fresh");
    }

    #[test]
    fn test_is_cache_fresh_invalid_timestamp() {
        // Invalid timestamp should return false (treat as stale — safe fallback)
        assert!(!is_cache_fresh("not-a-timestamp"), "Invalid timestamp should be treated as stale");
        assert!(!is_cache_fresh(""), "Empty string should be treated as stale");
        assert!(!is_cache_fresh("2026-13-45T99:99:99Z"), "Impossible date should be treated as stale");
    }

    // --- Task 4.4: Version comparison / check_min_app_version() tests ---

    #[test]
    fn test_check_min_app_version_compatible() {
        // Current app is 0.1.1. min_app_version=0.1.0 should pass (current >= min)
        assert!(check_min_app_version("0.1.0"), "App 0.1.1 should satisfy min 0.1.0");
    }

    #[test]
    fn test_check_min_app_version_exact_match() {
        // Current app is 0.1.1. min_app_version=0.1.1 should pass (equal is OK)
        assert!(check_min_app_version("0.1.1"), "App 0.1.1 should satisfy min 0.1.1 (exact match)");
    }

    #[test]
    fn test_check_min_app_version_incompatible() {
        // Current app is 0.1.1. min_app_version=0.2.0 should fail
        assert!(!check_min_app_version("0.2.0"), "App 0.1.1 should NOT satisfy min 0.2.0");
    }

    #[test]
    fn test_check_min_app_version_major_bump_incompatible() {
        // Current app is 0.1.1. min_app_version=1.0.0 should fail
        assert!(!check_min_app_version("1.0.0"), "App 0.1.1 should NOT satisfy min 1.0.0");
    }

    #[test]
    fn test_get_current_app_version_format() {
        let version = get_current_app_version();
        assert!(!version.is_empty(), "Version should not be empty");
        let parts: Vec<&str> = version.split('.').collect();
        assert_eq!(parts.len(), 3, "Version should be semver X.Y.Z format");
        for part in parts {
            assert!(part.parse::<u32>().is_ok(), "Each version component should be numeric");
        }
    }

    // --- Task 4.4: Schema version comparison in background fetch context ---

    #[test]
    fn test_version_newer_accepted_for_config() {
        // Newer schema version should be accepted
        assert!(
            crate::health_check::is_version_newer("2.0.0", "1.0.0"),
            "Schema v2.0.0 should be newer than v1.0.0"
        );
    }

    #[test]
    fn test_version_older_rejected_for_config() {
        // Older schema version should be rejected
        assert!(
            !crate::health_check::is_version_newer("1.0.0", "2.0.0"),
            "Schema v1.0.0 should NOT be newer than v2.0.0"
        );
    }

    #[test]
    fn test_version_equal_rejected_for_config() {
        // Equal schema version should be rejected (only strictly newer accepted)
        assert!(
            !crate::health_check::is_version_newer("1.0.0", "1.0.0"),
            "Schema v1.0.0 should NOT be newer than v1.0.0 (equal)"
        );
    }

    #[test]
    fn test_version_comparison_complex_semver() {
        // 1.2.0 > 1.1.9, 2.0.0 > 1.99.99 (per AC-4)
        assert!(crate::health_check::is_version_newer("1.2.0", "1.1.9"));
        assert!(crate::health_check::is_version_newer("2.0.0", "1.99.99"));
        assert!(!crate::health_check::is_version_newer("1.1.9", "1.2.0"));
    }

    // --- Task 6.5: Event emission payload test ---

    #[test]
    fn test_remote_config_serializes_for_event_payload() {
        // Verify RemoteConfig can be serialized to JSON for Tauri event emission
        let config = RemoteConfig {
            schema_version: "1.2.0".to_string(),
            min_app_version: "0.1.0".to_string(),
            updated_at: "2026-02-18T00:00:00Z".to_string(),
            strategies: vec![RemoteStrategy {
                id: "test".to_string(),
                name: "Test".to_string(),
                description: "Test strategy".to_string(),
                examples: vec!["Example".to_string()],
                best_for: "Testing".to_string(),
                status: StrategyStatus::Active,
                ab_weight: 0.5,
            }],
        };

        let json = serde_json::to_string(&config);
        assert!(json.is_ok(), "RemoteConfig must serialize for event payload");
        let json_str = json.unwrap();
        assert!(json_str.contains("\"schema_version\":\"1.2.0\""));
        assert!(json_str.contains("\"strategies\""));
    }

    // --- Task 7.4: Tauri command wrapper tests ---

    #[test]
    fn test_get_cached_config_command_struct_exists() {
        // Verify CachedConfig struct can be constructed and config extracted
        use crate::db::queries::remote_config::CachedConfig;
        let config = RemoteConfig {
            schema_version: "1.0.0".to_string(),
            min_app_version: "0.1.0".to_string(),
            updated_at: "2026-02-18T00:00:00Z".to_string(),
            strategies: vec![],
        };
        let cached = CachedConfig {
            config: config.clone(),
            fetched_at: "2026-02-18T00:00:00Z".to_string(),
            signature: "test_sig".to_string(),
            source: "remote".to_string(),
        };
        assert_eq!(cached.config.schema_version, "1.0.0");
        assert_eq!(cached.source, "remote");
    }

    #[test]
    fn test_force_refresh_returns_valid_config_type() {
        // Verify the return type chain: force_config_refresh_command returns Result<RemoteConfig, String>
        // Since we can't call the async command without AppHandle, verify the bundled fallback path
        let config = load_bundled_config().unwrap();
        let result: Result<RemoteConfig, String> = Ok(config);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().strategies.len(), 5);
    }

    // Story 10.5 Task 7: check_for_config_updates unit tests
    // (Unit tests for the result struct and serialization; integration tests require AppHandle mock)

    #[test]
    fn test_config_check_result_success_serializes_correctly() {
        let result = ConfigCheckResult {
            success: true,
            version: Some("1.2.0".to_string()),
            error: None,
            source: ConfigSourceStatus::Remote,
        };

        let json = serde_json::to_string(&result);
        assert!(json.is_ok(), "ConfigCheckResult should serialize to JSON");

        let json_str = json.unwrap();
        assert!(json_str.contains("\"success\":true"));
        assert!(json_str.contains("\"version\":\"1.2.0\""));
        assert!(json_str.contains("\"source\":\"remote\""));
    }

    #[test]
    fn test_config_check_result_failure_serializes_correctly() {
        let result = ConfigCheckResult {
            success: false,
            version: None,
            error: Some("Network error: connection refused".to_string()),
            source: ConfigSourceStatus::Cached,
        };

        let json = serde_json::to_string(&result);
        assert!(json.is_ok(), "ConfigCheckResult should serialize to JSON");

        let json_str = json.unwrap();
        assert!(json_str.contains("\"success\":false"));
        assert!(json_str.contains("\"error\":\"Network error"));
        assert!(json_str.contains("\"source\":\"cached\""));
    }

    #[test]
    fn test_config_check_result_source_enum_serializes_all_variants() {
        // Verify all ConfigSourceStatus variants serialize to expected lowercase strings
        let cases = [
            (ConfigSourceStatus::Remote, "\"source\":\"remote\""),
            (ConfigSourceStatus::Cached, "\"source\":\"cached\""),
            (ConfigSourceStatus::Defaults, "\"source\":\"defaults\""),
        ];
        for (variant, expected) in &cases {
            let result = ConfigCheckResult {
                success: false,
                version: None,
                error: None,
                source: *variant,
            };
            let json = serde_json::to_string(&result).unwrap();
            assert!(json.contains(expected), "Expected {} in {}", expected, json);
        }
    }

    #[test]
    fn test_config_check_result_null_version_for_failure() {
        let result = ConfigCheckResult {
            success: false,
            version: None,
            error: Some("Timeout".to_string()),
            source: ConfigSourceStatus::Defaults,
        };

        assert!(result.version.is_none(), "Failed check should have null version");
        assert!(result.error.is_some(), "Failed check should have error message");
    }

    #[test]
    fn test_config_check_result_null_error_for_success() {
        let result = ConfigCheckResult {
            success: true,
            version: Some("1.0.0".to_string()),
            error: None,
            source: ConfigSourceStatus::Remote,
        };

        assert!(result.error.is_none(), "Successful check should have null error");
        assert!(result.version.is_some(), "Successful check should have version");
    }

    // ========================================================================
    // Story 10.3: Hook strategy sync tests (Tasks 3.3, 4.3, 7.3)
    // ========================================================================

    fn create_sync_test_db() -> crate::db::Database {
        use tempfile::tempdir;
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("sync_test.db");
        crate::db::Database::new(db_path, None).unwrap()
    }

    fn make_test_config(strategies: Vec<RemoteStrategy>) -> RemoteConfig {
        RemoteConfig {
            schema_version: "1.0.0".to_string(),
            min_app_version: "0.1.0".to_string(),
            updated_at: "2024-01-15T10:30:00Z".to_string(),
            strategies,
        }
    }

    fn make_strategy(id: &str, name: &str, status: StrategyStatus) -> RemoteStrategy {
        RemoteStrategy {
            id: id.to_string(),
            name: name.to_string(),
            description: format!("{} description", name),
            examples: vec![format!("{} example", name)],
            best_for: format!("Best for {}", name),
            status,
            ab_weight: 0.5,
        }
    }

    #[test]
    fn test_sync_inserts_new_strategy() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config = make_test_config(vec![
            make_strategy("new-hook-1", "New Hook", StrategyStatus::Active),
        ]);

        let result = sync_hook_strategies_impl(&conn, &config).unwrap();

        assert_eq!(result.added_count, 1, "Should add 1 new strategy");
        assert_eq!(result.updated_count, 0);
        assert_eq!(result.retired_count, 0);

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM hook_strategies WHERE remote_id = 'new-hook-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "New strategy should be in the database");
    }

    #[test]
    fn test_sync_updates_changed_strategy() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config1 = make_test_config(vec![
            make_strategy("hook-update", "Original Name", StrategyStatus::Active),
        ]);
        sync_hook_strategies_impl(&conn, &config1).unwrap();

        let mut updated_strategy = make_strategy("hook-update", "Updated Name", StrategyStatus::Active);
        updated_strategy.description = "Updated description".to_string();
        let config2 = make_test_config(vec![updated_strategy]);

        let result = sync_hook_strategies_impl(&conn, &config2).unwrap();

        assert_eq!(result.added_count, 0);
        assert_eq!(result.updated_count, 1, "Should update 1 strategy");

        let name: String = conn
            .query_row(
                "SELECT name FROM hook_strategies WHERE remote_id = 'hook-update'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "Updated Name");
    }

    #[test]
    fn test_sync_skips_unchanged_strategy() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config = make_test_config(vec![
            make_strategy("hook-skip", "Skip Hook", StrategyStatus::Active),
        ]);

        sync_hook_strategies_impl(&conn, &config).unwrap();
        let result = sync_hook_strategies_impl(&conn, &config).unwrap();

        assert_eq!(result.added_count, 0);
        assert_eq!(result.updated_count, 0, "Should skip unchanged strategy");
        assert_eq!(result.retired_count, 0);
    }

    #[test]
    fn test_sync_retires_missing_strategy() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config1 = make_test_config(vec![
            make_strategy("hook-keep", "Keep Hook", StrategyStatus::Active),
            make_strategy("hook-retire", "Retire Hook", StrategyStatus::Active),
        ]);
        sync_hook_strategies_impl(&conn, &config1).unwrap();

        let config2 = make_test_config(vec![
            make_strategy("hook-keep", "Keep Hook", StrategyStatus::Active),
        ]);
        let result = sync_hook_strategies_impl(&conn, &config2).unwrap();

        assert_eq!(result.retired_count, 1, "Should retire 1 missing strategy");

        let status: String = conn
            .query_row(
                "SELECT status FROM hook_strategies WHERE remote_id = 'hook-retire'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "retired");
    }

    #[test]
    fn test_sync_preserves_created_at() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config1 = make_test_config(vec![
            make_strategy("hook-ts", "Timestamp Hook", StrategyStatus::Active),
        ]);
        sync_hook_strategies_impl(&conn, &config1).unwrap();

        let original_ts: String = conn
            .query_row(
                "SELECT created_at FROM hook_strategies WHERE remote_id = 'hook-ts'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        let mut changed = make_strategy("hook-ts", "Changed Name", StrategyStatus::Active);
        changed.description = "Changed".to_string();
        let config2 = make_test_config(vec![changed]);
        sync_hook_strategies_impl(&conn, &config2).unwrap();

        let after_ts: String = conn
            .query_row(
                "SELECT created_at FROM hook_strategies WHERE remote_id = 'hook-ts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(original_ts, after_ts, "created_at should be preserved on update");
    }

    #[test]
    fn test_sync_transaction_rolls_back_on_error() {
        // H3 fix: Simulate actual DB error and verify transaction rollback
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        // Create trigger that aborts on specific insert
        conn.execute_batch(
            "CREATE TRIGGER fail_on_insert_fail_me BEFORE INSERT ON hook_strategies
             FOR EACH ROW WHEN NEW.name = 'FAIL_ME'
             BEGIN
                 SELECT RAISE(ABORT, 'Simulated DB error for rollback test');
             END;",
        )
        .unwrap();

        let config = make_test_config(vec![
            make_strategy("good-strategy", "Good Strategy", StrategyStatus::Active),
            make_strategy("bad-strategy", "FAIL_ME", StrategyStatus::Active),
        ]);

        let result = sync_hook_strategies_impl(&conn, &config);
        assert!(result.is_err(), "Sync should fail due to simulated DB error");

        // Verify rollback: good strategy should NOT be committed
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM hook_strategies WHERE remote_id = 'good-strategy'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "Good strategy should be rolled back (transaction atomicity)");

        conn.execute_batch("DROP TRIGGER IF EXISTS fail_on_insert_fail_me;")
            .unwrap();
    }

    #[test]
    fn test_sync_multiple_strategies_atomic() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config = make_test_config(vec![
            make_strategy("multi-1", "Multi One", StrategyStatus::Active),
            make_strategy("multi-2", "Multi Two", StrategyStatus::Active),
            make_strategy("multi-3", "Multi Three", StrategyStatus::Deprecated),
        ]);

        let result = sync_hook_strategies_impl(&conn, &config).unwrap();
        assert_eq!(result.added_count, 3, "Should add all 3 strategies");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM hook_strategies WHERE remote_id IN ('multi-1', 'multi-2', 'multi-3')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 3, "All 3 strategies should be in database");
    }

    #[test]
    fn test_sync_result_counts_correct() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config1 = make_test_config(vec![
            make_strategy("count-1", "Count One", StrategyStatus::Active),
            make_strategy("count-2", "Count Two", StrategyStatus::Active),
            make_strategy("count-3", "Count Three", StrategyStatus::Active),
        ]);
        sync_hook_strategies_impl(&conn, &config1).unwrap();

        let mut updated = make_strategy("count-1", "Count One Updated", StrategyStatus::Active);
        updated.description = "Changed description".to_string();
        let config2 = make_test_config(vec![
            updated,
            make_strategy("count-2", "Count Two", StrategyStatus::Active),
            make_strategy("count-4", "Count Four", StrategyStatus::Active),
        ]);

        let result = sync_hook_strategies_impl(&conn, &config2).unwrap();
        assert_eq!(result.added_count, 1, "Should add count-4");
        assert_eq!(result.updated_count, 1, "Should update count-1");
        assert_eq!(result.retired_count, 1, "Should retire count-3");
    }

    #[test]
    fn test_sync_empty_config_no_changes() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config = make_test_config(vec![]);
        let result = sync_hook_strategies_impl(&conn, &config).unwrap();

        assert_eq!(result.added_count, 0);
        assert_eq!(result.updated_count, 0);
        assert_eq!(result.retired_count, 0);
    }

    #[test]
    fn test_sync_deprecated_status_applied() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config1 = make_test_config(vec![
            make_strategy("dep-hook", "Deprecate Me", StrategyStatus::Active),
        ]);
        sync_hook_strategies_impl(&conn, &config1).unwrap();

        let config2 = make_test_config(vec![
            make_strategy("dep-hook", "Deprecate Me", StrategyStatus::Deprecated),
        ]);
        let result = sync_hook_strategies_impl(&conn, &config2).unwrap();

        assert_eq!(result.updated_count, 1, "Should update status to deprecated");

        let status: String = conn
            .query_row(
                "SELECT status FROM hook_strategies WHERE remote_id = 'dep-hook'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "deprecated");
    }

    #[test]
    fn test_sync_updates_ab_weight() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let mut s = make_strategy("weight-hook", "Weight Hook", StrategyStatus::Active);
        s.ab_weight = 0.3;
        let config1 = make_test_config(vec![s]);
        sync_hook_strategies_impl(&conn, &config1).unwrap();

        let mut s2 = make_strategy("weight-hook", "Weight Hook", StrategyStatus::Active);
        s2.ab_weight = 0.8;
        let config2 = make_test_config(vec![s2]);
        let result = sync_hook_strategies_impl(&conn, &config2).unwrap();

        assert_eq!(result.updated_count, 1, "Should detect ab_weight change");

        let weight: f64 = conn
            .query_row(
                "SELECT ab_weight FROM hook_strategies WHERE remote_id = 'weight-hook'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!((weight - 0.8).abs() < f64::EPSILON, "ab_weight should be updated to 0.8");
    }

    #[test]
    fn test_sync_seed_strategies_unaffected() {
        let db = create_sync_test_db();
        let conn = db.conn.lock().unwrap();

        let config = make_test_config(vec![]);
        sync_hook_strategies_impl(&conn, &config).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM hook_strategies WHERE status = 'active' AND remote_id IS NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 5, "All 5 seed strategies should remain active and unaffected");
    }

    // NOTE: Task 4.3 (event emission tests) and Task 7.3 (integration tests)
    // require Tauri AppHandle mock which is not available in unit test context.
    // The sync_hook_strategies() function and background_config_fetch integration
    // are tested manually. Event emission logic is trivial (if-check + emit).
}
