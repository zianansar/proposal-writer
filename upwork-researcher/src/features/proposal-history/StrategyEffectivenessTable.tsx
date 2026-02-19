// A/B testing strategy effectiveness table (Story 10.4: AC-4)
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import type { StrategyEffectivenessData } from "../../types/analytics";

/** React Query hook for strategy effectiveness data (Story 10.4: Task 4.6) */
export function useStrategyEffectiveness() {
  return useQuery({
    queryKey: ["analytics", "strategyEffectiveness"],
    queryFn: () => invoke<StrategyEffectivenessData[]>("get_strategy_effectiveness"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/** Color-code response rate: >30% green, 20-30% yellow, <20% red (Dev Notes) */
function responseRateColor(rate: number): string {
  const pct = rate * 100;
  if (pct > 30) return "var(--color-success, #4ade80)";
  if (pct >= 20) return "var(--color-warning, #fbbf24)";
  return "var(--color-error, #f87171)";
}

/**
 * Strategy Effectiveness Table (Story 10.4: AC-4)
 *
 * Displays each hook strategy's A/B vs manual proposal outcomes:
 * total sent, won count, response rate %, and average score.
 * Rows are ranked by response rate descending (SQL already sorted).
 */
export function StrategyEffectivenessTable() {
  const { data, isLoading, isError, refetch } = useStrategyEffectiveness();

  if (isLoading) {
    return (
      <div
        className="strategy-effectiveness-skeleton"
        aria-label="Loading strategy effectiveness data"
        role="status"
      >
        <div className="chart-skeleton" style={{ height: "120px" }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="strategy-effectiveness-error" role="alert">
        <p>Failed to load strategy effectiveness data.</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="strategy-effectiveness-empty">
        Generate proposals and track outcomes to see strategy effectiveness.
      </p>
    );
  }

  return (
    <div className="strategy-effectiveness-table-wrapper" role="region" aria-label="Hook Strategy Effectiveness">
      <table className="strategy-effectiveness-table">
        <thead>
          <tr>
            <th scope="col">Strategy Name</th>
            <th scope="col">Source</th>
            <th scope="col">Total</th>
            <th scope="col">Won</th>
            <th scope="col">Lost</th>
            <th scope="col">Response Rate</th>
            <th scope="col">Avg Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const lost = row.total - row.won;
            const ratePct = (row.responseRate * 100).toFixed(1);
            return (
              <tr key={`${row.hookStrategyId}-${row.abAssigned ? "ab" : "manual"}-${i}`}>
                <td>{row.hookStrategyId}</td>
                <td>
                  <span
                    className={`source-badge source-badge--${row.abAssigned ? "ab" : "manual"}`}
                    aria-label={row.abAssigned ? "A/B assigned" : "Manually selected"}
                  >
                    {row.abAssigned ? "A/B" : "Manual"}
                  </span>
                </td>
                <td>{row.total}</td>
                <td>{row.won}</td>
                <td>{lost}</td>
                <td style={{ color: responseRateColor(row.responseRate), fontWeight: 600 }}>
                  {ratePct}%
                </td>
                <td>{row.avgScore.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
