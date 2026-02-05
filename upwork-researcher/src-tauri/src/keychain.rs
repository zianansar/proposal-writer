//! OS Keychain integration for secure API key storage (AR-17, NFR-10).
//!
//! Provides secure credential storage using platform-native keychains:
//! - macOS: Keychain Access
//! - Windows: Credential Manager
//! - Linux: Secret Service API (libsecret)
//!
//! Service name: "upwork-research-agent" (hyphenated for Windows Credential Manager compatibility)
//! Username/key: "anthropic_api_key"

#[cfg(test)]
mod tests;

use keyring::Entry;

/// Service identifier for keychain entries
/// Note: Using hyphenated name for Windows Credential Manager compatibility
const SERVICE_NAME: &str = "upwork-research-agent";

/// Key identifier for API key in keychain
const API_KEY_USERNAME: &str = "anthropic_api_key";

/// Error types for keychain operations
#[derive(Debug, thiserror::Error)]
pub enum KeychainError {
    #[error("Failed to access keychain: {0}")]
    AccessFailed(String),

    #[error("Failed to store credential in keychain: {0}")]
    StoreFailed(String),

    #[error("Failed to retrieve credential from keychain: {0}")]
    RetrieveFailed(String),

    #[error("Failed to delete credential from keychain: {0}")]
    DeleteFailed(String),

    #[error("API key not found in keychain")]
    NotFound,
}

/// Store API key in OS keychain.
///
/// # Arguments
/// * `api_key` - The Anthropic API key to store
///
/// # Returns
/// * `Ok(())` if stored successfully
/// * `Err(KeychainError)` if storage fails
///
/// # Platform behavior
/// - macOS: Stored in Keychain Access app
/// - Windows: Stored in Credential Manager
/// - Linux: Stored via Secret Service (requires libsecret)
pub fn store_api_key(api_key: &str) -> Result<(), KeychainError> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_USERNAME)
        .map_err(|e| KeychainError::AccessFailed(e.to_string()))?;

    entry
        .set_password(api_key)
        .map_err(|e| KeychainError::StoreFailed(e.to_string()))?;

    tracing::info!("API key stored in OS keychain (service: {}, user: {})", SERVICE_NAME, API_KEY_USERNAME);

    Ok(())
}

/// Retrieve API key from OS keychain.
///
/// # Returns
/// * `Ok(String)` with API key if found
/// * `Err(KeychainError::NotFound)` if not in keychain
/// * `Err(KeychainError)` for other failures
pub fn retrieve_api_key() -> Result<String, KeychainError> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_USERNAME)
        .map_err(|e| KeychainError::AccessFailed(e.to_string()))?;

    match entry.get_password() {
        Ok(password) => {
            tracing::debug!("API key retrieved from OS keychain");
            Ok(password)
        }
        Err(keyring::Error::NoEntry) => {
            tracing::warn!("API key not found in OS keychain");
            Err(KeychainError::NotFound)
        }
        Err(e) => {
            tracing::error!("Failed to retrieve API key from keychain: {}", e);
            Err(KeychainError::RetrieveFailed(e.to_string()))
        }
    }
}

/// Delete API key from OS keychain.
///
/// # Returns
/// * `Ok(())` if deleted successfully or not found
/// * `Err(KeychainError)` if deletion fails
pub fn delete_api_key() -> Result<(), KeychainError> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_USERNAME)
        .map_err(|e| KeychainError::AccessFailed(e.to_string()))?;

    match entry.delete_credential() {
        Ok(_) => {
            tracing::info!("API key deleted from OS keychain");
            Ok(())
        }
        Err(keyring::Error::NoEntry) => {
            // Already deleted or never existed - not an error
            tracing::debug!("API key not found in keychain (already deleted)");
            Ok(())
        }
        Err(e) => {
            tracing::error!("Failed to delete API key from keychain: {}", e);
            Err(KeychainError::DeleteFailed(e.to_string()))
        }
    }
}

/// Check if API key exists in OS keychain.
///
/// # Returns
/// * `Ok(true)` if key exists
/// * `Ok(false)` if key does not exist
/// * `Err(KeychainError)` if check fails
pub fn has_api_key() -> Result<bool, KeychainError> {
    match retrieve_api_key() {
        Ok(_) => Ok(true),
        Err(KeychainError::NotFound) => Ok(false),
        Err(e) => Err(e),
    }
}
