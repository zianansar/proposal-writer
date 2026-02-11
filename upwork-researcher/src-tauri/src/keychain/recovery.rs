//! Recovery key module for database passphrase recovery (Story 2.9).
//!
//! Provides recovery key generation and encryption for database access recovery
//! when passphrase is forgotten. Uses master key wrapping approach:
//! - Database encrypted with random master key
//! - Master key encrypted with passphrase-derived key
//! - Recovery key provides alternative access to master key
//!
//! Security: Recovery key shown to user (print/save), then encrypted at rest
//! using AES-256-GCM with Argon2id-derived key.

use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::Aead;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2, ParamsBuilder, Version,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use rand::{thread_rng, Rng, RngCore};
use rand::distributions::Alphanumeric;

/// Recovery key length (32 alphanumeric characters)
pub const RECOVERY_KEY_LENGTH: usize = 32;

/// AES-256-GCM nonce length (96 bits / 12 bytes)
const NONCE_LENGTH: usize = 12;

/// Error types for recovery key operations
#[derive(Debug, thiserror::Error)]
pub enum RecoveryError {
    #[error("Failed to generate recovery key: {0}")]
    GenerationFailed(String),

    #[error("Failed to encrypt recovery key: {0}")]
    EncryptionFailed(String),

    #[error("Failed to decrypt recovery key: {0}")]
    DecryptionFailed(String),

    #[error("Invalid recovery key format (expected {RECOVERY_KEY_LENGTH} alphanumeric characters)")]
    InvalidFormat,

    #[error("Recovery key derivation failed: {0}")]
    DerivationFailed(String),
}

/// Derive a 32-byte encryption key from passphrase using Argon2id.
///
/// Shared between encrypt and decrypt to avoid code duplication.
fn derive_encryption_key(passphrase: &str, salt: &SaltString) -> Result<Vec<u8>, RecoveryError> {
    let params = ParamsBuilder::new()
        .m_cost(65536)  // 64MB (same as passphrase module)
        .t_cost(3)      // 3 iterations
        .p_cost(4)      // 4 parallelism
        .output_len(32) // 32-byte key for AES-256
        .build()
        .map_err(|e| RecoveryError::DerivationFailed(format!("Params build failed: {}", e)))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);

    let password_hash = argon2
        .hash_password(passphrase.as_bytes(), salt)
        .map_err(|e| RecoveryError::DerivationFailed(format!("Argon2id hash failed: {}", e)))?;

    let hash_output = password_hash
        .hash
        .ok_or_else(|| RecoveryError::DerivationFailed("No hash output".to_string()))?;

    Ok(hash_output.as_bytes().to_vec())
}

/// Generate cryptographically secure random recovery key.
///
/// Generates a 32-character alphanumeric string using CSPRNG.
/// Format: [A-Za-z0-9]{32}
///
/// # Returns
/// * `Ok(String)` - 32-character recovery key
/// * `Err(RecoveryError)` - Generation failed
///
/// # Security
/// - Uses `rand::thread_rng()` (cryptographically secure)
/// - 32 chars × log2(62) ≈ 190 bits of entropy
/// - Collision probability: ~1 in 2^190
pub fn generate_recovery_key() -> Result<String, RecoveryError> {
    let mut rng = thread_rng();

    let recovery_key: String = (0..RECOVERY_KEY_LENGTH)
        .map(|_| rng.sample(Alphanumeric) as char)
        .collect();

    if recovery_key.len() != RECOVERY_KEY_LENGTH {
        return Err(RecoveryError::GenerationFailed(
            format!("Generated key length {} != {}", recovery_key.len(), RECOVERY_KEY_LENGTH)
        ));
    }

    tracing::info!("Recovery key generated (32 chars, ~190 bits entropy)");

    Ok(recovery_key)
}

