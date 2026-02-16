import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { GoldenSetUpload } from "../../features/voice-learning";
import { useOnboardingStore } from "../../stores/useOnboardingStore";

type CalibrationMode = "selection" | "golden-set" | "questionnaire" | "complete";

function VoiceCalibrationStep() {
  const { setCurrentStep, setShowOnboarding } = useOnboardingStore();
  const [mode, setMode] = useState<CalibrationMode>("selection");
  const navigate = useNavigate();

  const handleSkip = () => {
    setCurrentStep(4);
  };

  const handleBack = () => {
    if (mode === "complete") {
      // Can't go back from complete - already calibrated
      setMode("selection");
    } else if (mode !== "selection") {
      setMode("selection");
    } else {
      setCurrentStep(2);
    }
  };

  const handleGoldenSetComplete = () => {
    // Story 8.6 AC-3: Show condensed timeline before proceeding
    setMode("complete");
  };

  const handleContinueAfterCalibration = () => {
    setCurrentStep(4);
  };

  // Story 8.6 AC-3: Navigate to Voice Learning settings
  const handleLearnMore = () => {
    setShowOnboarding(false);
    navigate("/settings", { state: { section: "voice-learning" } });
  };

  // Story 8.6 AC-3: Condensed timeline after calibration complete
  if (mode === "complete") {
    return (
      <div className="onboarding-step">
        <h2 id="onboarding-title">Voice Profile Created!</h2>
        <div className="onboarding-step__success">
          <span className="onboarding-step__success-icon" aria-hidden="true">
            ✓
          </span>
          <p className="onboarding-step__message">
            Your writing style has been analyzed and saved.
          </p>
        </div>
        <div className="onboarding-step__timeline-callout">
          <span className="timeline-callout__icon" aria-hidden="true">
            💡
          </span>
          <span className="timeline-callout__text">Takes 3-5 uses to learn your voice.</span>
          <button type="button" className="timeline-callout__link" onClick={handleLearnMore}>
            Learn More →
          </button>
        </div>
        <div className="onboarding-step__actions">
          <button
            className="button button--primary"
            onClick={handleContinueAfterCalibration}
            autoFocus
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Golden Set Upload mode (Story 5.3 integration)
  if (mode === "golden-set") {
    return (
      <div className="onboarding-step">
        <h2 id="onboarding-title">Upload Your Best Proposals</h2>
        <GoldenSetUpload onComplete={handleGoldenSetComplete} />
        <div className="onboarding-step__actions">
          <button className="button button--secondary" onClick={handleBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // Selection mode (default)
  return (
    <div className="onboarding-step">
      <h2 id="onboarding-title">Voice Calibration (Optional)</h2>
      <p className="onboarding-step__message">
        Upload 3-5 past proposals to help the AI learn your writing style.
      </p>

      <div className="onboarding-step__options">
        <div className="onboarding-step__option">
          <strong>Option 1: Upload Past Proposals</strong>
          <p className="onboarding-step__option-hint">
            Upload 3-5 of your best proposals (text or PDF files)
          </p>
          <button className="button button--primary" onClick={() => setMode("golden-set")}>
            Upload Proposals
          </button>
        </div>

        <div className="onboarding-step__option">
          <strong>Option 2: Quick Questionnaire</strong>
          <p className="onboarding-step__option-hint">Answer 5 questions about your approach</p>
          <p className="onboarding-step__placeholder">Coming soon</p>
        </div>
      </div>

      <div className="onboarding-step__actions">
        <button className="button button--secondary" onClick={handleBack}>
          Back
        </button>
        <button className="button button--primary" onClick={handleSkip} autoFocus>
          Skip for now
        </button>
      </div>
    </div>
  );
}

export default VoiceCalibrationStep;
