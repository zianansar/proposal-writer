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
/// Story 10.3 adds status tracking for remote config updates.
/// Story 10.4 adds ab_weight for weighted random A/B selection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookStrategy {
    pub id: i64,
    pub name: String,
    pub description: String,
    /// JSON array of 2-3 example opening lines (Story 5.1: AC-3)
    pub examples_json: String,
    pub best_for: String,
    pub created_at: String,
    /// Strategy status: 'active', 'deprecated', or 'retired' (Story 10.3: AC-1)
    pub status: String,
    /// Remote config ID for sync mapping (Story 10.3: AC-2). None for seed strategies.
    pub remote_id: Option<String>,
    /// A/B testing weight in [0.0, 1.0]. 0.0 = inactive for A/B (Story 10.4: AC-1)
    pub ab_weight: f64,
}

/// Get all non-retired hook strategies.
///
/// Returns active and deprecated hook strategies for UI display (Story 5.2, 10.3).
/// Retired strategies are excluded (Story 10.3: AC-5 — hidden from selector for new proposals).
/// Strategies are ordered by status ASC then id ASC (active before deprecated).
///
/// # Story 5.1: AC-2
/// Expected to return exactly 5 default strategies (all active, no remote_id):
/// - Social Proof
/// - Contrarian
/// - Immediate Value
/// - Problem-Aware
/// - Question-Based
///
/// # Story 10.3: AC-5
/// Retired strategies are excluded from this query to hide them from the selection UI.
/// Use `get_all_hook_strategies_including_retired()` for history/admin views.
pub fn get_all_hook_strategies(conn: &Connection) -> Result<Vec<HookStrategy>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, examples_json, best_for, created_at, status, remote_id, ab_weight
         FROM hook_strategies
         WHERE status != 'retired'
         ORDER BY status ASC, id ASC",
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
                status: row.get(6)?,
                remote_id: row.get(7)?,
                ab_weight: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(strategies)
}

