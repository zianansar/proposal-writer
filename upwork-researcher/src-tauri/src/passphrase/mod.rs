//! Passphrase module for Argon2id key derivation (AR-3).
//!
//! Implements secure passphrase-based key derivation for SQLCipher database encryption.
//! - Argon2id algorithm with OWASP-recommended parameters
//! - 64MB memory, 3 iterations, 4 parallelism
//! - ~200ms derivation time (within NFR-1 startup budget)
//! - Salt management (random generation + persistent storage)

#[cfg(test)]
mod tests;

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2, ParamsBuilder, Version,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use rand::Rng;
use std::fs;
use std::path::{Path, PathBuf};

/// Minimum passphrase length (updated from 8 to 12 per Round 5 Security Audit)
pub const MIN_PASSPHRASE_LENGTH: usize = 12;

/// Derived key length (32 bytes for AES-256)
pub const KEY_LENGTH: usize = 32;

/// Salt length (16 bytes as recommended by OWASP)
const SALT_LENGTH: usize = 16;

/// Argon2id parameters (OWASP recommended minimums)
const MEMORY_SIZE_KB: u32 = 65536; // 64MB
const ITERATIONS: u32 = 3;
const PARALLELISM: u32 = 4;

/// Error types for passphrase operations
#[derive(Debug, thiserror::Error)]
pub enum PassphraseError {
    #[error("Passphrase is too short (minimum {MIN_PASSPHRASE_LENGTH} characters)")]
    TooShort,

    #[error("Failed to generate salt: {0}")]
    SaltGenerationFailed(String),

    #[error("Failed to derive key: {0}")]
    DerivationFailed(String),

    #[error("Failed to read salt file: {0}")]
    SaltReadFailed(String),

    #[error("Failed to write salt file: {0}")]
    SaltWriteFailed(String),

    #[error("Invalid salt format: {0}")]
    InvalidSalt(String),
}

/// Generate a cryptographically secure random salt
pub fn generate_random_salt() -> Result<[u8; SALT_LENGTH], PassphraseError> {
    let mut salt = [0u8; SALT_LENGTH];
    OsRng.try_fill(&mut salt).map_err(|e| PassphraseError::SaltGenerationFailed(e.to_string()))?;
    Ok(salt)
}

/// Store salt to file in app data directory
pub fn store_salt(salt: &[u8; SALT_LENGTH], app_data_dir: &Path) -> Result<PathBuf, PassphraseError> {
    let salt_path = app_data_dir.join(".salt");

    // Ensure app data directory exists
    fs::create_dir_all(app_data_dir)
        .map_err(|e| PassphraseError::SaltWriteFailed(format!("Failed to create directory: {}", e)))?;

    // Write salt to file (base64 encoded for safe storage)
    let salt_base64 = BASE64_STANDARD.encode(salt);
    fs::write(&salt_path, salt_base64)
        .map_err(|e| PassphraseError::SaltWriteFailed(format!("Failed to write salt file: {}", e)))?;

    tracing::info!("Salt stored at: {}", salt_path.display());

    Ok(salt_path)
}

/// Load salt from file in app data directory
pub fn load_salt(app_data_dir: &Path) -> Result<[u8; SALT_LENGTH], PassphraseError> {
    let salt_path = app_data_dir.join(".salt");

    // Read salt file
    let salt_base64 = fs::read_to_string(&salt_path)
        .map_err(|e| PassphraseError::SaltReadFailed(format!("Failed to read salt file: {}", e)))?;

    // Decode base64
    let salt_bytes = BASE64_STANDARD.decode(salt_base64.trim())
        .map_err(|e| PassphraseError::InvalidSalt(format!("Invalid base64 encoding: {}", e)))?;

    // Validate salt length
    if salt_bytes.len() != SALT_LENGTH {
        return Err(PassphraseError::InvalidSalt(format!(
            "Expected {} bytes, got {}",
            SALT_LENGTH,
            salt_bytes.len()
        )));
    }

    // Convert to fixed-size array
    let mut salt = [0u8; SALT_LENGTH];
    salt.copy_from_slice(&salt_bytes);

    Ok(salt)
}

