import { describe, it, expect, beforeEach } from "vitest";
import { useOnboardingStore } from "./useOnboardingStore";

describe("useOnboardingStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setShowOnboarding(false);
  });

  it("initializes with default values", () => {
    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.showOnboarding).toBe(false);
  });

  it("sets current step", () => {
    useOnboardingStore.getState().setCurrentStep(3);
    expect(useOnboardingStore.getState().currentStep).toBe(3);
  });

  it("sets show onboarding", () => {
    useOnboardingStore.getState().setShowOnboarding(true);
    expect(useOnboardingStore.getState().showOnboarding).toBe(true);
  });

  it("resets state", () => {
    const { setCurrentStep, reset } = useOnboardingStore.getState();

    setCurrentStep(3);

    reset();

    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe(1);
  });
});
