// Story 4b.8: Web Scraping Fallback
// Scrapes Upwork search pages when RSS feeds are blocked

use crate::job::rss::ParsedJob;
use scraper::{Html, Selector};
use std::collections::HashSet;
use std::time::Duration;
use tracing::{info, warn};

/// Convert RSS feed URL to equivalent search page URL
///
/// # Arguments
/// * `rss_url` - Upwork RSS feed URL (e.g., https://www.upwork.com/ab/feed/jobs/rss?q=react)
///
/// # Returns
/// * `Ok(String)` - Search page URL (e.g., https://www.upwork.com/nx/search/jobs/?q=react)
/// * `Err(String)` - URL parse error
///
/// # Example
/// ```
/// let rss = "https://www.upwork.com/ab/feed/jobs/rss?q=react+developer&sort=recency";
/// let search = rss_url_to_search_url(rss)?;
/// // Result: "https://www.upwork.com/nx/search/jobs/?q=react+developer&sort=recency"
/// ```
pub fn rss_url_to_search_url(rss_url: &str) -> Result<String, String> {
    // Parse URL to extract query parameters
    let url = url::Url::parse(rss_url).map_err(|e| format!("Failed to parse RSS URL: {}", e))?;

    // Extract query string from RSS URL
    let query_string = url.query().unwrap_or("");

    // Construct search page URL with same query parameters
    Ok(format!(
        "https://www.upwork.com/nx/search/jobs/?{}",
        query_string
    ))
}

/// Fetch Upwork search page HTML from URL
///
/// # Arguments
/// * `search_url` - Search page URL (from rss_url_to_search_url)
///
/// # Returns
/// * `Ok(String)` - HTML content of search page
/// * `Err(String)` - HTTP error with user-friendly description
///
/// # Behavior
/// - 5-second timeout (separate from RSS 10s timeout)
/// - Browser-like User-Agent header to avoid immediate blocking
/// - Specific error messages for common HTTP status codes
pub async fn fetch_upwork_search_page(search_url: &str) -> Result<String, String> {
    info!("Fetching Upwork search page: {}", search_url);

    let client = crate::http::client();

    // Perform GET request with browser-like headers
    let response = client
        .get(search_url)
        .timeout(Duration::from_secs(5))
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .header("Accept", "text/html,application/xhtml+xml")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Scrape request timed out after 5 seconds".to_string()
            } else if e.is_connect() {
                "Failed to connect to Upwork search page".to_string()
            } else {
                format!("Failed to fetch search page: {}", e)
            }
        })?;

    // Check HTTP status
    let status = response.status();
    if !status.is_success() {
        return Err(match status.as_u16() {
            403 => "Upwork blocked scraping (403 Forbidden)".to_string(),
            404 => "Search page not found (404)".to_string(),
            429 => "Rate limited by Upwork - too many requests".to_string(),
            500..=599 => format!("Upwork server error ({})", status.as_u16()),
            _ => format!("HTTP error: {}", status),
        });
    }

    // Get response body as text
    let html_content = response
        .text()
        .await
        .map_err(|e| format!("Failed to read search page content: {}", e))?;

    info!(
        "Successfully fetched search page ({} bytes)",
        html_content.len()
    );

    Ok(html_content)
}

/// CSS selectors for Upwork job cards (Feb 2026 structure)
///
/// Primary selectors with fallbacks for resilience
const JOB_CARD_SELECTOR: &str = "article[data-test='JobTile']";
const TITLE_SELECTORS: &[&str] = &["a.job-title-link h2", ".job-title", "h2"];
const LINK_SELECTORS: &[&str] = &["a.job-title-link", "a[href*='/jobs/~']"];
const DESCRIPTION_SELECTORS: &[&str] = &[".job-description p", ".job-description", "p"];

