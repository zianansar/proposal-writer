---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 5
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 5.5b: Persist Voice Profile to Database

## Story

As a developer,
I want voice profile parameters saved to the database,
So that they persist across sessions and can be loaded for generation.

## Acceptance Criteria

**AC-1: Save Voice Profile After Calibration**

**Given** voice calibration completes successfully (Story 5-4)
**When** `VoiceProfile` is returned from the analysis
**Then** it is automatically saved to the `voice_profiles` table
**And** the table stores all profile fields:
- `user_id` (TEXT, default 'default' for single-user, future multi-user support)
- `tone_score` (REAL, 1-10 scale)
- `avg_sentence_length` (REAL, average words per sentence)
- `vocabulary_complexity` (REAL, Flesch-Kincaid grade level)
- `structure_paragraphs_pct` (INTEGER, 0-100)
- `structure_bullets_pct` (INTEGER, 0-100)
- `technical_depth` (REAL, 1-10 scale)
- `common_phrases` (TEXT, JSON array of strings)
- `sample_count` (INTEGER, number of proposals analyzed)
- `calibration_source` (TEXT, enum: 'GoldenSet', 'QuickCalibration', 'Implicit')
- `created_at` (TEXT, ISO timestamp)
- `updated_at` (TEXT, ISO timestamp)

**AC-2: Load Voice Profile on App Startup**

**Given** the app starts
**When** the voice learning feature is accessed
**Then** the existing voice profile is loaded from the database
**And** if no profile exists, `null` is returned (triggers empty state in Story 5-5)
**And** loading completes within 100ms (local SQLite query)

**AC-3: Update Profile on Recalibration**

**Given** a voice profile already exists
**When** the user recalibrates their voice (Story 5-4)
**Then** the existing profile is UPDATED (not inserted as duplicate)
**And** `updated_at` is set to current timestamp
**And** all fields are replaced with new values
**And** only one row per `user_id` exists (UPSERT behavior)

**AC-4: Tauri Commands Exposed**

**Given** the frontend needs to interact with voice profiles
**Then** the following Tauri commands are available:
- `get_voice_profile` → Returns `VoiceProfile | null`
- `save_voice_profile(profile: VoiceProfile)` → Saves/updates profile
- `delete_voice_profile` → Removes profile (for recalibration reset)

**AC-5: Data Integrity**

**Given** a voice profile is saved
**Then** all numeric fields are validated (1-10 ranges, 0-100 percentages)
**And** `common_phrases` is valid JSON array
**And** `calibration_source` is a valid enum value
**And** invalid data returns an error (not silently corrupted)

## Tasks/Subtasks

- [ ] Task 1: Create database migration (AC-1, AC-5)
  - [ ] Subtask 1.1: Create `V3__create_voice_profiles_table.sql` migration file
  - [ ] Subtask 1.2: Define table schema with all columns
  - [ ] Subtask 1.3: Add CHECK constraints for numeric ranges
  - [ ] Subtask 1.4: Add UNIQUE constraint on user_id (UPSERT support)
  - [ ] Subtask 1.5: Add index on user_id for fast lookups
  - [ ] Subtask 1.6: Add trigger for updated_at auto-update

- [ ] Task 2: Create Rust database operations (AC-1, AC-2, AC-3)
  - [ ] Subtask 2.1: Add VoiceProfileRow struct for database mapping
  - [ ] Subtask 2.2: Implement `save_voice_profile()` with UPSERT logic
  - [ ] Subtask 2.3: Implement `get_voice_profile()` query
  - [ ] Subtask 2.4: Implement `delete_voice_profile()` for reset
  - [ ] Subtask 2.5: Add JSON serialization for common_phrases
  - [ ] Subtask 2.6: Add validation for numeric ranges

- [ ] Task 3: Create Tauri commands (AC-4)
  - [ ] Subtask 3.1: Create `commands/voice_profile.rs` module
  - [ ] Subtask 3.2: Implement `get_voice_profile` command
  - [ ] Subtask 3.3: Implement `save_voice_profile` command
  - [ ] Subtask 3.4: Implement `delete_voice_profile` command
  - [ ] Subtask 3.5: Register commands in main.rs
  - [ ] Subtask 3.6: Add proper error handling and AppError mapping

