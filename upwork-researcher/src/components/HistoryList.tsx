import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect, useRef } from "react";

import { useArrowKeyNavigation } from "../hooks/useArrowKeyNavigation";

import HistoryItem, { type ProposalSummary } from "./HistoryItem";

function HistoryList() {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Story 8.2 AC8: Arrow key navigation
  const { handleKeyDown } = useArrowKeyNavigation({
    itemCount: proposals.length,
    currentIndex: focusedIndex,
    onIndexChange: (newIndex) => {
      setFocusedIndex(newIndex);
      // Focus the element when index changes
      itemRefs.current[newIndex]?.focus();
    },
  });

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await invoke<ProposalSummary[]>("get_proposals");
        setProposals(result ?? []);
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
    return <div className="history-list history-list--loading">Loading proposals...</div>;
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
    <div
      className="history-list"
      role="listbox"
      aria-label="Proposal history"
      onKeyDown={handleKeyDown}
    >
      {proposals.map((proposal, index) => (
        <HistoryItem
          key={proposal.id}
          proposal={proposal}
          ref={(el) => (itemRefs.current[index] = el)}
          tabIndex={index === focusedIndex ? 0 : -1}
          role="option"
          aria-selected={index === focusedIndex}
        />
      ))}
    </div>
  );
}

export default HistoryList;