/// Encrypt recovery key using AES-256-GCM with Argon2id-derived key.
///
/// Uses Argon2id to derive a 32-byte encryption key from the passphrase,
/// then encrypts the recovery key using AES-256-GCM (authenticated encryption).
///
/// # Arguments
/// * `recovery_key` - The 32-char recovery key to encrypt
/// * `passphrase` - User's passphrase for encryption
///
/// # Returns
/// * `Ok(String)` - Format: "salt:base64(nonce || ciphertext || tag)"
/// * `Err(RecoveryError)` - Encryption failed
///
/// # Security
/// - AES-256-GCM provides confidentiality AND integrity (authenticated encryption)
/// - Wrong passphrase will always fail decryption (authentication tag mismatch)
/// - Random 96-bit nonce prevents ciphertext reuse attacks
pub fn encrypt_recovery_key(recovery_key: &str, passphrase: &str) -> Result<String, RecoveryError> {
    if recovery_key.len() != RECOVERY_KEY_LENGTH {
        return Err(RecoveryError::InvalidFormat);
    }

    // Generate random salt for Argon2id
    let salt = SaltString::generate(&mut OsRng);

    // Derive 32-byte encryption key from passphrase using Argon2id
    let encryption_key = derive_encryption_key(passphrase, &salt)?;

    // Generate random 96-bit nonce for AES-256-GCM
    let mut nonce_bytes = [0u8; NONCE_LENGTH];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt using AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(&encryption_key)
        .map_err(|e| RecoveryError::EncryptionFailed(format!("AES key init failed: {}", e)))?;

    let ciphertext = cipher
        .encrypt(nonce, recovery_key.as_bytes())
        .map_err(|e| RecoveryError::EncryptionFailed(format!("AES-256-GCM encrypt failed: {}", e)))?;

    // Combine nonce + ciphertext (tag is appended by aes-gcm)
    let mut combined = Vec::with_capacity(NONCE_LENGTH + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    // Format: "salt:base64(nonce || ciphertext || tag)"
    let salt_str = salt.as_str();
    let encrypted_b64 = BASE64_STANDARD.encode(&combined);
    let result = format!("{}:{}", salt_str, encrypted_b64);

    tracing::info!("Recovery key encrypted with AES-256-GCM (Argon2id-derived key)");

    Ok(result)
}

/// Decrypt recovery key using AES-256-GCM with Argon2id-derived key.
///
/// Reverses the encryption process: derives key from passphrase using stored
/// salt, then decrypts and authenticates the recovery key.
///
/// # Arguments
/// * `encrypted_data` - Format: "salt:base64(nonce || ciphertext || tag)"
/// * `passphrase` - User's passphrase for decryption
///
/// # Returns
/// * `Ok(String)` - Decrypted 32-char recovery key
/// * `Err(RecoveryError)` - Decryption or authentication failed
///
/// # Security
/// Wrong passphrase will ALWAYS fail (GCM authentication tag mismatch).
pub fn decrypt_recovery_key(encrypted_data: &str, passphrase: &str) -> Result<String, RecoveryError> {
    // Parse salt and encrypted data: "salt:base64(nonce || ciphertext || tag)"
    let parts: Vec<&str> = encrypted_data.splitn(2, ':').collect();
    if parts.len() != 2 {
        return Err(RecoveryError::DecryptionFailed(
            "Invalid encrypted data format (expected salt:encrypted)".to_string()
        ));
    }

    let salt_str = parts[0];
    let encrypted_b64 = parts[1];

    // Parse salt
    let salt = SaltString::from_b64(salt_str)
        .map_err(|e| RecoveryError::DecryptionFailed(format!("Invalid salt: {}", e)))?;

    // Derive encryption key from passphrase
    let encryption_key = derive_encryption_key(passphrase, &salt)?;

    // Decode the combined nonce + ciphertext
    let combined = BASE64_STANDARD.decode(encrypted_b64)
        .map_err(|e| RecoveryError::DecryptionFailed(format!("Invalid base64: {}", e)))?;

    if combined.len() < NONCE_LENGTH {
        return Err(RecoveryError::DecryptionFailed(
            "Encrypted data too short (missing nonce)".to_string()
        ));
    }

    // Split nonce and ciphertext
    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LENGTH);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Decrypt using AES-256-GCM (also verifies authentication tag)
    let cipher = Aes256Gcm::new_from_slice(&encryption_key)
        .map_err(|e| RecoveryError::DecryptionFailed(format!("AES key init failed: {}", e)))?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| RecoveryError::DecryptionFailed(
            "Decryption failed (wrong passphrase or corrupted data)".to_string()
        ))?;

    // Convert to string
    let recovery_key = String::from_utf8(plaintext)
        .map_err(|e| RecoveryError::DecryptionFailed(format!("Invalid UTF-8: {}", e)))?;

    if recovery_key.len() != RECOVERY_KEY_LENGTH {
        return Err(RecoveryError::DecryptionFailed(
            format!("Decrypted key length {} != {}", recovery_key.len(), RECOVERY_KEY_LENGTH)
        ));
    }

    tracing::info!("Recovery key decrypted successfully");

    Ok(recovery_key)
}

