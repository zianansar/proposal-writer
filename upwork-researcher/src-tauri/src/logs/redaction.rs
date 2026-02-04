/// Sensitive data redaction utilities for logging
///
/// Provides wrappers and utilities to automatically redact sensitive information
/// (API keys, passphrases) from logs to prevent credential leakage.

use std::fmt;

/// Wrapper for API keys that redacts the value when displayed
///
/// Masks all but the prefix (sk-ant-) for identification purposes.
/// Usage: `tracing::info!(api_key = %RedactedApiKey(&key), "Setting API key")`
pub struct RedactedApiKey<'a>(pub &'a str);

impl<'a> fmt::Display for RedactedApiKey<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.0.starts_with("sk-ant-") {
            write!(f, "sk-ant-...REDACTED")
        } else {
            write!(f, "[REDACTED]")
        }
    }
}

/// Wrapper for passphrases that completely redacts the value
///
/// Always displays as [REDACTED] regardless of the actual value.
/// Usage: `tracing::debug!(passphrase = %RedactedPassphrase(&pass), "Checking passphrase")`
pub struct RedactedPassphrase<'a>(pub &'a str);

impl<'a> fmt::Display for RedactedPassphrase<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[REDACTED]")
    }
}

/// Redact API key in a string (for general purpose redaction)
///
/// Replaces any API key pattern (sk-ant-...) with sk-ant-...REDACTED
pub fn redact_api_key(input: &str) -> String {
    // Simple pattern matching for sk-ant- prefix
    // In production, could use regex for more sophisticated matching
    if input.contains("sk-ant-") {
        let parts: Vec<&str> = input.split("sk-ant-").collect();
        let mut result = String::from(parts[0]);

        for (i, part) in parts.iter().enumerate().skip(1) {
            result.push_str("sk-ant-");
            if i < parts.len() - 1 || !part.is_empty() {
                result.push_str("...REDACTED");
                // Keep any text after the key (e.g., punctuation, spaces)
                if let Some(idx) = part.find(|c: char| !c.is_alphanumeric() && c != '-' && c != '_') {
                    result.push_str(&part[idx..]);
                }
            }
        }

        result
    } else {
        input.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redacted_api_key_display() {
        let key = "sk-ant-1234567890abcdef";
        let redacted = RedactedApiKey(key);
        assert_eq!(format!("{}", redacted), "sk-ant-...REDACTED");
    }

    #[test]
    fn test_redacted_api_key_invalid_format() {
        let key = "invalid-key-format";
        let redacted = RedactedApiKey(key);
        assert_eq!(format!("{}", redacted), "[REDACTED]");
    }

    #[test]
    fn test_redacted_passphrase_display() {
        let passphrase = "my-secret-passphrase-123";
        let redacted = RedactedPassphrase(passphrase);
        assert_eq!(format!("{}", redacted), "[REDACTED]");
    }

    #[test]
    fn test_redact_api_key_in_string() {
        let input = "API key: sk-ant-abc123def456";
        let output = redact_api_key(input);
        assert_eq!(output, "API key: sk-ant-...REDACTED");
    }

    #[test]
    fn test_redact_api_key_multiple() {
        let input = "Keys: sk-ant-key1 and sk-ant-key2";
        let output = redact_api_key(input);
        assert!(output.contains("sk-ant-...REDACTED"));
        assert!(!output.contains("key1"));
        assert!(!output.contains("key2"));
    }

    #[test]
    fn test_redact_api_key_no_match() {
        let input = "No API key here";
        let output = redact_api_key(input);
        assert_eq!(output, input);
    }

    #[test]
    fn test_redact_api_key_with_punctuation() {
        let input = "API key: sk-ant-abc123, done";
        let output = redact_api_key(input);
        assert!(output.contains("sk-ant-...REDACTED, done"));
    }
}
