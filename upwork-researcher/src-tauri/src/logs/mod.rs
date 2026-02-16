pub mod redaction;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialize logging infrastructure with file rotation and console output
///
/// Creates logs directory in app_data and sets up daily rotating log files.
/// Log level can be configured via settings (default: INFO).
///
/// # Arguments
/// * `app_data_dir` - Application data directory path
/// * `log_level` - Optional log level (ERROR, WARN, INFO, DEBUG). Defaults to INFO.
///
/// # Returns
/// * `Ok(PathBuf)` - Path to logs directory
/// * `Err(String)` - Error message if initialization fails
pub fn init_logging(
    app_data_dir: impl AsRef<Path>,
    log_level: Option<&str>,
) -> Result<PathBuf, String> {
    let logs_dir = ensure_logs_directory(app_data_dir.as_ref())?;

    // Parse log level from setting or use INFO as default
    let level = log_level.unwrap_or("INFO");
    let filter = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(level))
        .map_err(|e| format!("Invalid log level '{}': {}", level, e))?;

    // Daily rotating file appender
    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("app")
        .filename_suffix("log")
        .build(&logs_dir)
        .map_err(|e| format!("Failed to create file appender: {}", e))?;

    let file_layer = fmt::layer()
        .with_writer(file_appender)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false)
        .with_file(true)
        .with_line_number(true);

    // Console output only in debug builds
    #[cfg(debug_assertions)]
    {
        let console_layer = fmt::layer()
            .with_target(true)
            .with_thread_ids(false)
            .with_file(false)
            .with_line_number(false);

        tracing_subscriber::registry()
            .with(filter)
            .with(file_layer)
            .with(console_layer)
            .init();
    }

    #[cfg(not(debug_assertions))]
    {
        tracing_subscriber::registry()
            .with(filter)
            .with(file_layer)
            .init();
    }

    Ok(logs_dir)
}

/// Ensure logs directory exists in app_data
///
/// Creates {app_data}/logs/ directory if it doesn't exist.
///
/// # Arguments
/// * `app_data_dir` - Application data directory path
///
/// # Returns
/// * `Ok(PathBuf)` - Path to logs directory
/// * `Err(String)` - Error message if directory creation fails
pub fn ensure_logs_directory(app_data_dir: &Path) -> Result<PathBuf, String> {
    let logs_dir = app_data_dir.join("logs");

    if !logs_dir.exists() {
        fs::create_dir_all(&logs_dir)
            .map_err(|e| format!("Failed to create logs directory: {}", e))?;
    }

    Ok(logs_dir)
}

