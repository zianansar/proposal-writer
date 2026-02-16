import { useGenerationStore } from "../stores/useGenerationStore";
import { PIPELINE_STAGES, type StageStatus } from "../types/pipeline";
import "./PipelineIndicator.css";

/**
 * Pipeline Stage Indicator Component (Story 8.4)
 *
 * Displays real-time progress through generation pipeline stages:
 * - Preparing (API request setup)
 * - Generating (Streaming tokens from Claude)
 * - Complete (Generation finished)
 *
 * Future Epic 5: Will add hook selection and voice profile loading stages
 */
function PipelineIndicator() {
  const { currentStage, stageHistory, isStreaming } = useGenerationStore();

  // Don't show if not streaming and no history
  if (!isStreaming && stageHistory.length === 0) {
    return null;
  }

  const getStageStatus = (stageId: string): StageStatus => {
    const record = stageHistory.find((s) => s.id === stageId);
    if (record) return record.status;
    if (stageId === currentStage) return "active";
    return "pending";
  };

  const getStageDuration = (stageId: string): number | undefined => {
    const record = stageHistory.find((s) => s.id === stageId);
    return record?.durationMs;
  };

  return (
    <div className="pipeline-indicator" role="status" aria-live="polite">
      <ul className="pipeline-stages">
        {PIPELINE_STAGES.map(({ id, label }) => {
          const status = getStageStatus(id);
          const duration = getStageDuration(id);

          return (
            <li
              key={id}
              className={`pipeline-stage pipeline-stage--${status}`}
              aria-current={status === "active" ? "step" : undefined}
            >
              <span className="pipeline-stage-icon" aria-hidden="true">
                {status === "active" && <span className="spinner">⏳</span>}
                {status === "complete" && "✓"}
                {status === "error" && "✗"}
                {status === "pending" && "○"}
              </span>
              <span className="pipeline-stage-label">{label}</span>
              {duration !== undefined && (
                <span className="pipeline-stage-duration">{(duration / 1000).toFixed(1)}s</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PipelineIndicator;
