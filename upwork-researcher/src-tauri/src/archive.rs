// Story 6-7: Archive Old Revisions
// Compression utilities for archived revisions

use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};

use crate::db::queries::revisions::ProposalRevision;

/// Archived revision (lightweight version of ProposalRevision)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchivedRevision {
    pub id: i64,
    pub proposal_id: i64, // M3 fix: Include for data integrity validation
    pub content: String,
    pub revision_type: String,
    pub restored_from_id: Option<i64>,
    pub created_at: String,
}

impl From<ProposalRevision> for ArchivedRevision {
    fn from(rev: ProposalRevision) -> Self {
        ArchivedRevision {
            id: rev.id,
            proposal_id: rev.proposal_id,
            content: rev.content,
            revision_type: rev.revision_type,
            restored_from_id: rev.restored_from_id,
            created_at: rev.created_at,
        }
    }
}

/// Compress revisions to a byte array
pub fn compress_revisions(revisions: &[ArchivedRevision]) -> Result<Vec<u8>, String> {
    let json = serde_json::to_vec(revisions).map_err(|e| e.to_string())?;

    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&json).map_err(|e| e.to_string())?;
    encoder.finish().map_err(|e| e.to_string())
}

/// Decompress byte array to revisions
pub fn decompress_revisions(data: &[u8]) -> Result<Vec<ArchivedRevision>, String> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let mut decoder = ZlibDecoder::new(data);
    let mut json = Vec::new();
    decoder.read_to_end(&mut json).map_err(|e| e.to_string())?;

    serde_json::from_slice(&json).map_err(|e| e.to_string())
}

/// Merge new archived revisions with existing archive
pub fn merge_archives(
    existing: Option<&[u8]>,
    new_revisions: Vec<ArchivedRevision>,
) -> Result<Vec<u8>, String> {
    let mut all_revisions = match existing {
        Some(data) if !data.is_empty() => decompress_revisions(data)?,
        _ => Vec::new(),
    };

    all_revisions.extend(new_revisions);
    compress_revisions(&all_revisions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_decompress_roundtrip() {
        let revisions = vec![
            ArchivedRevision {
                id: 1,
                proposal_id: 100,
                content: "First revision content".to_string(),
                revision_type: "generation".to_string(),
                restored_from_id: None,
                created_at: "2024-01-01T00:00:00Z".to_string(),
            },
            ArchivedRevision {
                id: 2,
                proposal_id: 100,
                content: "Second revision content".to_string(),
                revision_type: "edit".to_string(),
                restored_from_id: None,
                created_at: "2024-01-02T00:00:00Z".to_string(),
            },
        ];

        let compressed = compress_revisions(&revisions).unwrap();
        let decompressed = decompress_revisions(&compressed).unwrap();

        assert_eq!(revisions.len(), decompressed.len());
        assert_eq!(revisions[0].id, decompressed[0].id);
        assert_eq!(revisions[0].proposal_id, decompressed[0].proposal_id);
        assert_eq!(revisions[0].content, decompressed[0].content);
        assert_eq!(revisions[1].id, decompressed[1].id);
        assert_eq!(revisions[1].proposal_id, decompressed[1].proposal_id);
        assert_eq!(revisions[1].content, decompressed[1].content);
    }

    #[test]
    fn test_compress_empty_array() {
        let revisions: Vec<ArchivedRevision> = vec![];
        let compressed = compress_revisions(&revisions).unwrap();
        assert!(!compressed.is_empty()); // Even empty array has some compressed data
    }

    #[test]
    fn test_decompress_empty_data() {
        let empty_data: &[u8] = &[];
        let result = decompress_revisions(empty_data).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_merge_archives_with_existing() {
        let existing_revisions = vec![ArchivedRevision {
            id: 1,
            proposal_id: 100,
            content: "Old revision".to_string(),
            revision_type: "edit".to_string(),
            restored_from_id: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
        }];

        let existing_compressed = compress_revisions(&existing_revisions).unwrap();

        let new_revisions = vec![ArchivedRevision {
            id: 2,
            proposal_id: 100,
            content: "New revision".to_string(),
            revision_type: "edit".to_string(),
            restored_from_id: None,
            created_at: "2024-01-02T00:00:00Z".to_string(),
        }];

        let merged = merge_archives(Some(&existing_compressed), new_revisions).unwrap();
        let decompressed = decompress_revisions(&merged).unwrap();

        assert_eq!(decompressed.len(), 2);
        assert_eq!(decompressed[0].id, 1);
        assert_eq!(decompressed[1].id, 2);
    }

    #[test]
    fn test_merge_archives_without_existing() {
        let new_revisions = vec![ArchivedRevision {
            id: 1,
            proposal_id: 100,
            content: "First revision".to_string(),
            revision_type: "generation".to_string(),
            restored_from_id: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
        }];

        let merged = merge_archives(None, new_revisions).unwrap();
        let decompressed = decompress_revisions(&merged).unwrap();

        assert_eq!(decompressed.len(), 1);
        assert_eq!(decompressed[0].id, 1);
    }

    #[test]
    fn test_compression_reduces_size() {
        // Create a large revision with repetitive content
        let large_content = "This is repetitive content. ".repeat(100);
        let revisions = vec![ArchivedRevision {
            id: 1,
            proposal_id: 100,
            content: large_content.clone(),
            revision_type: "edit".to_string(),
            restored_from_id: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
        }];

        let json = serde_json::to_vec(&revisions).unwrap();
        let compressed = compress_revisions(&revisions).unwrap();

        // Compression should reduce size significantly for repetitive text
        // Expecting at least 50% reduction
        assert!(compressed.len() < json.len() / 2);
    }
}
