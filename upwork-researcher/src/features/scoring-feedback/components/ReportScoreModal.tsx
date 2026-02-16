// Story 4b.10: Report Incorrect Score Modal

import React, { useState, useEffect, useRef, useCallback } from "react";

import { useSubmitScoringFeedback } from "../hooks/useSubmitScoringFeedback";
import { ScoringFeedbackIssue } from "../types";
import "./ReportScoreModal.css";

export interface ReportScoreModalProps {
  jobPostId: number;
  overallScore: number | null;
  colorFlag: string;
  skillsMatchPct: number | null;
  clientQualityScore: number | null;
  budgetAlignmentPct: number | null;
  isOpen: boolean;
  onClose: () => void;
  /** Ref to the trigger element for focus return (AC-10, Task 7.7) */
  triggerRef?: React.RefObject<HTMLButtonElement | HTMLElement | null>;
}

export function ReportScoreModal({
  jobPostId,
  overallScore,
  colorFlag,
  skillsMatchPct,
  clientQualityScore,
  budgetAlignmentPct,
  isOpen,
  onClose,
  triggerRef,
}: ReportScoreModalProps) {
  const [selectedIssues, setSelectedIssues] = useState<Set<ScoringFeedbackIssue>>(new Set());
  const [userNotes, setUserNotes] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const firstCheckboxRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const { mutate, isPending, isError, error } = useSubmitScoringFeedback();

  // Return focus to trigger element when modal closes (H1 fix, Task 7.7)
  const handleClose = useCallback(() => {
    onClose();
    // Use setTimeout to ensure focus returns after modal unmounts
    setTimeout(() => {
      triggerRef?.current?.focus();
    }, 0);
  }, [onClose, triggerRef]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIssues(new Set());
      setUserNotes("");
      setIsSuccess(false);
      // Trigger screen reader announcement (M3 fix, Task 7.6)
      setAnnounceOpen(true);
      setTimeout(() => setAnnounceOpen(false), 1000);
      // Focus first checkbox when modal opens (AC-10)
      setTimeout(() => {
        firstCheckboxRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Auto-close after success (AC-8)
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        handleClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, handleClose]);

  // Submit handler wrapped in useCallback to fix stale closure (M1 fix)
  const handleSubmit = useCallback(() => {
    if (selectedIssues.size === 0) return;

    mutate(
      {
        jobPostId,
        issues: Array.from(selectedIssues),
        userNotes: userNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setIsSuccess(true);
        },
      },
    );
  }, [selectedIssues, jobPostId, userNotes, mutate]);

  // Focus trap (AC-10)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close (AC-10)
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      // Enter to submit (AC-10) - only when not in textarea
      if (e.key === "Enter" && !isSuccess && selectedIssues.size > 0) {
        // Don't submit if focus is in textarea (allow newlines)
        if (document.activeElement?.tagName === "TEXTAREA") return;
        e.preventDefault();
        handleSubmit();
        return;
      }

      // Tab focus trap
      if (e.key === "Tab") {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, input, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSuccess, selectedIssues, handleClose, handleSubmit]);

  // Toggle issue selection
  const toggleIssue = (issue: ScoringFeedbackIssue) => {
    setSelectedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issue)) {
        next.delete(issue);
      } else {
        next.add(issue);
      }
      return next;
    });
  };

  const handleSuccessClick = () => {
    handleClose();
  };

  if (!isOpen) return null;

  // M2 fix: Use raw length for consistency with maxLength={500} on textarea
  const charCount = userNotes.length;
  const isValid = selectedIssues.size > 0 && charCount <= 500;

  return (
    <div
      className="report-score-modal-overlay"
      onClick={isSuccess ? handleSuccessClick : undefined}
    >
      {/* M3 fix: Screen reader announcement for modal open (Task 7.6) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announceOpen && "Report Incorrect Score dialog opened"}
      </div>
      <div
        ref={modalRef}
        className="report-score-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-score-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {isSuccess ? (
          <div className="report-score-modal__success" onClick={handleSuccessClick}>
            <div className="report-score-modal__success-icon" aria-hidden="true">
              ✓
            </div>
            <p role="status">
              Thanks! We&apos;ll use this to
              <br />
              improve scoring.
            </p>
          </div>
        ) : (
          <>
            <div className="report-score-modal__header">
              <h2 id="report-score-modal-title">Report Incorrect Score</h2>
              <button
                ref={closeButtonRef}
                className="report-score-modal__close"
                onClick={handleClose}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="report-score-modal__score-summary">
              <div>
                <strong>Current Score:</strong> {overallScore?.toFixed(1) ?? "N/A"}%{" "}
                <span className={`score-color-${colorFlag}`}>{colorFlag}</span>
              </div>
              <div className="report-score-modal__score-details">
                Skills: {skillsMatchPct?.toFixed(0) ?? "N/A"}% | Client:{" "}
                {clientQualityScore ?? "N/A"}% | Budget: {budgetAlignmentPct ?? "N/A"}%
              </div>
            </div>

            <div className="report-score-modal__body">
              <label className="report-score-modal__label">
                What&apos;s wrong with this score?
              </label>

              <div className="report-score-modal__checkbox-group">
                {[
                  { issue: ScoringFeedbackIssue.SkillsMismatch, label: "Skills match is wrong" },
                  {
                    issue: ScoringFeedbackIssue.ClientQualityWrong,
                    label: "Client quality assessment is wrong",
                  },
                  { issue: ScoringFeedbackIssue.BudgetWrong, label: "Budget alignment is wrong" },
                  { issue: ScoringFeedbackIssue.ScoreTooHigh, label: "Overall score is too high" },
                  { issue: ScoringFeedbackIssue.ScoreTooLow, label: "Overall score is too low" },
                  { issue: ScoringFeedbackIssue.Other, label: "Other" },
                ].map(({ issue, label }, index) => (
                  <label key={issue} className="report-score-modal__checkbox-label">
                    <input
                      ref={index === 0 ? firstCheckboxRef : undefined}
                      type="checkbox"
                      checked={selectedIssues.has(issue)}
                      onChange={() => toggleIssue(issue)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="report-score-modal__textarea-container">
                <label htmlFor="user-notes" className="report-score-modal__label">
                  Tell us more (optional)
                </label>
                <textarea
                  id="user-notes"
                  className="report-score-modal__textarea"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <div className="report-score-modal__char-count">{charCount}/500</div>
              </div>

              {isError && error && (
                <div className="report-score-modal__error" role="alert">
                  {error.message}
                </div>
              )}

              <button
                className="report-score-modal__submit"
                disabled={!isValid || isPending}
                onClick={handleSubmit}
              >
                {isPending ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
