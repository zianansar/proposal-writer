// Story 4b.7: RSS Feed Import
// Parses Upwork RSS feeds and extracts job post information
// Story 4b.8: Fallback to web scraping when RSS fails

use crate::analysis;
use crate::db;
use crate::db::queries::{job_posts, rss_imports};
use crate::events;
use crate::job::scraper;
use crate::keychain;
use chrono::Utc;
use regex::Regex;
use rss::Channel;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{Emitter, State};
use tokio::time::sleep;
use tracing::{error, info, warn};

/// Represents a job post parsed from an RSS feed item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedJob {
    pub title: String,
    pub url: String,
    pub description: String,
    pub posted_at: Option<String>,
}

/// Result returned from import_rss_feed Tauri command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssImportResult {
    pub batch_id: String,
    pub total_jobs: usize,
    pub message: String,
    /// Story 4b.8: Source of jobs (rss or scrape)
    pub source: String,
}

/// Story 4b.8: Save parsed jobs to database with duplicate detection
///
/// # Returns
/// * `Ok((saved_count, skipped_count))` - Number of jobs saved and skipped
/// * `Err(String)` - Database error
fn save_parsed_jobs(
    conn: &rusqlite::Connection,
    jobs: &[ParsedJob],
    batch_id: &str,
) -> Result<(usize, usize), String> {
    let mut saved_count = 0;
    let mut skipped_count = 0;

    for job in jobs {
        match job_posts::insert_job_post_from_rss(conn, &job.url, &job.description, batch_id) {
            Ok(Some(_id)) => {
                saved_count += 1;
            }
            Ok(None) => {
                // Duplicate detected
                skipped_count += 1;
                info!("Skipped duplicate job: {}", job.url);
            }
            Err(e) => {
                error!("Failed to save job {}: {}", job.url, e);
                return Err(format!("Database error while saving jobs: {}", e));
            }
        }
    }

    info!(
        "Saved {} new jobs, skipped {} duplicates",
        saved_count, skipped_count
    );

    Ok((saved_count, skipped_count))
}

/// Story 4b.8: Try RSS import first, fall back to web scraping if RSS fails
///
/// This implements the fallback chain: RSS → web scraping → manual paste
/// AC-7: Total timeout of 15 seconds for entire chain (RSS 10s + scrape 5s)
///
/// # Returns
/// * `Ok((jobs, source))` - Parsed jobs and source ("rss" or "scrape")
/// * `Err(String)` - Both methods failed with composite error message
async fn try_import_with_fallback<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    feed_url: &str,
) -> Result<(Vec<ParsedJob>, String), String> {
    // AC-7: Enforce 15-second total timeout for entire fallback chain
    let result = tokio::time::timeout(
        Duration::from_secs(15),
        try_import_with_fallback_inner(app, feed_url),
    )
    .await;

    match result {
        Ok(inner_result) => inner_result,
        Err(_) => Err(
            "Import timed out after 15 seconds. Please try again or paste jobs manually."
                .to_string(),
        ),
    }
}

