/**
 * Job Card Component - Story 4b.9
 * Displays individual job in the queue with all key information
 * [AI-Review Fix H3]: Now uses JobScoreBadge component instead of inline badge
 */

import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

import type { JobQueueItem } from "../types";

import JobScoreBadge from "./JobScoreBadge";

import "./JobCard.css";

interface JobCardProps {
  job: JobQueueItem;
}

export default function JobCard({ job }: JobCardProps) {
  const navigate = useNavigate();

  // AC-6: Navigate to proposal generation on click
  const handleClick = () => {
    navigate(`/editor/${job.id}`);
  };

  // AC-6.7: Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // AC-6.6: Format date as relative time
  const relativeTime = job.createdAt
    ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })
    : "Unknown";

  // AC-6.2: Truncate job title to 50 chars
  const truncatedTitle =
    job.jobTitle.length > 50 ? `${job.jobTitle.slice(0, 47)}...` : job.jobTitle;

  return (
    <div
      className="job-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Job from ${job.clientName}: ${truncatedTitle}`}
    >
      {/* AC-6.2: Display client name, job title, skills %, client quality % */}
      <div className="job-card-content">
        <div className="job-card-header">
          <h3 className="client-name">{job.clientName}</h3>
          <span className="job-date">{relativeTime}</span>
        </div>

        <p className="job-title">{truncatedTitle}</p>

        <div className="job-metrics">
          {job.skillsMatchPercent !== null && (
            <div className="metric">
              <span className="metric-label">Skills:</span>
              <span className="metric-value">{job.skillsMatchPercent}%</span>
            </div>
          )}
          {job.clientQualityPercent !== null && (
            <div className="metric">
              <span className="metric-label">Client:</span>
              <span className="metric-value">{job.clientQualityPercent}%</span>
            </div>
          )}
        </div>
      </div>

      {/* AC-6.3: Score badge prominent on right - uses reusable JobScoreBadge component */}
      <div className="job-card-score">
        <JobScoreBadge score={job.overallScore} color={job.scoreColor} size="sm" />
        <span className="score-label">Score</span>
      </div>
    </div>
  );
}
