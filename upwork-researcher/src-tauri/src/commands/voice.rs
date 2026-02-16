//! Voice learning commands for Epic 5
//!
//! Provides Tauri commands for golden set proposal management and file uploads.
//! Privacy: All proposal text stays local - never transmitted to API (AR-12).

use crate::db::queries::golden_set::{
    add_golden_proposal, delete_golden_proposal, get_golden_proposal_count, get_golden_proposals,
    GoldenProposal,
};
use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

/// File content extracted from uploaded file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub text: String,
    pub filename: String,
}

/// Tauri command: Add a golden proposal (from paste or file upload)
///
/// # Story 5.3: AC-2, AC-3, AC-4, AC-6
/// - AC-2: Stores proposals from file upload
/// - AC-3: Stores proposals from paste area
/// - AC-4: Validates minimum 200 words
/// - AC-6: Saves to golden_set_proposals table
#[tauri::command]
pub async fn add_golden_proposal_command(
    content: String,
    source_filename: Option<String>,
    database: State<'_, AppDatabase>,
) -> Result<i64, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    add_golden_proposal(&conn, &content, source_filename.as_deref()).map_err(|e| match e {
        rusqlite::Error::SqliteFailure(_, Some(msg)) => msg,
        _ => format!("Failed to add proposal: {}", e),
    })
}

/// Tauri command: Get all golden proposals
///
/// # Story 5.3: AC-5
/// - Returns list of uploaded proposals with preview
#[tauri::command]
pub async fn get_golden_proposals_command(
    database: State<'_, AppDatabase>,
) -> Result<Vec<GoldenProposal>, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    get_golden_proposals(&conn).map_err(|e| format!("Failed to fetch proposals: {}", e))
}

/// Tauri command: Delete a golden proposal by ID
///
/// # Story 5.3: AC-5
/// - Delete button (×) to remove individual proposals
#[tauri::command]
pub async fn delete_golden_proposal_command(
    id: i64,
    database: State<'_, AppDatabase>,
) -> Result<(), String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    delete_golden_proposal(&conn, id).map_err(|e| format!("Failed to delete proposal: {}", e))
}

/// Tauri command: Get count of golden proposals
///
/// # Story 5.3: AC-5
/// - Counter: "2/5 proposals uploaded"
#[tauri::command]
pub async fn get_golden_proposal_count_command(
    database: State<'_, AppDatabase>,
) -> Result<i64, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    get_golden_proposal_count(&conn).map_err(|e| format!("Failed to get proposal count: {}", e))
}

