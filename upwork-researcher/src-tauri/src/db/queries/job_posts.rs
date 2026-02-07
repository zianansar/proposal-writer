use rusqlite::{params, Connection, Result};

/// Insert a new job post into the database
/// Returns the ID of the newly inserted job post
pub fn insert_job_post(
    conn: &Connection,
    url: Option<&str>,
    raw_content: &str,
    client_name: Option<&str>,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO job_posts (url, raw_content, client_name) VALUES (?1, ?2, ?3)",
        params![url, raw_content, client_name],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Update the client_name field for an existing job post
/// Story 4a.2: AC-3 - Save extracted client name to database
pub fn update_job_post_client_name(
    conn: &Connection,
    id: i64,
    client_name: Option<&str>,
) -> Result<()> {
    conn.execute(
        "UPDATE job_posts SET client_name = ?1 WHERE id = ?2",
        params![client_name, id],
    )?;
    Ok(())
}

// ==========================================
// Job Skills Functions (Story 4a.3)
// ==========================================

/// Insert skills for a job post (batch insert)
/// Story 4a.3: AC-3 - Save extracted skills to job_skills table
///
/// # Arguments
/// * `conn` - Database connection
/// * `job_post_id` - ID of the job post
/// * `skills` - Slice of skill names to insert
///
/// # Behavior
/// - Inserts each skill as a separate row linked to job_post_id
/// - Empty skills slice is valid (no-op)
/// - Duplicate skills for same job_post are allowed (LLM may return similar terms)
pub fn insert_job_skills(
    conn: &Connection,
    job_post_id: i64,
    skills: &[String],
) -> Result<()> {
    // Task 2.2: Batch insert - loop over skills vec, insert each row
    for skill in skills {
        conn.execute(
            "INSERT INTO job_skills (job_post_id, skill_name) VALUES (?1, ?2)",
            params![job_post_id, skill],
        )?;
    }
    Ok(())
}

/// Retrieve all skills for a given job post
/// Story 4a.3: Returns Vec of skill names for display
///
/// # Returns
/// - Vec of skill names (e.g., ["React", "TypeScript"])
/// - Empty vec if no skills found
pub fn get_job_skills(conn: &Connection, job_post_id: i64) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT skill_name FROM job_skills WHERE job_post_id = ?1 ORDER BY id"
    )?;

    let skills = stmt
        .query_map(params![job_post_id], |row| row.get(0))?
        .collect::<Result<Vec<String>>>()?;

    Ok(skills)
}

/// Delete all skills for a job post (used before re-analysis)
/// Story 4a.3: AC-3 - Clear old skills before inserting fresh extraction
///
/// # Use Case
/// User clicks "Analyze" again → delete existing skills, insert new ones
pub fn delete_job_skills(conn: &Connection, job_post_id: i64) -> Result<()> {
    conn.execute(
        "DELETE FROM job_skills WHERE job_post_id = ?1",
        params![job_post_id],
    )?;
    Ok(())
}

// ==========================================
// Hidden Needs Functions (Story 4a.4)
// ==========================================

/// Update the hidden_needs field for an existing job post
/// Story 4a.4: AC-3 - Save extracted hidden needs to database as JSON
///
/// # Arguments
/// * `conn` - Database connection
/// * `id` - Job post ID
/// * `hidden_needs_json` - Serialized JSON string of hidden needs array
///
/// # JSON Format
/// `[{"need": "...", "evidence": "..."}, ...]`
pub fn update_job_post_hidden_needs(
    conn: &Connection,
    id: i64,
    hidden_needs_json: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE job_posts SET hidden_needs = ?1 WHERE id = ?2",
        params![hidden_needs_json, id],
    )?;
    Ok(())
}

/// Retrieve hidden needs for a given job post
/// Story 4a.4: Returns Vec of HiddenNeed structs for display
///
/// # Returns
/// - Vec of HiddenNeed (e.g., [HiddenNeed { need, evidence }])
/// - Empty vec if no hidden needs found or JSON parse fails
pub fn get_job_post_hidden_needs(
    conn: &Connection,
    job_post_id: i64,
) -> Result<Vec<crate::analysis::HiddenNeed>> {
    let json_str: Option<String> = conn.query_row(
        "SELECT hidden_needs FROM job_posts WHERE id = ?1",
        params![job_post_id],
        |row| row.get(0),
    )?;

    match json_str {
        Some(json) => {
            // Deserialize JSON string to Vec<HiddenNeed>
            serde_json::from_str(&json).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })
        }
        None => Ok(vec![]), // NULL column -> no analysis run yet
    }
}

