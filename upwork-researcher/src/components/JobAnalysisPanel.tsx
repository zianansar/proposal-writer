/**
 * Story 4a.7: Job Analysis Results Display
 * Story 4b.6: Scoring Breakdown UI Integration
 *
 * Unified panel displaying all extracted job analysis information:
 * - Client Name
 * - Key Skills
 * - Hidden Needs
 * - Overall Score with expandable breakdown (Story 4b.6)
 *
 * AC-1: Structured panel with sections grouped by type
 * AC-4: Only visible when analysis data exists (no empty shell)
 * AC-5: Clear visual hierarchy (section labels muted, data prominent)
 * AC-7: Semantic HTML for screen reader navigation
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SkillTags from './SkillTags';
import HiddenNeedsDisplay from './HiddenNeedsDisplay';
import SkillsMatchBadge from './SkillsMatchBadge';
import ClientQualityBadge from './ClientQualityBadge';
import BudgetAlignmentBadge from './BudgetAlignmentBadge';
import { JobScoreBadge } from './JobScoreBadge';
import ScoringBreakdownCard from './ScoringBreakdown';
import './JobAnalysisPanel.css';

// Story 4b.6: Scoring breakdown data structure (matches Rust ScoringBreakdown)
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

interface JobAnalysisPanelProps {
  jobPostId?: number | null; // Story 4b.6: Required for fetching breakdown
  clientName: string | null;
  keySkills: string[];
  hiddenNeeds: Array<{ need: string; evidence: string }>;
  onGenerateClick: () => void;
  visible: boolean;
  isGenerating?: boolean;
  skillsMatchPercentage?: number | null;
  skillsMatchReason?: 'no-user-skills' | 'no-job-skills' | null;
  matchedSkillsCount?: number;
  totalJobSkillsCount?: number;
  clientQualityScore?: number | null;
  // Story 4b.4: Budget alignment props
  budgetAlignmentPct?: number | null;
  budgetAlignmentStatus?: 'green' | 'yellow' | 'red' | 'gray' | 'mismatch' | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  budgetType?: 'hourly' | 'fixed' | 'unknown';
  userHourlyRate?: number | null;
  userProjectRateMin?: number | null;
  // Story 4b.5: Overall score props
  overallScore?: number | null;
  colorFlag?: 'green' | 'yellow' | 'red' | 'gray';
}

export default function JobAnalysisPanel({
  jobPostId,
  clientName,
  keySkills,
  hiddenNeeds,
  onGenerateClick,
  visible,
  isGenerating = false,
  skillsMatchPercentage,
  skillsMatchReason,
  matchedSkillsCount,
  totalJobSkillsCount,
  clientQualityScore,
  // Story 4b.4: Budget alignment
  budgetAlignmentPct,
  budgetAlignmentStatus,
  budgetMin,
  budgetMax,
  budgetType = 'unknown',
  userHourlyRate,
  userProjectRateMin,
  // Story 4b.5: Overall score
  overallScore,
  colorFlag,
}: JobAnalysisPanelProps) {
  // Story 4b.6: Breakdown expansion state
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const [breakdown, setBreakdown] = useState<ScoringBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  // Story 4b.6: Fetch breakdown when expanded
  useEffect(() => {
    if (isBreakdownExpanded && jobPostId && !breakdown) {
      setBreakdownLoading(true);
      invoke<ScoringBreakdown>('get_scoring_breakdown', { jobPostId })
        .then((data) => {
          setBreakdown(data);
          setBreakdownLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch scoring breakdown:', err);
          setBreakdownLoading(false);
        });
    }
  }, [isBreakdownExpanded, jobPostId, breakdown]);

  // Story 4b.6: Reset breakdown when job changes
  useEffect(() => {
    setBreakdown(null);
    setIsBreakdownExpanded(false);
  }, [jobPostId]);

  // AC-4: Return null when not visible (no empty panel shell)
  if (!visible) {
    return null;
  }

  return (
    <div
      className="job-analysis-panel"
      role="region"
      aria-label="Job Analysis Results"
      data-testid="job-analysis-panel"
    >
      {/* Client Section */}
      <section className="job-analysis-section">
        <h3 className="job-analysis-section__header">Client</h3>
        <div className="job-analysis-section__content">
          <div className="client-name-display" data-testid="panel-client-name">
            Client: {clientName || "Unknown"}
          </div>
        </div>
      </section>

      {/* Key Skills Section */}
      <section className="job-analysis-section">
        <h3 className="job-analysis-section__header">Key Skills</h3>
        <div className="job-analysis-section__content">
          <SkillTags skills={keySkills} />
        </div>
      </section>

      {/* Skills Match Section (Story 4b.2) */}
      {(skillsMatchPercentage !== undefined || skillsMatchReason) && (
        <section className="job-analysis-section">
          <h3 className="job-analysis-section__header">Skills Match</h3>
          <div className="job-analysis-section__content">
            <SkillsMatchBadge
              percentage={skillsMatchPercentage ?? null}
              reason={skillsMatchReason}
              matchedCount={matchedSkillsCount}
              totalCount={totalJobSkillsCount}
            />
          </div>
        </section>
      )}

      {/* Client Quality Section (Story 4b.3)
          Pattern: undefined = not passed (hide section), null = analyzed but no score ("Not available"), number = show score
          This matches TypeScript optional prop semantics where undefined means "not provided" */}
      {clientQualityScore !== undefined && (
        <section className="job-analysis-section">
          <h3 className="job-analysis-section__header">Client Quality</h3>
          <div className="job-analysis-section__content">
            <ClientQualityBadge score={clientQualityScore ?? null} />
          </div>
        </section>
      )}

      {/* Budget Alignment Section (Story 4b.4)
          Pattern: undefined = not passed (hide section), null/values = show badge with appropriate state */}
      {budgetAlignmentStatus !== undefined && (
        <section className="job-analysis-section">
          <h3 className="job-analysis-section__header">Budget Alignment</h3>
          <div className="job-analysis-section__content">
            <BudgetAlignmentBadge
              percentage={budgetAlignmentPct ?? null}
              status={budgetAlignmentStatus}
              budgetMin={budgetMin ?? null}
              budgetMax={budgetMax ?? null}
              budgetType={budgetType}
              userHourlyRate={userHourlyRate}
              userProjectRateMin={userProjectRateMin}
            />
          </div>
        </section>
      )}

      {/* Overall Score Section (Story 4b.5, 4b.6)
          Pattern: Show when colorFlag is provided (indicates scoring has been calculated)
          Story 4b.6: Click to expand breakdown */}
      {colorFlag !== undefined && (
        <section className="job-analysis-section">
          <h3 className="job-analysis-section__header">Overall Score</h3>
          <div className="job-analysis-section__content">
            <JobScoreBadge
              overallScore={overallScore ?? null}
              colorFlag={colorFlag}
              isExpanded={isBreakdownExpanded}
              onToggle={() => setIsBreakdownExpanded(!isBreakdownExpanded)}
            />
            {/* Story 4b.6: Scoring Breakdown Card */}
            {breakdownLoading && isBreakdownExpanded && (
              <div style={{ marginTop: '8px', color: '#9ca3af' }}>Loading breakdown...</div>
            )}
            {breakdown && !breakdownLoading && jobPostId && (
              <ScoringBreakdownCard
                breakdown={breakdown}
                isExpanded={isBreakdownExpanded}
                jobPostId={jobPostId}
              />
            )}
          </div>
        </section>
      )}

      {/* Hidden Needs Section */}
      <section className="job-analysis-section">
        <h3 className="job-analysis-section__header">Hidden Needs</h3>
        <div className="job-analysis-section__content">
          <HiddenNeedsDisplay hiddenNeeds={hiddenNeeds} />
        </div>
      </section>

      {/* Action Section - Generate Proposal CTA */}
      <section className="job-analysis-actions">
        <button
          className="generate-proposal-cta"
          onClick={onGenerateClick}
          disabled={isGenerating}
          type="button"
          data-testid="panel-generate-button"
        >
          {isGenerating ? "Generating..." : "Generate Proposal"}
        </button>
      </section>
    </div>
  );
}
