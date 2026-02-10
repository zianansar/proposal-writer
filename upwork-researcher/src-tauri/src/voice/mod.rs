//! Voice learning module for Epic 5
//!
//! Provides local text analysis for voice calibration (Story 5.4).
//! Privacy: All analysis happens locally - NO API calls (AR-12).

pub mod analyzer;
pub mod profile;
pub mod prompt;

pub use analyzer::*;
pub use profile::*;
pub use prompt::*;
