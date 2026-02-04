import { useOnboardingStore } from "../../stores/useOnboardingStore";

function VoiceCalibrationStep() {
  const { setCurrentStep } = useOnboardingStore();

  const handleSkip = () => {
    setCurrentStep(4);
  };

  const handleBack = () => {
    setCurrentStep(2);
  };

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
            Upload 3-5 of your best proposals (text files)
          </p>
          <p className="onboarding-step__placeholder">
            File upload will be implemented in Epic 6
          </p>
        </div>

        <div className="onboarding-step__option">
          <strong>Option 2: Quick Questionnaire</strong>
          <p className="onboarding-step__option-hint">
            Answer 5 questions about your approach
          </p>
          <p className="onboarding-step__placeholder">
            Questionnaire will be implemented in Epic 6
          </p>
        </div>
      </div>

      <div className="onboarding-step__actions">
        <button
          className="button button--secondary"
          onClick={handleBack}
        >
          Back
        </button>
        <button
          className="button button--primary"
          onClick={handleSkip}
          autoFocus
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

export default VoiceCalibrationStep;
