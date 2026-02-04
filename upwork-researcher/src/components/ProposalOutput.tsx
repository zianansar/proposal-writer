import CopyButton from "./CopyButton";

interface ProposalOutputProps {
  proposal: string | null;
  loading: boolean;
  error: string | null;
  isSaved?: boolean;
  onRetry?: () => void;
  onSaveForLater?: () => void;
  retryCount?: number;
}

function ProposalOutput({
  proposal,
  loading,
  error,
  isSaved = false,
  onRetry,
  onSaveForLater,
  retryCount = 0,
}: ProposalOutputProps) {
  // Show streaming content with indicator while loading
  if (loading && proposal) {
    return (
      <div className="proposal-output proposal-output--streaming" aria-live="polite" aria-busy="true">
        <label>Generating Proposal...</label>
        <div className="proposal-text">
          {proposal}
          <span className="streaming-cursor" aria-hidden="true"></span>
        </div>
      </div>
    );
  }

  // Show loading indicator before any tokens arrive
  if (loading) {
    return (
      <div className="proposal-output proposal-output--loading" aria-live="polite" aria-busy="true">
        <p>Generating your proposal...</p>
      </div>
    );
  }

  // Show error with any partial content preserved
  if (error) {
    const MAX_RETRIES = 3;
    const canRetry = retryCount < MAX_RETRIES;

    return (
      <div className="proposal-output proposal-output--error" aria-live="assertive">
        <p className="error-message">{error}</p>
        <div className="error-actions">
          {canRetry && onRetry && (
            <button onClick={onRetry} className="button button--primary">
              Retry {retryCount > 0 && `(${retryCount}/${MAX_RETRIES})`}
            </button>
          )}
          {onSaveForLater && (
            <button onClick={onSaveForLater} className="button button--secondary">
              Save Job for Later
            </button>
          )}
        </div>
        {proposal && (
          <>
            <label>Partial Result (preserved)</label>
            <div className="proposal-text">{proposal}</div>
            <CopyButton text={proposal} />
          </>
        )}
      </div>
    );
  }

  if (!proposal) {
    return null;
  }

  return (
    <div className="proposal-output" aria-live="polite">
      <div className="proposal-header">
        <label>Generated Proposal</label>
        {isSaved && <span className="saved-indicator" aria-label="Saved to database">Saved</span>}
      </div>
      <div className="proposal-text">{proposal}</div>
      <CopyButton text={proposal} />
    </div>
  );
}

export default ProposalOutput;