/// Validate recovery key format.
///
/// Checks that recovery key is exactly 32 alphanumeric characters.
///
/// # Arguments
/// * `recovery_key` - Recovery key to validate
///
/// # Returns
/// * `Ok(())` - Valid format
/// * `Err(RecoveryError::InvalidFormat)` - Invalid format
pub fn validate_recovery_key(recovery_key: &str) -> Result<(), RecoveryError> {
    if recovery_key.len() != RECOVERY_KEY_LENGTH {
        return Err(RecoveryError::InvalidFormat);
    }

    if !recovery_key.chars().all(|c| c.is_alphanumeric()) {
        return Err(RecoveryError::InvalidFormat);
    }

    Ok(())
}

/// Wrap (encrypt) a database encryption key with the recovery key.
///
/// Uses AES-256-GCM to encrypt the DB key, deriving the encryption key
/// from the recovery key using Argon2id. This allows the DB to be unlocked
/// using just the recovery key (without the passphrase).
///
/// # Arguments
/// * `db_key` - 32-byte database encryption key to wrap
/// * `recovery_key` - 32-char alphanumeric recovery key
///
/// # Returns
/// * `Ok(String)` - Format: "salt:base64(nonce || ciphertext || tag)"
/// * `Err(RecoveryError)` - Wrapping failed
///
/// # Story 2-7b: Enables recovery flow to actually unlock database
pub fn wrap_db_key(db_key: &[u8], recovery_key: &str) -> Result<String, RecoveryError> {
    validate_recovery_key(recovery_key)?;

    if db_key.len() != 32 {
        return Err(RecoveryError::EncryptionFailed(
            format!("DB key must be 32 bytes, got {}", db_key.len())
        ));
    }

    // Generate random salt for Argon2id
    let salt = SaltString::generate(&mut OsRng);

    // Derive 32-byte encryption key from recovery key using Argon2id
    let encryption_key = derive_encryption_key(recovery_key, &salt)?;

    // Generate random 96-bit nonce for AES-256-GCM
    let mut nonce_bytes = [0u8; NONCE_LENGTH];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt using AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(&encryption_key)
        .map_err(|e| RecoveryError::EncryptionFailed(format!("AES key init failed: {}", e)))?;

    let ciphertext = cipher
        .encrypt(nonce, db_key)
        .map_err(|e| RecoveryError::EncryptionFailed(format!("AES-256-GCM encrypt failed: {}", e)))?;

    // Combine nonce + ciphertext (tag is appended by aes-gcm)
    let mut combined = Vec::with_capacity(NONCE_LENGTH + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    // Format: "salt:base64(nonce || ciphertext || tag)"
    let salt_str = salt.as_str();
    let encrypted_b64 = BASE64_STANDARD.encode(&combined);
    let result = format!("{}:{}", salt_str, encrypted_b64);

    tracing::info!("DB key wrapped with recovery key (AES-256-GCM)");

    Ok(result)
}

/// Unwrap (decrypt) a database encryption key using the recovery key.
///
/// Reverses wrap_db_key: derives key from recovery key, decrypts DB key.
///
/// # Arguments
/// * `wrapped_key` - Format: "salt:base64(nonce || ciphertext || tag)"
/// * `recovery_key` - 32-char alphanumeric recovery key
///
/// # Returns
/// * `Ok(Vec<u8>)` - 32-byte database encryption key
/// * `Err(RecoveryError)` - Unwrapping failed (wrong key or corrupted)
///
/// # Story 2-7b: Enables recovery flow to actually unlock database
pub fn unwrap_db_key(wrapped_key: &str, recovery_key: &str) -> Result<Vec<u8>, RecoveryError> {
    validate_recovery_key(recovery_key)?;

    // Parse salt and encrypted data: "salt:base64(nonce || ciphertext || tag)"
    let parts: Vec<&str> = wrapped_key.splitn(2, ':').collect();
    if parts.len() != 2 {
        return Err(RecoveryError::DecryptionFailed(
            "Invalid wrapped key format (expected salt:encrypted)".to_string()
        ));
    }

    let salt = SaltString::from_b64(parts[0])
        .map_err(|e| RecoveryError::DecryptionFailed(format!("Invalid salt: {}", e)))?;

    let combined = BASE64_STANDARD.decode(parts[1])
        .map_err(|e| RecoveryError::DecryptionFailed(format!("Invalid base64: {}", e)))?;

    if combined.len() < NONCE_LENGTH + 16 {
        return Err(RecoveryError::DecryptionFailed(
            "Wrapped key data too short".to_string()
        ));
    }

    // Derive encryption key from recovery key
    let encryption_key = derive_encryption_key(recovery_key, &salt)?;

    // Split nonce and ciphertext
    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LENGTH);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Decrypt using AES-256-GCM (also verifies authentication tag)
    let cipher = Aes256Gcm::new_from_slice(&encryption_key)
        .map_err(|e| RecoveryError::DecryptionFailed(format!("AES key init failed: {}", e)))?;

    let db_key = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| RecoveryError::DecryptionFailed(
            "Unwrap failed (wrong recovery key or corrupted data)".to_string()
        ))?;

    if db_key.len() != 32 {
        return Err(RecoveryError::DecryptionFailed(
            format!("Unwrapped key length {} != 32", db_key.len())
        ));
    }

    tracing::info!("DB key unwrapped successfully");

    Ok(db_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_recovery_key_length() {
        let key = generate_recovery_key().unwrap();
        assert_eq!(key.len(), RECOVERY_KEY_LENGTH);
    }

    #[test]
    fn test_generate_recovery_key_alphanumeric() {
        let key = generate_recovery_key().unwrap();
        assert!(key.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn test_generate_recovery_key_randomness() {
        // Generate 100 keys, all should be unique
        let mut keys = std::collections::HashSet::new();
        for _ in 0..100 {
            keys.insert(generate_recovery_key().unwrap());
        }
        assert_eq!(keys.len(), 100, "All 100 keys should be unique");
    }

    #[test]
    fn test_encrypt_decrypt_round_trip() {
        let recovery_key = generate_recovery_key().unwrap();
        let passphrase = "test-passphrase-12345";

        let encrypted = encrypt_recovery_key(&recovery_key, passphrase).unwrap();
        let decrypted = decrypt_recovery_key(&encrypted, passphrase).unwrap();

        assert_eq!(decrypted, recovery_key);
    }

    #[test]
    fn test_decrypt_with_wrong_passphrase() {
        let recovery_key = generate_recovery_key().unwrap();
        let passphrase = "correct-passphrase";
        let wrong_passphrase = "wrong-passphrase";

        let encrypted = encrypt_recovery_key(&recovery_key, passphrase).unwrap();
        let result = decrypt_recovery_key(&encrypted, wrong_passphrase);

        // AES-256-GCM always fails with wrong passphrase (authentication tag mismatch)
        assert!(result.is_err(), "Decryption with wrong passphrase must fail");
    }

    #[test]
    fn test_validate_recovery_key_valid() {
        let key = generate_recovery_key().unwrap();
        assert!(validate_recovery_key(&key).is_ok());
    }

    #[test]
    fn test_validate_recovery_key_too_short() {
        assert!(validate_recovery_key("short").is_err());
    }

    #[test]
    fn test_validate_recovery_key_too_long() {
        let long_key = "a".repeat(33);
        assert!(validate_recovery_key(&long_key).is_err());
    }

    #[test]
    fn test_validate_recovery_key_non_alphanumeric() {
        let key = "a".repeat(31) + "!"; // 31 chars + special char
        assert!(validate_recovery_key(&key).is_err());
    }

    // M4 fix: Integration tests for recovery key unlock/re-encrypt flows

    /// Test Argon2id hash generation and verification round-trip
    /// (mirrors unlock_with_recovery_key Tauri command logic)
    #[test]
    fn test_recovery_key_argon2id_hash_verify() {
        use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString, PasswordHash, PasswordVerifier};
        use argon2::Argon2;

        let recovery_key = generate_recovery_key().unwrap();

        // Hash (same as generate_recovery_key command)
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(recovery_key.as_bytes(), &salt)
            .unwrap()
            .to_string();

        // Verify (same as unlock_with_recovery_key command)
        let parsed_hash = PasswordHash::new(&hash).unwrap();
        let result = Argon2::default().verify_password(recovery_key.as_bytes(), &parsed_hash);
        assert!(result.is_ok(), "Valid recovery key should verify against its hash");
    }

    /// Test Argon2id hash rejects wrong recovery key
    /// (mirrors unlock_with_recovery_key rejection path)
    #[test]
    fn test_recovery_key_argon2id_hash_rejects_wrong_key() {
        use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString, PasswordHash, PasswordVerifier};
        use argon2::Argon2;

        let real_key = generate_recovery_key().unwrap();
        let wrong_key = generate_recovery_key().unwrap();

        // Hash real key
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(real_key.as_bytes(), &salt)
            .unwrap()
            .to_string();

        // Verify with wrong key
        let parsed_hash = PasswordHash::new(&hash).unwrap();
        let result = Argon2::default().verify_password(wrong_key.as_bytes(), &parsed_hash);
        assert!(result.is_err(), "Wrong recovery key must fail verification");
    }

    /// Test re-encryption with new passphrase round-trip
    /// (mirrors set_new_passphrase_after_recovery command logic)
    #[test]
    fn test_reencrypt_recovery_key_with_new_passphrase() {
        let recovery_key = generate_recovery_key().unwrap();
        let old_passphrase = "old-passphrase-123";
        let new_passphrase = "new-passphrase-456";

        // Encrypt with old passphrase
        let encrypted_old = encrypt_recovery_key(&recovery_key, old_passphrase).unwrap();

        // Verify old passphrase decrypts
        let decrypted = decrypt_recovery_key(&encrypted_old, old_passphrase).unwrap();
        assert_eq!(decrypted, recovery_key);

        // Re-encrypt with new passphrase (same as set_new_passphrase_after_recovery)
        let encrypted_new = encrypt_recovery_key(&recovery_key, new_passphrase).unwrap();

        // Verify new passphrase decrypts
        let decrypted_new = decrypt_recovery_key(&encrypted_new, new_passphrase).unwrap();
        assert_eq!(decrypted_new, recovery_key);

        // Verify old passphrase no longer decrypts re-encrypted key
        let result = decrypt_recovery_key(&encrypted_new, old_passphrase);
        assert!(result.is_err(), "Old passphrase must not decrypt re-encrypted key");
    }
}
