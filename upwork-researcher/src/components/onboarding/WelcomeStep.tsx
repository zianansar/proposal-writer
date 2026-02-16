import { useOnboardingStore } from "../../stores/useOnboardingStore";

function WelcomeStep() {
  const { setCurrentStep } = useOnboardingStore();

  const handleNext = () => {
    setCurrentStep(2);
  };

  return (
    <div className="onboarding-step">
      <h2 id="onboarding-title">Welcome to Upwork Research Agent!</h2>
      <p className="onboarding-step__message">
        This tool helps you write personalized proposals faster.
      </p>

      <div className="onboarding-step__actions">
        <button className="button button--primary" onClick={handleNext} autoFocus>
          Get Started
        </button>
      </div>
    </div>
  );
}

export default WelcomeStep;
