// Story 4b.7: RSS Import Progress Display
// Story 4b.8: Added fallback status display
// Shows progress of background RSS analysis and fallback status

import { useRssImport } from '../hooks/useRssImport';
import './RssImportProgress.css';

export function RssImportProgress() {
  const { progress, isComplete, error, isFallingBack, fallbackMessage } = useRssImport();

  // Story 4b.8: Show error state with "Try Manual Paste" button
  if (error) {
    const isBothMethodsFailed = error.includes('Both import methods failed');

    return (
      <div className="rss-progress-error" role="alert">
        <strong>Import failed:</strong> {error}
        {isBothMethodsFailed && (
          <button
            className="rss-progress-manual-paste-btn"
            onClick={() => {
              // TODO: Navigate to manual paste input (Story 4a.1 job input screen)
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Try Manual Paste
          </button>
        )}
      </div>
    );
  }

  // Story 4b.8: Show fallback message when falling back to web scraping
  if (isFallingBack && fallbackMessage) {
    return (
      <div className="rss-progress-fallback" role="status" aria-live="polite">
        <span className="rss-progress-spinner" />
        {fallbackMessage}
      </div>
    );
  }

  if (!progress && !isComplete) {
    return null;
  }

  if (isComplete) {
    return (
      <div className="rss-progress-complete" role="status" aria-live="polite">
        <span aria-label="Success">✓</span> All jobs analyzed.{' '}
        <button
          className="rss-queue-link"
          onClick={() => {
            // Navigate to job queue when Story 4b-9 is implemented
            // For now, scroll to top where job list would be
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          type="button"
        >
          View queue →
        </button>
      </div>
    );
  }

  if (!progress) return null;

  const percentage = Math.round((progress.current / progress.total) * 100);

  return (
    <div
      className="rss-progress"
      role="progressbar"
      aria-valuenow={progress.current}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-label={`Analyzing ${progress.current} of ${progress.total} jobs`}
    >
      <div className="rss-progress-bar">
        <div
          className="rss-progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="rss-progress-text" aria-live="polite">
        Analyzed {progress.current}/{progress.total} jobs... {progress.job_title}
      </div>
    </div>
  );
}
