import { useEffect } from "react";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import WelcomeStep from "./onboarding/WelcomeStep";
import ApiKeyStep from "./onboarding/ApiKeyStep";
import VoiceCalibrationStep from "./onboarding/VoiceCalibrationStep";
import ReadyStep from "./onboarding/ReadyStep";
import "./OnboardingWizard.css";

// Review Fix #11: Extract magic number to constant
const TOTAL_STEPS = 4;

function OnboardingWizard() {
  const { currentStep, showOnboarding, setShowOnboarding } = useOnboardingStore();

  // Keyboard navigation: Escape to close (Task 8)
  useEffect(() => {
    if (!showOnboarding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Allow user to close with Escape (they can reopen from settings)
        setShowOnboarding(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showOnboarding, setShowOnboarding]);

  if (!showOnboarding) {
    return null;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <WelcomeStep />;
      case 2:
        return <ApiKeyStep />;
      case 3:
        return <VoiceCalibrationStep />;
      case 4:
        return <ReadyStep />;
      default:
        return <WelcomeStep />;
    }
  };

  return (
    <div
      className="onboarding-wizard__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-wizard">
        <div className="onboarding-wizard__progress">
          Step {currentStep} of {TOTAL_STEPS}
        </div>
        {renderStep()}
      </div>
    </div>
  );
}

export default OnboardingWizard;