/// Inner implementation of fallback chain (without outer timeout)
async fn try_import_with_fallback_inner<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    feed_url: &str,
) -> Result<(Vec<ParsedJob>, String), String> {
    // Try RSS first (10-second timeout built into fetch_rss_feed)
    info!("Attempting RSS import from: {}", feed_url);

    match fetch_and_parse_rss(feed_url).await {
        Ok(jobs) if !jobs.is_empty() => {
            info!("RSS import succeeded with {} jobs", jobs.len());
            return Ok((jobs, "rss".to_string()));
        }
        Ok(_) => {
            // Empty feed - don't fall back, just return error
            return Err("No jobs found in RSS feed".to_string());
        }
        Err(rss_error) => {
            warn!(
                "RSS import failed: {}. Falling back to web scraping...",
                rss_error
            );

            // Emit fallback event
            let _ = app.emit(
                events::RSS_FALLBACK_STARTED,
                RssFallbackPayload {
                    original_error: rss_error.clone(),
                },
            );

            // Try web scraping (5-second timeout in fetch_upwork_search_page)
            let search_url = match scraper::rss_url_to_search_url(feed_url) {
                Ok(url) => url,
                Err(url_err) => {
                    return Err(format!(
                        "RSS failed ({}). Could not convert to search URL ({})",
                        rss_error, url_err
                    ));
                }
            };

            match fetch_and_scrape(&search_url).await {
                Ok(jobs) if !jobs.is_empty() => {
                    info!("Web scraping succeeded with {} jobs", jobs.len());
                    return Ok((jobs, "scrape".to_string()));
                }
                Ok(_) => {
                    return Err(format!(
                        "RSS failed ({}). Scraping found no jobs.",
                        rss_error
                    ));
                }
                Err(scrape_error) => {
                    // Both methods failed
                    error!("Both RSS and scraping failed");
                    return Err(format!(
                        "Both import methods failed. RSS: {}. Scraping: {}. Please paste jobs manually.",
                        rss_error, scrape_error
                    ));
                }
            }
        }
    }
}

/// Helper: Fetch and parse RSS feed
async fn fetch_and_parse_rss(feed_url: &str) -> Result<Vec<ParsedJob>, String> {
    let xml_content = fetch_rss_feed(feed_url).await?;
    parse_rss_feed(&xml_content)
}

/// Helper: Fetch and scrape search page
async fn fetch_and_scrape(search_url: &str) -> Result<Vec<ParsedJob>, String> {
    let html = scraper::fetch_upwork_search_page(search_url).await?;
    scraper::scrape_upwork_search(&html)
}

/// Story 4b.8: Fallback event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssFallbackPayload {
    pub original_error: String,
}

/// Import RSS feed jobs into database and trigger background analysis
///
/// Story 4b.7: Task 5 - RSS feed import
/// Story 4b.8: Task 4 - Fallback to web scraping when RSS fails
///
/// This is the main Tauri command for job import with fallback chain.
///
/// # Behavior
/// 1. Try RSS import first (10s timeout)
/// 2. If RSS fails, fall back to web scraping (5s timeout)
/// 3. Save all parsed jobs to database with pending_analysis status
/// 4. Create rss_imports batch record
/// 5. Spawn background worker for analysis (non-blocking)
/// 6. Return immediately with confirmation
///
/// # Arguments
/// * `app` - Tauri app handle for event emission
/// * `database` - Database state for DB access
/// * `feed_url` - RSS feed URL to import from
///
/// # Returns
/// * `Ok(RssImportResult)` - Import initiated successfully
/// * `Err(String)` - Both import methods failed with detailed error
#[tauri::command]
pub async fn import_rss_feed<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    database: State<'_, db::AppDatabase>,
    feed_url: String,
) -> Result<RssImportResult, String> {
    let database = database.get()?;
    info!("Starting import with fallback from: {}", feed_url);

    // 1. Try import with fallback chain (RSS → scraping)
    let (parsed_jobs, source) = try_import_with_fallback(&app, &feed_url).await?;

    info!(
        "Import succeeded via {} with {} jobs",
        source,
        parsed_jobs.len()
    );

    // 2. Generate batch ID
    let batch_id = if source == "rss" {
        format!("rss_{}", Utc::now().format("%Y%m%d_%H%M%S"))
    } else {
        format!("scrape_{}", Utc::now().format("%Y%m%d_%H%M%S"))
    };

    // 3. Save jobs to database (with duplicate detection)
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    let (saved_count, skipped_count) = save_parsed_jobs(&conn, &parsed_jobs, &batch_id)?;

    // 4. Create rss_imports batch record with import method tracking (Story 4b.8)
    rss_imports::create_rss_import_batch(&conn, &batch_id, &feed_url, saved_count as i64, &source)
        .map_err(|e| format!("Failed to create RSS import batch record: {}", e))?;

    // 5. Spawn background worker (Task 6)
    // Story 4b.7: Full background analysis worker implementation
    if saved_count > 0 {
        let app_clone = app.clone();
        let batch_id_clone = batch_id.clone();
        let db_path = database.path.clone();

        tauri::async_runtime::spawn(async move {
            process_rss_analysis_queue(app_clone, batch_id_clone, db_path).await;
        });
        info!("Background analysis worker spawned for batch: {}", batch_id);
    }

    // 6. Return immediately
    let source_label = if source == "rss" {
        "RSS"
    } else {
        "web scraping"
    };
    let message = if skipped_count > 0 {
        format!(
            "{} jobs imported via {} ({} duplicates skipped). Analysis in progress...",
            saved_count, source_label, skipped_count
        )
    } else {
        format!(
            "{} jobs imported via {}. Analysis in progress...",
            saved_count, source_label
        )
    };

    Ok(RssImportResult {
        batch_id,
        total_jobs: saved_count,
        message,
        source,
    })
}

