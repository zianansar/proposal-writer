/**
 * Story 4a.7: Job Analysis Results Display
 *
 * Unified panel displaying all extracted job analysis information:
 * - Client Name
 * - Key Skills
 * - Hidden Needs
 *
 * AC-1: Structured panel with sections grouped by type
 * AC-4: Only visible when analysis data exists (no empty shell)
 * AC-5: Clear visual hierarchy (section labels muted, data prominent)
 * AC-7: Semantic HTML for screen reader navigation
 */

import SkillTags from './SkillTags';
import HiddenNeedsDisplay from './HiddenNeedsDisplay';
import './JobAnalysisPanel.css';

interface JobAnalysisPanelProps {
  clientName: string | null;
  keySkills: string[];
  hiddenNeeds: Array<{ need: string; evidence: string }>;
  onGenerateClick: () => void;
  visible: boolean;
  isGenerating?: boolean;
}

export default function JobAnalysisPanel({
  clientName,
  keySkills,
  hiddenNeeds,
  onGenerateClick,
  visible,
  isGenerating = false,
}: JobAnalysisPanelProps) {
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
