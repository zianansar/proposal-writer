// Story 4b.7: RSS Feed Import Dialog
// Allows user to paste RSS feed URL and trigger import

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './RssImportDialog.css';

interface RssImportResult {
  batch_id: string;
  total_jobs: number;
  message: string;
}

export function RssImportDialog() {
  const [feedUrl, setFeedUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!feedUrl.trim()) {
      setError('Please enter a feed URL');
      return;
    }

    setIsImporting(true);
    setError('');
    setMessage('');

    try {
      const result = await invoke<RssImportResult>('import_rss_feed', {
        feedUrl: feedUrl.trim(),
      });
      setMessage(result.message);
      setFeedUrl('');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsImporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && feedUrl.trim() && !isImporting) {
      handleImport();
    }
  };

  return (
    <div className="rss-import-dialog">
      <h2>Import RSS Feed</h2>
      <label htmlFor="rss-url-input" className="visually-hidden">
        RSS Feed URL
      </label>
      <input
        id="rss-url-input"
        type="text"
        value={feedUrl}
        onChange={(e) => setFeedUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste Upwork RSS feed URL..."
        disabled={isImporting}
        className="rss-url-input"
        aria-describedby={error ? 'rss-error' : undefined}
      />
      <button
        onClick={handleImport}
        disabled={!feedUrl.trim() || isImporting}
        className="import-button"
      >
        {isImporting ? 'Importing...' : 'Import Jobs'}
      </button>
      {message && <div className="success-message" role="status">{message}</div>}
      {error && <div id="rss-error" className="error-message" role="alert" aria-live="assertive">{error}</div>}
    </div>
  );
}
