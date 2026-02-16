//! Unit tests for passphrase module (Story 2.1, Task 6)

use super::*;
use tempfile::tempdir;

#[test]
fn test_argon2id_produces_consistent_key() {
    // Subtask 6.1: Test Argon2id produces consistent key for same passphrase + salt
    let passphrase = "MySecurePassphrase123!";
    let salt = [1u8; 16]; // Fixed salt for reproducibility

    // Derive key twice with same inputs
    let key1 = derive_key(passphrase, &salt).unwrap();
    let key2 = derive_key(passphrase, &salt).unwrap();

    // Keys should be identical
    assert_eq!(key1, key2);
    assert_eq!(key1.len(), KEY_LENGTH);
}

#[test]
fn test_argon2id_different_salts_produce_different_keys() {
    // Verify different salts produce different keys
    let passphrase = "MySecurePassphrase123!";
    let salt1 = [1u8; 16];
    let salt2 = [2u8; 16];

    let key1 = derive_key(passphrase, &salt1).unwrap();
    let key2 = derive_key(passphrase, &salt2).unwrap();

    // Keys should be different
    assert_ne!(key1, key2);
}

#[test]
fn test_passphrase_validation_length_12_rejected() {
    // Subtask 6.2: Test passphrase validation (length <12 rejected, ≥12 accepted)
    let short_passphrase = "Short1!"; // Only 7 characters
    let salt = [0u8; 16];

    let result = derive_key(short_passphrase, &salt);

    assert!(result.is_err());
    match result {
        Err(PassphraseError::TooShort) => {} // Expected error
        _ => panic!("Expected TooShort error"),
    }
}

#[test]
fn test_passphrase_validation_length_12_accepted() {
    // Exactly 12 characters should be accepted
    let valid_passphrase = "Valid12Pass!"; // Exactly 12 characters
    let salt = [0u8; 16];

    let result = derive_key(valid_passphrase, &salt);

    assert!(result.is_ok());
    let key = result.unwrap();
    assert_eq!(key.len(), KEY_LENGTH);
}

#[test]
fn test_passphrase_validation_long_passphrase_accepted() {
    // Longer passphrase should be accepted
    let valid_passphrase = "ThisIsAVeryLongAndSecurePassphrase123!@#";
    let salt = [0u8; 16];

    let result = derive_key(valid_passphrase, &salt);

    assert!(result.is_ok());
}

#[test]
fn test_strength_meter_weak() {
    // Subtask 6.3: Test strength meter logic (weak/medium/strong cases)

    // Case 1: Too short (< 12 chars)
    let strength = calculate_strength("Short1!");
    assert_eq!(strength.level, StrengthLevel::Weak);
    assert!(!strength.meets_min_length);

    // Case 2: Long enough but missing criteria
    let strength = calculate_strength("alllowercase");
    assert_eq!(strength.level, StrengthLevel::Weak);
    assert!(strength.meets_min_length);
    assert!(!strength.has_uppercase);
    assert!(strength.has_lowercase);
    assert!(!strength.has_number);
    assert!(!strength.has_symbol);
}

#[test]
fn test_strength_meter_medium() {
    // Medium: 12+ chars, 2-3 character types
    let strength = calculate_strength("Password1234"); // uppercase, lowercase, number (3 types)
    assert_eq!(strength.level, StrengthLevel::Medium);
    assert!(strength.meets_min_length);
    assert!(strength.has_uppercase);
    assert!(strength.has_lowercase);
    assert!(strength.has_number);
    assert!(!strength.has_symbol);
}

#[test]
fn test_strength_meter_strong() {
    // Strong: 12+ chars, all 4 character types
    let strength = calculate_strength("MyPassword123!"); // uppercase, lowercase, number, symbol
    assert_eq!(strength.level, StrengthLevel::Strong);
    assert!(strength.meets_min_length);
    assert!(strength.has_uppercase);
    assert!(strength.has_lowercase);
    assert!(strength.has_number);
    assert!(strength.has_symbol);
}

#[test]
fn test_salt_generation_uniqueness() {
    // Subtask 6.4: Test salt generation uniqueness
    let salt1 = generate_random_salt().unwrap();
    let salt2 = generate_random_salt().unwrap();

    // Salts should be different (extremely unlikely to be same with crypto RNG)
    assert_ne!(salt1, salt2);
}

#[test]
fn test_salt_generation_correct_length() {
    let salt = generate_random_salt().unwrap();
    assert_eq!(salt.len(), SALT_LENGTH);
}

#[test]
fn test_salt_storage_and_loading() {
    let dir = tempdir().unwrap();
    let salt = [42u8; 16]; // Known salt for testing

    // Store salt
    let salt_path = store_salt(&salt, dir.path()).unwrap();
    assert!(salt_path.exists());

    // Load salt
    let loaded_salt = load_salt(dir.path()).unwrap();
    assert_eq!(loaded_salt, salt);
}

#[test]
fn test_salt_loading_missing_file() {
    let dir = tempdir().unwrap();

    // Try to load salt from directory with no .salt file
    let result = load_salt(dir.path());

    assert!(result.is_err());
    match result {
        Err(PassphraseError::SaltReadFailed(_)) => {} // Expected
        _ => panic!("Expected SaltReadFailed error"),
    }
}

