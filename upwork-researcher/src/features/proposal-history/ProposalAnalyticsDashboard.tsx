// Analytics Dashboard component (Story 7.5)
import { useAnalyticsSummary } from './useProposalAnalytics';
import { OutcomeDistributionChart } from './OutcomeDistributionChart';
import { StrategyPerformanceChart } from './StrategyPerformanceChart';
import { WeeklyActivityChart } from './WeeklyActivityChart';
import { formatLabel } from './OutcomeDropdown';
import './ProposalAnalyticsDashboard.css';

// CR R2 M-2: Accept optional onBack prop for reuse outside tab navigation
interface ProposalAnalyticsDashboardProps {
  onBack?: () => void;
}

export function ProposalAnalyticsDashboard({ onBack }: ProposalAnalyticsDashboardProps) {
  const { data: summary, isLoading, isError, refetch } = useAnalyticsSummary();

  // AC-6: Empty state when no proposals
  if (!isLoading && summary && summary.totalProposals === 0) {
    return (
      <div className="analytics-empty-state">
        <p>No analytics data yet. Generate and track proposals to see insights here.</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="analytics-loading">
        <div className="metric-cards-skeleton">
          <div className="metric-card-skeleton" />
          <div className="metric-card-skeleton" />
          <div className="metric-card-skeleton" />
          <div className="metric-card-skeleton" />
        </div>
        <div className="charts-skeleton">
          <div className="chart-skeleton" />
          <div className="chart-skeleton" />
        </div>
        <div className="chart-skeleton-full" />
      </div>
    );
  }

  // Error state
  if (isError || !summary) {
    return (
      <div className="analytics-error">
        <p>Failed to load analytics data.</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  // Response rate color: >20% green, 10-20% yellow, <10% red
  const responseRateColor =
    summary.responseRate > 20 ? '#4ade80' : summary.responseRate >= 10 ? '#fbbf24' : '#f87171';

  return (
    <div className="analytics-dashboard">
      <h2 className="analytics-title">Proposal Analytics</h2>

      {/* Summary Metric Cards */}
      <div className="metric-cards">
        <div className="metric-card">
          <div className="metric-label">Total Proposals</div>
          <div className="metric-value">{summary.totalProposals}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Response Rate</div>
          <div className="metric-value" style={{ color: responseRateColor }}>
            {summary.responseRate.toFixed(1)}%
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Best Strategy</div>
          <div className="metric-value-small">
            {summary.bestStrategy ? formatLabel(summary.bestStrategy) : 'N/A'}
          </div>
          {summary.bestStrategy && (
            <div className="metric-subtitle">{summary.bestStrategyRate.toFixed(1)}%</div>
          )}
        </div>

        <div className="metric-card">
          <div className="metric-label">This Month</div>
          <div className="metric-value">{summary.proposalsThisMonth}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        <div className="chart-container">
          <h3>Outcome Distribution</h3>
          <OutcomeDistributionChart />
        </div>

        <div className="chart-container">
          <h3>Hook Strategy Performance</h3>
          <StrategyPerformanceChart />
        </div>
      </div>

      {/* Full-Width Weekly Activity Chart */}
      <div className="chart-container-full">
        <h3>Weekly Activity (Last 12 Weeks)</h3>
        <WeeklyActivityChart />
      </div>
    </div>
  );
}
