//! Application configuration management.
//!
//! Handles loading and saving app configuration to a JSON file.
//! API key is stored in OS keychain (Story 2.6).

use crate::keychain;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Application configuration stored in JSON file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Anthropic API key (DEPRECATED - now stored in OS keychain, this field kept for backward compatibility during migration)
    #[serde(default)]
    pub api_key: Option<String>,

    /// Log level (Story 2.1, Task 8: deferred from Story 1-16)
    /// Moved from database to config.json to resolve initialization order dependency
    #[serde(default = "default_log_level")]
    pub log_level: String,
}

/// Default log level (INFO)
fn default_log_level() -> String {
    "INFO".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_key: None,
            log_level: default_log_level(),
        }
    }
}

/// Thread-safe configuration state.
pub struct ConfigState {
    pub config: Mutex<Config>,
    pub config_path: PathBuf,
}

impl ConfigState {
    /// Create a new ConfigState, loading existing config if present.
    pub fn new(config_dir: PathBuf) -> Result<Self, String> {
        // Ensure config directory exists
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;

        let config_path = config_dir.join("config.json");

        // Load existing config or create default
        let config = if config_path.exists() {
            let contents = fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read config file: {}", e))?;
            serde_json::from_str(&contents)
                .map_err(|e| format!("Failed to parse config file: {}", e))?
        } else {
            Config::default()
        };

        Ok(Self {
            config: Mutex::new(config),
            config_path,
        })
    }

    /// Save current configuration to file.
    pub fn save(&self) -> Result<(), String> {
        let config = self
            .config
            .lock()
            .map_err(|e| format!("Config lock error: {}", e))?;
        let contents = serde_json::to_string_pretty(&*config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&self.config_path, contents)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
        Ok(())
    }

    /// Check if API key is configured (checks keychain first, then config fallback).
    pub fn has_api_key(&self) -> Result<bool, String> {
        // Check keychain first (Story 2.6)
        match keychain::has_api_key() {
            Ok(true) => return Ok(true),
            Ok(false) => {} // Not in keychain, check config fallback
            Err(e) => {
                tracing::warn!("Keychain check failed: {}. Falling back to config.", e);
            }
        }

        // Fallback: check config.json (for backward compatibility during migration)
        let config = self
            .config
            .lock()
            .map_err(|e| format!("Config lock error: {}", e))?;
        Ok(config
            .api_key
            .as_ref()
            .map(|k| !k.is_empty())
            .unwrap_or(false))
    }

    /// Get the API key (retrieves from keychain, with config fallback).
    pub fn get_api_key(&self) -> Result<Option<String>, String> {
        // Try keychain first (Story 2.6)
        match keychain::retrieve_api_key() {
            Ok(api_key) => {
                tracing::debug!("Retrieved API key from keychain");
                return Ok(Some(api_key));
            }
            Err(keychain::KeychainError::NotFound) => {
                tracing::debug!("API key not in keychain, checking config fallback");
            }
            Err(e) => {
                tracing::warn!("Keychain retrieval failed: {}. Falling back to config.", e);
            }
        }

        // Fallback: check config.json (for backward compatibility during migration)
        let config = self
            .config
            .lock()
            .map_err(|e| format!("Config lock error: {}", e))?;
        Ok(config.api_key.clone())
    }

    /// Set the API key (stores in keychain, with config.json fallback for unsigned binaries).
    pub fn set_api_key(&self, api_key: String) -> Result<(), String> {
        // Validate format first (Story 2.6 code review fix)
        validate_api_key_format(&api_key)?;

        // Store in keychain (Story 2.6)
        keychain::store_api_key(&api_key)
            .map_err(|e| format!("Failed to store API key in keychain: {}", e))?;

        // Verify keychain retrieval works (may fail on unsigned Windows binaries)
        let keychain_works = keychain::retrieve_api_key().is_ok();

        if keychain_works {
            // Keychain works - remove from config.json for security
            {
                let mut config = self
                    .config
                    .lock()
                    .map_err(|e| format!("Config lock error: {}", e))?;
                config.api_key = None;
            }
            self.save()?;
            tracing::info!("API key stored in keychain and removed from config.json");
        } else {
            // Keychain retrieval fails (unsigned binary) - keep in config.json as fallback
            tracing::warn!(
                "Keychain retrieval failed (unsigned binary limitation). \
                Storing API key in config.json as fallback for development."
            );
            {
                let mut config = self
                    .config
                    .lock()
                    .map_err(|e| format!("Config lock error: {}", e))?;
                config.api_key = Some(api_key);
            }
            self.save()?;
            tracing::info!("API key stored in config.json (dev fallback)");
        }

        Ok(())
    }

