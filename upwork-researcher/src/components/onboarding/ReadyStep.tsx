import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

import { useOnboardingStore } from "../../stores/useOnboardingStore";

function ReadyStep() {
  const { setShowOnboarding, reset } = useOnboardingStore();
  const [isCompleting, setIsCompleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleComplete = async () => {
    setIsCompleting(true);
    setSaveError(null);

    try {
      // Mark onboarding as completed in settings table
      await invoke("set_setting", {
        key: "onboarding_completed",
        value: "true",
      });

      // Close wizard and reset state
      setShowOnboarding(false);
      reset();
    } catch (err) {
      // Review Fix #3: Show error, don't close wizard on failure
      const errorMessage = err instanceof Error ? err.message : "Failed to save onboarding status";
      setSaveError(errorMessage);
      setIsCompleting(false);
    }
  };

  return (
    <div className="onboarding-step">
      <h2 id="onboarding-title">You're All Set!</h2>
      <p className="onboarding-step__message">
        Paste a job post to get started with your first proposal.
      </p>

      {saveError && <p className="onboarding-step__error">{saveError}</p>}

      <div className="onboarding-step__actions">
        <button
          className="button button--primary"
          onClick={handleComplete}
          disabled={isCompleting}
          autoFocus
        >
          {isCompleting ? "Finishing..." : saveError ? "Retry" : "Start Using App"}
        </button>
      </div>
    </div>
  );
}

export default ReadyStep;