// ==========================================
// Atomic Save Function (Story 4a.8)
// ==========================================

/// Save all job analysis data atomically in a single transaction
/// Story 4a.8: AC-1, AC-2, AC-3, AC-6
///
/// # Arguments
/// * `conn` - Database connection
/// * `job_post_id` - ID of the job post
/// * `client_name` - Extracted client name (or None)
/// * `key_skills` - Slice of skill names
/// * `hidden_needs_json` - Serialized JSON string of hidden needs array
///
/// # Behavior
/// - Wraps all operations in BEGIN EXCLUSIVE TRANSACTION / COMMIT
/// - Updates client_name, deletes old skills, inserts new skills, updates hidden_needs
/// - On any error: executes ROLLBACK, returns error (all-or-nothing)
/// - Re-analysis safe: replaces existing skills (delete + insert)
///
/// # Performance
/// - Target: <100ms combined (NFR-4)
/// - Uses prepared statement for batch skill insert
///
/// # References
/// - Pattern: migration/mod.rs → copy_data_atomic()
/// - AC-2: All-or-nothing transaction semantics
/// - AC-6: Re-analysis replaces existing data (no duplicates)
pub fn save_job_analysis_atomic(
    conn: &Connection,
    job_post_id: i64,
    client_name: Option<&str>,
    key_skills: &[String],
    hidden_needs_json: &str,
) -> Result<()> {
    // BEGIN EXCLUSIVE TRANSACTION (prevents other writes)
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])?;

    // Attempt all operations - rollback on any failure
    let result = (|| {
        // 1. Update client_name
        conn.execute(
            "UPDATE job_posts SET client_name = ?1 WHERE id = ?2",
            params![client_name, job_post_id],
        )?;

        // 2. Delete old skills (re-analysis safe)
        conn.execute(
            "DELETE FROM job_skills WHERE job_post_id = ?1",
            params![job_post_id],
        )?;

        // 3. Insert new skills (use prepared statement for batch insert)
        let mut stmt = conn.prepare(
            "INSERT INTO job_skills (job_post_id, skill_name) VALUES (?1, ?2)"
        )?;
        for skill in key_skills {
            stmt.execute(params![job_post_id, skill])?;
        }

        // 4. Update hidden_needs JSON
        conn.execute(
            "UPDATE job_posts SET hidden_needs = ?1 WHERE id = ?2",
            params![hidden_needs_json, job_post_id],
        )?;

        Ok::<(), rusqlite::Error>(())
    })();

    // Handle transaction commit/rollback
    match result {
        Ok(()) => {
            conn.execute("COMMIT", [])?;
            Ok(())
        }
        Err(e) => {
            // Rollback on any error (ignore rollback errors)
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    #[test]
    fn test_insert_job_post_with_url() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let id = insert_job_post(
            &conn,
            Some("https://upwork.com/job/123"),
            "Sample job content for web development project",
            None,
        )
        .unwrap();

        assert!(id > 0);

        // Verify the job was saved
        let saved_content: String = conn
            .query_row(
                "SELECT raw_content FROM job_posts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(saved_content, "Sample job content for web development project");
    }

    #[test]
    fn test_insert_job_post_without_url() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let id = insert_job_post(
            &conn,
            None, // No URL - user pasted text directly
            "Job content without URL",
            None,
        )
        .unwrap();

        assert!(id > 0);

        // Verify url is NULL
        let url: Option<String> = conn
            .query_row(
                "SELECT url FROM job_posts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert!(url.is_none());
    }

    #[test]
    fn test_insert_job_post_with_client_name() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let id = insert_job_post(
            &conn,
            Some("https://upwork.com/job/456"),
            "Project for TechCorp Inc",
            Some("TechCorp Inc"),
        )
        .unwrap();

        assert!(id > 0);

        // Verify client_name was saved
        let client: Option<String> = conn
            .query_row(
                "SELECT client_name FROM job_posts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(client, Some("TechCorp Inc".to_string()));
    }

    #[test]
    fn test_update_job_post_client_name() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Insert job post without client name
        let id = insert_job_post(
            &conn,
            Some("https://upwork.com/job/789"),
            "Looking for a developer",
            None,
        )
        .unwrap();

        // Update with client name
        update_job_post_client_name(&conn, id, Some("John Smith")).unwrap();

        // Verify client_name was updated
        let client: Option<String> = conn
            .query_row(
                "SELECT client_name FROM job_posts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(client, Some("John Smith".to_string()));
    }

    #[test]
    fn test_update_job_post_client_name_to_null() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Insert job post with client name
        let id = insert_job_post(
            &conn,
            Some("https://upwork.com/job/999"),
            "Project content",
            Some("Initial Name"),
        )
        .unwrap();

        // Update to null (e.g., re-analysis found no name)
        update_job_post_client_name(&conn, id, None).unwrap();

        // Verify client_name is now null
        let client: Option<String> = conn
            .query_row(
                "SELECT client_name FROM job_posts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert!(client.is_none());
    }

    // ====================
    // Story 4a.3 Tests: Job Skills Functions
    // ====================

    #[test]
    fn test_insert_job_skills_multiple_skills() {
        // Task 2.2: Test batch insert of multiple skills
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Create a job post
        let job_id = insert_job_post(&conn, None, "React developer needed", None).unwrap();

        // Insert skills
        let skills = vec![
            "React".to_string(),
            "TypeScript".to_string(),
            "API Integration".to_string(),
            "Testing".to_string(),
        ];
        insert_job_skills(&conn, job_id, &skills).unwrap();

        // Verify skills were inserted
        let saved_skills = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(saved_skills.len(), 4);
        assert_eq!(saved_skills, skills);
    }

    #[test]
    fn test_insert_job_skills_empty_skills() {
        // Task 2.2: Test empty skills array (valid case - no skills detected)
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Vague job post", None).unwrap();

        // Insert empty skills (no-op)
        let skills: Vec<String> = vec![];
        let result = insert_job_skills(&conn, job_id, &skills);
        assert!(result.is_ok());

        // Verify no skills saved
        let saved_skills = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(saved_skills.len(), 0);
    }

    #[test]
    fn test_get_job_skills_returns_correct_skills() {
        // Task 2.3: Test get_job_skills retrieval
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Python developer", None).unwrap();

        let skills = vec!["Python".to_string(), "Django".to_string(), "PostgreSQL".to_string()];
        insert_job_skills(&conn, job_id, &skills).unwrap();

        // Retrieve skills
        let retrieved_skills = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(retrieved_skills, skills);
    }

    #[test]
    fn test_get_job_skills_empty_for_no_skills() {
        // Task 2.3: Test get_job_skills returns empty vec when no skills exist
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job with no skills", None).unwrap();

        // Don't insert any skills
        let skills = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(skills.len(), 0);
    }

    #[test]
    fn test_delete_job_skills_removes_all_skills() {
        // Task 2.4: Test delete_job_skills removes all skills for a job
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Node.js developer", None).unwrap();

        // Insert skills
        let skills = vec!["Node.js".to_string(), "Express".to_string()];
        insert_job_skills(&conn, job_id, &skills).unwrap();

        // Verify skills exist
        assert_eq!(get_job_skills(&conn, job_id).unwrap().len(), 2);

        // Delete skills
        delete_job_skills(&conn, job_id).unwrap();

        // Verify skills deleted
        assert_eq!(get_job_skills(&conn, job_id).unwrap().len(), 0);
    }

    #[test]
    fn test_delete_job_skills_only_affects_target_job() {
        // Task 2.4: Verify delete_job_skills doesn't affect other jobs
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Create two jobs with skills
        let job1_id = insert_job_post(&conn, None, "Job 1", None).unwrap();
        let job2_id = insert_job_post(&conn, None, "Job 2", None).unwrap();

        insert_job_skills(&conn, job1_id, &vec!["React".to_string()]).unwrap();
        insert_job_skills(&conn, job2_id, &vec!["Vue".to_string()]).unwrap();

        // Delete job1 skills
        delete_job_skills(&conn, job1_id).unwrap();

        // Verify job1 skills deleted, job2 skills intact
        assert_eq!(get_job_skills(&conn, job1_id).unwrap().len(), 0);
        assert_eq!(get_job_skills(&conn, job2_id).unwrap().len(), 1);
    }

    #[test]
    fn test_job_skills_foreign_key_constraint_on_insert() {
        // Verify foreign key constraint prevents invalid job_post_id
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Try to insert skills for non-existent job_post_id
        let skills = vec!["React".to_string()];
        let result = insert_job_skills(&conn, 999999, &skills);

        // Should fail due to foreign key constraint
        assert!(result.is_err());
    }

    // ====================
    // Story 4a.4 Tests: Hidden Needs Functions
    // ====================

    #[test]
    fn test_update_job_post_hidden_needs() {
        // Task 6.3: Test update_job_post_hidden_needs stores JSON string
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Insert job post
        let job_id = insert_job_post(&conn, None, "Urgent project", None).unwrap();

        // Update with hidden needs JSON
        let hidden_needs_json = r#"[{"need":"Time-pressured","evidence":"Mentions 'urgent'"}]"#;
        update_job_post_hidden_needs(&conn, job_id, hidden_needs_json).unwrap();

        // Verify stored
        let saved: Option<String> = conn
            .query_row(
                "SELECT hidden_needs FROM job_posts WHERE id = ?1",
                params![job_id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(saved, Some(hidden_needs_json.to_string()));
    }

    #[test]
    fn test_get_job_post_hidden_needs_returns_deserialized_vec() {
        // Task 6.4: Test get_job_post_hidden_needs deserializes correctly
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job content", None).unwrap();

        // Store hidden needs
        let hidden_needs_json = r#"[
            {"need":"Time-pressured","evidence":"Urgent deadline"},
            {"need":"Budget-conscious","evidence":"Cost-effective"}
        ]"#;
        update_job_post_hidden_needs(&conn, job_id, hidden_needs_json).unwrap();

        // Retrieve and verify
        let needs = get_job_post_hidden_needs(&conn, job_id).unwrap();
        assert_eq!(needs.len(), 2);
        assert_eq!(needs[0].need, "Time-pressured");
        assert_eq!(needs[0].evidence, "Urgent deadline");
        assert_eq!(needs[1].need, "Budget-conscious");
    }

    #[test]
    fn test_get_job_post_hidden_needs_null_returns_empty_vec() {
        // Task 6.4: Test NULL column returns empty vec
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job without analysis", None).unwrap();

        // Don't set hidden_needs - should be NULL
        let needs = get_job_post_hidden_needs(&conn, job_id).unwrap();
        assert_eq!(needs.len(), 0);
    }

    #[test]
    fn test_get_job_post_hidden_needs_empty_array() {
        // Task 6.4: Test empty JSON array returns empty vec
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Generic job", None).unwrap();

        // Store empty array (no hidden needs detected)
        update_job_post_hidden_needs(&conn, job_id, "[]").unwrap();

        let needs = get_job_post_hidden_needs(&conn, job_id).unwrap();
        assert_eq!(needs.len(), 0);
    }

    // ====================
    // Story 4a.8 Tests: Atomic Save Function
    // ====================

    #[test]
    fn test_save_job_analysis_atomic_saves_all_data() {
        // Task 5.1: Test atomic save saves all three data types
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Create job post
        let job_id = insert_job_post(&conn, None, "Test job", None).unwrap();

        // Save analysis data atomically
        let skills = vec!["React".to_string(), "TypeScript".to_string()];
        let hidden_needs_json = r#"[{"need":"Time-pressured","evidence":"Urgent"}]"#;

        save_job_analysis_atomic(
            &conn,
            job_id,
            Some("John Doe"),
            &skills,
            hidden_needs_json,
        ).unwrap();

        // Verify all data saved
        let saved_name: Option<String> = conn.query_row(
            "SELECT client_name FROM job_posts WHERE id = ?1",
            params![job_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(saved_name, Some("John Doe".to_string()));

        let saved_skills = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(saved_skills, skills);

        let saved_needs_json: String = conn.query_row(
            "SELECT hidden_needs FROM job_posts WHERE id = ?1",
            params![job_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(saved_needs_json, hidden_needs_json);
    }

    #[test]
    fn test_save_job_analysis_atomic_client_name_updated() {
        // Task 5.2: Test client_name updated correctly
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job", Some("Old Name")).unwrap();

        save_job_analysis_atomic(&conn, job_id, Some("New Name"), &[], "[]").unwrap();

        let client: Option<String> = conn.query_row(
            "SELECT client_name FROM job_posts WHERE id = ?1",
            params![job_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(client, Some("New Name".to_string()));
    }

    #[test]
    fn test_save_job_analysis_atomic_skills_inserted() {
        // Task 5.3: Test skills inserted correctly
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job", None).unwrap();
        let skills = vec!["Python".to_string(), "Django".to_string(), "PostgreSQL".to_string()];

        save_job_analysis_atomic(&conn, job_id, None, &skills, "[]").unwrap();

        let saved_skills = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(saved_skills, skills);
    }

    #[test]
    fn test_save_job_analysis_atomic_hidden_needs_stored() {
        // Task 5.4: Test hidden_needs JSON stored correctly
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job", None).unwrap();
        let needs_json = r#"[{"need":"Budget-conscious","evidence":"Cost-effective"}]"#;

        save_job_analysis_atomic(&conn, job_id, None, &[], needs_json).unwrap();

        let saved: String = conn.query_row(
            "SELECT hidden_needs FROM job_posts WHERE id = ?1",
            params![job_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(saved, needs_json);
    }

    #[test]
    fn test_save_job_analysis_atomic_replaces_old_skills() {
        // Task 5.5: Test re-analysis replaces old skills
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job", None).unwrap();

        // First analysis
        let old_skills = vec!["React".to_string(), "Vue".to_string()];
        save_job_analysis_atomic(&conn, job_id, None, &old_skills, "[]").unwrap();
        assert_eq!(get_job_skills(&conn, job_id).unwrap(), old_skills);

        // Re-analysis with different skills
        let new_skills = vec!["Angular".to_string()];
        save_job_analysis_atomic(&conn, job_id, None, &new_skills, "[]").unwrap();

        // Verify old skills replaced, not duplicated
        let saved = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(saved, new_skills);
        assert_eq!(saved.len(), 1);
    }

    #[test]
    fn test_save_job_analysis_atomic_rollback_on_failure() {
        // Task 5.6: Test transaction rollback on error
        // H1 Code Review Fix: Use FK constraint violation to trigger actual rollback
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job", Some("Original")).unwrap();

        // Insert initial skills to verify they remain after failed re-analysis
        let initial_skills = vec!["InitialSkill".to_string()];
        insert_job_skills(&conn, job_id, &initial_skills).unwrap();
        assert_eq!(get_job_skills(&conn, job_id).unwrap().len(), 1);

        // Attempt save with non-existent job_id AND skills to trigger FK constraint error
        // The skills INSERT will fail due to foreign key constraint on job_post_id
        let bad_skills = vec!["React".to_string(), "TypeScript".to_string()];
        let result = save_job_analysis_atomic(&conn, 999999, Some("New"), &bad_skills, "[]");

        // Should fail due to FK constraint on job_skills INSERT
        assert!(result.is_err(), "Expected FK constraint error but got success");

        // Verify original job unchanged (rollback worked)
        let client: Option<String> = conn.query_row(
            "SELECT client_name FROM job_posts WHERE id = ?1",
            params![job_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(client, Some("Original".to_string()));

        // Verify original skills still exist (rollback preserved them)
        let skills = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(skills, initial_skills, "Original skills should be preserved after rollback");
    }

    #[test]
    fn test_save_job_analysis_atomic_timing() {
        // Task 5.7: Test save completes in <100ms
        use std::time::Instant;

        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job", None).unwrap();
        let skills = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        let needs_json = r#"[{"need":"Test","evidence":"Evidence"}]"#;

        let start = Instant::now();
        save_job_analysis_atomic(&conn, job_id, Some("Name"), &skills, needs_json).unwrap();
        let duration = start.elapsed();

        assert!(duration.as_millis() < 100, "Save took {:?} (target: <100ms)", duration);
    }

    #[test]
    fn test_save_job_analysis_atomic_empty_skills() {
        // Task 5.8: Test empty skills array saves successfully
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job", None).unwrap();

        save_job_analysis_atomic(&conn, job_id, Some("Name"), &[], "[]").unwrap();

        let skills = get_job_skills(&conn, job_id).unwrap();
        assert_eq!(skills.len(), 0);
    }

    #[test]
    fn test_save_job_analysis_atomic_null_client_name() {
        // Task 5.9: Test null client_name saves successfully
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_id = insert_job_post(&conn, None, "Job", Some("Original")).unwrap();

        save_job_analysis_atomic(&conn, job_id, None, &[], "[]").unwrap();

        let client: Option<String> = conn.query_row(
            "SELECT client_name FROM job_posts WHERE id = ?1",
            params![job_id],
            |row| row.get(0),
        ).unwrap();
        assert!(client.is_none());
    }
}