/// Clean up log files older than 7 days
///
/// Iterates through logs directory and deletes files modified more than 7 days ago.
/// Non-blocking: errors are logged but don't prevent app startup.
///
/// # Arguments
/// * `logs_dir` - Path to logs directory
///
/// # Returns
/// * `Ok(usize)` - Number of files deleted
/// * `Err(String)` - Error message if cleanup fails (non-fatal)
pub fn cleanup_old_logs(logs_dir: &Path) -> Result<usize, String> {
    if !logs_dir.exists() {
        return Ok(0);
    }

    let retention_duration = Duration::from_secs(7 * 24 * 60 * 60); // 7 days
    let now = SystemTime::now();
    let mut deleted_count = 0;

    let entries =
        fs::read_dir(logs_dir).map_err(|e| format!("Failed to read logs directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Only process .log files
        if !path.is_file() || path.extension().and_then(|s| s.to_str()) != Some("log") {
            continue;
        }

        // Check file modification time
        let metadata = fs::metadata(&path)
            .map_err(|e| format!("Failed to read file metadata for {:?}: {}", path, e))?;

        let modified = metadata
            .modified()
            .map_err(|e| format!("Failed to get modification time for {:?}: {}", path, e))?;

        if let Ok(age) = now.duration_since(modified) {
            if age > retention_duration {
                match fs::remove_file(&path) {
                    Ok(_) => {
                        deleted_count += 1;
                        tracing::info!("Deleted old log file: {:?}", path);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to delete old log file {:?}: {}", path, e);
                    }
                }
            }
        }
    }

    Ok(deleted_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_ensure_logs_directory() {
        let temp_dir = TempDir::new().unwrap();
        let app_data = temp_dir.path();

        let logs_dir = ensure_logs_directory(app_data).unwrap();

        assert!(logs_dir.exists());
        assert!(logs_dir.is_dir());
        assert_eq!(logs_dir, app_data.join("logs"));
    }

    #[test]
    fn test_logs_directory_created_with_init() {
        let temp_dir = TempDir::new().unwrap();
        let app_data = temp_dir.path();

        // Verify directory doesn't exist before init
        let logs_dir = app_data.join("logs");
        assert!(!logs_dir.exists());

        // Note: Cannot test full init_logging() as it initializes global subscriber
        // which can only be done once per process. Testing ensure_logs_directory instead.
        let result = ensure_logs_directory(app_data).unwrap();

        assert!(result.exists());
        assert_eq!(result, logs_dir);
    }

    #[test]
    fn test_log_level_configuration() {
        // Test that valid log levels can be configured
        // Only ERROR, WARN, INFO, DEBUG are allowed per set_log_level validation
        assert!(EnvFilter::try_new("ERROR").is_ok());
        assert!(EnvFilter::try_new("WARN").is_ok());
        assert!(EnvFilter::try_new("INFO").is_ok());
        assert!(EnvFilter::try_new("DEBUG").is_ok());

        // EnvFilter accepts module-specific filters, so custom strings are valid
        // The validation happens in set_log_level command instead
        assert!(EnvFilter::try_new("my_crate=debug").is_ok());
    }

    #[test]
    fn test_ensure_logs_directory_already_exists() {
        let temp_dir = TempDir::new().unwrap();
        let app_data = temp_dir.path();
        let logs_dir = app_data.join("logs");
        fs::create_dir_all(&logs_dir).unwrap();

        let result = ensure_logs_directory(app_data).unwrap();

        assert_eq!(result, logs_dir);
        assert!(result.exists());
    }

    #[test]
    fn test_cleanup_old_logs_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();

        let deleted = cleanup_old_logs(&logs_dir).unwrap();

        assert_eq!(deleted, 0);
    }

    #[test]
    fn test_cleanup_old_logs_recent_files() {
        let temp_dir = TempDir::new().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();

        // Create a recent log file
        let log_file = logs_dir.join("app-2026-02-04.log");
        File::create(&log_file)
            .unwrap()
            .write_all(b"test log")
            .unwrap();

        let deleted = cleanup_old_logs(&logs_dir).unwrap();

        assert_eq!(deleted, 0);
        assert!(log_file.exists());
    }

    #[test]
    fn test_cleanup_old_logs_old_files() {
        let temp_dir = TempDir::new().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();

        // Create a log file
        let log_file = logs_dir.join("app-2026-01-01.log");
        File::create(&log_file)
            .unwrap()
            .write_all(b"old log")
            .unwrap();

        // Set file modification time to 8 days ago
        let eight_days_ago = SystemTime::now() - Duration::from_secs(8 * 24 * 60 * 60);
        filetime::set_file_mtime(
            &log_file,
            filetime::FileTime::from_system_time(eight_days_ago),
        )
        .unwrap();

        let deleted = cleanup_old_logs(&logs_dir).unwrap();

        assert_eq!(deleted, 1);
        assert!(!log_file.exists());
    }

    #[test]
    fn test_cleanup_ignores_non_log_files() {
        let temp_dir = TempDir::new().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();

        // Create non-log files
        let txt_file = logs_dir.join("readme.txt");
        let json_file = logs_dir.join("config.json");
        File::create(&txt_file)
            .unwrap()
            .write_all(b"readme")
            .unwrap();
        File::create(&json_file).unwrap().write_all(b"{}").unwrap();

        // Set files to old dates
        let eight_days_ago = SystemTime::now() - Duration::from_secs(8 * 24 * 60 * 60);
        filetime::set_file_mtime(
            &txt_file,
            filetime::FileTime::from_system_time(eight_days_ago),
        )
        .unwrap();
        filetime::set_file_mtime(
            &json_file,
            filetime::FileTime::from_system_time(eight_days_ago),
        )
        .unwrap();

        let deleted = cleanup_old_logs(&logs_dir).unwrap();

        assert_eq!(deleted, 0);
        assert!(txt_file.exists());
        assert!(json_file.exists());
    }

    #[test]
    fn test_cleanup_nonexistent_directory() {
        let temp_dir = TempDir::new().unwrap();
        let logs_dir = temp_dir.path().join("nonexistent");

        let result = cleanup_old_logs(&logs_dir);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }
}