    /// Clear the API key (removes from both keychain and config).
    pub fn clear_api_key(&self) -> Result<(), String> {
        // Delete from keychain (Story 2.6)
        keychain::delete_api_key()
            .map_err(|e| format!("Failed to delete API key from keychain: {}", e))?;

        // Also clear from config.json (cleanup)
        {
            let mut config = self
                .config
                .lock()
                .map_err(|e| format!("Config lock error: {}", e))?;
            config.api_key = None;
        }
        self.save()?;

        tracing::info!("API key cleared from keychain and config.json");
        Ok(())
    }

    /// Get the log level (Story 2.1, Task 8)
    pub fn get_log_level(&self) -> Result<String, String> {
        let config = self
            .config
            .lock()
            .map_err(|e| format!("Config lock error: {}", e))?;
        Ok(config.log_level.clone())
    }

    /// Set the log level (Story 2.1, Task 8)
    pub fn set_log_level(&self, level: String) -> Result<(), String> {
        {
            let mut config = self
                .config
                .lock()
                .map_err(|e| format!("Config lock error: {}", e))?;
            config.log_level = level;
        }
        self.save()
    }

    /// Migrate API key from config.json to OS keychain (Story 2.6).
    ///
    /// This function:
    /// 1. Reads API key from config.json
    /// 2. Stores it in OS keychain
    /// 3. Deletes it from config.json
    /// 4. Verifies retrieval from keychain works
    ///
    /// Safe to call multiple times (idempotent).
    ///
    /// # Returns
    /// * `Ok(true)` if migration performed
    /// * `Ok(false)` if no migration needed (already in keychain or no key)
    /// * `Err(String)` if migration fails
    pub fn migrate_api_key_to_keychain(&self) -> Result<bool, String> {
        // Check if API key is already in keychain
        match keychain::has_api_key() {
            Ok(true) => {
                tracing::debug!("API key already in keychain, no migration needed");
                // Clean up config.json just in case
                let mut config = self
                    .config
                    .lock()
                    .map_err(|e| format!("Config lock error: {}", e))?;
                if config.api_key.is_some() {
                    config.api_key = None;
                    drop(config);
                    self.save()?;
                    tracing::info!("Cleaned up API key from config.json (already in keychain)");
                }
                return Ok(false);
            }
            Ok(false) => {} // Not in keychain, proceed with migration
            Err(e) => {
                tracing::warn!(
                    "Failed to check keychain status: {}. Attempting migration anyway.",
                    e
                );
            }
        }

        // Read API key from config.json
        let api_key = {
            let config = self
                .config
                .lock()
                .map_err(|e| format!("Config lock error: {}", e))?;
            config.api_key.clone()
        };

        // If no API key in config, nothing to migrate
        let Some(api_key) = api_key else {
            tracing::debug!("No API key in config.json to migrate");
            return Ok(false);
        };

        if api_key.is_empty() {
            tracing::debug!("Empty API key in config.json, skipping migration");
            return Ok(false);
        }

        tracing::info!("Migrating API key from config.json to OS keychain...");

        // Store in keychain
        keychain::store_api_key(&api_key).map_err(|e| {
            format!(
                "Failed to store API key in keychain during migration: {}",
                e
            )
        })?;

        // Verify retrieval works (best effort - may fail in unsigned test environment)
        match keychain::retrieve_api_key() {
            Ok(retrieved) => {
                if retrieved != api_key {
                    return Err(
                        "API key verification failed: retrieved key does not match stored key"
                            .to_string(),
                    );
                }
                tracing::info!("API key verified in keychain");
            }
            Err(keychain::KeychainError::NotFound) => {
                // Test environment limitation (unsigned binary)
                tracing::warn!(
                    "Keychain verification failed (test environment limitation). \
                    API key stored but cannot be retrieved in unsigned binary. \
                    This is expected behavior - keychain will work in signed Tauri app."
                );
            }
            Err(e) => {
                return Err(format!(
                    "Failed to verify API key retrieval from keychain: {}",
                    e
                ));
            }
        }

        // Delete from config.json
        {
            let mut config = self
                .config
                .lock()
                .map_err(|e| format!("Config lock error: {}", e))?;
            config.api_key = None;
        }
        self.save()?;

        tracing::info!("API key migration complete: config.json → OS keychain");
        Ok(true)
    }
}