/// Scrape Upwork search page HTML and extract job posts
///
/// # Arguments
/// * `html` - Raw HTML from Upwork search page
///
/// # Returns
/// * `Ok(Vec<ParsedJob>)` - Successfully scraped jobs (up to 50 items)
/// * `Err(String)` - Parse error or selector failure
///
/// # Behavior
/// - Caps extraction at 50 items maximum (same as RSS)
/// - Skips malformed items gracefully (logs warning, continues)
/// - Detects duplicate URLs and skips them
/// - Returns error if >80% of expected items fail to parse (indicates Upwork changed HTML)
pub fn scrape_upwork_search(html: &str) -> Result<Vec<ParsedJob>, String> {
    let document = Html::parse_document(html);

    let job_card_selector = Selector::parse(JOB_CARD_SELECTOR)
        .map_err(|e| format!("Invalid job card selector: {}", e))?;

    let job_cards: Vec<_> = document.select(&job_card_selector).collect();
    let total_cards = job_cards.len();

    if total_cards == 0 {
        return Err("No job cards found - Upwork HTML structure may have changed".to_string());
    }

    info!("Found {} job cards in HTML", total_cards);

    let mut parsed_jobs = Vec::new();
    let mut seen_urls = HashSet::new();
    let mut failed_count = 0;
    let max_items = 50;

    for (idx, card) in job_cards.iter().enumerate() {
        if parsed_jobs.len() >= max_items {
            info!("Reached maximum of {} items, stopping scrape", max_items);
            break;
        }

        // Extract title using fallback selectors
        let title = match try_selectors(card, TITLE_SELECTORS) {
            Some(t) if !t.trim().is_empty() => t.trim().to_string(),
            _ => {
                warn!("Job card {}: missing title", idx + 1);
                failed_count += 1;
                continue;
            }
        };

        // Extract job URL using fallback selectors
        let url = match try_link_selectors(card, LINK_SELECTORS) {
            Some(u) if !u.trim().is_empty() => {
                // Convert relative URLs to absolute
                let full_url = if u.starts_with("http") {
                    u
                } else if u.starts_with('/') {
                    format!("https://www.upwork.com{}", u)
                } else {
                    format!("https://www.upwork.com/{}", u)
                };
                full_url.trim().to_string()
            }
            _ => {
                warn!("Job card {}: missing link", idx + 1);
                failed_count += 1;
                continue;
            }
        };

        // Skip duplicate URLs
        if seen_urls.contains(&url) {
            info!("Skipping duplicate job URL: {}", url);
            continue;
        }
        seen_urls.insert(url.clone());

        // Extract description using fallback selectors
        let description = try_selectors(card, DESCRIPTION_SELECTORS).unwrap_or_else(|| {
            warn!("Job card {} has no description", idx + 1);
            String::new()
        });

        parsed_jobs.push(ParsedJob {
            title,
            url,
            description,
            posted_at: None, // HTML doesn't include posted date like RSS does
        });
    }

    // Check if >80% of cards failed to parse (indicates Upwork changed HTML)
    let fail_rate = (failed_count as f64) / (total_cards as f64);
    if fail_rate > 0.8 {
        return Err(format!(
            "Failed to parse {}% of job cards - Upwork HTML structure likely changed",
            (fail_rate * 100.0) as u32
        ));
    }

    if failed_count > 0 {
        warn!(
            "Successfully scraped {} jobs, failed to parse {} cards",
            parsed_jobs.len(),
            failed_count
        );
    } else {
        info!("Successfully scraped {} jobs from HTML", parsed_jobs.len());
    }

    Ok(parsed_jobs)
}

