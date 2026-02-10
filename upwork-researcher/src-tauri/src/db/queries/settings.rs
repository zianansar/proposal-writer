//! Settings database queries.
//!
//! Provides CRUD operations for the settings table (key-value store).

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// A setting with its value and metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

/// Get a setting by key.
/// Returns None if the setting doesn't exist.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;

    let mut rows = stmt.query(params![key])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

/// Set a setting value (insert or update).
/// Uses UPSERT pattern for atomic operation.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )?;
    Ok(())
}

/// Delete a setting by key.
/// Returns true if a setting was deleted, false if it didn't exist.
pub fn delete_setting(conn: &Connection, key: &str) -> Result<bool, rusqlite::Error> {
    let rows_affected = conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
    Ok(rows_affected > 0)
}

/// List all settings.
pub fn list_settings(conn: &Connection) -> Result<Vec<Setting>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT key, value, updated_at FROM settings ORDER BY key")?;

    let settings = stmt
        .query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(settings)
}

/// Story 8.6: Get proposals edited count for voice learning progress.
/// Returns 0 if key doesn't exist (code-level default).
pub fn get_proposals_edited_count(conn: &Connection) -> Result<i32, rusqlite::Error> {
    match get_setting(conn, "proposals_edited_count")? {
        Some(value) => value
            .parse::<i32>()
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))),
        None => Ok(0), // Default to 0 if key doesn't exist
    }
}

/// Story 8.6: Increment proposals edited count by 1.
/// Returns the new count after incrementing.
pub fn increment_proposals_edited(conn: &Connection) -> Result<i32, rusqlite::Error> {
    let current = get_proposals_edited_count(conn)?;
    let new_count = current + 1;
    set_setting(conn, "proposals_edited_count", &new_count.to_string())?;
    Ok(new_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    fn create_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        Database::new(db_path, None).unwrap()
    }

    #[test]
    fn test_default_settings_seeded() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Check theme default
        let theme = get_setting(&conn, "theme").unwrap();
        assert_eq!(theme, Some("dark".to_string()));

        // Check api_provider default
        let api_provider = get_setting(&conn, "api_provider").unwrap();
        assert_eq!(api_provider, Some("anthropic".to_string()));
    }

    #[test]
    fn test_get_nonexistent_setting() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let result = get_setting(&conn, "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_set_new_setting() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        set_setting(&conn, "custom_setting", "custom_value").unwrap();

        let result = get_setting(&conn, "custom_setting").unwrap();
        assert_eq!(result, Some("custom_value".to_string()));
    }

    #[test]
    fn test_update_existing_setting() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Update the default theme setting
        set_setting(&conn, "theme", "light").unwrap();

        let result = get_setting(&conn, "theme").unwrap();
        assert_eq!(result, Some("light".to_string()));
    }

    #[test]
    fn test_delete_setting() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Add a custom setting
        set_setting(&conn, "to_delete", "value").unwrap();
        assert!(get_setting(&conn, "to_delete").unwrap().is_some());

        // Delete it
        let deleted = delete_setting(&conn, "to_delete").unwrap();
        assert!(deleted);

        // Verify it's gone
        assert!(get_setting(&conn, "to_delete").unwrap().is_none());
    }

    #[test]
    fn test_delete_nonexistent_setting() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let deleted = delete_setting(&conn, "nonexistent").unwrap();
        assert!(!deleted);
    }

    #[test]
    fn test_list_settings() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let settings = list_settings(&conn).unwrap();

        // Should have at least the 2 default settings
        assert!(settings.len() >= 2);

        // Find theme and api_provider in the list
        let keys: Vec<&str> = settings.iter().map(|s| s.key.as_str()).collect();
        assert!(keys.contains(&"theme"));
        assert!(keys.contains(&"api_provider"));
    }

    #[test]
    fn test_setting_has_updated_at() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let settings = list_settings(&conn).unwrap();
        let theme_setting = settings.iter().find(|s| s.key == "theme").unwrap();

        // updated_at should be a non-empty timestamp
        assert!(!theme_setting.updated_at.is_empty());
    }

    // Story 8.6: Voice learning progress tests (Subtask 5.4)

    #[test]
    fn test_get_proposals_edited_count_default() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Should return 0 if key doesn't exist (code-level default)
        let count = get_proposals_edited_count(&conn).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_increment_proposals_edited() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // First increment: 0 -> 1
        let count1 = increment_proposals_edited(&conn).unwrap();
        assert_eq!(count1, 1);

        // Second increment: 1 -> 2
        let count2 = increment_proposals_edited(&conn).unwrap();
        assert_eq!(count2, 2);

        // Verify the value persists
        let retrieved = get_proposals_edited_count(&conn).unwrap();
        assert_eq!(retrieved, 2);
    }

    #[test]
    fn test_proposals_edited_count_persistence() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Increment multiple times
        increment_proposals_edited(&conn).unwrap();
        increment_proposals_edited(&conn).unwrap();
        increment_proposals_edited(&conn).unwrap();

        let count = get_proposals_edited_count(&conn).unwrap();
        assert_eq!(count, 3);

        // Verify it's stored as a setting
        let setting = get_setting(&conn, "proposals_edited_count").unwrap();
        assert_eq!(setting, Some("3".to_string()));
    }

    #[test]
    fn test_proposals_edited_count_parse_error() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Manually set invalid value
        set_setting(&conn, "proposals_edited_count", "invalid").unwrap();

        // Should return error when parsing fails
        let result = get_proposals_edited_count(&conn);
        assert!(result.is_err());
    }
}
