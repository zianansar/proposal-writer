//! Settings database queries.
//!
//! Provides CRUD operations for the settings table (key-value store).

use rusqlite::{params, Connection};

/// A setting with its value and metadata.
#[derive(Debug, Clone)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    fn create_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.into_path().join("test.db");
        Database::new(db_path).unwrap()
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
}
