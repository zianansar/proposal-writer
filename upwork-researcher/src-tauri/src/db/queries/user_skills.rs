//! User Skills CRUD operations for Story 4b.1
//! Supports job matching (FR-4, Story 4b.2)

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

/// User skill for job matching
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserSkill {
    pub id: i64,
    pub skill: String,
    pub added_at: String,
    pub is_primary: bool,
}

/// Maximum skill name length (M-1: prevent database bloat)
const MAX_SKILL_LENGTH: usize = 100;

/// Add a new skill to user's profile
/// Returns skill ID on success, error if duplicate (case-insensitive) or too long
pub fn add_user_skill(conn: &Connection, skill: &str) -> Result<i64, rusqlite::Error> {
    // M-1: Validate skill length to prevent database bloat
    let trimmed = skill.trim();
    if trimmed.is_empty() {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
            Some("Skill name cannot be empty".to_string()),
        ));
    }
    if trimmed.len() > MAX_SKILL_LENGTH {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
            Some(format!("Skill name exceeds {} characters", MAX_SKILL_LENGTH)),
        ));
    }

    // Check for case-insensitive duplicate (Subtask 2.2)
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM user_skills WHERE LOWER(skill) = LOWER(?)",
        params![skill],
        |row| row.get(0),
    )?;

    if exists > 0 {
        // Subtask 2.3: Return error if duplicate
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
            Some("Skill already exists (case-insensitive)".to_string()),
        ));
    }

    // Subtask 2.1: Insert new skill
    conn.execute(
        "INSERT INTO user_skills (skill) VALUES (?)",
        params![skill],
    )?;

    // Subtask 2.3: Return skill ID on success
    Ok(conn.last_insert_rowid())
}

/// Remove a skill from user's profile
pub fn remove_user_skill(conn: &Connection, skill_id: i64) -> Result<(), rusqlite::Error> {
    // Subtask 2.5: DELETE FROM user_skills WHERE id = ?
    let rows_affected = conn.execute("DELETE FROM user_skills WHERE id = ?", params![skill_id])?;

    if rows_affected == 0 {
        // Subtask 2.4: Return error if skill doesn't exist
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    Ok(())
}

/// Get all user skills ordered by added_at DESC (newest first)
pub fn get_user_skills(conn: &Connection) -> Result<Vec<UserSkill>, rusqlite::Error> {
    // Subtask 2.7: Return all skills ordered by added_at DESC
    let mut stmt = conn.prepare(
        "SELECT id, skill, added_at, is_primary FROM user_skills ORDER BY added_at DESC",
    )?;

    // Subtask 2.8: Map to UserSkill struct
    let skills = stmt
        .query_map([], |row| {
            Ok(UserSkill {
                id: row.get(0)?,
                skill: row.get(1)?,
                added_at: row.get(2)?,
                is_primary: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(skills)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        // Create user_skills table (matches V11 migration)
        conn.execute_batch(
            r#"
            CREATE TABLE user_skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skill TEXT NOT NULL,
                added_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_primary BOOLEAN DEFAULT 0,
                UNIQUE(skill COLLATE NOCASE)
            );
            CREATE INDEX idx_user_skills_skill ON user_skills(skill COLLATE NOCASE);
            CREATE INDEX idx_user_skills_added_at ON user_skills(added_at DESC);
            "#,
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_add_user_skill_valid() {
        // Task 7, Subtask 7.1: Test add_user_skill with valid skill → returns skill ID
        let conn = setup_test_db();

        let skill_id = add_user_skill(&conn, "JavaScript").unwrap();
        assert!(skill_id > 0, "Should return positive skill ID");

        // Verify skill was inserted
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM user_skills WHERE skill = ?",
                params!["JavaScript"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "Skill should be inserted once");
    }

    #[test]
    fn test_add_user_skill_duplicate_case_insensitive() {
        // Task 7, Subtask 7.2: Test add_user_skill with duplicate skill (case-insensitive) → returns error
        let conn = setup_test_db();

        add_user_skill(&conn, "JavaScript").unwrap();

        // Try to add duplicate with different case
        let result = add_user_skill(&conn, "javascript");
        assert!(result.is_err(), "Should reject duplicate (case-insensitive)");

        // Try exact duplicate
        let result2 = add_user_skill(&conn, "JavaScript");
        assert!(result2.is_err(), "Should reject exact duplicate");
    }

    #[test]
    fn test_remove_user_skill_valid() {
        // Task 7, Subtask 7.3: Test remove_user_skill with valid ID → deletes skill
        let conn = setup_test_db();

        let skill_id = add_user_skill(&conn, "React").unwrap();

        remove_user_skill(&conn, skill_id).unwrap();

        // Verify skill was deleted
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM user_skills WHERE id = ?",
                params![skill_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "Skill should be deleted");
    }

    #[test]
    fn test_remove_user_skill_non_existent() {
        // Task 7, Subtask 7.4: Test remove_user_skill with non-existent ID → returns error
        let conn = setup_test_db();

        let result = remove_user_skill(&conn, 99999);
        assert!(result.is_err(), "Should return error for non-existent skill");
    }

    #[test]
    fn test_get_user_skills_ordered_by_added_at() {
        // Task 7, Subtask 7.5: Test get_user_skills returns skills ordered by added_at DESC
        let conn = setup_test_db();

        // Insert skills with explicit timestamps to ensure ordering
        conn.execute(
            "INSERT INTO user_skills (skill, added_at) VALUES (?, ?)",
            params!["JavaScript", "2024-01-01 10:00:00"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO user_skills (skill, added_at) VALUES (?, ?)",
            params!["Python", "2024-01-01 10:00:01"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO user_skills (skill, added_at) VALUES (?, ?)",
            params!["React", "2024-01-01 10:00:02"],
        )
        .unwrap();

        let skills = get_user_skills(&conn).unwrap();

        assert_eq!(skills.len(), 3, "Should return 3 skills");
        assert_eq!(skills[0].skill, "React", "Newest skill should be first");
        assert_eq!(skills[1].skill, "Python", "Second newest should be second");
        assert_eq!(skills[2].skill, "JavaScript", "Oldest skill should be last");
    }

    #[test]
    fn test_get_user_skills_empty() {
        // Test get_user_skills with empty table
        let conn = setup_test_db();

        let skills = get_user_skills(&conn).unwrap();
        assert_eq!(skills.len(), 0, "Should return empty array for no skills");
    }

    #[test]
    fn test_add_user_skill_empty_string() {
        // M-1: Test add_user_skill rejects empty strings
        let conn = setup_test_db();

        let result = add_user_skill(&conn, "");
        assert!(result.is_err(), "Should reject empty skill name");

        let result2 = add_user_skill(&conn, "   ");
        assert!(result2.is_err(), "Should reject whitespace-only skill name");
    }

    #[test]
    fn test_add_user_skill_too_long() {
        // M-1: Test add_user_skill rejects skills over 100 characters
        let conn = setup_test_db();

        let long_skill = "a".repeat(101);
        let result = add_user_skill(&conn, &long_skill);
        assert!(result.is_err(), "Should reject skill name over 100 characters");

        // 100 chars should be allowed
        let max_skill = "b".repeat(100);
        let result2 = add_user_skill(&conn, &max_skill);
        assert!(result2.is_ok(), "Should allow skill name of exactly 100 characters");
    }
}