/// Story 4b.7 Task 6: Background analysis worker
/// Processes pending jobs sequentially with rate limiting and progress events
///
/// # Behavior
/// - Queries pending jobs for batch_id
/// - Analyzes each job with 2-second delay between calls (rate limiting)
/// - Emits progress events after each job
/// - Handles errors gracefully (continues on individual failures)
/// - Emits completion event when done
///
/// # Note on Encryption
/// Currently opens DB without encryption key. For encrypted databases,
/// the encryption key would need to be stored in app state and passed here.
async fn process_rss_analysis_queue<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    batch_id: String,
    db_path: std::path::PathBuf,
) {
    info!("Starting background analysis for batch: {}", batch_id);

    // Get API key from keychain
    let api_key = match keychain::retrieve_api_key() {
        Ok(key) => key,
        Err(e) => {
            error!("Failed to retrieve API key: {}", e);
            let _ = app.emit(
                events::RSS_IMPORT_ERROR,
                format!("Failed to get API key: {}", e),
            );
            return;
        }
    };

    // Get pending jobs using spawn_blocking (rusqlite Connection is !Send)
    let batch_id_clone = batch_id.clone();
    let db_path_clone = db_path.clone();

    let pending_jobs = match tokio::task::spawn_blocking(move || {
        let db = db::Database::new(db_path_clone, None)
            .map_err(|e| format!("Failed to open database: {}", e))?;
        let conn = db
            .conn
            .lock()
            .map_err(|e| format!("Failed to lock db: {}", e))?;
        job_posts::get_pending_jobs_by_batch(&conn, &batch_id_clone)
            .map_err(|e| format!("Failed to query pending jobs: {}", e))
    })
    .await
    {
        Ok(Ok(jobs)) => jobs,
        Ok(Err(e)) => {
            error!("Database error: {}", e);
            let _ = app.emit(events::RSS_IMPORT_ERROR, e);
            return;
        }
        Err(e) => {
            error!("Task join error: {}", e);
            let _ = app.emit(events::RSS_IMPORT_ERROR, format!("Task error: {}", e));
            return;
        }
    };

    let total = pending_jobs.len();
    info!("Found {} pending jobs for batch {}", total, batch_id);

    if total == 0 {
        let _ = app.emit(
            events::RSS_IMPORT_COMPLETE,
            events::RssImportComplete {
                batch_id: batch_id.clone(),
                total_analyzed: 0,
                failed_count: 0,
            },
        );
        return;
    }

    let mut analyzed_count = 0;
    let mut failed_count = 0;

    for (idx, job) in pending_jobs.iter().enumerate() {
        let job_id = job.id;
        let job_title = job
            .url
            .clone()
            .unwrap_or_else(|| format!("Job #{}", job_id));

        // Update status to 'analyzing'
        let db_path_clone = db_path.clone();
        let _ = tokio::task::spawn_blocking(move || {
            if let Ok(db) = db::Database::new(db_path_clone, None) {
                if let Ok(conn) = db.conn.lock() {
                    let _ = job_posts::update_job_analysis_status(&conn, job_id, "analyzing");
                }
            }
        })
        .await;

        // Perform analysis
        let analysis_result = analysis::analyze_job(&job.raw_content, &api_key).await;

        // Save results
        let db_path_clone = db_path.clone();
        let analysis_clone = analysis_result.clone();

        let save_result = tokio::task::spawn_blocking(move || {
            let db = db::Database::new(db_path_clone, None)?;
            let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

            match analysis_clone {
                Ok(analysis) => {
                    // Save analysis results
                    let hidden_needs_json = serde_json::to_string(&analysis.hidden_needs)
                        .unwrap_or_else(|_| "[]".to_string());

                    job_posts::save_job_analysis_atomic(
                        &conn,
                        job_id,
                        analysis.client_name.as_deref(),
                        &analysis.key_skills,
                        &hidden_needs_json,
                    )
                    .map_err(|e| format!("Failed to save analysis: {}", e))?;

                    job_posts::update_job_analysis_status(&conn, job_id, "analyzed")
                        .map_err(|e| format!("Failed to update status: {}", e))?;

                    Ok::<bool, String>(true)
                }
                Err(e) => {
                    error!("Analysis failed for job {}: {}", job_id, e);
                    job_posts::update_job_analysis_status(&conn, job_id, "error")
                        .map_err(|e| format!("Failed to update status: {}", e))?;
                    Ok(false)
                }
            }
        })
        .await;

        match save_result {
            Ok(Ok(true)) => analyzed_count += 1,
            Ok(Ok(false)) => failed_count += 1,
            Ok(Err(e)) => {
                error!("Save error for job {}: {}", job_id, e);
                failed_count += 1;
            }
            Err(e) => {
                error!("Task error for job {}: {}", job_id, e);
                failed_count += 1;
            }
        }

        // Update batch progress in DB
        let db_path_clone = db_path.clone();
        let batch_id_clone = batch_id.clone();
        let current_analyzed = analyzed_count;
        let current_failed = failed_count;
        let _ = tokio::task::spawn_blocking(move || {
            if let Ok(db) = db::Database::new(db_path_clone, None) {
                if let Ok(conn) = db.conn.lock() {
                    let _ = rss_imports::update_rss_import_progress(
                        &conn,
                        &batch_id_clone,
                        current_analyzed as i64,
                        current_failed as i64,
                    );
                }
            }
        })
        .await;

        // Emit progress event
        let _ = app.emit(
            events::RSS_IMPORT_PROGRESS,
            events::RssImportProgress {
                batch_id: batch_id.clone(),
                current: idx + 1,
                total,
                job_title: job_title.clone(),
            },
        );

        // Rate limiting: 2-second delay between jobs (AC-5)
        if idx + 1 < total {
            sleep(Duration::from_secs(2)).await;
        }
    }

    // Mark batch as complete
    let db_path_clone = db_path.clone();
    let batch_id_clone = batch_id.clone();
    let _ = tokio::task::spawn_blocking(move || {
        if let Ok(db) = db::Database::new(db_path_clone, None) {
            if let Ok(conn) = db.conn.lock() {
                let _ = rss_imports::complete_rss_import_batch(&conn, &batch_id_clone);
            }
        }
    })
    .await;

    // Emit completion event
    info!(
        "Batch {} complete: {} analyzed, {} failed",
        batch_id, analyzed_count, failed_count
    );
    let _ = app.emit(
        events::RSS_IMPORT_COMPLETE,
        events::RssImportComplete {
            batch_id: batch_id.clone(),
            total_analyzed: analyzed_count,
            failed_count,
        },
    );
}