- [ ] Task 4: Integrate with calibration flow (AC-1, AC-3)
  - [ ] Subtask 4.1: Modify Story 5-4's `calibrate_voice` to call save_voice_profile
  - [ ] Subtask 4.2: Ensure profile is saved after successful analysis
  - [ ] Subtask 4.3: Handle save errors gracefully (log but don't fail calibration)

- [ ] Task 5: Add tests (AC-1 through AC-5)
  - [ ] Subtask 5.1: Test migration applies correctly
  - [ ] Subtask 5.2: Test save_voice_profile creates new row
  - [ ] Subtask 5.3: Test save_voice_profile updates existing row (UPSERT)
  - [ ] Subtask 5.4: Test get_voice_profile returns correct data
  - [ ] Subtask 5.5: Test get_voice_profile returns null when no profile
  - [ ] Subtask 5.6: Test delete_voice_profile removes row
  - [ ] Subtask 5.7: Test validation rejects out-of-range values
  - [ ] Subtask 5.8: Test JSON serialization/deserialization of common_phrases

## Dev Notes

### Architecture Requirements

**AR-12: React Stack**
- Tauri commands exposed for frontend consumption
- TypeScript types match Rust structs

**NFR-3: Performance**
- Database queries complete in <100ms
- Single indexed lookup on user_id

**FR-16: Golden Set Calibration**
- Profile persists across sessions
- Recalibration updates existing profile

### Database Migration

```sql
-- V3__create_voice_profiles_table.sql

-- Voice profiles table for storing calibrated writing style parameters
-- Single row per user (UPSERT on recalibration)

CREATE TABLE voice_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default' UNIQUE,

    -- Numeric scores (1-10 scale)
    tone_score REAL NOT NULL CHECK (tone_score >= 1 AND tone_score <= 10),
    technical_depth REAL NOT NULL CHECK (technical_depth >= 1 AND technical_depth <= 10),

    -- Sentence analysis
    avg_sentence_length REAL NOT NULL CHECK (avg_sentence_length > 0),
    vocabulary_complexity REAL NOT NULL CHECK (vocabulary_complexity >= 0),

    -- Structure preference (percentages, must sum to 100)
    structure_paragraphs_pct INTEGER NOT NULL CHECK (structure_paragraphs_pct >= 0 AND structure_paragraphs_pct <= 100),
    structure_bullets_pct INTEGER NOT NULL CHECK (structure_bullets_pct >= 0 AND structure_bullets_pct <= 100),

    -- Common phrases (JSON array of strings)
    common_phrases TEXT NOT NULL DEFAULT '[]',

    -- Metadata
    sample_count INTEGER NOT NULL CHECK (sample_count >= 0),
    calibration_source TEXT NOT NULL CHECK (calibration_source IN ('GoldenSet', 'QuickCalibration', 'Implicit')),

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast user_id lookups
CREATE INDEX idx_voice_profiles_user_id ON voice_profiles(user_id);

-- Trigger to auto-update updated_at on changes
CREATE TRIGGER voice_profiles_updated_at
    AFTER UPDATE ON voice_profiles
    FOR EACH ROW
BEGIN
    UPDATE voice_profiles SET updated_at = datetime('now') WHERE id = NEW.id;
END;
```

### Rust Structs

```rust
// db/voice_profile.rs

use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Row};

/// Database row representation of VoiceProfile
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
    pub common_phrases: Vec<String>,  // Serialized as JSON
    pub sample_count: i32,
    pub calibration_source: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl VoiceProfileRow {
    /// Convert from Story 5-4's VoiceProfile struct
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
```

### Database Operations

```rust
// db/voice_profile.rs (continued)

impl Database {
    /// Save or update voice profile (UPSERT)
    pub fn save_voice_profile(&self, profile: &VoiceProfileRow) -> Result<(), AppError> {
        let phrases_json = serde_json::to_string(&profile.common_phrases)
            .map_err(|e| AppError::Database(format!("JSON serialization failed: {}", e)))?;

        self.conn.execute(
            "INSERT INTO voice_profiles (
                user_id, tone_score, avg_sentence_length, vocabulary_complexity,
                structure_paragraphs_pct, structure_bullets_pct, technical_depth,
                common_phrases, sample_count, calibration_source
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(user_id) DO UPDATE SET
                tone_score = excluded.tone_score,
                avg_sentence_length = excluded.avg_sentence_length,
                vocabulary_complexity = excluded.vocabulary_complexity,
                structure_paragraphs_pct = excluded.structure_paragraphs_pct,
                structure_bullets_pct = excluded.structure_bullets_pct,
                technical_depth = excluded.technical_depth,
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
                phrases_json,
                profile.sample_count,
                profile.calibration_source,
            ],
        )?;

        Ok(())
    }

    /// Get voice profile for user (returns None if not exists)
    pub fn get_voice_profile(&self, user_id: &str) -> Result<Option<VoiceProfileRow>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, user_id, tone_score, avg_sentence_length, vocabulary_complexity,
                    structure_paragraphs_pct, structure_bullets_pct, technical_depth,
                    common_phrases, sample_count, calibration_source, created_at, updated_at
             FROM voice_profiles
             WHERE user_id = ?1"
        )?;

        let result = stmt.query_row(params![user_id], |row| {
            let phrases_json: String = row.get(8)?;
            let common_phrases: Vec<String> = serde_json::from_str(&phrases_json)
                .unwrap_or_default();

            Ok(VoiceProfileRow {
                id: Some(row.get(0)?),
                user_id: row.get(1)?,
                tone_score: row.get(2)?,
                avg_sentence_length: row.get(3)?,
                vocabulary_complexity: row.get(4)?,
                structure_paragraphs_pct: row.get(5)?,
                structure_bullets_pct: row.get(6)?,
                technical_depth: row.get(7)?,
                common_phrases,
                sample_count: row.get(9)?,
                calibration_source: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        });

        match result {
            Ok(profile) => Ok(Some(profile)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    /// Delete voice profile (for reset/recalibration)
    pub fn delete_voice_profile(&self, user_id: &str) -> Result<bool, AppError> {
        let rows_affected = self.conn.execute(
            "DELETE FROM voice_profiles WHERE user_id = ?1",
            params![user_id],
        )?;

        Ok(rows_affected > 0)
    }
}
```

### Tauri Commands

```rust
// commands/voice_profile.rs

use tauri::command;
use crate::db::VoiceProfileRow;
use crate::voice::VoiceProfile;
use crate::error::AppError;
use crate::state::AppState;

/// Get voice profile from database
/// Returns null if no profile exists (triggers empty state in UI)
#[command]
pub async fn get_voice_profile(
    state: tauri::State<'_, AppState>,
) -> Result<Option<VoiceProfile>, AppError> {
    let db = state.db.lock().await;

    match db.get_voice_profile("default")? {
        Some(row) => Ok(Some(row.to_voice_profile())),
        None => Ok(None),
    }
}

/// Save voice profile to database (UPSERT)
#[command]
pub async fn save_voice_profile(
    profile: VoiceProfile,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db = state.db.lock().await;
    let row = VoiceProfileRow::from_voice_profile(&profile, "default");
    db.save_voice_profile(&row)?;
    Ok(())
}

/// Delete voice profile (reset for recalibration)
#[command]
pub async fn delete_voice_profile(
    state: tauri::State<'_, AppState>,
) -> Result<bool, AppError> {
    let db = state.db.lock().await;
    db.delete_voice_profile("default")
}
```

### Integration with Story 5-4

Modify the `calibrate_voice` command to save the profile after analysis:

```rust
// In commands/voice.rs (Story 5-4), add after analysis completes:

#[command]
pub async fn calibrate_voice(
    window: Window,
    state: State<'_, AppState>
) -> Result<CalibrationResult, AppError> {
    // ... existing analysis code ...

    let profile = aggregate_voice_profile(&analyzed_texts);

    // NEW: Persist to database (Story 5-5b)
    let db = state.db.lock().await;
    let row = VoiceProfileRow::from_voice_profile(&profile, "default");
    if let Err(e) = db.save_voice_profile(&row) {
        // Log error but don't fail calibration
        log::error!("Failed to persist voice profile: {}", e);
    }

    let elapsed = start.elapsed();

    Ok(CalibrationResult {
        profile,
        elapsed_ms: elapsed.as_millis() as u64,
        proposals_analyzed: total,
    })
}
```

### TypeScript Types

```typescript
// src/features/voice-learning/types.ts
// (Same as Story 5-5, ensure consistency)

export interface VoiceProfile {
  tone_score: number;              // 1-10: formal to casual
  avg_sentence_length: number;     // Average words per sentence
  vocabulary_complexity: number;   // Flesch-Kincaid grade level
  structure_preference: {
    paragraphs_pct: number;        // 0-100
    bullets_pct: number;           // 0-100
  };
  technical_depth: number;         // 1-10: layman to expert
  common_phrases: string[];        // Top 5 repeated phrases
  sample_count: number;            // Number of proposals analyzed
  calibration_source: 'GoldenSet' | 'QuickCalibration' | 'Implicit';
  created_at?: string;             // ISO timestamp
  updated_at?: string;             // ISO timestamp
}
```

### File Structure

```
upwork-researcher/
  src-tauri/
    src/
      db/
        migrations/
          V3__create_voice_profiles_table.sql  # NEW: Migration
        voice_profile.rs                        # NEW: DB operations
        mod.rs                                  # Add voice_profile module
      commands/
        voice_profile.rs                        # NEW: Tauri commands
        mod.rs                                  # Add voice_profile module
      lib.rs                                    # Register commands
```

### Testing Requirements

**Unit Tests (Rust):**

1. **Migration Tests:**
   - Test table creates successfully
   - Test CHECK constraints reject invalid values
   - Test UNIQUE constraint on user_id

2. **Database Operation Tests:**
   - Test save_voice_profile inserts new row
   - Test save_voice_profile updates existing row (UPSERT)
   - Test get_voice_profile returns correct data
   - Test get_voice_profile returns None when no profile
   - Test delete_voice_profile removes row
   - Test delete_voice_profile returns false when no row

3. **Validation Tests:**
   - Test tone_score outside 1-10 fails
   - Test technical_depth outside 1-10 fails
   - Test percentages outside 0-100 fail
   - Test invalid calibration_source fails
   - Test malformed JSON in common_phrases fails

4. **Serialization Tests:**
   - Test common_phrases round-trips correctly
   - Test empty common_phrases array works
   - Test phrases with special characters work

**Integration Tests:**

1. **Full Flow Test:**
   - Call calibrate_voice (Story 5-4)
   - Verify profile saved to database
   - Call get_voice_profile
   - Verify returned data matches

2. **Recalibration Test:**
   - Save initial profile
   - Save updated profile (same user_id)
   - Verify only one row exists
   - Verify updated_at changed

### Scope Boundaries

**In Scope for Story 5-5b:**
- Database migration for voice_profiles table
- Rust structs for database row mapping
- CRUD operations (save/get/delete)
- Tauri commands for frontend access
- Integration with calibration flow (Story 5-4)
- Validation and error handling

**Out of Scope (Other Stories):**
- Voice calibration analysis (Story 5-4)
- Voice profile display UI (Story 5-5)
- Using voice profile in generation (Story 5-8)
- Multi-user support (future)

### Dependencies

**Depends On:**
- **Story 5-4: Local-Only Voice Analysis** (provides VoiceProfile struct)
- Database migration framework (Story 1-11)

**Depended On By:**
- **Story 5-5: Voice Profile Display** (reads profile via get_voice_profile)
- **Story 5-8: Voice-Informed Proposal Generation** (uses profile in generation)

### References

- [Source: epics-stories.md#Story 5.5b (implicit from Round 5 analysis)]
- [Source: architecture.md#Voice Learning Data Architecture]
- [Story 5-4: Local-Only Voice Analysis — produces VoiceProfile]
- [Story 5-5: Voice Profile Display — consumes stored profile]