/// Tauri command: Pick and read a file (.txt or .pdf)
///
/// Opens file dialog, reads file, and extracts text.
/// Note: Uses blocking dialog as Tauri dialog plugin is inherently modal.
///
/// # Story 5.3: AC-2
/// - Accepts .txt and .pdf files
/// - Extracts plain text from uploaded files
/// - Returns filename after successful upload
#[tauri::command]
pub async fn pick_and_read_file(app_handle: tauri::AppHandle) -> Result<FileContent, String> {
    use tauri_plugin_dialog::DialogExt;

    // Open file picker with .txt and .pdf filter
    // Note: blocking_pick_file is correct - dialog is modal by nature
    let file_path = app_handle
        .dialog()
        .file()
        .set_title("Select Proposal File")
        .add_filter("Text Files", &["txt", "pdf"])
        .blocking_pick_file()
        .ok_or("No file selected")?;

    // Convert FilePath to PathBuf
    let path_str = file_path.to_string();
    let path = std::path::PathBuf::from(&path_str);

    let filename = path
        .file_name()
        .and_then(|n: &std::ffi::OsStr| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Extract text based on file extension
    let text = if path.extension().and_then(|e: &std::ffi::OsStr| e.to_str()) == Some("pdf") {
        // PDF extraction (AC-2: Extract text from .pdf files)
        extract_text_from_pdf(&path).map_err(|e| {
            format!(
                "Could not read PDF. Please paste the text instead. Error: {}",
                e
            )
        })?
    } else {
        // Plain text file (AC-2: Extract text from .txt files)
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?
    };

    Ok(FileContent { text, filename })
}

/// Extract text from PDF file using pdf-extract crate
fn extract_text_from_pdf(path: &std::path::Path) -> Result<String, Box<dyn std::error::Error>> {
    // NOTE: PDF extraction implementation
    // Using pdf-extract crate for pure Rust PDF text extraction
    // Fallback: Show error message to user (AC-2: "Could not read PDF. Please paste the text instead.")

    use pdf_extract::extract_text;

    let text = extract_text(path)?;

    Ok(text)
}

/// Result of voice calibration
///
/// # Story 5.4: Task 3.5, AC-6
#[derive(Clone, Serialize)]
pub struct CalibrationResult {
    pub profile: crate::voice::VoiceProfile,
    pub elapsed_ms: u64,
    pub proposals_analyzed: usize,
}

/// Progress event payload
///
/// # Story 5.4: Task 3.4, AC-4
#[derive(Clone, Serialize)]
struct AnalysisProgress {
    current: usize,
    total: usize,
}

/// Tauri command: Calibrate voice from Golden Set proposals
///
/// # Story 5.4: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
/// - AC-1: Analyzes locally in Rust backend (NOT via API call)
/// - AC-2: Extracts 6 voice parameters (tone, sentence length, complexity, structure, depth, phrases)
/// - AC-3: Completes in <2 seconds for 5 proposals
/// - AC-4: Emits progress events: "Analyzing proposals... (3/5)"
/// - AC-5: Returns completion message with elapsed time
/// - AC-6: Returns VoiceProfile to frontend
#[tauri::command]
pub async fn calibrate_voice(
    window: tauri::Window,
    database: State<'_, AppDatabase>,
    voice_cache: State<'_, crate::VoiceCache>, // Story 5.8 Subtask 4.5: Cache invalidation
) -> Result<CalibrationResult, String> {
    use std::time::Instant;

    let database = database.get()?;
    let start = Instant::now();

    // Load golden set proposals (Task 3.2)
    let (proposals, total) = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        let proposals =
            get_golden_proposals(&conn).map_err(|e| format!("Failed to load proposals: {}", e))?;

        if proposals.len() < 3 {
            return Err("At least 3 proposals required for voice calibration".to_string());
        }

        let total = proposals.len();
        (proposals, total)
    }; // conn dropped here

    let mut proposal_texts = Vec::new();

    // Emit progress events for each proposal (Task 3.4, AC-4)
    for (i, proposal) in proposals.iter().enumerate() {
        window
            .emit(
                "analysis_progress",
                AnalysisProgress {
                    current: i + 1,
                    total,
                },
            )
            .map_err(|e| format!("Failed to emit progress: {}", e))?;

        proposal_texts.push(proposal.content.clone());
    }

    // Run local analysis (Task 3.3, AC-1, AC-2)
    let profile = crate::voice::aggregate_voice_profile(&proposal_texts);

    // Track elapsed time (Task 3.6, AC-3)
    let elapsed = start.elapsed();

    // Save profile to database (Story 5-5b: AC-1)
    {
        use crate::db::queries::voice_profile::{self, VoiceProfileRow};
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;
        let row = VoiceProfileRow::from_voice_profile(&profile, "default");
        voice_profile::save_voice_profile(&conn, &row)
            .map_err(|e| format!("Warning: Failed to save voice profile: {}", e))?;
    }

    // Story 5.8 Subtask 4.5: Invalidate cache after recalibration (AC-6)
    voice_cache.invalidate();
    tracing::info!("Voice profile cache invalidated after calibration");

    Ok(CalibrationResult {
        profile,
        elapsed_ms: elapsed.as_millis() as u64,
        proposals_analyzed: total,
    })
}

// ==================== Story 5-5b: Voice Profile Persistence ====================

/// Tauri command: Get voice profile from database
///
/// # Story 5-5b: AC-2, AC-4
/// - Returns voice profile if exists (AC-2: load on app startup)
/// - Returns null if no profile exists (triggers empty state in UI)
/// - Completes in <100ms (indexed query)
#[tauri::command]
pub async fn get_voice_profile(
    database: State<'_, AppDatabase>,
) -> Result<Option<crate::voice::VoiceProfile>, String> {
    use crate::db::queries::voice_profile;

    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    voice_profile::get_voice_profile(&conn, "default")
        .map(|opt: Option<voice_profile::VoiceProfileRow>| opt.map(|row| row.to_voice_profile()))
        .map_err(|e| format!("Failed to get voice profile: {}", e))
}