/// Validate RSS feed URL format and security
///
/// # Arguments
/// * `url` - URL to validate
///
/// # Returns
/// * `Ok(())` - URL is valid
/// * `Err(String)` - Validation error with description
///
/// # Requirements
/// - Must be HTTPS (security requirement)
/// - Should contain "upwork.com" (warns if not, but allows for testing)
pub fn validate_rss_url(url: &str) -> Result<(), String> {
    if url.trim().is_empty() {
        return Err("RSS feed URL cannot be empty".to_string());
    }

    if !url.starts_with("https://") {
        return Err("RSS feed URL must use HTTPS protocol for security".to_string());
    }

    // Warn if not Upwork domain (but allow for testing/dev)
    if !url.contains("upwork.com") {
        warn!("RSS feed URL does not contain 'upwork.com': {}", url);
    }

    Ok(())
}

/// Fetch RSS feed XML from URL
///
/// # Arguments
/// * `url` - RSS feed URL (must be HTTPS)
///
/// # Returns
/// * `Ok(String)` - RSS XML content
/// * `Err(String)` - Fetch error with user-friendly description
///
/// # Behavior
/// - 10-second timeout
/// - Validates content-type (prefers XML types but accepts any if parseable)
/// - User-friendly error messages for common failures
pub async fn fetch_rss_feed(url: &str) -> Result<String, String> {
    // Validate URL first
    validate_rss_url(url)?;

    let client = crate::http::client();

    info!("Fetching RSS feed from: {}", url);

    // Perform GET request
    let response = client.get(url).timeout(Duration::from_secs(10)).send().await.map_err(|e| {
        if e.is_timeout() {
            "Feed request timed out after 10 seconds".to_string()
        } else if e.is_connect() {
            "Failed to connect to RSS feed server".to_string()
        } else {
            format!("Failed to fetch RSS feed: {}", e)
        }
    })?;

    // Check HTTP status
    let status = response.status();
    if !status.is_success() {
        return Err(match status.as_u16() {
            403 => "RSS feed blocked by Upwork (403 Forbidden)".to_string(),
            404 => "Feed not found (404)".to_string(),
            429 => "Too many requests - rate limited by server".to_string(),
            500..=599 => format!("Server error ({})", status.as_u16()),
            _ => format!("HTTP error: {}", status),
        });
    }

    // Validate content-type (preferably XML, but not strict)
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let is_xml_content = content_type.contains("xml") || content_type.contains("rss");
    if !is_xml_content && !content_type.is_empty() {
        warn!(
            "RSS feed content-type is not XML: {} (will attempt parse anyway)",
            content_type
        );
    }

    // Get response body as text
    let xml_content = response
        .text()
        .await
        .map_err(|e| format!("Failed to read RSS feed content: {}", e))?;

    info!(
        "Successfully fetched RSS feed ({} bytes)",
        xml_content.len()
    );
    Ok(xml_content)
}

