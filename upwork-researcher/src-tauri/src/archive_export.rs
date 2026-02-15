// Archive export/import functionality for database portability
// Binary format: URB1 (Upwork Research Backup v1)

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;

/// Magic header for URB archive format (4 bytes)
const MAGIC_HEADER: &[u8; 4] = b"URB1";

/// Metadata stored in the archive header
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveMetadata {
    /// Format version (currently 1)
    pub format_version: u8,
    /// Export timestamp (ISO 8601)
    pub export_date: String,
    /// Application version at export time
    pub app_version: String,
    /// Optional user-provided passphrase hint
    pub passphrase_hint: Option<String>,
    /// Count of proposals in backup
    pub proposal_count: usize,
    /// Count of proposal revisions in backup
    pub revision_count: usize,
    /// Count of job posts in backup
    pub job_post_count: usize,
    /// Count of settings entries in backup
    pub settings_count: usize,
    /// Count of voice profiles in backup
    pub voice_profile_count: usize,
    /// Size of the encrypted database file in bytes
    pub db_size_bytes: u64,
}

impl ArchiveMetadata {
    /// Creates a new metadata instance with the given counts
    pub fn new(
        app_version: String,
        passphrase_hint: Option<String>,
        proposal_count: usize,
        revision_count: usize,
        job_post_count: usize,
        settings_count: usize,
        voice_profile_count: usize,
        db_size_bytes: u64,
    ) -> Self {
        Self {
            format_version: 1,
            export_date: chrono::Utc::now().to_rfc3339(),
            app_version,
            passphrase_hint,
            proposal_count,
            revision_count,
            job_post_count,
            settings_count,
            voice_profile_count,
            db_size_bytes,
        }
    }
}

/// Writes a URB archive to the specified path
///
/// Format:
/// - 4 bytes: Magic header "URB1"
/// - 4 bytes: Metadata length (u32 LE)
/// - N bytes: JSON metadata
/// - 4 bytes: Salt length (u32 LE)
/// - M bytes: Salt bytes
/// - Remaining: Encrypted database file bytes
pub fn write_archive(
    path: &Path,
    metadata: &ArchiveMetadata,
    salt_bytes: &[u8],
    db_bytes: &[u8],
) -> Result<(), String> {
    // Serialize metadata to JSON
    let metadata_json =
        serde_json::to_vec(metadata).map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    let metadata_len = metadata_json.len() as u32;
    let salt_len = salt_bytes.len() as u32;

    // Open file for writing
    let mut file = fs::File::create(path)
        .map_err(|e| format!("Failed to create archive file: {}", e))?;

    // Write magic header
    file.write_all(MAGIC_HEADER)
        .map_err(|e| format!("Failed to write magic header: {}", e))?;

    // Write metadata length (u32 little-endian)
    file.write_all(&metadata_len.to_le_bytes())
        .map_err(|e| format!("Failed to write metadata length: {}", e))?;

    // Write metadata JSON
    file.write_all(&metadata_json)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    // Write salt length (u32 little-endian)
    file.write_all(&salt_len.to_le_bytes())
        .map_err(|e| format!("Failed to write salt length: {}", e))?;

    // Write salt bytes
    file.write_all(salt_bytes)
        .map_err(|e| format!("Failed to write salt: {}", e))?;

    // Write database bytes
    file.write_all(db_bytes)
        .map_err(|e| format!("Failed to write database: {}", e))?;

    // Sync to disk
    file.sync_all()
        .map_err(|e| format!("Failed to sync archive to disk: {}", e))?;

    Ok(())
}

/// Reads and parses a URB archive, returning (metadata, salt, db_bytes)
///
/// This function validates the archive format and extracts all components
/// without decrypting the database (the DB is already encrypted).
pub fn read_archive_metadata(
    path: &Path,
) -> Result<(ArchiveMetadata, Vec<u8>, Vec<u8>), String> {
    // Open and read entire file
    let mut file = fs::File::open(path)
        .map_err(|e| format!("Failed to open archive file: {}", e))?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read archive file: {}", e))?;

    // Verify minimum size (header + 2 length fields = 12 bytes minimum)
    if buffer.len() < 12 {
        return Err("Archive file is too small to be valid".to_string());
    }

    let mut offset = 0;

    // Read and verify magic header
    let magic = &buffer[offset..offset + 4];
    if magic != MAGIC_HEADER {
        return Err(format!(
            "Invalid archive format: expected URB1, got {:?}",
            magic
        ));
    }
    offset += 4;

    // Read metadata length
    let metadata_len = u32::from_le_bytes([
        buffer[offset],
        buffer[offset + 1],
        buffer[offset + 2],
        buffer[offset + 3],
    ]) as usize;
    offset += 4;

    // Validate metadata length
    if offset + metadata_len > buffer.len() {
        return Err("Archive metadata length exceeds file size".to_string());
    }

    // Read and parse metadata JSON
    let metadata_bytes = &buffer[offset..offset + metadata_len];
    let metadata: ArchiveMetadata = serde_json::from_slice(metadata_bytes)
        .map_err(|e| format!("Failed to parse metadata JSON: {}", e))?;
    offset += metadata_len;

    // Verify we have at least 4 more bytes for salt length
    if offset + 4 > buffer.len() {
        return Err("Archive truncated: missing salt length field".to_string());
    }

    // Read salt length
    let salt_len = u32::from_le_bytes([
        buffer[offset],
        buffer[offset + 1],
        buffer[offset + 2],
        buffer[offset + 3],
    ]) as usize;
    offset += 4;

    // Validate salt length
    if offset + salt_len > buffer.len() {
        return Err("Archive salt length exceeds file size".to_string());
    }

    // Read salt bytes
    let salt_bytes = buffer[offset..offset + salt_len].to_vec();
    offset += salt_len;

    // Remaining bytes are the encrypted database
    let db_bytes = buffer[offset..].to_vec();

    // Validate database has content
    if db_bytes.is_empty() {
        return Err("Archive contains no database data".to_string());
    }

    Ok((metadata, salt_bytes, db_bytes))
}

