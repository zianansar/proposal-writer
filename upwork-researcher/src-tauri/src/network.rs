// Network allowlist enforcement module
// Implements AR-14: Dual-layer network security (Rust-side domain validation)

use thiserror::Error;
use tauri::{AppHandle, Emitter, Manager};

/// Allowlisted domains for network requests
const ALLOWED_DOMAINS: &[&str] = &["api.anthropic.com"];

/// Network validation errors
#[derive(Debug, Error)]
pub enum NetworkError {
    #[error("Blocked network request to unauthorized domain: {0}")]
    BlockedDomain(String),

    #[error("Invalid URL format: {0}")]
    InvalidUrl(String),
}

/// Validates a URL against the allowlist of approved domains.
///
/// # Arguments
/// * `url` - The URL to validate
///
/// # Returns
/// * `Ok(())` if the domain is allowlisted
/// * `Err(NetworkError)` if the domain is blocked or URL is invalid
///
/// # Examples
/// ```
/// use crate::network::validate_url;
///
/// // Allowed domain
/// assert!(validate_url("https://api.anthropic.com/v1/messages").is_ok());
///
/// // Blocked domain
/// assert!(validate_url("https://evil.com/exfiltrate").is_err());
/// ```
pub fn validate_url(url: &str) -> Result<(), NetworkError> {
    // Parse URL
    let parsed = url::Url::parse(url)
        .map_err(|e| NetworkError::InvalidUrl(format!("{}: {}", e, url)))?;

    // Extract host
    let host = parsed.host_str()
        .ok_or_else(|| NetworkError::InvalidUrl(format!("No host in URL: {}", url)))?;

    // Check against allowlist
    if ALLOWED_DOMAINS.contains(&host) {
        Ok(())
    } else {
        tracing::warn!(
            domain = %host,
            url = %url,
            "Blocked network request to unauthorized domain"
        );
        Err(NetworkError::BlockedDomain(host.to_string()))
    }
}

/// Helper to emit network:blocked event and record blocked request.
/// Task 4.2: Event emission for blocked network requests.
///
/// # Arguments
/// * `app_handle` - Tauri AppHandle for event emission
/// * `domain` - The blocked domain
/// * `url` - The full blocked URL
pub fn emit_blocked_event(app_handle: &AppHandle, domain: String, url: String) {
    use crate::events::{NetworkBlockedPayload, NETWORK_BLOCKED};

    let timestamp = chrono::Utc::now().to_rfc3339();

    // Emit event to frontend
    let payload = NetworkBlockedPayload {
        domain: domain.clone(),
        url: url.clone(),
        timestamp: timestamp.clone(),
    };

    if let Err(e) = app_handle.emit(NETWORK_BLOCKED, payload) {
        tracing::error!("Failed to emit network:blocked event: {}", e);
    }

    // Record in BlockedRequestsState
    if let Some(blocked_state) = app_handle.try_state::<crate::BlockedRequestsState>() {
        blocked_state.add(domain, url);
    } else {
        tracing::warn!("BlockedRequestsState not available in app state");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_allowed_domain() {
        // AC: anthropic.com domain passes validation
        let result = validate_url("https://api.anthropic.com/v1/messages");
        assert!(result.is_ok(), "Anthropic API should be allowed");
    }

    #[test]
    fn test_validate_url_blocked_domain() {
        // AC: non-allowlisted domains fail with BlockedDomain error
        let result = validate_url("https://evil.com/exfiltrate");
        assert!(result.is_err(), "Evil domain should be blocked");

        match result {
            Err(NetworkError::BlockedDomain(domain)) => {
                assert_eq!(domain, "evil.com");
            }
            _ => panic!("Expected BlockedDomain error"),
        }
    }

    #[test]
    fn test_validate_url_invalid_url() {
        // AC: malformed URLs fail with InvalidUrl error
        let result = validate_url("not-a-url");
        assert!(result.is_err(), "Invalid URL should be rejected");

        match result {
            Err(NetworkError::InvalidUrl(_)) => {
                // Expected
            }
            _ => panic!("Expected InvalidUrl error"),
        }
    }

    #[test]
    fn test_validate_url_subdomain_attack() {
        // AC: subdomain spoofing like "api.anthropic.com.evil.com" should be blocked
        let result = validate_url("https://api.anthropic.com.evil.com/v1/messages");
        assert!(result.is_err(), "Subdomain attack should be blocked");

        match result {
            Err(NetworkError::BlockedDomain(domain)) => {
                assert_eq!(domain, "api.anthropic.com.evil.com");
            }
            _ => panic!("Expected BlockedDomain error for subdomain attack"),
        }
    }

    #[test]
    fn test_validate_url_with_path_and_query() {
        // AC: allowlisted domain with complex path/query should pass
        let result = validate_url("https://api.anthropic.com/v1/messages?model=claude-3-5-sonnet-20241022");
        assert!(result.is_ok(), "Anthropic API with query params should be allowed");
    }

    #[test]
    fn test_validate_url_different_scheme() {
        // AC: allowlisted domain with http (not https) should still pass host check
        // Note: TLS verification happens at HTTP client layer, not here
        let result = validate_url("http://api.anthropic.com/test");
        assert!(result.is_ok(), "Scheme shouldn't affect domain validation");
    }

    #[test]
    fn test_validate_anthropic_api_url_constant() {
        // Task 3.4: Sanity check that ANTHROPIC_API_URL constant passes validation
        const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
        let result = validate_url(ANTHROPIC_API_URL);
        assert!(result.is_ok(), "ANTHROPIC_API_URL constant should pass validation");
    }
}
