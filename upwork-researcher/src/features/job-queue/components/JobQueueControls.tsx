/**
 * Job Queue Controls Component - Story 4b.9 Task 8
 * Sort and filter controls for job queue
 */

import type { SortField, ScoreFilter, ColorCounts } from "../types";
import "./JobQueueControls.css";

interface JobQueueControlsProps {
  sortBy: SortField;
  filter: ScoreFilter;
  colorCounts: ColorCounts;
  onSortChange: (sortBy: SortField) => void;
  onFilterChange: (filter: ScoreFilter) => void;
}

export default function JobQueueControls({
  sortBy,
  filter,
  colorCounts,
  onSortChange,
  onFilterChange,
}: JobQueueControlsProps) {
  // [AI-Review Fix H2]: Calculate counts for filter chips
  const allCount = colorCounts.green + colorCounts.yellow + colorCounts.red + colorCounts.gray;
  const yellowPlusCount = colorCounts.green + colorCounts.yellow;

  return (
    <div className="job-queue-controls">
      {/* AC-3, AC-4: Sort controls */}
      <div className="control-group">
        <label htmlFor="sort-select">Sort by:</label>
        <select
          id="sort-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortField)}
          className="sort-select"
        >
          <option value="score">Score (High → Low)</option>
          <option value="date">Date (Newest)</option>
          <option value="clientName">Client (A-Z)</option>
        </select>
      </div>

      {/* AC-5: Filter controls with per-filter counts */}
      <div className="control-group filter-chips">
        <span className="filter-label">Show:</span>
        <button
          className={`filter-chip ${filter === "all" ? "active" : ""}`}
          onClick={() => onFilterChange("all")}
          aria-pressed={filter === "all"}
        >
          All ({allCount})
        </button>
        <button
          className={`filter-chip ${filter === "yellowAndGreen" ? "active" : ""}`}
          onClick={() => onFilterChange("yellowAndGreen")}
          aria-pressed={filter === "yellowAndGreen"}
        >
          Yellow+ ({yellowPlusCount})
        </button>
        <button
          className={`filter-chip ${filter === "greenOnly" ? "active" : ""}`}
          onClick={() => onFilterChange("greenOnly")}
          aria-pressed={filter === "greenOnly"}
        >
          Green Only ({colorCounts.green})
        </button>
      </div>
    </div>
  );
}
