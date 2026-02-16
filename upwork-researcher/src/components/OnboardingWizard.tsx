import { useEffect, useRef } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";
import { useOnboardingStore } from "../stores/useOnboardingStore";

import ApiKeyStep from "./onboarding/ApiKeyStep";
import ReadyStep from "./onboarding/ReadyStep";
import VoiceCalibrationStep from "./onboarding/VoiceCalibrationStep";
import WelcomeStep from "./onboarding/WelcomeStep";
import "./OnboardingWizard.css";

// Review Fix #11: Extract magic number to constant
const TOTAL_STEPS = 4;

function OnboardingWizard() {
  const { currentStep, showOnboarding, setShowOnboarding } = useOnboardingStore();

  // Story 8.2: Focus trap for keyboard navigation
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef);

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
      <div ref={modalRef} className="onboarding-wizard">
        <div className="onboarding-wizard__progress">
          Step {currentStep} of {TOTAL_STEPS}
        </div>
        {renderStep()}
      </div>
    </div>
  );
}

export default OnboardingWizard;