/// Tauri command: Save voice profile to database (UPSERT)
///
/// # Story 5-5b: AC-1, AC-3, AC-4
/// - Saves new profile or updates existing (UPSERT)
/// - Validates data integrity (AC-5: ranges, JSON)
#[tauri::command]
pub async fn save_voice_profile(
    profile: crate::voice::VoiceProfile,
    database: State<'_, AppDatabase>,
) -> Result<(), String> {
    use crate::db::queries::voice_profile::{self, VoiceProfileRow};

    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let row = VoiceProfileRow::from_voice_profile(&profile, "default");
    voice_profile::save_voice_profile(&conn, &row)
        .map_err(|e| format!("Failed to save voice profile: {}", e))
}

/// Tauri command: Delete voice profile (reset for recalibration)
///
/// # Story 5-5b: AC-4
/// - Removes existing profile to allow recalibration
/// - Returns true if profile was deleted, false if none existed
#[tauri::command]
pub async fn delete_voice_profile(database: State<'_, AppDatabase>) -> Result<bool, String> {
    use crate::db::queries::voice_profile;

    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    voice_profile::delete_voice_profile(&conn, "default")
        .map_err(|e| format!("Failed to delete voice profile: {}", e))
}

// ==================== Story 6-2: Manual Voice Parameter Adjustments ====================

/// Voice parameter partial update (for manual slider adjustments)
///
/// # Story 6.2: Task 5
/// - Allows updating only tone_score, length_preference, technical_depth
/// - Other fields remain unchanged
#[derive(Debug, Deserialize)]
pub struct VoiceParameterUpdate {
    pub tone_score: Option<f32>,
    pub length_preference: Option<f32>,
    pub technical_depth: Option<f32>,
}

/// Tauri command: Update voice parameters (manual adjustments from sliders)
///
/// # Story 6.2: AC (adjusting slider immediately saves)
/// - Partial update: only specified parameters are updated
/// - Creates profile with defaults if none exists
/// - Returns updated profile
#[tauri::command]
pub async fn update_voice_parameters(
    user_id: String,
    params: VoiceParameterUpdate,
    database: State<'_, AppDatabase>,
    voice_cache: State<'_, crate::VoiceCache>, // Invalidate cache on update
) -> Result<crate::voice::VoiceProfile, String> {
    use crate::db::queries::voice_profile::VoiceProfileRow;
    use crate::db::queries::voice_profile::{get_voice_profile, save_voice_profile};

    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Load existing profile or create default
    let mut profile_row = match get_voice_profile(&conn, &user_id)
        .map_err(|e| format!("Failed to get voice profile: {}", e))?
    {
        Some(existing) => existing,
        None => {
            // No profile exists - create default
            VoiceProfileRow {
                id: None,
                user_id: user_id.clone(),
                tone_score: 5.0,
                avg_sentence_length: 15.0,
                vocabulary_complexity: 8.0,
                structure_paragraphs_pct: 70,
                structure_bullets_pct: 30,
                technical_depth: 5.0,
                length_preference: 5.0,
                common_phrases: vec![],
                sample_count: 0,
                calibration_source: "Implicit".to_string(), // Must match CHECK constraint enum
                created_at: None,
                updated_at: None,
            }
        }
    };

    // Apply partial updates
    if let Some(tone) = params.tone_score {
        profile_row.tone_score = tone as f64;
    }
    if let Some(length) = params.length_preference {
        profile_row.length_preference = length as f64;
    }
    if let Some(depth) = params.technical_depth {
        profile_row.technical_depth = depth as f64;
    }

    // Save updated profile
    save_voice_profile(&conn, &profile_row)
        .map_err(|e| format!("Failed to save voice profile: {}", e))?;

    // Invalidate cache (changes affect future proposals)
    voice_cache.invalidate();
    tracing::info!("Voice profile cache invalidated after manual parameter update");

    // Return updated profile for frontend
    Ok(profile_row.to_voice_profile())
}

// ==================== Story 5-7: Quick Calibration ====================

/// Quick calibration answers from user questionnaire
///
/// # Story 5.7: Subtask 3.2, AC-4
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCalibrationAnswers {
    pub tone: String,            // formal, professional, conversational, casual
    pub length: String,          // brief, moderate, detailed
    pub technical_depth: String, // simple, technical, expert
    pub structure: String,       // bullets, paragraphs, mixed
    // call_to_action is collected from the frontend questionnaire but not yet mapped
    // to a VoiceProfile field. Reserved for future CTA-style personalization.
    pub call_to_action: String, // direct, consultative, question
}

