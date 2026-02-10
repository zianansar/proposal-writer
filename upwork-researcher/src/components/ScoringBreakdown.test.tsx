import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScoringBreakdownCard from './ScoringBreakdown';

// Mock the hooks used by ScoringBreakdown for the report button
vi.mock('../features/scoring-feedback/hooks/useCanReportScore', () => ({
  useCanReportScore: () => ({ data: { canReport: true }, isLoading: false }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('ScoringBreakdownCard', () => {
  const mockBreakdown = {
    overallScore: 75.5,
    colorFlag: 'yellow',
    skillsMatchPct: 75.0,
    skillsMatchedCount: 3,
    skillsTotalCount: 4,
    skillsMatchedList: ['React', 'TypeScript', 'Node.js'],
    skillsMissingList: ['Docker'],
    clientQualityScore: 70,
    clientQualitySignals: 'Limited client history, moderate confidence',
    budgetAlignmentPct: 90,
    budgetDisplay: '$55/hr vs your $50/hr rate',
    budgetType: 'hourly',
    recommendation: 'Proceed with caution. Review client history before applying.',
  };

  it('renders all three metric rows with correct icons and labels', () => {
    renderWithProviders(<ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={true} jobPostId={1} />);

    // Skills Match
    expect(screen.getByText(/Skills Match: 75%/)).toBeInTheDocument();
    expect(screen.getByText(/\(good\)/)).toBeInTheDocument();

    // Client Quality
    expect(screen.getByText(/Client Quality: 70/)).toBeInTheDocument();
    expect(screen.getByText(/\(medium risk\)/)).toBeInTheDocument();

    // Budget
    expect(screen.getByText(/Budget: 90%/)).toBeInTheDocument();
    expect(screen.getByText(/\(below rate\)/)).toBeInTheDocument();
  });

  it('displays correct quality labels at threshold boundaries - skills green', () => {
    const greenSkills = { ...mockBreakdown, skillsMatchPct: 80.0 };
    renderWithProviders(<ScoringBreakdownCard breakdown={greenSkills} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Skills Match: 80%/)).toBeInTheDocument();
    expect(screen.getByText(/\(good\)/)).toBeInTheDocument();
  });

  it('displays correct quality labels at threshold boundaries - skills moderate', () => {
    const moderateSkills = { ...mockBreakdown, skillsMatchPct: 60.0 };
    renderWithProviders(<ScoringBreakdownCard breakdown={moderateSkills} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Skills Match: 60%/)).toBeInTheDocument();
    expect(screen.getByText(/\(moderate\)/)).toBeInTheDocument();
  });

  it('displays correct quality labels at threshold boundaries - skills poor', () => {
    const poorSkills = { ...mockBreakdown, skillsMatchPct: 40.0 };
    renderWithProviders(<ScoringBreakdownCard breakdown={poorSkills} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Skills Match: 40%/)).toBeInTheDocument();
    expect(screen.getByText(/\(poor\)/)).toBeInTheDocument();
  });

  it('displays correct quality labels at threshold boundaries - client reliable', () => {
    const reliableClient = { ...mockBreakdown, clientQualityScore: 85 };
    renderWithProviders(<ScoringBreakdownCard breakdown={reliableClient} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Client Quality: 85/)).toBeInTheDocument();
    expect(screen.getByText(/\(reliable\)/)).toBeInTheDocument();
  });

  it('displays correct quality labels at threshold boundaries - client high risk', () => {
    const highRiskClient = { ...mockBreakdown, clientQualityScore: 50 };
    renderWithProviders(<ScoringBreakdownCard breakdown={highRiskClient} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Client Quality: 50/)).toBeInTheDocument();
    expect(screen.getByText(/\(high risk\)/)).toBeInTheDocument();
  });

  it('displays correct quality labels at threshold boundaries - budget good', () => {
    const goodBudget = { ...mockBreakdown, budgetAlignmentPct: 110 };
    const { container } = renderWithProviders(<ScoringBreakdownCard breakdown={goodBudget} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Budget: 110%/)).toBeInTheDocument();
    // Query within budget metric section (3rd metric)
    const metrics = container.querySelectorAll('.scoring-breakdown__metric');
    expect(metrics[2].textContent).toContain('(good)');
  });

  it('displays correct quality labels at threshold boundaries - budget low', () => {
    const lowBudget = { ...mockBreakdown, budgetAlignmentPct: 60 };
    renderWithProviders(<ScoringBreakdownCard breakdown={lowBudget} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Budget: 60%/)).toBeInTheDocument();
    expect(screen.getByText(/\(low\)/)).toBeInTheDocument();
  });

  it('shows matched and missing skills lists', () => {
    renderWithProviders(<ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={true} jobPostId={1} />);

    expect(screen.getByText(/You have 3\/4 required skills/)).toBeInTheDocument();
    expect(screen.getByText(/Matched:/)).toBeInTheDocument();
    expect(screen.getByText(/React, TypeScript, Node.js/)).toBeInTheDocument();
    expect(screen.getByText(/Missing:/)).toBeInTheDocument();
    expect(screen.getByText(/Docker/)).toBeInTheDocument();
  });

  it('shows budget comparison text', () => {
    renderWithProviders(<ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText('$55/hr vs your $50/hr rate')).toBeInTheDocument();
  });

  it('shows client quality signals', () => {
    renderWithProviders(<ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText('Limited client history, moderate confidence')).toBeInTheDocument();
  });

  it('shows recommendation text', () => {
    renderWithProviders(<ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Proceed with caution\. Review client history before applying\./)).toBeInTheDocument();
  });

  it('does not render when isExpanded is false', () => {
    const { container } = renderWithProviders(<ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={false} jobPostId={1} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles null scores gracefully - skills not configured', () => {
    const nullSkills = { ...mockBreakdown, skillsMatchPct: null };
    renderWithProviders(<ScoringBreakdownCard breakdown={nullSkills} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Skills Match: N\/A/)).toBeInTheDocument();
    expect(screen.getByText(/Configure your skills in Settings/)).toBeInTheDocument();
  });

  it('handles null scores gracefully - client not assessed', () => {
    const nullClient = { ...mockBreakdown, clientQualityScore: null };
    renderWithProviders(<ScoringBreakdownCard breakdown={nullClient} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Client Quality: N\/A/)).toBeInTheDocument();
    expect(screen.getByText(/\(not assessed\)/)).toBeInTheDocument();
  });

  it('handles null scores gracefully - budget unknown', () => {
    const nullBudget = { ...mockBreakdown, budgetAlignmentPct: null };
    renderWithProviders(<ScoringBreakdownCard breakdown={nullBudget} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText(/Budget: N\/A/)).toBeInTheDocument();
    expect(screen.getByText(/\(unknown\)/)).toBeInTheDocument();
  });

  it('has correct aria attributes for accessibility', () => {
    renderWithProviders(<ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={true} jobPostId={1} />);

    const breakdown = screen.getByRole('region');
    expect(breakdown).toHaveAttribute('aria-labelledby', 'scoring-breakdown-title');
    expect(breakdown).toHaveAttribute('id', 'scoring-breakdown');
  });

  it('displays correct title based on color flag', () => {
    renderWithProviders(<ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText('Why Yellow?')).toBeInTheDocument();
  });

  it('capitalizes color flag correctly in title - green', () => {
    const green = { ...mockBreakdown, colorFlag: 'green' };
    renderWithProviders(<ScoringBreakdownCard breakdown={green} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText('Why Green?')).toBeInTheDocument();
  });

  it('capitalizes color flag correctly in title - red', () => {
    const red = { ...mockBreakdown, colorFlag: 'red' };
    renderWithProviders(<ScoringBreakdownCard breakdown={red} isExpanded={true} jobPostId={1} />);
    expect(screen.getByText('Why Red?')).toBeInTheDocument();
  });
});