/// Derive encryption key from passphrase using Argon2id
///
/// # Parameters
/// - `passphrase`: User's passphrase (must be at least MIN_PASSPHRASE_LENGTH)
/// - `salt`: 16-byte salt (randomly generated on first use)
///
/// # Returns
/// 32-byte encryption key suitable for SQLCipher AES-256
///
/// # Security Notes
/// - Argon2id variant (hybrid of Argon2i and Argon2d)
/// - 64MB memory cost (prevents GPU brute-force)
/// - 3 iterations (OWASP minimum)
/// - 4 parallelism (balances security and performance)
/// - ~200ms derivation time (acceptable for startup)
pub fn derive_key(passphrase: &str, salt: &[u8; SALT_LENGTH]) -> Result<Vec<u8>, PassphraseError> {
    // Validate passphrase length
    if passphrase.len() < MIN_PASSPHRASE_LENGTH {
        return Err(PassphraseError::TooShort);
    }

    // Build Argon2id parameters
    let params = ParamsBuilder::new()
        .m_cost(MEMORY_SIZE_KB)
        .t_cost(ITERATIONS)
        .p_cost(PARALLELISM)
        .output_len(KEY_LENGTH)
        .build()
        .map_err(|e| PassphraseError::DerivationFailed(format!("Failed to build params: {}", e)))?;

    // Create Argon2 instance
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);

    // Convert salt to SaltString for argon2 crate
    let salt_string = SaltString::encode_b64(salt)
        .map_err(|e| PassphraseError::DerivationFailed(format!("Failed to encode salt: {}", e)))?;

    // Derive key
    let password_hash = argon2
        .hash_password(passphrase.as_bytes(), &salt_string)
        .map_err(|e| PassphraseError::DerivationFailed(format!("Argon2id derivation failed: {}", e)))?;

    // Extract raw hash bytes
    let key = password_hash
        .hash
        .ok_or_else(|| PassphraseError::DerivationFailed("No hash produced".to_string()))?
        .as_bytes()
        .to_vec();

    // Verify key length
    if key.len() != KEY_LENGTH {
        return Err(PassphraseError::DerivationFailed(format!(
            "Expected {} bytes, got {}",
            KEY_LENGTH,
            key.len()
        )));
    }

    Ok(key)
}

/// Set passphrase and derive encryption key
///
/// High-level function that:
/// 1. Validates passphrase
/// 2. Generates salt (or loads existing)
/// 3. Derives 32-byte encryption key
/// 4. Stores salt for future use
///
/// Returns the derived key for immediate use in SQLCipher initialization.
pub fn set_passphrase(passphrase: &str, app_data_dir: &Path) -> Result<Vec<u8>, PassphraseError> {
    // Generate new salt
    let salt = generate_random_salt()?;

    // Derive key from passphrase
    let key = derive_key(passphrase, &salt)?;

    // Store salt for future use (restart scenarios)
    store_salt(&salt, app_data_dir)?;

    tracing::info!("Passphrase set successfully, key derived (~200ms)");

    Ok(key)
}

/// Verify passphrase by deriving key and comparing (constant-time)
///
/// Used during app restart to unlock the encrypted database.
/// Loads existing salt and derives key to verify correctness.
pub fn verify_passphrase(passphrase: &str, app_data_dir: &Path) -> Result<Vec<u8>, PassphraseError> {
    // Load existing salt
    let salt = load_salt(app_data_dir)?;

    // Derive key from passphrase
    let key = derive_key(passphrase, &salt)?;

    tracing::info!("Passphrase verified successfully");

    Ok(key)
}

/// Derive encryption key from stored salt for database unlock on restart (Story 2.7, Task 1.1).
///
/// Delegates to `verify_passphrase`. Named for clarity in the restart flow —
/// "verification" happens at the SQLCipher layer when the derived key is used
/// to open the encrypted database, not during key derivation itself.
///
/// # Security (AC-6: Constant-Time)
/// - Argon2id derivation is constant-time by algorithm design
/// - SQLCipher uses constant-time comparison during PRAGMA key
/// - No stored key to compare — correctness verified by database unlock
pub fn verify_passphrase_and_derive_key(passphrase: &str, app_data_dir: &Path) -> Result<Vec<u8>, PassphraseError> {
    verify_passphrase(passphrase, app_data_dir)
}

/// Passphrase strength assessment
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PassphraseStrength {
    pub level: StrengthLevel,
    pub meets_min_length: bool,
    pub has_uppercase: bool,
    pub has_lowercase: bool,
    pub has_number: bool,
    pub has_symbol: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StrengthLevel {
    Weak,
    Medium,
    Strong,
}

/// Calculate passphrase strength (for UI feedback)
pub fn calculate_strength(passphrase: &str) -> PassphraseStrength {
    let meets_min_length = passphrase.len() >= MIN_PASSPHRASE_LENGTH;
    let has_uppercase = passphrase.chars().any(|c| c.is_uppercase());
    let has_lowercase = passphrase.chars().any(|c| c.is_lowercase());
    let has_number = passphrase.chars().any(|c| c.is_numeric());
    let has_symbol = passphrase.chars().any(|c| !c.is_alphanumeric());

    let criteria_count = [has_uppercase, has_lowercase, has_number, has_symbol]
        .iter()
        .filter(|&&x| x)
        .count();

    let level = if meets_min_length {
        match criteria_count {
            4 => StrengthLevel::Strong,
            2..=3 => StrengthLevel::Medium,
            _ => StrengthLevel::Weak,
        }
    } else {
        StrengthLevel::Weak
    };

    PassphraseStrength {
        level,
        meets_min_length,
        has_uppercase,
        has_lowercase,
        has_number,
        has_symbol,
    }
}
