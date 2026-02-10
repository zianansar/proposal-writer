/// Event name constants for Tauri events.
/// Convention: {feature}:{action}, lowercase, two levels max.

use serde::{Deserialize, Serialize};

pub const GENERATION_TOKEN: &str = "generation:token";
pub const GENERATION_COMPLETE: &str = "generation:complete";
pub const GENERATION_ERROR: &str = "generation:error";
pub const GENERATION_STAGE: &str = "generation:stage";

// Story 4b.7: RSS Feed Import Events
pub const RSS_IMPORT_PROGRESS: &str = "rss:import-progress";
pub const RSS_IMPORT_COMPLETE: &str = "rss:import-complete";
pub const RSS_IMPORT_ERROR: &str = "rss:import-error";

// Story 4b.8: RSS Fallback Events
pub const RSS_FALLBACK_STARTED: &str = "rss:fallback-started";
// Note: SCRAPE_FAILED was defined but not used - composite error via rss:import-error instead

// Story 8.13: Network Allowlist Enforcement
pub const NETWORK_BLOCKED: &str = "network:blocked";

/// RSS import progress event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssImportProgress {
    pub batch_id: String,
    pub current: usize,
    pub total: usize,
    pub job_title: String,
}

/// RSS import completion event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssImportComplete {
    pub batch_id: String,
    pub total_analyzed: usize,
    pub failed_count: usize,
}

/// Blocked network request event payload (Story 8.13)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkBlockedPayload {
    pub domain: String,
    pub url: String,
    pub timestamp: String,
}
