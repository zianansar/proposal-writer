//! Database query modules organized by entity.
//!
//! Each file exports standalone functions that operate on the database.
//! All queries use prepared statements via rusqlite's params![] macro.

pub mod golden_set;
pub mod hook_strategies;
pub mod job_posts;
pub mod proposals;
pub mod revisions;
pub mod rss_imports;
pub mod safety_overrides;
pub mod scoring;
pub mod settings;
pub mod user_skills;
pub mod voice_profile;