/// Map quick calibration answers to a VoiceProfile (pure function, no DB).
///
/// Single source of truth for answer-to-profile mapping (TD-5 AC-2).
/// Frontend calls `quick_calibrate` Tauri command which uses this internally.
pub fn map_answers_to_profile(answers: &QuickCalibrationAnswers) -> crate::voice::VoiceProfile {
    use crate::voice::{CalibrationSource, StructurePreference, VoiceProfile};

    let tone_score = match answers.tone.as_str() {
        "formal" => 9.0,
        "professional" => 7.0,
        "conversational" => 5.0,
        "casual" => 3.0,
        _ => 7.0,
    };

    let avg_sentence_length = match answers.length.as_str() {
        "brief" => 10.0,
        "moderate" => 16.0,
        "detailed" => 24.0,
        _ => 16.0,
    };

    let technical_depth = match answers.technical_depth.as_str() {
        "simple" => 3.0,
        "technical" => 6.0,
        "expert" => 9.0,
        _ => 6.0,
    };

    let structure_preference = match answers.structure.as_str() {
        "bullets" => StructurePreference {
            paragraphs_pct: 20,
            bullets_pct: 80,
        },
        "paragraphs" => StructurePreference {
            paragraphs_pct: 80,
            bullets_pct: 20,
        },
        "mixed" => StructurePreference {
            paragraphs_pct: 50,
            bullets_pct: 50,
        },
        _ => StructurePreference {
            paragraphs_pct: 50,
            bullets_pct: 50,
        },
    };

    VoiceProfile {
        tone_score,
        avg_sentence_length,
        // Quick calibration doesn't assess vocabulary or length preference —
        // these require actual proposal text analysis (Golden Set calibration).
        // Defaults: ~college reading level, neutral length preference.
        vocabulary_complexity: 8.0,
        structure_preference,
        technical_depth,
        length_preference: 5.0,
        common_phrases: vec![],
        sample_count: 0,
        calibration_source: CalibrationSource::QuickCalibration,
    }
}

/// Tauri command: Quick calibrate voice from 5-question answers
///
/// # Story 5.7: AC-4, AC-5
/// - Maps answers to VoiceProfile parameters
/// - Saves profile via save_voice_profile
/// - Returns created profile
#[tauri::command]
pub async fn quick_calibrate(
    answers: QuickCalibrationAnswers,
    database: State<'_, AppDatabase>,
    voice_cache: State<'_, crate::VoiceCache>, // Story 5.8 Subtask 4.5: Cache invalidation
) -> Result<crate::voice::VoiceProfile, String> {
    // TD-5 AC-2: Single source of truth — uses extracted map_answers_to_profile
    let profile = map_answers_to_profile(&answers);

    // Save profile to database (Subtask 3.4)
    {
        use crate::db::queries::voice_profile::{self, VoiceProfileRow};
        let database = database.get()?;
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;
        let row = VoiceProfileRow::from_voice_profile(&profile, "default");
        voice_profile::save_voice_profile(&conn, &row)
            .map_err(|e| format!("Failed to save voice profile: {}", e))?;
    }

    // Story 5.8 Subtask 4.5: Invalidate cache after recalibration (AC-6)
    voice_cache.invalidate();
    tracing::info!("Voice profile cache invalidated after quick calibration");

    // Return created profile (Subtask 3.5)
    Ok(profile)
}

#[cfg(test)]
mod tests {
    use crate::db::queries::golden_set;
    use crate::db::Database;
    use std::io::Write;
    use tempfile::{tempdir, NamedTempFile};

