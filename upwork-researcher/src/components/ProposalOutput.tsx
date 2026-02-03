interface ProposalOutputProps {
  proposal: string | null;
  loading: boolean;
  error: string | null;
}

function ProposalOutput({ proposal, loading, error }: ProposalOutputProps) {
  if (loading) {
    return (
      <div className="proposal-output proposal-output--loading" aria-live="polite" aria-busy="true">
        <p>Generating your proposal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="proposal-output proposal-output--error" aria-live="assertive">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  if (!proposal) {
    return null;
  }

  return (
    <div className="proposal-output" aria-live="polite">
      <label>Generated Proposal</label>
      <div className="proposal-text">{proposal}</div>
    </div>
  );
}

export default ProposalOutput;