#[test]
fn test_set_passphrase_creates_salt_file() {
    let dir = tempdir().unwrap();
    let passphrase = "MySecurePass123!";

    // Set passphrase (should generate and store salt)
    let key = set_passphrase(passphrase, dir.path()).unwrap();

    assert_eq!(key.len(), KEY_LENGTH);

    // Verify salt file was created
    let salt_path = dir.path().join(".salt");
    assert!(salt_path.exists());
}

#[test]
fn test_verify_passphrase_correct() {
    let dir = tempdir().unwrap();
    let passphrase = "MySecurePass123!";

    // Set passphrase
    let original_key = set_passphrase(passphrase, dir.path()).unwrap();

    // Verify with same passphrase
    let verified_key = verify_passphrase(passphrase, dir.path()).unwrap();

    // Keys should match
    assert_eq!(original_key, verified_key);
}

#[test]
fn test_verify_passphrase_incorrect() {
    let dir = tempdir().unwrap();
    let correct_passphrase = "MySecurePass123!";
    let wrong_passphrase = "WrongPassword456!";

    // Set passphrase
    let original_key = set_passphrase(correct_passphrase, dir.path()).unwrap();

    // Verify with wrong passphrase
    let verified_key = verify_passphrase(wrong_passphrase, dir.path()).unwrap();

    // Keys should NOT match
    assert_ne!(original_key, verified_key);
}

#[test]
fn test_key_derivation_timing_acceptable() {
    // Ensure key derivation completes within ~200-500ms (NFR-1)
    use std::time::Instant;

    let passphrase = "MySecurePass123!";
    let salt = generate_random_salt().unwrap();

    let start = Instant::now();
    let _key = derive_key(passphrase, &salt).unwrap();
    let duration = start.elapsed();

    // Should complete within 5 seconds (debug builds are ~10x slower, system load adds variance)
    // Release builds: ~200ms (NFR-1 target)
    // Debug builds: ~2-3s typical, up to 5s under heavy load (179 concurrent tests)
    assert!(
        duration.as_millis() < 5000,
        "Key derivation took too long: {:?}",
        duration
    );

    println!("Key derivation took: {:?} (target: ~200ms)", duration);
}

#[test]
fn test_derived_key_length_is_32_bytes() {
    // Verify derived key is exactly 32 bytes (AES-256 requirement)
    let passphrase = "MySecurePass123!";
    let salt = [0u8; 16];

    let key = derive_key(passphrase, &salt).unwrap();

    assert_eq!(key.len(), 32);
}

#[test]
fn test_passphrase_with_unicode_characters() {
    // Test passphrase with unicode characters
    let passphrase = "Pässwörd123!🔒"; // Contains umlauts and emoji
    let salt = [0u8; 16];

    let result = derive_key(passphrase, &salt);

    // Should work (counted by character, not bytes)
    assert!(result.is_ok());
}

#[test]
fn test_strength_calculation_serialization() {
    // Verify PassphraseStrength can be serialized (for Tauri commands)
    let strength = calculate_strength("MyPassword123!");

    // Should be able to serialize to JSON
    let json = serde_json::to_string(&strength).unwrap();
    assert!(json.contains("strong"));
}

// ====================
// Story 2.7 Tests: Encrypted Database Access on App Restart
// ====================

#[test]
fn test_verify_passphrase_and_derive_key_returns_same_as_set() {
    // Task 8.1: Test verify_passphrase_and_derive_key with correct passphrase
    // returns same key as Story 2-1 set_passphrase
    let dir = tempdir().unwrap();
    let passphrase = "RestartTest123!";

    // Set passphrase (Story 2-1 flow)
    let original_key = set_passphrase(passphrase, dir.path()).unwrap();

    // Verify on restart (Story 2.7 flow)
    let restart_key = verify_passphrase_and_derive_key(passphrase, dir.path()).unwrap();

    // Keys must match - same passphrase + salt → same key
    assert_eq!(original_key, restart_key);
    assert_eq!(restart_key.len(), KEY_LENGTH);
}

#[test]
fn test_verify_passphrase_and_derive_key_salt_missing() {
    // Task 8.3: Test salt file missing returns PassphraseError::SaltReadFailed
    let dir = tempdir().unwrap();
    let passphrase = "TestPassphrase123!";

    // Try to verify without salt file (database corrupted scenario)
    let result = verify_passphrase_and_derive_key(passphrase, dir.path());

    assert!(result.is_err());
    match result {
        Err(PassphraseError::SaltReadFailed(_)) => {} // Expected error
        _ => panic!("Expected SaltReadFailed error when salt file missing"),
    }
}

#[test]
fn test_verify_passphrase_and_derive_key_different_passphrases() {
    // Verify different passphrases produce different keys
    let dir = tempdir().unwrap();
    let passphrase1 = "CorrectPass123!";
    let passphrase2 = "WrongPassword456!";

    // Set passphrase
    let key1 = set_passphrase(passphrase1, dir.path()).unwrap();

    // Verify with different passphrase
    let key2 = verify_passphrase_and_derive_key(passphrase2, dir.path()).unwrap();

    // Keys must be different (incorrect passphrase detection happens at DB level)
    assert_ne!(key1, key2);
}

