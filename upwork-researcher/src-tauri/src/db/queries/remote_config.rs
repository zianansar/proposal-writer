//! Remote config database queries.
//!
//! Provides storage and retrieval for cached remote configuration.

use crate::remote_config::RemoteConfig;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Cached remote configuration with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedConfig {
    pub config: RemoteConfig,
    pub fetched_at: String,
    pub signature: String,
    pub source: String,
}

/// Store or update remote config in database (UPSERT pattern)
///
/// Uses single-row cache with id=1. Only one config is ever stored.
/// Atomic operation - replaces entire cached config.
///
/// # Arguments
/// * `conn` - Database connection
/// * `config` - Remote config to store
/// * `signature` - HMAC signature from verification
///
/// # Returns
/// * `Ok(())` on success
/// * `Err(rusqlite::Error)` on database failure
pub fn store_remote_config(
    conn: &Connection,
    config: &RemoteConfig,
    signature: &str,
) -> Result<(), rusqlite::Error> {
    let config_json = serde_json::to_string(config)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    conn.execute(
        "INSERT INTO remote_config (id, schema_version, config_json, fetched_at, signature, source)
         VALUES (1, ?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), ?3, 'remote')
         ON CONFLICT(id) DO UPDATE SET
            schema_version = excluded.schema_version,
            config_json = excluded.config_json,
            fetched_at = excluded.fetched_at,
            signature = excluded.signature,
            source = excluded.source",
        params![&config.schema_version, &config_json, signature],
    )?;

    Ok(())
}

/// Get cached config from database
///
/// Returns None if no config is cached (first run or cache cleared).
///
/// # Arguments
/// * `conn` - Database connection
///
/// # Returns
/// * `Ok(Some(CachedConfig))` if cache exists
/// * `Ok(None)` if no cached config
/// * `Err(rusqlite::Error)` on database or deserialization failure
pub fn get_cached_config(conn: &Connection) -> Result<Option<CachedConfig>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT config_json, fetched_at, signature, source FROM remote_config WHERE id = 1",
    )?;

    let mut rows = stmt.query([])?;

    if let Some(row) = rows.next()? {
        let config_json: String = row.get(0)?;
        let fetched_at: String = row.get(1)?;
        let signature: String = row.get(2)?;
        let source: String = row.get(3)?;

        // Deserialize config from JSON
        let config: RemoteConfig = serde_json::from_str(&config_json).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(e),
            )
        })?;

        Ok(Some(CachedConfig {
            config,
            fetched_at,
            signature,
            source,
        }))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use crate::remote_config::{RemoteStrategy, StrategyStatus};
    use tempfile::tempdir;

    fn create_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        Database::new(db_path, None).unwrap()
    }

    fn create_test_config() -> RemoteConfig {
        RemoteConfig {
            schema_version: "1.0.0".to_string(),
            min_app_version: "0.1.0".to_string(),
            updated_at: "2026-02-17T00:00:00Z".to_string(),
            strategies: vec![RemoteStrategy {
                id: "test-strategy".to_string(),
                name: "Test Strategy".to_string(),
                description: "A test strategy".to_string(),
                examples: vec!["Example 1".to_string(), "Example 2".to_string()],
                best_for: "Testing".to_string(),
                status: StrategyStatus::Active,
                ab_weight: 1.0,
            }],
        }
    }

    #[test]
    fn test_store_then_retrieve_config() {
        // Task 2.6: Store config then retrieve it
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let config = create_test_config();
        let signature = "test_signature_abc123";

        // Store config
        store_remote_config(&conn, &config, signature).unwrap();

        // Retrieve config
        let cached = get_cached_config(&conn).unwrap();
        assert!(cached.is_some());

        let cached = cached.unwrap();
        assert_eq!(cached.config.schema_version, "1.0.0");
        assert_eq!(cached.signature, signature);
        assert_eq!(cached.source, "remote");
        assert_eq!(cached.config.strategies.len(), 1);
    }

    #[test]
    fn test_upsert_replaces_existing() {
        // Task 2.6: UPSERT pattern replaces existing config
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let config_v1 = create_test_config();
        store_remote_config(&conn, &config_v1, "signature_v1").unwrap();

        // Update to v2
        let mut config_v2 = create_test_config();
        config_v2.schema_version = "2.0.0".to_string();
        store_remote_config(&conn, &config_v2, "signature_v2").unwrap();

        // Should only have one row (id=1)
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM remote_config", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1, "Should only have one cached config");

        // Retrieved config should be v2
        let cached = get_cached_config(&conn).unwrap().unwrap();
        assert_eq!(cached.config.schema_version, "2.0.0");
        assert_eq!(cached.signature, "signature_v2");
    }

    #[test]
    fn test_empty_cache_returns_none() {
        // Task 2.6: Empty cache returns None
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let cached = get_cached_config(&conn).unwrap();
        assert!(
            cached.is_none(),
            "Empty cache should return None (first run)"
        );
    }

    #[test]
    fn test_invalid_json_handling() {
        // Task 2.6: Invalid JSON in database returns error
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Manually insert invalid JSON
        conn.execute(
            "INSERT INTO remote_config (id, schema_version, config_json, fetched_at, signature)
             VALUES (1, '1.0.0', 'invalid json {', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 'test_sig')",
            [],
        )
        .unwrap();

        // Should return deserialization error
        let result = get_cached_config(&conn);
        assert!(
            result.is_err(),
            "Invalid JSON should return deserialization error"
        );
    }

    #[test]
    fn test_fetched_at_timestamp_set() {
        // Verify fetched_at is set automatically
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let config = create_test_config();
        store_remote_config(&conn, &config, "test_sig").unwrap();

        let cached = get_cached_config(&conn).unwrap().unwrap();
        assert!(
            !cached.fetched_at.is_empty(),
            "fetched_at should be set automatically"
        );
        // ISO 8601 format check (basic validation)
        assert!(
            cached.fetched_at.contains('T') && cached.fetched_at.contains('Z'),
            "fetched_at should be ISO 8601 format"
        );
    }

    #[test]
    fn test_config_serialization_roundtrip() {
        // Verify complex config survives serialization roundtrip
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let mut config = create_test_config();
        // Add more strategies to test array serialization
        config.strategies.push(RemoteStrategy {
            id: "strategy-2".to_string(),
            name: "Second Strategy".to_string(),
            description: "Another test strategy with longer description".to_string(),
            examples: vec![
                "Example A".to_string(),
                "Example B".to_string(),
                "Example C".to_string(),
            ],
            best_for: "Advanced testing scenarios".to_string(),
            status: StrategyStatus::Deprecated,
            ab_weight: 0.5,
        });

        store_remote_config(&conn, &config, "sig").unwrap();

        let cached = get_cached_config(&conn).unwrap().unwrap();
        assert_eq!(cached.config.strategies.len(), 2);
        assert_eq!(cached.config.strategies[1].id, "strategy-2");
        assert_eq!(cached.config.strategies[1].status, StrategyStatus::Deprecated);
        assert_eq!(cached.config.strategies[1].ab_weight, 0.5);
        assert_eq!(cached.config.strategies[1].examples.len(), 3);
    }
}
