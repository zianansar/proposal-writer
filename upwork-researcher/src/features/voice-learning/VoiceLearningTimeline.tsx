// Story 8.6: Voice Learning Timeline component
// Displays how voice learning works with 3 milestone stages

import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import "./VoiceLearningTimeline.css";

export function VoiceLearningTimeline() {
  return (
    <Card className="voice-learning-timeline">
      <CardHeader>
        <CardTitle>How Voice Learning Works</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="timeline-milestones">
          {/* Milestone 1: First proposal */}
          <div className="timeline-milestone">
            <div className="milestone-icon" aria-hidden="true">
              📝
            </div>
            <div className="milestone-content">
              <h4 className="milestone-title">First proposal</h4>
              <p className="milestone-description">
                Uses your Quick Calibration or Golden Set as the baseline.
              </p>
            </div>
          </div>

          {/* Milestone 2: After 3-5 proposals */}
          <div className="timeline-milestone">
            <div className="milestone-icon" aria-hidden="true">
              📈
            </div>
            <div className="milestone-content">
              <h4 className="milestone-title">After 3-5 proposals</h4>
              <p className="milestone-description">
                System learns your editing patterns and adjusts to your preferences.
              </p>
            </div>
          </div>

          {/* Milestone 3: After 10+ proposals */}
          <div className="timeline-milestone">
            <div className="milestone-icon" aria-hidden="true">
              ✨
            </div>
            <div className="milestone-content">
              <h4 className="milestone-title">After 10+ proposals</h4>
              <p className="milestone-description">
                Highly personalized to your unique writing style.
              </p>
            </div>
          </div>
        </div>

        {/* Summary callout */}
        <div className="timeline-summary">
          <span className="summary-icon" aria-hidden="true">
            💡
          </span>
          <span className="summary-text">Takes 3-5 uses to learn your voice.</span>
        </div>
      </CardContent>
    </Card>
  );
}