    fn create_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        Database::new(db_path, None).unwrap()
    }

    #[test]
    fn test_add_golden_proposal_valid() {
        // Story 5.3: Subtask 2.2 - Test add/get/delete CRUD operations
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let content = "word ".repeat(200); // 200 words
        let result = golden_set::add_golden_proposal(&conn, &content, Some("test.txt"));

        assert!(result.is_ok(), "Should succeed with valid proposal");
        assert!(result.unwrap() > 0, "Should return positive ID");
    }

    #[test]
    fn test_add_golden_proposal_below_minimum() {
        // Story 5.3: Subtask 5.3 - Test word count validation
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let content = "word ".repeat(150); // 150 words (below minimum)
        let result = golden_set::add_golden_proposal(&conn, &content, None);

        assert!(result.is_err(), "Should reject proposal < 200 words");

        if let Err(rusqlite::Error::SqliteFailure(_, Some(msg))) = result {
            assert!(
                msg.contains("200"),
                "Error should mention minimum word count"
            );
            assert!(msg.contains("150"), "Error should show current word count");
        }
    }

    #[test]
    fn test_get_golden_proposals() {
        // Story 5.3: Subtask 2.3 - Test get_golden_proposals
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Add 2 proposals
        let content = "word ".repeat(200); // 200 words
        golden_set::add_golden_proposal(&conn, &content, Some("first.txt")).unwrap();
        golden_set::add_golden_proposal(&conn, &content, Some("second.txt")).unwrap();

        let result = golden_set::get_golden_proposals(&conn);

        assert!(result.is_ok(), "Should succeed");
        let proposals = result.unwrap();
        assert_eq!(proposals.len(), 2, "Should return 2 proposals");
    }

    #[test]
    fn test_delete_golden_proposal() {
        // Story 5.3: Subtask 2.4 - Test delete_golden_proposal
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let content = "word ".repeat(200); // 200 words
        let proposal_id =
            golden_set::add_golden_proposal(&conn, &content, Some("test.txt")).unwrap();

        let result = golden_set::delete_golden_proposal(&conn, proposal_id);
        assert!(result.is_ok(), "Should delete successfully");

        // Verify it's deleted
        let proposals = golden_set::get_golden_proposals(&conn).unwrap();
        assert_eq!(proposals.len(), 0, "Should have 0 proposals after delete");
    }

    #[test]
    fn test_get_golden_proposal_count() {
        // Story 5.3: Subtask 2.5 - Test get_golden_proposal_count
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Initially 0
        let count = golden_set::get_golden_proposal_count(&conn).unwrap();
        assert_eq!(count, 0, "Should start with 0 proposals");

        // Add 3 proposals
        let content = "word ".repeat(200); // 200 words
        for i in 1..=3 {
            golden_set::add_golden_proposal(&conn, &content, Some(&format!("{}.txt", i))).unwrap();
        }

        let count = golden_set::get_golden_proposal_count(&conn).unwrap();
        assert_eq!(count, 3, "Should have 3 proposals");
    }

    #[test]
    fn test_extract_text_from_txt_file() {
        // Story 5.3: Subtask 5.4 - Test file text extraction (.txt)
        let mut temp_file = NamedTempFile::new().unwrap();
        let test_content = "This is a test file with some content.";
        writeln!(temp_file, "{}", test_content).unwrap();

        let content = std::fs::read_to_string(temp_file.path()).unwrap();
        assert!(
            content.contains(test_content),
            "Should read .txt file content"
        );
    }

    #[test]
    fn test_pdf_extraction_function_exists() {
        // Verify PDF extraction function is properly integrated
        // Note: Full PDF test requires actual PDF file - tested via integration
        use std::path::PathBuf;

        // Test with non-existent file (should error gracefully)
        let fake_path = PathBuf::from("nonexistent.pdf");
        let result = super::extract_text_from_pdf(&fake_path);

        // Should return an error for non-existent file
        assert!(result.is_err(), "Should error for non-existent PDF");
    }

    #[test]
    fn test_max_proposals_enforced_in_backend() {
        // Verify max 5 proposals limit is enforced at backend level
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let content = "word ".repeat(200);

        // Add 5 proposals
        for i in 1..=5 {
            golden_set::add_golden_proposal(&conn, &content, Some(&format!("{}.txt", i))).unwrap();
        }

        // 6th should fail
        let result = golden_set::add_golden_proposal(&conn, &content, Some("6.txt"));
        assert!(result.is_err(), "Backend should reject 6th proposal");
    }

    // TD-5 AC-2: Tests for map_answers_to_profile (single source of truth)
    #[test]
    fn test_map_answers_tone_mapping() {
        use super::{map_answers_to_profile, QuickCalibrationAnswers};
        let make = |tone: &str| QuickCalibrationAnswers {
            tone: tone.to_string(),
            length: "moderate".to_string(),
            technical_depth: "technical".to_string(),
            structure: "mixed".to_string(),
            call_to_action: "direct".to_string(),
        };
        assert_eq!(map_answers_to_profile(&make("formal")).tone_score, 9.0);
        assert_eq!(
            map_answers_to_profile(&make("professional")).tone_score,
            7.0
        );
        assert_eq!(
            map_answers_to_profile(&make("conversational")).tone_score,
            5.0
        );
        assert_eq!(map_answers_to_profile(&make("casual")).tone_score, 3.0);
        assert_eq!(map_answers_to_profile(&make("unknown")).tone_score, 7.0); // default
    }

    #[test]
    fn test_map_answers_length_mapping() {
        use super::{map_answers_to_profile, QuickCalibrationAnswers};
        let make = |length: &str| QuickCalibrationAnswers {
            tone: "professional".to_string(),
            length: length.to_string(),
            technical_depth: "technical".to_string(),
            structure: "mixed".to_string(),
            call_to_action: "direct".to_string(),
        };
        assert_eq!(
            map_answers_to_profile(&make("brief")).avg_sentence_length,
            10.0
        );
        assert_eq!(
            map_answers_to_profile(&make("moderate")).avg_sentence_length,
            16.0
        );
        assert_eq!(
            map_answers_to_profile(&make("detailed")).avg_sentence_length,
            24.0
        );
    }

    #[test]
    fn test_map_answers_technical_depth_mapping() {
        use super::{map_answers_to_profile, QuickCalibrationAnswers};
        let make = |depth: &str| QuickCalibrationAnswers {
            tone: "professional".to_string(),
            length: "moderate".to_string(),
            technical_depth: depth.to_string(),
            structure: "mixed".to_string(),
            call_to_action: "direct".to_string(),
        };
        assert_eq!(map_answers_to_profile(&make("simple")).technical_depth, 3.0);
        assert_eq!(
            map_answers_to_profile(&make("technical")).technical_depth,
            6.0
        );
        assert_eq!(map_answers_to_profile(&make("expert")).technical_depth, 9.0);
    }

    #[test]
    fn test_map_answers_structure_mapping() {
        use super::{map_answers_to_profile, QuickCalibrationAnswers};
        let make = |structure: &str| QuickCalibrationAnswers {
            tone: "professional".to_string(),
            length: "moderate".to_string(),
            technical_depth: "technical".to_string(),
            structure: structure.to_string(),
            call_to_action: "direct".to_string(),
        };
        let bullets = map_answers_to_profile(&make("bullets"));
        assert_eq!(bullets.structure_preference.bullets_pct, 80);
        assert_eq!(bullets.structure_preference.paragraphs_pct, 20);

        let paragraphs = map_answers_to_profile(&make("paragraphs"));
        assert_eq!(paragraphs.structure_preference.paragraphs_pct, 80);
        assert_eq!(paragraphs.structure_preference.bullets_pct, 20);

        let mixed = map_answers_to_profile(&make("mixed"));
        assert_eq!(mixed.structure_preference.paragraphs_pct, 50);
        assert_eq!(mixed.structure_preference.bullets_pct, 50);
    }

    #[test]
    fn test_map_answers_defaults_and_metadata() {
        use super::{map_answers_to_profile, QuickCalibrationAnswers};
        let answers = QuickCalibrationAnswers {
            tone: "professional".to_string(),
            length: "moderate".to_string(),
            technical_depth: "technical".to_string(),
            structure: "mixed".to_string(),
            call_to_action: "direct".to_string(),
        };
        let profile = map_answers_to_profile(&answers);
        assert_eq!(profile.vocabulary_complexity, 8.0);
        assert_eq!(profile.length_preference, 5.0);
        assert_eq!(profile.sample_count, 0);
        assert!(profile.common_phrases.is_empty());
        assert!(matches!(
            profile.calibration_source,
            crate::voice::CalibrationSource::QuickCalibration
        ));
    }

    #[test]
    fn test_map_answers_call_to_action_does_not_affect_profile() {
        // call_to_action is collected but intentionally not mapped to any profile field.
        // Changing it should produce identical profiles. Reserved for future use.
        use super::{map_answers_to_profile, QuickCalibrationAnswers};
        let base = |cta: &str| QuickCalibrationAnswers {
            tone: "professional".to_string(),
            length: "moderate".to_string(),
            technical_depth: "technical".to_string(),
            structure: "mixed".to_string(),
            call_to_action: cta.to_string(),
        };
        let direct = map_answers_to_profile(&base("direct"));
        let consultative = map_answers_to_profile(&base("consultative"));
        let question = map_answers_to_profile(&base("question"));

        assert_eq!(direct.tone_score, consultative.tone_score);
        assert_eq!(direct.tone_score, question.tone_score);
        assert_eq!(direct.avg_sentence_length, consultative.avg_sentence_length);
        assert_eq!(direct.technical_depth, question.technical_depth);
        assert_eq!(
            direct.structure_preference.bullets_pct,
            consultative.structure_preference.bullets_pct
        );
    }
}
