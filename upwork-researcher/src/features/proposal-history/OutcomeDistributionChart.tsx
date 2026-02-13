// Outcome Distribution Chart component (Story 7.5 AC-2)
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useOutcomeDistribution } from './useProposalAnalytics';
import { formatLabel } from './OutcomeDropdown';

// Outcome status color mapping (match badge CSS from OutcomeDropdown.css)
const OUTCOME_COLORS: Record<string, string> = {
  pending: '#737373',
  submitted: '#3b82f6',
  response_received: '#22d3ee',
  interview: '#a855f7',
  hired: '#4ade80',
  no_response: '#f87171',
  rejected: '#ef4444',
};

export function OutcomeDistributionChart() {
  const { data, isLoading, isError } = useOutcomeDistribution();

  if (isLoading) {
    return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3' }}>Loading...</div>;
  }

  if (isError || !data) {
    return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>Error loading data</div>;
  }

  if (data.length === 0) {
    return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3' }}>No data</div>;
  }

  // Calculate total for percentage
  const total = data.reduce((sum, item) => sum + item.count, 0);

  // Transform data for recharts
  const chartData = data.map((item) => ({
    name: formatLabel(item.outcomeStatus),
    count: item.count,
    percentage: ((item.count / total) * 100).toFixed(1),
    fill: OUTCOME_COLORS[item.outcomeStatus] || '#a3a3a3',
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <XAxis dataKey="name" stroke="#a3a3a3" style={{ fontSize: 12 }} />
        <YAxis stroke="#a3a3a3" style={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e1e1e',
            border: '1px solid #404040',
            borderRadius: '4px',
            color: '#fafafa',
          }}
          formatter={(value: any, name: string, props: any) => [
            `${value} (${props.payload.percentage}%)`,
            'Count',
          ]}
        />
        <Bar dataKey="count">
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