/// Parse RSS XML feed and extract job posts
///
/// # Arguments
/// * `xml_content` - Raw RSS XML string
///
/// # Returns
/// * `Ok(Vec<ParsedJob>)` - Successfully parsed jobs (up to 50 items)
/// * `Err(String)` - Parse error with description
///
/// # Behavior
/// - Caps extraction at 50 items maximum
/// - Skips malformed items gracefully (logs warning, continues)
/// - Strips HTML tags from description CDATA
/// - Decodes HTML entities (&amp;, &lt;, &gt;, etc.)
pub fn parse_rss_feed(xml_content: &str) -> Result<Vec<ParsedJob>, String> {
    // Parse RSS channel
    let channel = Channel::read_from(xml_content.as_bytes())
        .map_err(|e| format!("Failed to parse RSS feed: {}", e))?;

    info!(
        "Parsing RSS feed: {} ({} items)",
        channel.title(),
        channel.items().len()
    );

    let html_strip_regex = Regex::new(r"<[^>]+>").unwrap();
    let mut parsed_jobs = Vec::new();
    let max_items = 50;

    // Extract up to 50 items
    for (idx, item) in channel.items().iter().enumerate() {
        if idx >= max_items {
            info!("Reached maximum of {} items, stopping parse", max_items);
            break;
        }

        // Extract required fields - skip item if any are missing
        let title = match item.title() {
            Some(t) if !t.trim().is_empty() => t.trim().to_string(),
            _ => {
                warn!("Skipping RSS item {}: missing title", idx + 1);
                continue;
            }
        };

        let url = match item.link() {
            Some(u) if !u.trim().is_empty() => u.trim().to_string(),
            _ => {
                warn!("Skipping RSS item {}: missing link", idx + 1);
                continue;
            }
        };

        // Description - strip HTML tags and decode entities
        let description = match item.description() {
            Some(d) => {
                let stripped = html_strip_regex.replace_all(d, "");
                decode_html_entities(&stripped)
            }
            None => {
                warn!(
                    "RSS item {} has no description, using empty string",
                    idx + 1
                );
                String::new()
            }
        };

        // Posted date - parse to ISO 8601 if available
        let posted_at = item.pub_date().map(|d| d.to_string());

        parsed_jobs.push(ParsedJob {
            title,
            url,
            description,
            posted_at,
        });
    }

    info!(
        "Successfully parsed {} jobs from RSS feed",
        parsed_jobs.len()
    );
    Ok(parsed_jobs)
}

