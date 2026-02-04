//! Database query modules organized by entity.
//!
//! Each file exports standalone functions that operate on the database.
//! All queries use prepared statements via rusqlite's params![] macro.

pub mod proposals;
pub mod settings;
