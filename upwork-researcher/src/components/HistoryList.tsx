import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import HistoryItem, { type ProposalSummary } from "./HistoryItem";

function HistoryList() {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await invoke<ProposalSummary[]>("get_proposals");
        setProposals(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, []);

  if (loading) {
    return (
      <div className="history-list history-list--loading">
        Loading proposals...
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-list history-list--error">
        <p className="error-message">Failed to load proposals: {error}</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="history-list history-list--empty">
        <p>No proposals yet. Generate your first proposal to see it here.</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {proposals.map((proposal) => (
        <HistoryItem key={proposal.id} proposal={proposal} />
      ))}
    </div>
  );
}

export default HistoryList;