/// Reads only the metadata header from a URB archive (without loading DB bytes)
///
/// This is optimized for preview — reads only the header portion of the file
/// instead of loading the entire archive into memory. For a 500MB archive,
/// this reads only a few KB instead of 500MB.
pub fn read_metadata_only(path: &Path) -> Result<ArchiveMetadata, String> {
    use std::io::{BufReader, Seek, SeekFrom};

    let file = fs::File::open(path)
        .map_err(|e| format!("Failed to open archive file: {}", e))?;
    let mut reader = BufReader::new(file);

    // Read magic header (4 bytes)
    let mut magic = [0u8; 4];
    reader.read_exact(&mut magic)
        .map_err(|e| format!("Failed to read magic header: {}", e))?;
    if &magic != MAGIC_HEADER {
        return Err(format!("Invalid archive format: expected URB1, got {:?}", magic));
    }

    // Read metadata length (4 bytes, u32 LE)
    let mut len_buf = [0u8; 4];
    reader.read_exact(&mut len_buf)
        .map_err(|e| format!("Failed to read metadata length: {}", e))?;
    let metadata_len = u32::from_le_bytes(len_buf) as usize;

    // Sanity check metadata length (max 1MB)
    if metadata_len > 1024 * 1024 {
        return Err(format!("Metadata too large: {} bytes", metadata_len));
    }

    // Read metadata JSON
    let mut metadata_bytes = vec![0u8; metadata_len];
    reader.read_exact(&mut metadata_bytes)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    let metadata: ArchiveMetadata = serde_json::from_slice(&metadata_bytes)
        .map_err(|e| format!("Failed to parse metadata JSON: {}", e))?;

    Ok(metadata)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_round_trip_write_read() {
        // Create test data
        let metadata = ArchiveMetadata::new(
            "1.0.0".to_string(),
            Some("my secret hint".to_string()),
            42,
            123,
            89,
            12,
            1,
            1024,
        );
        let salt = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let db = vec![0xFF; 1024]; // Fake encrypted DB data

        // Write to temp file
        let temp_file = NamedTempFile::new().unwrap();
        let path = temp_file.path();

        write_archive(path, &metadata, &salt, &db).unwrap();

        // Read back
        let (read_metadata, read_salt, read_db) = read_archive_metadata(path).unwrap();

        // Verify
        assert_eq!(read_metadata, metadata);
        assert_eq!(read_salt, salt);
        assert_eq!(read_db, db);
    }

    #[test]
    fn test_corrupt_magic_header() {
        let mut temp_file = NamedTempFile::new().unwrap();

        // Write invalid magic header
        temp_file.write_all(b"XXXX").unwrap();
        temp_file.write_all(&[0u8; 8]).unwrap(); // Some padding
        temp_file.flush().unwrap();

        let result = read_archive_metadata(temp_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid archive format"));
    }

    #[test]
    fn test_truncated_file() {
        let mut temp_file = NamedTempFile::new().unwrap();

        // Write only magic header (incomplete)
        temp_file.write_all(b"URB1").unwrap();
        temp_file.flush().unwrap();

        let result = read_archive_metadata(temp_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too small"));
    }

    #[test]
    fn test_metadata_length_overflow() {
        let mut temp_file = NamedTempFile::new().unwrap();

        // Write magic header
        temp_file.write_all(b"URB1").unwrap();

        // Write huge metadata length that exceeds file size
        let huge_len = 999999u32;
        temp_file.write_all(&huge_len.to_le_bytes()).unwrap();

        // Write padding to get past minimum size check (need at least 12 bytes)
        temp_file.write_all(&[0u8; 4]).unwrap(); // Padding to reach 12 bytes

        temp_file.flush().unwrap();

        let result = read_archive_metadata(temp_file.path());
        assert!(result.is_err());
        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("metadata length exceeds file size"),
            "Expected 'metadata length exceeds file size', got: {}",
            err_msg
        );
    }

    #[test]
    fn test_empty_database() {
        let metadata = ArchiveMetadata::new(
            "1.0.0".to_string(),
            None,
            0,
            0,
            0,
            0,
            0,
            0,
        );
        let salt = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let db = vec![]; // Empty DB

        let temp_file = NamedTempFile::new().unwrap();
        write_archive(temp_file.path(), &metadata, &salt, &db).unwrap();

        let result = read_archive_metadata(temp_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("no database data"));
    }

    #[test]
    fn test_large_metadata() {
        // Create metadata with large hint text
        let large_hint = "x".repeat(10000); // 10KB hint
        let metadata = ArchiveMetadata::new(
            "1.0.0".to_string(),
            Some(large_hint.clone()),
            100,
            200,
            50,
            20,
            3,
            2048,
        );
        let salt = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let db = vec![0xAB; 2048];

        let temp_file = NamedTempFile::new().unwrap();
        write_archive(temp_file.path(), &metadata, &salt, &db).unwrap();

        let (read_metadata, read_salt, read_db) = read_archive_metadata(temp_file.path()).unwrap();

        assert_eq!(read_metadata.passphrase_hint, Some(large_hint));
        assert_eq!(read_salt, salt);
        assert_eq!(read_db, db);
    }

    #[test]
    fn test_metadata_format_version() {
        let metadata = ArchiveMetadata::new(
            "1.0.0".to_string(),
            None,
            1,
            2,
            3,
            4,
            5,
            100,
        );

        assert_eq!(metadata.format_version, 1);
        assert!(metadata.export_date.contains("T")); // ISO 8601 format
    }

    #[test]
    fn test_read_metadata_only_valid_archive() {
        // Create a valid archive and read metadata only (without loading DB)
        let metadata = ArchiveMetadata::new(
            "2.0.0".to_string(),
            Some("pet name".to_string()),
            50,
            100,
            30,
            8,
            2,
            4096,
        );
        let salt = vec![0xAA; 16];
        let db = vec![0xFF; 4096];

        let temp_file = NamedTempFile::new().unwrap();
        write_archive(temp_file.path(), &metadata, &salt, &db).unwrap();

        let read_meta = read_metadata_only(temp_file.path()).unwrap();

        assert_eq!(read_meta.format_version, 1);
        assert_eq!(read_meta.app_version, "2.0.0");
        assert_eq!(read_meta.passphrase_hint, Some("pet name".to_string()));
        assert_eq!(read_meta.proposal_count, 50);
        assert_eq!(read_meta.revision_count, 100);
        assert_eq!(read_meta.job_post_count, 30);
        assert_eq!(read_meta.settings_count, 8);
        assert_eq!(read_meta.voice_profile_count, 2);
        assert_eq!(read_meta.db_size_bytes, 4096);
    }

    #[test]
    fn test_read_metadata_only_corrupt_header() {
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(b"BAAD").unwrap();
        temp_file.write_all(&[0u8; 100]).unwrap();
        temp_file.flush().unwrap();

        let result = read_metadata_only(temp_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid archive format"));
    }

    #[test]
    fn test_read_metadata_only_oversized_metadata() {
        let mut temp_file = NamedTempFile::new().unwrap();

        // Write valid magic header
        temp_file.write_all(b"URB1").unwrap();

        // Write metadata length exceeding 1MB sanity check
        let huge_len = 2 * 1024 * 1024u32; // 2MB
        temp_file.write_all(&huge_len.to_le_bytes()).unwrap();

        // Write some padding (doesn't matter, length check triggers first)
        temp_file.write_all(&[0u8; 100]).unwrap();
        temp_file.flush().unwrap();

        let result = read_metadata_only(temp_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Metadata too large"));
    }

    #[test]
    fn test_salt_length_validation() {
        let mut temp_file = NamedTempFile::new().unwrap();

        // Write valid magic header
        temp_file.write_all(b"URB1").unwrap();

        // Write minimal valid metadata
        let metadata = ArchiveMetadata::new("1.0.0".to_string(), None, 0, 0, 0, 0, 0, 100);
        let metadata_json = serde_json::to_vec(&metadata).unwrap();
        let metadata_len = metadata_json.len() as u32;

        temp_file.write_all(&metadata_len.to_le_bytes()).unwrap();
        temp_file.write_all(&metadata_json).unwrap();

        // Write huge salt length that exceeds remaining file size
        let huge_salt_len = 999999u32;
        temp_file.write_all(&huge_salt_len.to_le_bytes()).unwrap();

        temp_file.flush().unwrap();

        let result = read_archive_metadata(temp_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("salt length exceeds file size"));
    }
}
