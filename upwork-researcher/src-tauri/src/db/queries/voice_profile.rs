//! Voice profile database operations (Story 5-5b)
//!
//! Handles CRUD operations for voice_profiles table with UPSERT support.
//! All operations use prepared statements for safety.

use crate::voice::{CalibrationSource, StructurePreference, VoiceProfile};
use rusqlite::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Database row representation of VoiceProfile
///
/// Maps between frontend VoiceProfile struct and database schema.
/// Story 5-5b: AC-1, AC-2, AC-3
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceProfileRow {
    pub id: Option<i64>,
    pub user_id: String,
    pub tone_score: f64,
    pub avg_sentence_length: f64,
    pub vocabulary_complexity: f64,
    pub structure_paragraphs_pct: i32,
    pub structure_bullets_pct: i32,
    pub technical_depth: f64,
    pub length_preference: f64, // Story 6.2: Manual voice parameter (1-10: brief to detailed)
    pub common_phrases: Vec<String>, // Serialized as JSON
    pub sample_count: i32,
    pub calibration_source: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl VoiceProfileRow {
    /// Convert from VoiceProfile struct (Story 5-4 output)
    ///
    /// # Arguments
    /// * `profile` - Voice profile from analysis
    /// * `user_id` - User identifier (default 'default' for MVP)
    pub fn from_voice_profile(profile: &VoiceProfile, user_id: &str) -> Self {
        Self {
            id: None,
            user_id: user_id.to_string(),
            tone_score: profile.tone_score as f64,
            avg_sentence_length: profile.avg_sentence_length as f64,
            vocabulary_complexity: profile.vocabulary_complexity as f64,
            structure_paragraphs_pct: profile.structure_preference.paragraphs_pct as i32,
            structure_bullets_pct: profile.structure_preference.bullets_pct as i32,
            technical_depth: profile.technical_depth as f64,
            length_preference: profile.length_preference as f64,
            common_phrases: profile.common_phrases.clone(),
            sample_count: profile.sample_count as i32,
            calibration_source: format!("{:?}", profile.calibration_source),
            created_at: None,
            updated_at: None,
        }
    }

    /// Convert back to VoiceProfile for frontend
    pub fn to_voice_profile(&self) -> VoiceProfile {
        VoiceProfile {
            tone_score: self.tone_score as f32,
            avg_sentence_length: self.avg_sentence_length as f32,
            vocabulary_complexity: self.vocabulary_complexity as f32,
            structure_preference: StructurePreference {
                paragraphs_pct: self.structure_paragraphs_pct as u8,
                bullets_pct: self.structure_bullets_pct as u8,
            },
            technical_depth: self.technical_depth as f32,
            length_preference: self.length_preference as f32,
            common_phrases: self.common_phrases.clone(),
            sample_count: self.sample_count as u32,
            calibration_source: match self.calibration_source.as_str() {
                "GoldenSet" => CalibrationSource::GoldenSet,
                "QuickCalibration" => CalibrationSource::QuickCalibration,
                _ => CalibrationSource::Implicit,
            },
        }
    }
}

/// Save or update voice profile (UPSERT)
///
/// Story 5-5b: AC-1 (save after calibration), AC-3 (update on recalibration)
///
/// # Arguments
/// * `conn` - Database connection
/// * `profile` - Voice profile row to save
///
/// # Returns
/// * `Ok(())` - Profile saved successfully
/// * `Err(rusqlite::Error)` - Database error or validation failure
///
/// # SQL Behavior
/// - INSERT if user_id doesn't exist
/// - UPDATE if user_id already exists (UPSERT via ON CONFLICT)
/// - updated_at auto-updated by trigger (AC-3)
pub fn save_voice_profile(conn: &Connection, profile: &VoiceProfileRow) -> Result<()> {
    // Serialize common_phrases to JSON (AC-5: validation)
    let phrases_json = serde_json::to_string(&profile.common_phrases)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    // UPSERT query: INSERT or UPDATE on conflict
    conn.execute(
        "INSERT INTO voice_profiles (
            user_id, tone_score, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, technical_depth,
            length_preference, common_phrases, sample_count, calibration_source
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(user_id) DO UPDATE SET
            tone_score = excluded.tone_score,
            avg_sentence_length = excluded.avg_sentence_length,
            vocabulary_complexity = excluded.vocabulary_complexity,
            structure_paragraphs_pct = excluded.structure_paragraphs_pct,
            structure_bullets_pct = excluded.structure_bullets_pct,
            technical_depth = excluded.technical_depth,
            length_preference = excluded.length_preference,
            common_phrases = excluded.common_phrases,
            sample_count = excluded.sample_count,
            calibration_source = excluded.calibration_source",
        params![
            profile.user_id,
            profile.tone_score,
            profile.avg_sentence_length,
            profile.vocabulary_complexity,
            profile.structure_paragraphs_pct,
            profile.structure_bullets_pct,
            profile.technical_depth,
            profile.length_preference,
            phrases_json,
            profile.sample_count,
            profile.calibration_source,
        ],
    )?;

    Ok(())
}

/// Get voice profile for user (returns None if not exists)
///
/// Story 5-5b: AC-2 (load on app startup)
///
/// # Arguments
/// * `conn` - Database connection
/// * `user_id` - User identifier (default 'default' for MVP)
///
/// # Returns
/// * `Ok(Some(profile))` - Profile exists
/// * `Ok(None)` - No profile for user (triggers empty state in UI)
/// * `Err(rusqlite::Error)` - Database error
///
/// # Performance
/// - Uses idx_voice_profiles_user_id index for fast lookup
/// - Completes in <100ms (AC-2)
pub fn get_voice_profile(conn: &Connection, user_id: &str) -> Result<Option<VoiceProfileRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, tone_score, avg_sentence_length, vocabulary_complexity,
                    structure_paragraphs_pct, structure_bullets_pct, technical_depth,
                    length_preference, common_phrases, sample_count, calibration_source,
                    created_at, updated_at
             FROM voice_profiles
             WHERE user_id = ?1",
    )?;

    let result = stmt.query_row(params![user_id], |row| {
        let phrases_json: String = row.get(9)?;
        let common_phrases: Vec<String> = serde_json::from_str(&phrases_json).unwrap_or_default();

        Ok(VoiceProfileRow {
            id: Some(row.get(0)?),
            user_id: row.get(1)?,
            tone_score: row.get(2)?,
            avg_sentence_length: row.get(3)?,
            vocabulary_complexity: row.get(4)?,
            structure_paragraphs_pct: row.get(5)?,
            structure_bullets_pct: row.get(6)?,
            technical_depth: row.get(7)?,
            length_preference: row.get(8)?,
            common_phrases,
            sample_count: row.get(10)?,
            calibration_source: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    });

    match result {
        Ok(profile) => Ok(Some(profile)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Delete voice profile (for reset/recalibration)
///
/// Story 5-5b: AC-4 (Tauri commands exposed)
///
/// # Arguments
/// * `conn` - Database connection
/// * `user_id` - User identifier to delete
///
/// # Returns
/// * `Ok(true)` - Profile was deleted
/// * `Ok(false)` - No profile existed for user
/// * `Err(rusqlite::Error)` - Database error
pub fn delete_voice_profile(conn: &Connection, user_id: &str) -> Result<bool> {
    let rows_affected = conn.execute(
        "DELETE FROM voice_profiles WHERE user_id = ?1",
        params![user_id],
    )?;

    Ok(rows_affected > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// Helper: Create test database with migrations
    fn create_test_db() -> (TempDir, Connection) {
        use crate::db::Database;

        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let _db = Database::new(db_path.clone(), None).unwrap();
        let conn = Connection::open(&db_path).unwrap();

        (temp_dir, conn)
    }

    /// Helper: Create test voice profile row
    fn create_test_profile(user_id: &str) -> VoiceProfileRow {
        VoiceProfileRow {
            id: None,
            user_id: user_id.to_string(),
            tone_score: 6.5,
            avg_sentence_length: 15.2,
            vocabulary_complexity: 9.8,
            structure_paragraphs_pct: 70,
            structure_bullets_pct: 30,
            technical_depth: 7.5,
            length_preference: 5.0,
            common_phrases: vec![
                "I have experience with".to_string(),
                "happy to help you".to_string(),
            ],
            sample_count: 10,
            calibration_source: "GoldenSet".to_string(),
            created_at: None,
            updated_at: None,
        }
    }

    /// Subtask 5.2: Test save_voice_profile creates new row
    #[test]
    fn test_save_voice_profile_creates_new_row() {
        let (_temp_dir, conn) = create_test_db();
        let profile = create_test_profile("test_user_1");

        // Save should succeed
        let result = save_voice_profile(&conn, &profile);
        assert!(result.is_ok(), "save_voice_profile should succeed");

        // Verify row exists
        let loaded = get_voice_profile(&conn, "test_user_1").unwrap();
        assert!(loaded.is_some(), "Profile should exist after save");

        let loaded_profile = loaded.unwrap();
        assert_eq!(loaded_profile.user_id, "test_user_1");
        assert_eq!(loaded_profile.tone_score, 6.5);
        assert_eq!(loaded_profile.sample_count, 10);
    }

    /// Subtask 5.3: Test save_voice_profile updates existing row (UPSERT)
    #[test]
    fn test_save_voice_profile_updates_existing_row() {
        let (_temp_dir, conn) = create_test_db();

        // Save initial profile
        let profile1 = create_test_profile("test_user_2");
        save_voice_profile(&conn, &profile1).unwrap();

        // Save updated profile with same user_id
        let mut profile2 = create_test_profile("test_user_2");
        profile2.tone_score = 8.0;
        profile2.sample_count = 20;

        let result = save_voice_profile(&conn, &profile2);
        assert!(result.is_ok(), "UPSERT should succeed");

        // Verify only one row exists with updated values
        let loaded = get_voice_profile(&conn, "test_user_2").unwrap().unwrap();
        assert_eq!(loaded.tone_score, 8.0);
        assert_eq!(loaded.sample_count, 20);

        // Verify only one row per user_id
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM voice_profiles WHERE user_id = ?1",
                params!["test_user_2"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "Should have exactly one row per user_id");
    }

    /// Subtask 5.4: Test get_voice_profile returns correct data
    #[test]
    fn test_get_voice_profile_returns_correct_data() {
        let (_temp_dir, conn) = create_test_db();
        let profile = create_test_profile("test_user_3");
        save_voice_profile(&conn, &profile).unwrap();

        let loaded = get_voice_profile(&conn, "test_user_3").unwrap();
        assert!(loaded.is_some(), "Profile should exist");

        let loaded_profile = loaded.unwrap();
        assert_eq!(loaded_profile.user_id, "test_user_3");
        assert_eq!(loaded_profile.tone_score, 6.5);
        assert_eq!(loaded_profile.avg_sentence_length, 15.2);
        assert_eq!(loaded_profile.vocabulary_complexity, 9.8);
        assert_eq!(loaded_profile.structure_paragraphs_pct, 70);
        assert_eq!(loaded_profile.structure_bullets_pct, 30);
        assert_eq!(loaded_profile.technical_depth, 7.5);
        assert_eq!(loaded_profile.common_phrases.len(), 2);
        assert_eq!(loaded_profile.sample_count, 10);
        assert_eq!(loaded_profile.calibration_source, "GoldenSet");
    }

    /// Subtask 5.5: Test get_voice_profile returns None when no profile
    #[test]
    fn test_get_voice_profile_returns_none_when_missing() {
        let (_temp_dir, conn) = create_test_db();

        // Query non-existent profile
        let result = get_voice_profile(&conn, "non_existent_user").unwrap();
        assert!(
            result.is_none(),
            "Should return None for non-existent profile"
        );
    }

    /// Subtask 5.6: Test delete_voice_profile removes row
    #[test]
    fn test_delete_voice_profile_removes_row() {
        let (_temp_dir, conn) = create_test_db();
        let profile = create_test_profile("test_user_4");
        save_voice_profile(&conn, &profile).unwrap();

        // Verify profile exists
        assert!(get_voice_profile(&conn, "test_user_4").unwrap().is_some());

        // Delete profile
        let deleted = delete_voice_profile(&conn, "test_user_4").unwrap();
        assert!(deleted, "delete_voice_profile should return true");

        // Verify profile no longer exists
        assert!(
            get_voice_profile(&conn, "test_user_4").unwrap().is_none(),
            "Profile should be deleted"
        );
    }

    /// Subtask 5.6: Test delete_voice_profile returns false when no row
    #[test]
    fn test_delete_voice_profile_returns_false_when_missing() {
        let (_temp_dir, conn) = create_test_db();

        // Delete non-existent profile
        let deleted = delete_voice_profile(&conn, "non_existent").unwrap();
        assert!(!deleted, "Should return false when no profile to delete");
    }

    /// Subtask 5.7: Test validation rejects out-of-range values
    #[test]
    fn test_validation_rejects_out_of_range_values() {
        let (_temp_dir, conn) = create_test_db();

        // Test tone_score out of range (CHECK constraint in migration)
        let mut profile = create_test_profile("validation_test");
        profile.tone_score = 11.0; // > 10

        let result = save_voice_profile(&conn, &profile);
        assert!(
            result.is_err(),
            "Should reject tone_score > 10 (CHECK constraint)"
        );

        // Test technical_depth out of range
        profile.tone_score = 5.0;
        profile.technical_depth = 0.5; // < 1

        let result = save_voice_profile(&conn, &profile);
        assert!(
            result.is_err(),
            "Should reject technical_depth < 1 (CHECK constraint)"
        );

        // Test percentage out of range
        profile.technical_depth = 7.0;
        profile.structure_paragraphs_pct = 101; // > 100

        let result = save_voice_profile(&conn, &profile);
        assert!(
            result.is_err(),
            "Should reject structure_paragraphs_pct > 100 (CHECK constraint)"
        );
    }

    /// Subtask 5.8: Test JSON serialization/deserialization of common_phrases
    #[test]
    fn test_json_serialization_of_common_phrases() {
        let (_temp_dir, conn) = create_test_db();

        // Test with phrases containing special characters
        let mut profile = create_test_profile("json_test");
        profile.common_phrases = vec![
            "I'm experienced with".to_string(),
            "Let's work together".to_string(),
            r#"Uses "quotes" and backslashes \"#.to_string(),
        ];

        // Save should succeed
        save_voice_profile(&conn, &profile).unwrap();

        // Load and verify phrases are correct
        let loaded = get_voice_profile(&conn, "json_test").unwrap().unwrap();
        assert_eq!(loaded.common_phrases.len(), 3);
        assert_eq!(loaded.common_phrases[0], "I'm experienced with");
        assert_eq!(loaded.common_phrases[1], "Let's work together");
        assert_eq!(
            loaded.common_phrases[2],
            r#"Uses "quotes" and backslashes \"#
        );
    }

    /// Subtask 5.8: Test empty common_phrases array works
    #[test]
    fn test_empty_common_phrases_array() {
        let (_temp_dir, conn) = create_test_db();

        let mut profile = create_test_profile("empty_phrases");
        profile.common_phrases = vec![];

        save_voice_profile(&conn, &profile).unwrap();

        let loaded = get_voice_profile(&conn, "empty_phrases").unwrap().unwrap();
        assert_eq!(loaded.common_phrases.len(), 0);
    }

    /// Test conversion from VoiceProfile to VoiceProfileRow
    #[test]
    fn test_from_voice_profile_conversion() {
        let voice_profile = VoiceProfile {
            tone_score: 7.5,
            avg_sentence_length: 18.3,
            vocabulary_complexity: 11.2,
            structure_preference: StructurePreference {
                paragraphs_pct: 80,
                bullets_pct: 20,
            },
            technical_depth: 8.0,
            length_preference: 6.0,
            common_phrases: vec!["test phrase".to_string()],
            sample_count: 15,
            calibration_source: CalibrationSource::QuickCalibration,
        };

        let row = VoiceProfileRow::from_voice_profile(&voice_profile, "test_user");

        assert_eq!(row.user_id, "test_user");
        assert!((row.tone_score - 7.5).abs() < 0.01, "tone_score mismatch");
        assert!(
            (row.avg_sentence_length - 18.3).abs() < 0.01,
            "avg_sentence_length mismatch"
        );
        assert!(
            (row.vocabulary_complexity - 11.2).abs() < 0.01,
            "vocabulary_complexity mismatch"
        );
        assert_eq!(row.structure_paragraphs_pct, 80);
        assert_eq!(row.structure_bullets_pct, 20);
        assert!(
            (row.technical_depth - 8.0).abs() < 0.01,
            "technical_depth mismatch"
        );
        assert!(
            (row.length_preference - 6.0).abs() < 0.01,
            "length_preference mismatch"
        );
        assert_eq!(row.sample_count, 15);
        assert_eq!(row.calibration_source, "QuickCalibration");
    }

    /// Test conversion from VoiceProfileRow to VoiceProfile
    #[test]
    fn test_to_voice_profile_conversion() {
        let row = create_test_profile("conversion_test");

        let voice_profile = row.to_voice_profile();

        assert_eq!(voice_profile.tone_score, 6.5);
        assert_eq!(voice_profile.avg_sentence_length, 15.2);
        assert_eq!(voice_profile.vocabulary_complexity, 9.8);
        assert_eq!(voice_profile.structure_preference.paragraphs_pct, 70);
        assert_eq!(voice_profile.structure_preference.bullets_pct, 30);
        assert_eq!(voice_profile.technical_depth, 7.5);
        assert_eq!(voice_profile.length_preference, 5.0);
        assert_eq!(voice_profile.sample_count, 10);
        assert!(matches!(
            voice_profile.calibration_source,
            CalibrationSource::GoldenSet
        ));
    }
}