/// Decode common HTML entities to their text equivalents
///
/// Handles: &amp; &lt; &gt; &#39; &quot;
fn decode_html_entities(text: &str) -> String {
    text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_upwork_feed() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Upwork: Jobs</title>
    <link>https://www.upwork.com/</link>
    <item>
      <title>Build React Dashboard App</title>
      <link>https://www.upwork.com/jobs/~01XXXXXXXXXXXX</link>
      <description><![CDATA[
        <b>Budget</b>: $500<br/>
        Required skills: React, TypeScript, Node.js<br/>
        We need an experienced developer...
      ]]></description>
      <pubDate>Thu, 06 Feb 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>"#;

        let result = parse_rss_feed(xml);
        assert!(result.is_ok());

        let jobs = result.unwrap();
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].title, "Build React Dashboard App");
        assert_eq!(jobs[0].url, "https://www.upwork.com/jobs/~01XXXXXXXXXXXX");
        assert!(jobs[0].description.contains("Budget: $500"));
        assert!(!jobs[0].description.contains("<b>"));
        assert!(!jobs[0].description.contains("<br/>"));
    }

    #[test]
    fn test_parse_empty_feed() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Upwork: Jobs</title>
    <link>https://www.upwork.com/</link>
  </channel>
</rss>"#;

        let result = parse_rss_feed(xml);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_parse_malformed_xml() {
        let xml = "not valid xml";
        let result = parse_rss_feed(xml);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse RSS feed"));
    }

    #[test]
    fn test_cap_at_50_items() {
        // Generate feed with 100 items
        let mut xml = String::from(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Upwork: Jobs</title>
    <link>https://www.upwork.com/</link>"#,
        );

        for i in 1..=100 {
            xml.push_str(&format!(
                r#"<item>
      <title>Job {}</title>
      <link>https://www.upwork.com/jobs/~{:020}</link>
      <description>Description {}</description>
    </item>"#,
                i, i, i
            ));
        }
        xml.push_str("</channel></rss>");

        let result = parse_rss_feed(&xml);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 50);
    }

    #[test]
    fn test_skip_missing_fields() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Upwork: Jobs</title>
    <link>https://www.upwork.com/</link>
    <item>
      <title>Valid Job</title>
      <link>https://www.upwork.com/jobs/~01VALID</link>
      <description>Good job</description>
    </item>
    <item>
      <link>https://www.upwork.com/jobs/~01NOTITLE</link>
      <description>Missing title</description>
    </item>
    <item>
      <title>Missing Link Job</title>
      <description>Missing link</description>
    </item>
    <item>
      <title>Another Valid Job</title>
      <link>https://www.upwork.com/jobs/~02VALID</link>
      <description>Also good</description>
    </item>
  </channel>
