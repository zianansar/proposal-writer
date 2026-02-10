// Story 8.6: Voice Learning Progress component
// Shows progress indicator with status message based on proposals edited count

import { Progress } from "../../components/ui/progress";
import { VoiceLearningProgress as ProgressType } from "./types";
import "./VoiceLearningProgress.css";

export interface VoiceLearningProgressProps {
  progress: ProgressType;
}

export function VoiceLearningProgress({ progress }: VoiceLearningProgressProps) {
  const { proposalsEditedCount, status, progressPercent } = progress;

  // Generate status message based on count
  const getStatusMessage = () => {
    if (status === 'initial') {
      return `Proposals edited: ${proposalsEditedCount} (no proposals yet)`;
    } else if (status === 'learning') {
      return `Proposals edited: ${proposalsEditedCount}/5 (learning in progress)`;
    } else if (status === 'refining') {
      return `Proposals edited: ${proposalsEditedCount}/10 (refining your style)`;
    } else {
      // personalized
      return `Proposals edited: ${proposalsEditedCount} ✓ (highly personalized)`;
    }
  };

  return (
    <div className="voice-learning-progress">
      <div className="progress-header">
        <span
          className="progress-label"
          aria-live="polite"
          aria-atomic="true"
        >
          {getStatusMessage()}
        </span>
      </div>

      <Progress
        value={progressPercent}
        max={100}
        className="progress-bar"
        aria-label={`Voice learning progress: ${proposalsEditedCount} proposals edited, ${Math.round(progressPercent)}% complete`}
      />

      {/* Milestone markers at 5 and 10 */}
      <div className="progress-markers">
        <div
          className={`progress-marker ${proposalsEditedCount >= 5 ? 'progress-marker--reached' : ''}`}
          style={{ left: '50%' }}
          aria-hidden="true"
        >
          <span className="marker-label">5</span>
        </div>
        <div
          className={`progress-marker ${proposalsEditedCount >= 10 ? 'progress-marker--reached' : ''}`}
          style={{ left: '100%' }}
          aria-hidden="true"
        >
          <span className="marker-label">10</span>
        </div>
      </div>
    </div>
  );
}