/// Try multiple CSS selectors in order until one matches
///
/// Returns the text content of the first matching element
fn try_selectors(element: &scraper::ElementRef, selectors: &[&str]) -> Option<String> {
    for selector_str in selectors {
        if let Ok(selector) = Selector::parse(selector_str) {
            if let Some(el) = element.select(&selector).next() {
                let text = el.text().collect::<String>().trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
    }
    None
}

/// Try multiple CSS selectors for link elements, extracting href attribute
///
/// Returns the href value of the first matching element
fn try_link_selectors(element: &scraper::ElementRef, selectors: &[&str]) -> Option<String> {
    for selector_str in selectors {
        if let Ok(selector) = Selector::parse(selector_str) {
            if let Some(el) = element.select(&selector).next() {
                if let Some(href) = el.value().attr("href") {
                    if !href.trim().is_empty() {
                        return Some(href.trim().to_string());
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_UPWORK_HTML: &str = r#"<!DOCTYPE html>
<html>
<body>
  <section class="air3-card-section">
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01ABC123">
        <h2>React Developer Needed</h2>
      </a>
      <div class="job-description">
        <p>We need a skilled React developer for our dashboard project.</p>
      </div>
    </article>
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01DEF456">
        <h2>TypeScript Expert</h2>
      </a>
      <div class="job-description">
        <p>Looking for TypeScript expertise for API development.</p>
      </div>
    </article>
  </section>
</body>
</html>"#;

    #[test]
    fn test_scrape_valid_upwork_html() {
        let result = scrape_upwork_search(VALID_UPWORK_HTML);
        assert!(result.is_ok(), "Should parse valid HTML");

        let jobs = result.unwrap();
        assert_eq!(jobs.len(), 2, "Should find 2 jobs");

        // First job
        assert_eq!(jobs[0].title, "React Developer Needed");
        assert_eq!(jobs[0].url, "https://www.upwork.com/jobs/~01ABC123");
        assert!(jobs[0].description.contains("skilled React developer"));

        // Second job
        assert_eq!(jobs[1].title, "TypeScript Expert");
        assert_eq!(jobs[1].url, "https://www.upwork.com/jobs/~01DEF456");
        assert!(jobs[1].description.contains("TypeScript expertise"));
    }

    #[test]
    fn test_scrape_empty_html() {
        let html = "<html><body></body></html>";
        let result = scrape_upwork_search(html);
        assert!(result.is_err(), "Should error on empty HTML");
        assert!(result.unwrap_err().contains("No job cards found"));
    }

    #[test]
    fn test_scrape_malformed_cards() {
        let html = r#"<!DOCTYPE html>
<html>
<body>
  <section class="air3-card-section">
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01VALID">
        <h2>Valid Job</h2>
      </a>
      <div class="job-description">
        <p>Good job</p>
      </div>
    </article>
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01NOTITLE">
      </a>
      <div class="job-description">
        <p>Missing title</p>
      </div>
    </article>
    <article data-test="JobTile">
      <h2>Missing Link</h2>
      <div class="job-description">
        <p>No link element</p>
      </div>
    </article>
  </section>
</body>
</html>"#;

        let result = scrape_upwork_search(html);
        assert!(result.is_ok(), "Should handle malformed cards gracefully");

        let jobs = result.unwrap();
        assert_eq!(jobs.len(), 1, "Should only parse valid job");
        assert_eq!(jobs[0].title, "Valid Job");
    }

    #[test]
    fn test_scrape_caps_at_50_items() {
        // Generate HTML with 100 job cards
        let mut html = String::from(
            r#"<!DOCTYPE html>
<html>
<body>
  <section class="air3-card-section">"#,
        );

        for i in 1..=100 {
            html.push_str(&format!(
                r#"<article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~{:020}">
        <h2>Job {}</h2>
      </a>
      <div class="job-description">
        <p>Description {}</p>
      </div>
    </article>"#,
                i, i, i
            ));
        }
        html.push_str("</section></body></html>");

        let result = scrape_upwork_search(&html);
        assert!(result.is_ok(), "Should parse large HTML");
        assert_eq!(result.unwrap().len(), 50, "Should cap at 50 items");
    }

    #[test]
    fn test_scrape_detects_duplicates() {
        let html = r#"<!DOCTYPE html>
<html>
<body>
  <section class="air3-card-section">
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01ABC123">
        <h2>First Instance</h2>
      </a>
      <div class="job-description">
        <p>Original</p>
      </div>
    </article>
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01ABC123">
        <h2>Duplicate</h2>
      </a>
      <div class="job-description">
        <p>Should be skipped</p>
      </div>
    </article>
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01DEF456">
        <h2>Second Unique Job</h2>
      </a>
      <div class="job-description">
        <p>Different job</p>
      </div>
    </article>
  </section>
</body>
</html>"#;

        let result = scrape_upwork_search(html);
        assert!(result.is_ok(), "Should handle duplicates");

        let jobs = result.unwrap();
        assert_eq!(jobs.len(), 2, "Should skip duplicate URL");
        assert_eq!(jobs[0].title, "First Instance");
        assert_eq!(jobs[1].title, "Second Unique Job");
    }

    #[test]
    fn test_scrape_handles_absolute_urls() {
        let html = r#"<!DOCTYPE html>
<html>
<body>
  <section class="air3-card-section">
    <article data-test="JobTile">
      <a class="job-title-link" href="https://www.upwork.com/jobs/~01ABC123">
        <h2>Absolute URL Job</h2>
      </a>
      <div class="job-description">
        <p>Description</p>
      </div>
    </article>
  </section>
</body>
</html>"#;

        let result = scrape_upwork_search(html);
        assert!(result.is_ok(), "Should handle absolute URLs");

        let jobs = result.unwrap();
        assert_eq!(jobs[0].url, "https://www.upwork.com/jobs/~01ABC123");
    }

    #[test]
    fn test_scrape_fails_on_high_failure_rate() {
        // Create HTML with 10 cards, all malformed (missing both title and link)
        let mut html = String::from(
            r#"<!DOCTYPE html>
<html>
<body>
  <section class="air3-card-section">"#,
        );

        for i in 1..=10 {
            html.push_str(&format!(
                r#"<article data-test="JobTile">
      <div class="job-description">
        <p>Malformed card {}</p>
      </div>
    </article>"#,
                i
            ));
        }
        html.push_str("</section></body></html>");

        let result = scrape_upwork_search(&html);
        assert!(result.is_err(), "Should error when >80% fail");
        assert!(result
            .unwrap_err()
            .contains("HTML structure likely changed"));
    }

    #[test]
    fn test_scrape_selector_fallback() {
        // Test fallback selectors when primary selector fails
        let html = r#"<!DOCTYPE html>
<html>
<body>
  <section class="air3-card-section">
    <article data-test="JobTile">
      <a href="/jobs/~01ABC123">
        <h2>Title without class</h2>
      </a>
      <p>Description without wrapper div</p>
    </article>
  </section>
</body>
</html>"#;

        let result = scrape_upwork_search(html);
        assert!(result.is_ok(), "Should use fallback selectors");

        let jobs = result.unwrap();
        assert_eq!(jobs.len(), 1, "Should find 1 job with fallbacks");
        assert_eq!(jobs[0].title, "Title without class");
    }

    // URL Conversion Tests

    #[test]
    fn test_rss_url_to_search_url_basic() {
        let rss = "https://www.upwork.com/ab/feed/jobs/rss?q=react+developer";
        let result = rss_url_to_search_url(rss);
        assert!(result.is_ok(), "Should convert valid RSS URL");
        assert_eq!(
            result.unwrap(),
            "https://www.upwork.com/nx/search/jobs/?q=react+developer"
        );
    }

    #[test]
    fn test_rss_url_to_search_url_with_multiple_params() {
        let rss =
            "https://www.upwork.com/ab/feed/jobs/rss?q=typescript&sort=recency&job_type=hourly";
        let result = rss_url_to_search_url(rss);
        assert!(result.is_ok(), "Should handle multiple query params");

        let search_url = result.unwrap();
        assert!(search_url.contains("q=typescript"));
        assert!(search_url.contains("sort=recency"));
        assert!(search_url.contains("job_type=hourly"));
        assert!(search_url.starts_with("https://www.upwork.com/nx/search/jobs/?"));
    }

    #[test]
    fn test_rss_url_to_search_url_no_query() {
        let rss = "https://www.upwork.com/ab/feed/jobs/rss";
        let result = rss_url_to_search_url(rss);
        assert!(result.is_ok(), "Should handle RSS URL with no query params");
        assert_eq!(result.unwrap(), "https://www.upwork.com/nx/search/jobs/?");
    }

    #[test]
    fn test_rss_url_to_search_url_invalid() {
        let invalid = "not a valid url";
        let result = rss_url_to_search_url(invalid);
        assert!(result.is_err(), "Should error on invalid URL");
        assert!(result.unwrap_err().contains("Failed to parse"));
    }
}