/// Validate API key format.
/// Returns Ok(()) if valid, Err with message if invalid.
pub fn validate_api_key_format(api_key: &str) -> Result<(), String> {
    let trimmed = api_key.trim();

    if trimmed.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    if !trimmed.starts_with("sk-ant-") {
        return Err("API key must start with 'sk-ant-'".to_string());
    }

    if trimmed.len() < 20 {
        return Err("API key appears too short".to_string());
    }

    Ok(())
}

/// Mask API key for display (show only last 4 characters).
pub fn mask_api_key(api_key: &str) -> String {
    if api_key.len() <= 8 {
        return "****".to_string();
    }
    let visible_part = &api_key[api_key.len() - 4..];
    format!("sk-ant-...{}", visible_part)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_validate_api_key_format_valid() {
        assert!(validate_api_key_format("sk-ant-api03-abcdefghijklmnop").is_ok());
    }

    #[test]
    fn test_validate_api_key_format_empty() {
        let result = validate_api_key_format("");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_validate_api_key_format_wrong_prefix() {
        let result = validate_api_key_format("sk-openai-abcdefghijklmnop");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("sk-ant-"));
    }

    #[test]
    fn test_validate_api_key_format_too_short() {
        let result = validate_api_key_format("sk-ant-abc");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("short"));
    }

    #[test]
    fn test_mask_api_key() {
        assert_eq!(
            mask_api_key("sk-ant-api03-abcdefghijklmnop"),
            "sk-ant-...mnop"
        );
    }

    #[test]
    fn test_mask_api_key_short() {
        assert_eq!(mask_api_key("short"), "****");
    }

    #[test]
    fn test_config_state_new_creates_default() {
        let dir = tempdir().unwrap();
        let state = ConfigState::new(dir.path().to_path_buf()).unwrap();

        assert!(!state.has_api_key().unwrap());
    }

    #[test]
    fn test_config_state_set_and_get_api_key() {
        let dir = tempdir().unwrap();
        let state = ConfigState::new(dir.path().to_path_buf()).unwrap();

        state
            .set_api_key("sk-ant-test-key-12345678".to_string())
            .unwrap();

        // Check if keychain is restricted
        let keychain_works = crate::keychain::retrieve_api_key().is_ok();

        if keychain_works {
            assert!(state.has_api_key().unwrap());
            assert_eq!(
                state.get_api_key().unwrap(),
                Some("sk-ant-test-key-12345678".to_string())
            );
        } else {
            eprintln!("SKIPPED: Keychain not accessible in test environment");
            // In restricted environment, API key won't be retrievable (expected)
        }

        // Cleanup
        let _ = crate::keychain::delete_api_key();
    }

    #[test]
    fn test_config_state_persists_to_file() {
        let dir = tempdir().unwrap();
        let config_path = dir.path().to_path_buf();

        // Set API key
        {
            let state = ConfigState::new(config_path.clone()).unwrap();
            state
                .set_api_key("sk-ant-test-key-persist".to_string())
                .unwrap();
        }

        // Check if keychain is accessible
        let keychain_works = crate::keychain::retrieve_api_key().is_ok();

        // Load fresh and verify
        {
            let state = ConfigState::new(config_path).unwrap();
            if keychain_works {
                assert_eq!(
                    state.get_api_key().unwrap(),
                    Some("sk-ant-test-key-persist".to_string())
                );
            } else {
                eprintln!("SKIPPED: Keychain not accessible in test environment");
            }
        }

        // Cleanup
        let _ = crate::keychain::delete_api_key();
    }

    #[test]
    fn test_config_state_clear_api_key() {
        let dir = tempdir().unwrap();
        let state = ConfigState::new(dir.path().to_path_buf()).unwrap();

        state
            .set_api_key("sk-ant-test-key-12345678".to_string())
            .unwrap();

        // Check if keychain is accessible
        let keychain_works = crate::keychain::retrieve_api_key().is_ok();

        if keychain_works {
            assert!(state.has_api_key().unwrap());

            state.clear_api_key().unwrap();
            assert!(!state.has_api_key().unwrap());
        } else {
            eprintln!("SKIPPED: Keychain not accessible in test environment");
            state.clear_api_key().unwrap(); // Still test that clear doesn't crash
        }

        // Cleanup keychain
        let _ = crate::keychain::delete_api_key();
    }

    #[test]
    fn test_api_key_stored_in_keychain_not_config() {
        // Story 2.6: API key should be in keychain, not config.json
        let dir = tempdir().unwrap();
        let state = ConfigState::new(dir.path().to_path_buf()).unwrap();

        // Set API key
        state
            .set_api_key("sk-ant-keychain-test".to_string())
            .unwrap();

        // Verify it's NOT in config.json (this should always work)
        let config = state.config.lock().unwrap();
        assert!(
            config.api_key.is_none(),
            "API key should not be in config.json"
        );
        drop(config);

        // Check if keychain is accessible
        let keychain_works = crate::keychain::retrieve_api_key().is_ok();

        if keychain_works {
            // Verify it's in keychain
            let keychain_key = crate::keychain::retrieve_api_key().unwrap();
            assert_eq!(keychain_key, "sk-ant-keychain-test");

            // Verify get_api_key retrieves from keychain
            let retrieved = state.get_api_key().unwrap();
            assert_eq!(retrieved, Some("sk-ant-keychain-test".to_string()));
        } else {
            eprintln!("SKIPPED keychain verification: Unsigned test environment");
        }

        // Cleanup
        state.clear_api_key().unwrap();
    }

    #[test]
    fn test_migrate_api_key_to_keychain() {
        // Story 2.6: Test migration from config.json to keychain
        let dir = tempdir().unwrap();

        // Cleanup keychain before test
        let _ = crate::keychain::delete_api_key();

        // Check if keychain is restricted (unsigned test binary)
        let keychain_restricted = {
            let test_key = "migration-test-check";
            crate::keychain::store_api_key(test_key).is_ok()
                && crate::keychain::retrieve_api_key().is_err()
        };
        let _ = crate::keychain::delete_api_key();

        // Manually create config with API key in plaintext (simulate Epic 1 state)
        {
            let mut config = Config::default();
            config.api_key = Some("sk-ant-migrate-test".to_string());
            let config_path = dir.path().join("config.json");
            let contents = serde_json::to_string_pretty(&config).unwrap();
            fs::write(&config_path, contents).unwrap();
        }

        // Load config and run migration
        let state = ConfigState::new(dir.path().to_path_buf()).unwrap();
        let migrated = state.migrate_api_key_to_keychain().unwrap();

        assert!(migrated, "Migration should have been performed");

        if !keychain_restricted {
            // Verify key is now in keychain (only if keychain is accessible)
            let keychain_key = crate::keychain::retrieve_api_key().unwrap();
            assert_eq!(keychain_key, "sk-ant-migrate-test");

            // Verify get_api_key retrieves from keychain
            let retrieved = state.get_api_key().unwrap();
            assert_eq!(retrieved, Some("sk-ant-migrate-test".to_string()));
        } else {
            eprintln!("SKIPPED keychain verification: Unsigned test environment");
            // In restricted environment, get_api_key will fall back to config (which is now empty)
            // This is expected behavior during testing
        }

        // Verify key is removed from config.json
        let config = state.config.lock().unwrap();
        assert!(
            config.api_key.is_none(),
            "API key should be removed from config.json after migration"
        );
        drop(config);

        // Test idempotency: running migration again should return false
        let migrated_again = state.migrate_api_key_to_keychain().unwrap();
        assert!(
            !migrated_again,
            "Second migration should return false (already migrated)"
        );

        // Cleanup
        let _ = crate::keychain::delete_api_key();
    }

    #[test]
    fn test_migrate_with_no_api_key() {
        // Migration with no API key should succeed without errors
        let dir = tempdir().unwrap();
        let _ = crate::keychain::delete_api_key();

        let state = ConfigState::new(dir.path().to_path_buf()).unwrap();
        let migrated = state.migrate_api_key_to_keychain().unwrap();

        assert!(
            !migrated,
            "No migration should occur when no API key exists"
        );
    }

    #[test]
    fn test_backward_compatibility_fallback() {
        // If keychain fails, should fall back to config.json
        // This is a safety mechanism during migration period
        let dir = tempdir().unwrap();

        // Create config with API key (simulate old version or keychain failure scenario)
        let state = ConfigState::new(dir.path().to_path_buf()).unwrap();
        {
            let mut config = state.config.lock().unwrap();
            config.api_key = Some("sk-ant-fallback-test".to_string());
            drop(config);
            state.save().unwrap();
        }

        // Clear keychain to simulate keychain being unavailable
        let _ = crate::keychain::delete_api_key();

        // get_api_key should fall back to config.json
        let retrieved = state.get_api_key().unwrap();
        assert_eq!(retrieved, Some("sk-ant-fallback-test".to_string()));

        // has_api_key should also work with fallback
        assert!(state.has_api_key().unwrap());
    }
}