/// Get all hook strategies including retired ones.
///
/// Returns ALL strategies regardless of status (Story 10.3: Task 2.2).
/// Used for proposal history display so users can see retired strategy names.
/// Also used for admin/debug views.
///
/// # Story 10.3: AC-5
/// Proposals previously generated with a retired strategy retain the strategy name
/// in their history. This query provides access to all strategies for that purpose.
pub fn get_all_hook_strategies_including_retired(
    conn: &Connection,
) -> Result<Vec<HookStrategy>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, examples_json, best_for, created_at, status, remote_id, ab_weight
         FROM hook_strategies
         ORDER BY status ASC, id ASC",
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
                status: row.get(6)?,
                remote_id: row.get(7)?,
                ab_weight: row.get(8)?,
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
        "SELECT id, name, description, examples_json, best_for, created_at, status, remote_id, ab_weight
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
            status: row.get(6)?,
            remote_id: row.get(7)?,
            ab_weight: row.get(8)?,
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

    // Story 10.3: Query filter tests (Task 2.3)

    #[test]
    fn test_get_all_returns_active_strategies_only_when_all_active() {
        // Task 2.3.1: get_all returns only active strategies when all are active
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();

        // All 5 seed strategies should be active and returned
        assert_eq!(strategies.len(), 5, "Should return all 5 active seed strategies");
        for s in &strategies {
            assert_eq!(s.status, "active", "All returned strategies should be active");
        }
    }

    #[test]
    fn test_get_all_returns_deprecated_strategies_with_active() {
        // Task 2.3.2: get_all returns deprecated strategies alongside active ones
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Add a deprecated strategy
        conn.execute(
            "INSERT INTO hook_strategies (name, description, examples_json, best_for, status, remote_id)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![
                "Deprecated Hook",
                "A deprecated strategy",
                "[\"Old example\"]",
                "Legacy use cases",
                "deprecated",
                "remote-deprecated-1"
            ],
        ).unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();

        // Should return 5 active + 1 deprecated = 6 total
        assert_eq!(strategies.len(), 6, "Should return active + deprecated strategies");
        let deprecated_count = strategies.iter().filter(|s| s.status == "deprecated").count();
        assert_eq!(deprecated_count, 1, "Should include 1 deprecated strategy");
    }

    #[test]
    fn test_get_all_excludes_retired_strategies() {
        // Task 2.3.3: get_all excludes retired strategies
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Add a retired strategy
        conn.execute(
            "INSERT INTO hook_strategies (name, description, examples_json, best_for, status, remote_id)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![
                "Retired Hook",
                "A retired strategy",
                "[\"Old example\"]",
                "No longer used",
                "retired",
                "remote-retired-1"
            ],
        ).unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();

        // Should return only the 5 active seed strategies (retired excluded)
        assert_eq!(strategies.len(), 5, "Should exclude retired strategies");
        for s in &strategies {
            assert_ne!(s.status, "retired", "No retired strategies should be returned");
        }
    }

    #[test]
    fn test_get_all_including_retired_returns_all_strategies() {
        // Task 2.3.4: get_all_including_retired returns ALL strategies
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Add a retired strategy
        conn.execute(
            "INSERT INTO hook_strategies (name, description, examples_json, best_for, status, remote_id)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![
                "Retired Hook",
                "A retired strategy",
                "[\"Old example\"]",
                "No longer used",
                "retired",
                "remote-retired-2"
            ],
        ).unwrap();

        let all_strategies = get_all_hook_strategies_including_retired(&conn).unwrap();
        let active_only = get_all_hook_strategies(&conn).unwrap();

        // Including retired should have more than active only
        assert_eq!(all_strategies.len(), 6, "Should return all 6 strategies including retired");
        assert_eq!(active_only.len(), 5, "Active-only should return 5");
        assert!(
            all_strategies.len() > active_only.len(),
            "Including retired should have more strategies than active-only"
        );
    }

    #[test]
    fn test_strategies_ordered_by_status_then_id() {
        // Task 2.3.5: Strategies ordered by status ASC then id ASC (active before deprecated)
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Add a deprecated strategy (it will have a higher id than the 5 seeds)
        conn.execute(
            "INSERT INTO hook_strategies (name, description, examples_json, best_for, status, remote_id)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![
                "Deprecated Hook",
                "A deprecated strategy",
                "[\"Old example\"]",
                "Legacy use cases",
                "deprecated",
                "remote-deprecated-3"
            ],
        ).unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();

        // All active strategies should come before deprecated ones
        let mut found_deprecated = false;
        for s in &strategies {
            if s.status == "deprecated" {
                found_deprecated = true;
            }
            if found_deprecated {
                // Once we see deprecated, all subsequent must also be deprecated
                assert_eq!(
                    s.status, "deprecated",
                    "Active strategies should come before deprecated ones"
                );
            }
        }
        assert!(found_deprecated, "Should have found the deprecated strategy");
    }

    #[test]
    fn test_get_all_returns_empty_when_all_retired() {
        // Task 2.3.6: get_all returns empty when all strategies are retired
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Mark all 5 seed strategies as retired
        conn.execute_batch(
            "UPDATE hook_strategies SET status = 'retired' WHERE status = 'active';"
        ).unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();

        assert_eq!(
            strategies.len(), 0,
            "Should return empty when all strategies are retired"
        );
    }

    // Story 10.3: Migration V28 tests (Task 1.4)
    #[test]
    fn test_migration_v28_runs_on_clean_database() {
        // Task 1.4.1: Verify V28 migration runs successfully on clean database
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Verify status and remote_id columns exist by querying them
        let result = conn.query_row(
            "SELECT status, remote_id FROM hook_strategies WHERE id = 1",
            [],
            |row| {
                let status: String = row.get(0)?;
                let remote_id: Option<String> = row.get(1)?;
                Ok((status, remote_id))
            },
        );

        assert!(result.is_ok(), "Should be able to query status and remote_id columns");
        let (status, remote_id) = result.unwrap();
        assert_eq!(status, "active", "Default status should be 'active'");
        assert!(remote_id.is_none(), "Default remote_id should be NULL");
    }

    #[test]
    fn test_migration_v28_existing_strategies_get_default_values() {
        // Task 1.4.2: Verify existing 5 seed strategies get status='active', remote_id=NULL
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let strategies = get_all_hook_strategies(&conn).unwrap();

        // All 5 seed strategies should have status='active' and remote_id=None
        assert_eq!(strategies.len(), 5, "Should have 5 seed strategies");

        for strategy in strategies {
            assert_eq!(
                strategy.status, "active",
                "Strategy '{}' should have status='active'",
                strategy.name
            );
            assert!(
                strategy.remote_id.is_none(),
                "Strategy '{}' should have remote_id=None (NULL)",
                strategy.name
            );
        }
    }

    #[test]
    fn test_migration_v28_check_constraint_rejects_invalid_status() {
        // Task 1.4.3: Verify CHECK constraint rejects invalid status values
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Try to insert a strategy with invalid status 'invalid'
        let result = conn.execute(
            "INSERT INTO hook_strategies (name, description, examples_json, best_for, status)
             VALUES (?, ?, ?, ?, ?)",
            params![
                "Test Strategy",
                "Test description",
                "[\"Example 1\"]",
                "Test use case",
                "invalid" // Invalid status value
            ],
        );

        // Should fail due to CHECK constraint
        assert!(
            result.is_err(),
            "INSERT with invalid status 'invalid' should fail CHECK constraint"
        );

        // Verify the error message mentions the constraint
        let error_msg = result.unwrap_err().to_string();
        assert!(
            error_msg.contains("CHECK") || error_msg.contains("constraint"),
            "Error should mention CHECK constraint violation, got: {}",
            error_msg
        );
    }
}