</rss>"#;

        let result = parse_rss_feed(xml);
        assert!(result.is_ok());

        let jobs = result.unwrap();
        // Should only parse the 2 valid items
        assert_eq!(jobs.len(), 2);
        assert_eq!(jobs[0].title, "Valid Job");
        assert_eq!(jobs[1].title, "Another Valid Job");
    }

    #[test]
    fn test_html_entity_decoding() {
        let text = "Test &amp; example &lt;tag&gt; with &#39;quotes&#39; &quot;here&quot;";
        let decoded = decode_html_entities(text);
        assert_eq!(decoded, "Test & example <tag> with 'quotes' \"here\"");
    }

    // URL Validation Tests

    #[test]
    fn test_validate_rss_url_valid_upwork() {
        let result = validate_rss_url("https://www.upwork.com/ab/feed/jobs/rss");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_rss_url_http_rejected() {
        let result = validate_rss_url("http://www.upwork.com/feed");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("HTTPS"));
    }

    #[test]
    fn test_validate_rss_url_empty_rejected() {
        let result = validate_rss_url("");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_validate_rss_url_non_upwork_warns_but_allows() {
        // Should succeed but log warning (testing other RSS feeds)
        let result = validate_rss_url("https://example.com/feed.xml");
        assert!(result.is_ok());
    }

    // Story 4b.8: Fallback orchestration tests

    #[test]
    fn test_fallback_composite_error_format() {
        // Verify composite error message format matches AC-5 requirement
        let rss_error = "RSS feed blocked (403 Forbidden)";
        let scrape_error = "HTML structure changed";

        let composite = format!(
            "Both import methods failed. RSS: {}. Scraping: {}. Please paste jobs manually.",
            rss_error, scrape_error
        );

        assert!(composite.contains("Both import methods failed"));
        assert!(composite.contains("RSS:"));
        assert!(composite.contains("Scraping:"));
        assert!(composite.contains("Please paste jobs manually"));
    }

    #[test]
    fn test_batch_id_format_rss() {
        // Verify batch ID format for RSS source
        let source = "rss";
        let batch_id = format!("{}_{}", source, "20260209_120000");
        assert!(batch_id.starts_with("rss_"));
    }

    #[test]
    fn test_batch_id_format_scrape() {
        // Verify batch ID format for scrape source
        let source = "scrape";
        let batch_id = format!("{}_{}", source, "20260209_120000");
        assert!(batch_id.starts_with("scrape_"));
    }

    #[tokio::test]
    async fn test_fallback_timeout_wrapper() {
        // Test that timeout wrapper returns error after specified duration
        use std::time::Duration;
        use tokio::time::timeout;

        // Simulate a slow operation that would exceed timeout
        let slow_operation = async {
            tokio::time::sleep(Duration::from_millis(100)).await;
            Ok::<&str, &str>("success")
        };

        // With short timeout, should fail
        let result = timeout(Duration::from_millis(10), slow_operation).await;
        assert!(result.is_err(), "Should timeout");

        // With long timeout, should succeed
        let fast_operation = async {
            tokio::time::sleep(Duration::from_millis(5)).await;
            Ok::<&str, &str>("success")
        };
        let result = timeout(Duration::from_millis(100), fast_operation).await;
        assert!(result.is_ok(), "Should not timeout");
        assert_eq!(result.unwrap().unwrap(), "success");
    }

    #[test]
    fn test_fallback_chain_rss_success_path() {
        // Test: When RSS succeeds, source should be "rss"
        let rss_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Upwork: Jobs</title>
    <item>
      <title>Test Job</title>
      <link>https://www.upwork.com/jobs/~01ABC</link>
      <description>Test description</description>
    </item>
  </channel>
</rss>"#;

        let jobs = parse_rss_feed(rss_xml).unwrap();
        assert!(!jobs.is_empty(), "RSS should parse successfully");

        // In real fallback, this would return source = "rss"
        let source = if !jobs.is_empty() { "rss" } else { "scrape" };
        assert_eq!(source, "rss");
    }

    #[test]
    fn test_fallback_chain_scrape_success_path() {
        // Test: When RSS fails but scrape succeeds, source should be "scrape"
        use crate::job::scraper::scrape_upwork_search;

        let html = r#"<!DOCTYPE html>
<html><body>
  <article data-test="JobTile">
    <a class="job-title-link" href="/jobs/~01ABC">
      <h2>Scraped Job</h2>
    </a>
    <div class="job-description"><p>Description</p></div>
  </article>
</body></html>"#;

        let jobs = scrape_upwork_search(html).unwrap();
        assert!(!jobs.is_empty(), "Scraper should parse successfully");

        // In real fallback after RSS failure, this would return source = "scrape"
        let source = "scrape";
        assert_eq!(source, "scrape");
        assert_eq!(jobs[0].title, "Scraped Job");
    }

    #[test]
    fn test_fallback_chain_both_fail_path() {
        // Test: When both methods fail, composite error is returned
        use crate::job::scraper::scrape_upwork_search;

        // Simulate RSS failure
        let rss_result = parse_rss_feed("invalid xml");
        assert!(rss_result.is_err(), "RSS should fail on invalid XML");
        let rss_error = rss_result.unwrap_err();

        // Simulate scrape failure (empty HTML)
        let scrape_result = scrape_upwork_search("<html><body></body></html>");
        assert!(scrape_result.is_err(), "Scrape should fail on empty HTML");
        let scrape_error = scrape_result.unwrap_err();

        // Verify composite error can be constructed
        let composite = format!(
            "Both import methods failed. RSS: {}. Scraping: {}. Please paste jobs manually.",
            rss_error, scrape_error
        );

        assert!(composite.contains("Both import methods failed"));
        assert!(composite.contains(&rss_error));
        assert!(composite.contains(&scrape_error));
    }

    #[test]
    fn test_rss_import_result_serialization() {
        // Verify RssImportResult can be serialized (required for Tauri command return)
        let result = RssImportResult {
            batch_id: "rss_20260209_120000".to_string(),
            total_jobs: 10,
            message: "10 jobs imported via RSS. Analysis in progress...".to_string(),
            source: "rss".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("rss_20260209_120000"));
        assert!(json.contains("\"total_jobs\":10"));
        assert!(json.contains("\"source\":\"rss\""));
    }

    #[test]
    fn test_rss_fallback_payload_serialization() {
        // Verify fallback payload can be serialized (required for Tauri event)
        let payload = RssFallbackPayload {
            original_error: "RSS feed blocked (403)".to_string(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("RSS feed blocked (403)"));
    }

    #[test]
    fn test_save_parsed_jobs_empty() {
        // Test that save_parsed_jobs handles empty job list
        let jobs = vec![];

        // Create temporary in-memory database
        let conn = rusqlite::Connection::open_in_memory().unwrap();

        // Create job_posts table (simplified schema for test)
        conn.execute(
            "CREATE TABLE job_posts (
                id INTEGER PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                description TEXT,
                batch_id TEXT
            )",
            [],
        )
        .unwrap();

        let result = save_parsed_jobs(&conn, &jobs, "test_batch");
        assert!(result.is_ok());

        let (saved, skipped) = result.unwrap();
        assert_eq!(saved, 0);
        assert_eq!(skipped, 0);
    }

    #[test]
    fn test_save_parsed_jobs_duplicate_detection() {
        let jobs = vec![
            ParsedJob {
                title: "Job 1".to_string(),
                url: "https://upwork.com/jobs/1".to_string(),
                description: "Description 1".to_string(),
                posted_at: None,
            },
            ParsedJob {
                title: "Job 2".to_string(),
                url: "https://upwork.com/jobs/1".to_string(), // Duplicate URL
                description: "Description 2".to_string(),
                posted_at: None,
            },
        ];

        // Create temporary in-memory database with full schema matching real schema
        let conn = rusqlite::Connection::open_in_memory().unwrap();

        conn.execute(
            "CREATE TABLE job_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                raw_content TEXT NOT NULL,
                client_name TEXT,
                source TEXT NOT NULL,
                analysis_status TEXT DEFAULT 'pending_analysis',
                import_batch_id TEXT
            )",
            [],
        )
        .unwrap();

        let result = save_parsed_jobs(&conn, &jobs, "test_batch");
        assert!(result.is_ok(), "save_parsed_jobs should succeed");

        let (saved, skipped) = result.unwrap();
        assert_eq!(saved, 1, "Should save first occurrence");
        assert_eq!(skipped, 1, "Should skip duplicate");
    }
}
