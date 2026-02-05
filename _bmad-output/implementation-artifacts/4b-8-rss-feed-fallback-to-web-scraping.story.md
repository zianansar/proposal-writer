---
status: ready-for-dev
---

# Story 4b.8: RSS Feed Fallback to Web Scraping

## Story

As a freelancer,
I want the app to still work if Upwork blocks RSS feeds,
So that I can continue importing jobs.

## Acceptance Criteria

**Given** RSS feed import fails (403 Forbidden, timeout, or invalid feed)
**When** the error is detected
**Then** the system shows: "RSS blocked. Trying alternative method..."
**And** falls back to web scraping the Upwork search page
**And** extracts jobs from HTML
**And** if both fail, shows clear error with manual paste option

## Technical Notes

- From Round 4 Hindsight: "RSS will break. Upwork hates automation."
- Graceful degradation: RSS → scraping → manual paste
- Scraping requires HTML parsing (use scraper crate)
