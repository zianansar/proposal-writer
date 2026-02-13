// ProposalDetailView component (Story 7.4)
// Full detail view for a single proposal — AC-1 through AC-6
import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useProposalDetail } from './useProposalDetail';
import { OutcomeDropdown, formatLabel } from './OutcomeDropdown';
import { useUpdateProposalOutcome } from './useUpdateProposalOutcome';
import type { OutcomeStatus } from './useUpdateProposalOutcome';
import DeleteConfirmDialog from '../../components/DeleteConfirmDialog';
import './ProposalDetailView.css';

interface ProposalRevision {
  id: number;
  proposalId: number;
  revisionNumber: number;
  createdAt: string;
}

interface RevisionContent {
  id: number;
  content: string;
  revisionNumber: number;
  createdAt: string;
}

interface ProposalDetailViewProps {
  proposalId: number;
  onBack: () => void;
}

/**
 * Full proposal detail view (Story 7.4).
 *
 * Shows complete proposal text, metadata, outcome status,
 * revision history, copy, and delete actions.
 */
export function ProposalDetailView({ proposalId, onBack }: ProposalDetailViewProps) {
  const queryClient = useQueryClient();
  const { data: proposal, isLoading, error, refetch } = useProposalDetail(proposalId);
  const { mutate: updateOutcome } = useUpdateProposalOutcome();

  // M-2 CR fix: useRef for outcome badge (replaces document.querySelector)
  const outcomeBadgeRef = useRef<HTMLButtonElement>(null);

  // Outcome dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // H-2 CR fix: Optimistic local outcome status — updates badge immediately (AC-5)
  const [optimisticOutcome, setOptimisticOutcome] = useState<OutcomeStatus | null>(null);

  // Toast state (inline, no Sonner)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Copy state (AC-3)
  const [copyLabel, setCopyLabel] = useState('Copy Proposal');

  // Delete dialog state (AC-6)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Collapsible sections
  const [jobContentExpanded, setJobContentExpanded] = useState(false);
  const [revisionsExpanded, setRevisionsExpanded] = useState(false);

  // Revision history state (AC-4)
  const [revisions, setRevisions] = useState<ProposalRevision[]>([]);
  const [expandedRevision, setExpandedRevision] = useState<number | null>(null);
  const [revisionContent, setRevisionContent] = useState<Record<number, string>>({});
  const [loadingRevision, setLoadingRevision] = useState<number | null>(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const ms = toast.type === 'success' ? 3000 : 5000;
    const timer = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(timer);
  }, [toast]);

  // AC-2: Escape key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDeleteDialog && !dropdownOpen) {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, showDeleteDialog, dropdownOpen]);

  // H-2 CR fix: Clear optimistic state when server data arrives (refetch completes)
  useEffect(() => {
    if (proposal && optimisticOutcome && proposal.outcomeStatus === optimisticOutcome) {
      setOptimisticOutcome(null);
    }
  }, [proposal?.outcomeStatus, optimisticOutcome]);

  // Derived display status: optimistic local state takes precedence (AC-5)
  // L-1 CR R2: Rust sends outcomeStatus as String. Cast is safe — DB column has CHECK constraint.
  const displayOutcomeStatus: OutcomeStatus = optimisticOutcome ?? (proposal?.outcomeStatus as OutcomeStatus) ?? 'pending';

  // AC-5: Handle outcome status change with optimistic update
  const handleStatusChange = useCallback(
    (status: OutcomeStatus) => {
      setDropdownOpen(false);
      if (status !== displayOutcomeStatus) {
        // H-2 CR fix: Set optimistic state immediately so badge updates before network round-trip
        setOptimisticOutcome(status);
        updateOutcome(
          { proposalId, outcomeStatus: status },
          {
            onSuccess: () => {
              setToast({ type: 'success', message: `Outcome updated to '${formatLabel(status)}'` });
              refetch();
            },
            onError: (err) => {
              // Revert optimistic state on failure
              setOptimisticOutcome(null);
              setToast({ type: 'error', message: err.message || 'Failed to update outcome' });
            },
          }
        );
      }
    },
    [displayOutcomeStatus, proposalId, updateOutcome, refetch]
  );

  // AC-3: Copy proposal text
  // L-2 CR note: Uses direct clipboard API instead of useSafeCopy — safety checks
  // already ran at generation time. Detail view is for reviewing past proposals.
  const handleCopy = useCallback(async () => {
    if (!proposal) return;
    try {
      await navigator.clipboard.writeText(proposal.generatedText);
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy Proposal'), 2000);
    } catch {
      setToast({ type: 'error', message: 'Failed to copy to clipboard' });
    }
  }, [proposal]);

  // AC-6: Delete proposal
  const handleDeleteConfirm = useCallback(async () => {
    try {
      await invoke('delete_proposal', { id: proposalId });
      queryClient.invalidateQueries({ queryKey: ['proposalHistory'] });
      onBack();
    } catch {
      setToast({ type: 'error', message: 'Failed to delete proposal' });
      setShowDeleteDialog(false);
    }
  }, [proposalId, queryClient, onBack]);

  // AC-4: Load revisions when section expanded
  const handleToggleRevisions = useCallback(async () => {
    const willExpand = !revisionsExpanded;
    setRevisionsExpanded(willExpand);

    if (willExpand && revisions.length === 0 && proposal && proposal.revisionCount > 0) {
      try {
        const result = await invoke<ProposalRevision[]>('get_proposal_revisions', { proposalId });
        setRevisions(result);
      } catch {
        setToast({ type: 'error', message: 'Failed to load revisions' });
      }
    }
  }, [revisionsExpanded, revisions.length, proposal, proposalId]);

  // AC-4: Load revision content on click
  const handleRevisionClick = useCallback(async (revisionId: number) => {
    if (expandedRevision === revisionId) {
      setExpandedRevision(null);
      return;
    }

    setExpandedRevision(revisionId);

    if (!revisionContent[revisionId]) {
      setLoadingRevision(revisionId);
      try {
        const result = await invoke<RevisionContent>('get_revision_content', { revisionId });
        setRevisionContent((prev) => ({ ...prev, [revisionId]: result.content }));
      } catch {
        setToast({ type: 'error', message: 'Failed to load revision content' });
      } finally {
        setLoadingRevision(null);
      }
    }
  }, [expandedRevision, revisionContent]);

  // Loading state
  if (isLoading) {
    return (
      <div className="proposal-detail" data-testid="proposal-detail-loading">
        <div className="proposal-detail__header">
          <button
            className="proposal-detail__back"
            onClick={onBack}
            aria-label="Back to history"
          >
            ← Back to History
          </button>
          <h2 className="proposal-detail__title">Proposal Details</h2>
        </div>
        <div className="proposal-detail__skeleton">
          <div className="skeleton-line skeleton-line--wide" />
          <div className="skeleton-line skeleton-line--medium" />
          <div className="skeleton-line skeleton-line--wide" />
          <div className="skeleton-line skeleton-line--narrow" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="proposal-detail" data-testid="proposal-detail-error">
        <div className="proposal-detail__header">
          <button
            className="proposal-detail__back"
            onClick={onBack}
            aria-label="Back to history"
          >
            ← Back to History
          </button>
          <h2 className="proposal-detail__title">Proposal Details</h2>
        </div>
        <div className="proposal-detail__error">
          <p>Failed to load proposal</p>
          <button className="proposal-detail__retry" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Not found state (defensive: Rust command converts None→Err so this branch
  // is normally unreachable — the error state handles "Proposal not found" from backend.
  // Kept as a safety net in case the query contract changes.)
  if (!proposal) {
    return (
      <div className="proposal-detail" data-testid="proposal-detail-not-found">
        <div className="proposal-detail__header">
          <button
            className="proposal-detail__back"
            onClick={onBack}
            aria-label="Back to history"
          >
            ← Back to History
          </button>
          <h2 className="proposal-detail__title">Proposal Details</h2>
        </div>
        <div className="proposal-detail__not-found">
          <p>Proposal not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="proposal-detail">
      {/* Header: Back + title + date */}
      <div className="proposal-detail__header">
        <button
          className="proposal-detail__back"
          onClick={onBack}
          aria-label="Back to history"
        >
          ← Back to History
        </button>
        <h2 className="proposal-detail__title">Proposal Details</h2>
      </div>

      {/* Metadata bar: date, outcome, strategy, job link */}
      <div className="proposal-detail__metadata">
        <span className="proposal-detail__date">
          Created: {format(new Date(proposal.createdAt), 'MMM d, yyyy')}
          {/* L-1 CR fix: Show last modified date when available */}
          {proposal.updatedAt && ` · Updated: ${format(new Date(proposal.updatedAt), 'MMM d, yyyy')}`}
        </span>

        {/* AC-5: Outcome badge with inline dropdown — uses displayOutcomeStatus for optimistic update (H-2) */}
        <div className="proposal-detail__outcome">
          <button
            ref={outcomeBadgeRef}
            type="button"
            className={`proposal-outcome-badge proposal-outcome-badge--${displayOutcomeStatus}`}
            aria-label={`Outcome: ${formatLabel(displayOutcomeStatus)}`}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen((prev) => !prev)}
          >
            {formatLabel(displayOutcomeStatus)}
          </button>
          {dropdownOpen && outcomeBadgeRef.current && (
            <OutcomeDropdown
              currentStatus={displayOutcomeStatus}
              onSelect={handleStatusChange}
              onClose={() => setDropdownOpen(false)}
              anchorRect={outcomeBadgeRef.current.getBoundingClientRect()}
            />
          )}
        </div>

        {proposal.hookStrategyId && (
          <span className="proposal-detail__strategy">
            {formatLabel(proposal.hookStrategyId)}
          </span>
        )}

        {proposal.jobTitle && (
          <span className="proposal-detail__job-link">
            Job: {proposal.jobTitle}
          </span>
        )}
      </div>

      {/* Full proposal text (AC-1) */}
      <div className="proposal-detail__content" role="article">
        <h3 className="proposal-detail__section-title">Proposal</h3>
        <div className="proposal-detail__text">
          {proposal.generatedText}
        </div>
      </div>

      {/* Collapsible: Original job content */}
      <div className="proposal-detail__section">
        <button
          className="proposal-detail__section-toggle"
          onClick={() => setJobContentExpanded(!jobContentExpanded)}
          aria-expanded={jobContentExpanded}
        >
          <span className="proposal-detail__chevron">{jobContentExpanded ? '▾' : '▸'}</span>
          Original Job Content
        </button>
        {jobContentExpanded && (
          <div className="proposal-detail__job-content">
            {proposal.jobContent}
          </div>
        )}
      </div>

      {/* Collapsible: Revision history (AC-4) */}
      {proposal.revisionCount > 0 && (
        <div className="proposal-detail__section">
          <button
            className="proposal-detail__section-toggle"
            onClick={handleToggleRevisions}
            aria-expanded={revisionsExpanded}
          >
            <span className="proposal-detail__chevron">{revisionsExpanded ? '▾' : '▸'}</span>
            Revision History ({proposal.revisionCount} revision{proposal.revisionCount !== 1 ? 's' : ''})
          </button>
          {revisionsExpanded && (
            <div className="proposal-detail__revisions">
              {revisions.length === 0 ? (
                <p className="proposal-detail__revisions-loading">Loading revisions...</p>
              ) : (
                revisions.map((rev) => (
                  <div key={rev.id} className="proposal-detail__revision">
                    <button
                      className="proposal-detail__revision-header"
                      onClick={() => handleRevisionClick(rev.id)}
                      aria-expanded={expandedRevision === rev.id}
                    >
                      <span>Revision #{rev.revisionNumber}</span>
                      <span className="proposal-detail__revision-date">
                        {format(new Date(rev.createdAt), 'MMM d, yyyy HH:mm')}
                      </span>
                    </button>
                    {expandedRevision === rev.id && (
                      <div className="proposal-detail__revision-content">
                        {loadingRevision === rev.id ? (
                          <p>Loading...</p>
                        ) : (
                          revisionContent[rev.id] || 'No content available'
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons: Copy + Delete */}
      <div className="proposal-detail__actions">
        <button
          className="proposal-detail__copy-btn"
          onClick={handleCopy}
          aria-label="Copy proposal text to clipboard"
        >
          {copyLabel}
        </button>
        <button
          className="proposal-detail__delete-btn"
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete Proposal
        </button>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`proposal-detail__toast proposal-detail__toast--${toast.type}`}
        >
          {toast.message}
        </div>
      )}

      {/* Delete confirmation dialog (AC-6) */}
      {showDeleteDialog && (
        <DeleteConfirmDialog
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
