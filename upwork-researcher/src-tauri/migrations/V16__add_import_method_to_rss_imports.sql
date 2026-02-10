-- Story 4b.8: RSS Feed Fallback to Web Scraping
-- Add import_method column to track which method succeeded (rss vs scrape)

-- Add import_method to track fallback success
-- Values: 'rss', 'scrape'
-- Indicates which method successfully imported the jobs
ALTER TABLE rss_imports ADD COLUMN import_method TEXT DEFAULT 'rss';
