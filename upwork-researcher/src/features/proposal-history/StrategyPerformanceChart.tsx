// Strategy Performance Chart component (Story 7.5 AC-3)
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useStrategyPerformance } from './useProposalAnalytics';
import { formatLabel } from './OutcomeDropdown';

export function StrategyPerformanceChart() {
  const { data, isLoading, isError } = useStrategyPerformance();

  if (isLoading) {
    return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3' }}>Loading...</div>;
  }

  if (isError || !data) {
    return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>Error loading data</div>;
  }

  if (data.length === 0) {
    return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3' }}>No data</div>;
  }

  // Transform data for horizontal bar chart
  const chartData = data.map((item) => ({
    name: item.strategy === 'none' ? 'No strategy' : formatLabel(item.strategy),
    responseRate: parseFloat(item.responseRate.toFixed(1)),
    total: item.total,
    positive: item.positive,
    lowSample: item.total < 3,
    label: `${item.positive}/${item.total}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical">
        <XAxis type="number" stroke="#a3a3a3" style={{ fontSize: 12 }} />
        <YAxis dataKey="name" type="category" stroke="#a3a3a3" style={{ fontSize: 12 }} width={120} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e1e1e',
            border: '1px solid #404040',
            borderRadius: '4px',
            color: '#fafafa',
          }}
          formatter={(value: any, name: string, props: any) => {
            const { total, positive, lowSample } = props.payload;
            return [
              `${value}% (${positive}/${total})${lowSample ? ' - low sample' : ''}`,
              'Response Rate',
            ];
          }}
        />
        <Bar dataKey="responseRate">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.lowSample ? '#3b82f680' : '#3b82f6'}
            />
          ))}
          <LabelList dataKey="label" position="right" style={{ fontSize: 11, fill: '#a3a3a3' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
