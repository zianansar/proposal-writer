//! Hook strategies database queries.
//!
//! Provides read-only operations for the hook_strategies table (Story 5.1).
//! Hook strategies are seeded during migration and guide proposal opening styles.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// A hook strategy with examples and guidance.
///
/// Hook strategies guide the opening style of proposal generation.
/// Each strategy includes examples and best-use-case guidance (Story 5.1: AC-1).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookStrategy {
    pub id: i64,
    pub name: String,
    pub description: String,
    /// JSON array of 2-3 example opening lines (Story 5.1: AC-3)
    pub examples_json: String,
    pub best_for: String,
    pub created_at: String,
}

/// Get all hook strategies.
///
/// Returns all seeded hook strategies for UI display (Story 5.2).
/// Strategies are ordered by id (insertion order).
///
/// # Story 5.1: AC-2
/// Expected to return exactly 5 default strategies:
/// - Social Proof
/// - Contrarian
/// - Immediate Value
/// - Problem-Aware
/// - Question-Based
pub fn get_all_hook_strategies(conn: &Connection) -> Result<Vec<HookStrategy>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, examples_json, best_for, created_at
         FROM hook_strategies
         ORDER BY id",
    )?;

    let strategies = stmt
        .query_map([], |row| {
            Ok(HookStrategy {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                examples_json: row.get(3)?,
                best_for: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(strategies)
}

/// Get a hook strategy by ID.
///
/// Returns None if the strategy doesn't exist.
/// Used by proposal generation to retrieve selected strategy details.
pub fn get_hook_strategy_by_id(
    conn: &Connection,
    id: i64,
) -> Result<Option<HookStrategy>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, examples_json, best_for, created_at
         FROM hook_strategies
         WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(HookStrategy {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            examples_json: row.get(3)?,
            best_for: row.get(4)?,
            created_at: row.get(5)?,
        }))
    } else {
        Ok(None)
    }
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
    fn test_get_all_hook_strategies_returns_five() {
        // Story 5.1: AC-2 - Verify 5 default strategies are returned
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();

        assert_eq!(
            strategies.len(),
            5,
            "Should return exactly 5 default hook strategies"
        );
    }

    #[test]
    fn test_get_all_hook_strategies_names() {
        // Story 5.1: AC-2 - Verify expected strategy names
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();
        let names: Vec<&str> = strategies.iter().map(|s| s.name.as_str()).collect();

        assert!(
            names.contains(&"Social Proof"),
            "Should include Social Proof strategy"
        );
        assert!(
            names.contains(&"Contrarian"),
            "Should include Contrarian strategy"
        );
        assert!(
            names.contains(&"Immediate Value"),
            "Should include Immediate Value strategy"
        );
        assert!(
            names.contains(&"Problem-Aware"),
            "Should include Problem-Aware strategy"
        );
        assert!(
            names.contains(&"Question-Based"),
            "Should include Question-Based strategy"
        );
    }

    #[test]
    fn test_get_hook_strategy_by_id_exists() {
        // Verify retrieval of a specific strategy by ID
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Get all strategies first to find a valid ID
        let strategies = get_all_hook_strategies(&conn).unwrap();
        let first_strategy = &strategies[0];

        // Retrieve by ID
        let retrieved = get_hook_strategy_by_id(&conn, first_strategy.id).unwrap();

        assert!(retrieved.is_some(), "Should find strategy by ID");
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.id, first_strategy.id);
        assert_eq!(retrieved.name, first_strategy.name);
    }

    #[test]
    fn test_get_hook_strategy_by_id_not_found() {
        // Verify None is returned for non-existent ID
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let result = get_hook_strategy_by_id(&conn, 9999).unwrap();

        assert!(result.is_none(), "Should return None for non-existent ID");
    }

    #[test]
    fn test_hook_strategy_has_valid_examples_json() {
        // Story 5.1: AC-3 - Verify examples_json is valid JSON
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();

        for strategy in strategies {
            // Parse examples_json to verify it's valid JSON
            let examples: serde_json::Value = serde_json::from_str(&strategy.examples_json)
                .unwrap_or_else(|_| {
                    panic!(
                        "Strategy '{}' should have valid JSON examples",
                        strategy.name
                    )
                });

            assert!(
                examples.is_array(),
                "Strategy '{}' examples should be a JSON array",
                strategy.name
            );

            let examples_array = examples.as_array().unwrap();
            assert!(
                examples_array.len() >= 2 && examples_array.len() <= 3,
                "Strategy '{}' should have 2-3 examples, got {}",
                strategy.name,
                examples_array.len()
            );
        }
    }

    #[test]
    fn test_hook_strategy_has_all_fields() {
        // Verify all fields are populated
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();
        let strategy = &strategies[0];

        assert!(strategy.id > 0, "ID should be positive");
        assert!(!strategy.name.is_empty(), "Name should not be empty");
        assert!(
            !strategy.description.is_empty(),
            "Description should not be empty"
        );
        assert!(
            !strategy.examples_json.is_empty(),
            "Examples JSON should not be empty"
        );
        assert!(
            !strategy.best_for.is_empty(),
            "Best for should not be empty"
        );
        assert!(
            !strategy.created_at.is_empty(),
            "Created at should not be empty"
        );
    }
}