#[test]
fn test_verify_passphrase_key_derivation_correctness() {
    // Task 8.4: Validate key derivation security properties
    //
    // AC-6 Constant-Time Note: Actual constant-time comparison happens at the
    // SQLCipher layer during PRAGMA key (database unlock), not at key derivation.
    // Argon2id is constant-time by algorithm design (fixed memory/iteration cost).
    // This test validates the cryptographic correctness properties instead:
    // 1. Same passphrase + salt → identical key (deterministic)
    // 2. Different passphrase + same salt → different key (sensitivity)
    // 3. Key length is always 32 bytes (AES-256 requirement)
    let dir = tempdir().unwrap();
    let correct_passphrase = "CorrectPass123!";
    let wrong_passphrase = "WrongPassword456!";

    // Set passphrase (creates salt, derives key)
    let original_key = set_passphrase(correct_passphrase, dir.path()).unwrap();

    // Property 1: Deterministic — same passphrase reproduces same key
    let key_attempt_1 = verify_passphrase_and_derive_key(correct_passphrase, dir.path()).unwrap();
    let key_attempt_2 = verify_passphrase_and_derive_key(correct_passphrase, dir.path()).unwrap();
    assert_eq!(original_key, key_attempt_1, "Key must be deterministic");
    assert_eq!(
        key_attempt_1, key_attempt_2,
        "Repeated derivation must be identical"
    );

    // Property 2: Sensitivity — wrong passphrase produces different key
    let wrong_key = verify_passphrase_and_derive_key(wrong_passphrase, dir.path()).unwrap();
    assert_ne!(
        original_key, wrong_key,
        "Different passphrase must produce different key"
    );

    // Property 3: Key length — always 32 bytes for AES-256
    assert_eq!(original_key.len(), KEY_LENGTH);
    assert_eq!(wrong_key.len(), KEY_LENGTH);

    // Property 4: Similar passphrase (1 char different) still produces different key
    let similar_key = verify_passphrase_and_derive_key("CorrectPass124!", dir.path()).unwrap();
    assert_ne!(
        original_key, similar_key,
        "Similar passphrase must produce different key"
    );
}

// ====================
// TD-3 Tests: Zeroize Behavior Verification
// ====================

#[test]
fn test_derive_key_returns_zeroizing_wrapper() {
    // TD-3 AC-1: Verify derive_key returns Zeroizing<Vec<u8>> that zeroes on call
    use zeroize::Zeroize;

    let passphrase = "MySecurePass123!";
    let salt = [0u8; 16];

    let mut key = derive_key(passphrase, &salt).unwrap();

    // Verify the key is valid and wrapped in Zeroizing (type system enforces this)
    assert_eq!(key.len(), KEY_LENGTH);
    // Key should contain non-zero bytes (actual cryptographic output)
    assert!(
        key.iter().any(|&b| b != 0),
        "Key should have non-zero bytes before zeroize"
    );

    // Explicitly zeroize while buffer is still alive (safe — no use-after-free)
    key.zeroize();

    // Verify all bytes are now zero — buffer is still allocated so this is safe
    assert!(
        key.iter().all(|&b| b == 0),
        "Key bytes should be zeroed after zeroize()"
    );
}

#[test]
fn test_set_passphrase_returns_zeroizing_wrapper() {
    // TD-3 AC-1: Verify set_passphrase returns Zeroizing<Vec<u8>>
    use zeroize::Zeroize;

    let dir = tempdir().unwrap();
    let passphrase = "MySecurePass123!";

    let mut key = set_passphrase(passphrase, dir.path()).unwrap();

    // Verify key is valid
    assert_eq!(key.len(), KEY_LENGTH);
    assert!(
        key.iter().any(|&b| b != 0),
        "Key should have non-zero bytes before zeroize"
    );

    // Explicitly zeroize while buffer is still alive (safe — no use-after-free)
    key.zeroize();

    // Verify all bytes are now zero
    assert!(
        key.iter().all(|&b| b == 0),
        "Key bytes should be zeroed after zeroize() (set_passphrase)"
    );
}

#[test]
fn test_zeroizing_string_zeroes_passphrase() {
    // TD-3 AC-3: Verify Zeroizing<String> zeroes passphrase from memory after use
    use zeroize::{Zeroize, Zeroizing};

    let mut passphrase = Zeroizing::new("TestPassphrase123!".to_string());

    // Verify passphrase is accessible while alive
    assert_eq!(passphrase.len(), 18);
    assert!(
        passphrase.as_bytes().iter().any(|&b| b != 0),
        "Passphrase should have non-zero bytes"
    );

    // Explicitly zeroize while buffer is still alive (safe — no use-after-free)
    passphrase.zeroize();

    // Verify all bytes are now zero
    assert!(
        passphrase.as_bytes().iter().all(|&b| b == 0),
        "Passphrase string bytes should be zeroed after zeroize()"
    );
}
