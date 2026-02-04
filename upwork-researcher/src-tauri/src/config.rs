//! Application configuration management.
//!
//! Handles loading and saving app configuration to a JSON file.
//! Currently stores API key in plaintext (will move to keychain in Epic 2).

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Application configuration stored in JSON file.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    /// Anthropic API key (plaintext for now, keychain in Epic 2)
    #[serde(default)]
    pub api_key: Option<String>,
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
        let config = self.config.lock().map_err(|e| format!("Config lock error: {}", e))?;
        let contents = serde_json::to_string_pretty(&*config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&self.config_path, contents)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
        Ok(())
    }

    /// Check if API key is configured.
    pub fn has_api_key(&self) -> Result<bool, String> {
        let config = self.config.lock().map_err(|e| format!("Config lock error: {}", e))?;
        Ok(config.api_key.as_ref().map(|k| !k.is_empty()).unwrap_or(false))
    }

    /// Get the API key.
    pub fn get_api_key(&self) -> Result<Option<String>, String> {
        let config = self.config.lock().map_err(|e| format!("Config lock error: {}", e))?;
        Ok(config.api_key.clone())
    }

    /// Set the API key.
    pub fn set_api_key(&self, api_key: String) -> Result<(), String> {
        {
            let mut config = self.config.lock().map_err(|e| format!("Config lock error: {}", e))?;
            config.api_key = Some(api_key);
        }
        self.save()
    }

    /// Clear the API key.
    pub fn clear_api_key(&self) -> Result<(), String> {
        {
            let mut config = self.config.lock().map_err(|e| format!("Config lock error: {}", e))?;
            config.api_key = None;
        }
        self.save()
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
        assert_eq!(mask_api_key("sk-ant-api03-abcdefghijklmnop"), "sk-ant-...mnop");
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

        state.set_api_key("sk-ant-test-key-12345678".to_string()).unwrap();

        assert!(state.has_api_key().unwrap());
        assert_eq!(state.get_api_key().unwrap(), Some("sk-ant-test-key-12345678".to_string()));
    }

    #[test]
    fn test_config_state_persists_to_file() {
        let dir = tempdir().unwrap();
        let config_path = dir.path().to_path_buf();

        // Set API key
        {
            let state = ConfigState::new(config_path.clone()).unwrap();
            state.set_api_key("sk-ant-test-key-persist".to_string()).unwrap();
        }

        // Load fresh and verify
        {
            let state = ConfigState::new(config_path).unwrap();
            assert_eq!(state.get_api_key().unwrap(), Some("sk-ant-test-key-persist".to_string()));
        }
    }

    #[test]
    fn test_config_state_clear_api_key() {
        let dir = tempdir().unwrap();
        let state = ConfigState::new(dir.path().to_path_buf()).unwrap();

        state.set_api_key("sk-ant-test-key-12345678".to_string()).unwrap();
        assert!(state.has_api_key().unwrap());

        state.clear_api_key().unwrap();
        assert!(!state.has_api_key().unwrap());
    }
}
