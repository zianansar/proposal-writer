import { useState, useRef } from "react";

import "./ScoringBreakdown.css";
import { ReportScoreModal } from "../features/scoring-feedback/components/ReportScoreModal";
import { useCanReportScore } from "../features/scoring-feedback/hooks/useCanReportScore";

interface ScoringBreakdown {
  overallScore: number | null;
  colorFlag: string;
  skillsMatchPct: number | null;
  skillsMatchedCount: number;
  skillsTotalCount: number;
  skillsMatchedList: string[];
  skillsMissingList: string[];
  clientQualityScore: number | null;
  clientQualitySignals: string;
  budgetAlignmentPct: number | null;
  budgetDisplay: string;
  budgetType: string;
  recommendation: string;
}

/**
 * Scoring Breakdown Component (Story 4b.6 + 4b.10)
 *
 * Displays detailed breakdown of job score components:
 * - Skills match with matched/missing lists
 * - Client quality with signals
 * - Budget alignment with comparison
 * - Contextual recommendation
 * - Report Incorrect Score button (Story 4b.10)
 */
function ScoringBreakdownCard({
  breakdown,
  isExpanded,
  jobPostId,
}: {
  breakdown: ScoringBreakdown;
  isExpanded: boolean;
  jobPostId: number;
}) {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const { data: canReportData, isLoading: isCheckingCanReport } = useCanReportScore(jobPostId);
  // H1 fix: Ref for focus return when modal closes (Task 7.7)
  const reportButtonRef = useRef<HTMLButtonElement>(null);

  if (!isExpanded) return null;

  const {
    colorFlag,
    skillsMatchPct,
    skillsMatchedCount,
    skillsTotalCount,
    skillsMatchedList,
    skillsMissingList,
    clientQualityScore,
    clientQualitySignals,
    budgetAlignmentPct,
    budgetDisplay,
    recommendation,
  } = breakdown;

  // Helper: Get quality label and icon for each component
  const getSkillsQuality = (pct: number | null) => {
    if (pct === null) return { icon: "—", label: "not configured", className: "gray" };
    if (pct >= 75) return { icon: "✅", label: "good", className: "green" };
    if (pct >= 50) return { icon: "⚠️", label: "moderate", className: "yellow" };
    return { icon: "❌", label: "poor", className: "red" };
  };

  const getClientQuality = (score: number | null) => {
    if (score === null) return { icon: "—", label: "not assessed", className: "gray" };
    if (score >= 80) return { icon: "✅", label: "reliable", className: "green" };
    if (score >= 60) return { icon: "⚠️", label: "medium risk", className: "yellow" };
    return { icon: "❌", label: "high risk", className: "red" };
  };

  const getBudgetQuality = (pct: number | null) => {
    if (pct === null) return { icon: "—", label: "unknown", className: "gray" };
    if (pct >= 100) return { icon: "✅", label: "good", className: "green" };
    if (pct >= 70) return { icon: "⚠️", label: "below rate", className: "yellow" };
    return { icon: "❌", label: "low", className: "red" };
  };

  const skillsQ = getSkillsQuality(skillsMatchPct);
  const clientQ = getClientQuality(clientQualityScore);
  const budgetQ = getBudgetQuality(budgetAlignmentPct);

  return (
    <div
      className="scoring-breakdown"
      role="region"
      aria-labelledby="scoring-breakdown-title"
      id="scoring-breakdown"
    >
      <h3 id="scoring-breakdown-title" className="scoring-breakdown__title">
        Why {colorFlag.charAt(0).toUpperCase() + colorFlag.slice(1)}?
      </h3>

      {/* Skills Match Metric */}
      <div className="scoring-breakdown__metric">
        <div className="scoring-breakdown__metric-header">
          <span className="scoring-breakdown__icon" aria-hidden="true">
            {skillsQ.icon}
          </span>
          <span className="scoring-breakdown__metric-name">
            Skills Match: {skillsMatchPct !== null ? `${skillsMatchPct}%` : "N/A"}
          </span>
          <span
            className={`scoring-breakdown__label scoring-breakdown__label--${skillsQ.className}`}
          >
            ({skillsQ.label})
          </span>
        </div>
        {skillsMatchPct !== null ? (
          <div className="scoring-breakdown__metric-detail">
            <p>
              You have {skillsMatchedCount}/{skillsTotalCount} required skills
            </p>
            {skillsMatchedList.length > 0 && (
              <p className="scoring-breakdown__skills-list">
                <strong>Matched:</strong> {skillsMatchedList.join(", ")}
              </p>
            )}
            {skillsMissingList.length > 0 && (
              <p className="scoring-breakdown__skills-list">
                <strong>Missing:</strong> {skillsMissingList.join(", ")}
              </p>
            )}
          </div>
        ) : (
          <p className="scoring-breakdown__metric-detail">Configure your skills in Settings</p>
        )}
      </div>

      {/* Client Quality Metric */}
      <div className="scoring-breakdown__metric">
        <div className="scoring-breakdown__metric-header">
          <span className="scoring-breakdown__icon" aria-hidden="true">
            {clientQ.icon}
          </span>
          <span className="scoring-breakdown__metric-name">
            Client Quality: {clientQualityScore !== null ? clientQualityScore : "N/A"}
          </span>
          <span
            className={`scoring-breakdown__label scoring-breakdown__label--${clientQ.className}`}
          >
            ({clientQ.label})
          </span>
        </div>
        <p className="scoring-breakdown__metric-detail">{clientQualitySignals}</p>
      </div>

      {/* Budget Alignment Metric */}
      <div className="scoring-breakdown__metric">
        <div className="scoring-breakdown__metric-header">
          <span className="scoring-breakdown__icon" aria-hidden="true">
            {budgetQ.icon}
          </span>
          <span className="scoring-breakdown__metric-name">
            Budget: {budgetAlignmentPct !== null ? `${budgetAlignmentPct}%` : "N/A"}
          </span>
          <span
            className={`scoring-breakdown__label scoring-breakdown__label--${budgetQ.className}`}
          >
            ({budgetQ.label})
          </span>
        </div>
        <p className="scoring-breakdown__metric-detail">{budgetDisplay}</p>
      </div>

      {/* Recommendation */}
      <div className="scoring-breakdown__recommendation">
        <span className="scoring-breakdown__recommendation-icon" aria-hidden="true">
          💡
        </span>
        {recommendation}
      </div>

      {/* Report Incorrect Score (Story 4b.10) */}
      <div className="scoring-breakdown__report">
        {!isCheckingCanReport && canReportData?.canReport === false ? (
          <span className="scoring-breakdown__reported">Reported</span>
        ) : (
          <button
            ref={reportButtonRef}
            className="scoring-breakdown__report-button"
            onClick={() => setIsReportModalOpen(true)}
            disabled={isCheckingCanReport}
          >
            {isCheckingCanReport ? "..." : "Report Incorrect Score"}
          </button>
        )}
      </div>

      {/* Report Score Modal */}
      <ReportScoreModal
        jobPostId={jobPostId}
        overallScore={breakdown.overallScore}
        colorFlag={breakdown.colorFlag}
        skillsMatchPct={breakdown.skillsMatchPct}
        clientQualityScore={breakdown.clientQualityScore}
        budgetAlignmentPct={breakdown.budgetAlignmentPct}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        triggerRef={reportButtonRef}
      />
    </div>
  );
}

export default ScoringBreakdownCard;
