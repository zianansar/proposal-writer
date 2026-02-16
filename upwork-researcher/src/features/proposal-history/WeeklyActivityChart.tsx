// Weekly Activity Chart component (Story 7.5 AC-4)
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { useWeeklyActivity } from "./useProposalAnalytics";

export function WeeklyActivityChart() {
  const { data, isLoading, isError } = useWeeklyActivity(12);

  if (isLoading) {
    return (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#a3a3a3",
        }}
      >
        Loading...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f87171",
        }}
      >
        Error loading data
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#a3a3a3",
        }}
      >
        No data
      </div>
    );
  }

  // Format week_start as "Jan 6", "Jan 13", etc.
  const chartData = data.map((item) => {
    const date = new Date(item.weekStart + "T00:00:00");
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    return {
      week: `${month} ${day}`,
      proposalCount: item.proposalCount,
      responseRate: parseFloat(item.responseRate.toFixed(1)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData}>
        <XAxis dataKey="week" stroke="#a3a3a3" style={{ fontSize: 12 }} />
        <YAxis yAxisId="left" stroke="#a3a3a3" style={{ fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" stroke="#f97316" style={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e1e1e",
            border: "1px solid #404040",
            borderRadius: "4px",
            color: "#fafafa",
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="proposalCount" fill="#3b82f6" name="Proposals" />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="responseRate"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ fill: "#f97316" }}
          name="Response Rate %"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
