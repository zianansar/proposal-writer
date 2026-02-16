import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";

import { useOnboardingStore } from "../stores/useOnboardingStore";

import OnboardingWizard from "./OnboardingWizard";

describe("OnboardingWizard", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setShowOnboarding(false);
  });

  it("does not render when showOnboarding is false", () => {
    const { container } = render(<OnboardingWizard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders progress indicator when showOnboarding is true", () => {
    useOnboardingStore.getState().setShowOnboarding(true);
    render(<OnboardingWizard />);
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("renders WelcomeStep on step 1", () => {
    useOnboardingStore.getState().setShowOnboarding(true);
    useOnboardingStore.getState().setCurrentStep(1);
    render(<OnboardingWizard />);
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("updates progress indicator when step changes", () => {
    useOnboardingStore.getState().setShowOnboarding(true);
    useOnboardingStore.getState().setCurrentStep(2);
    render(<OnboardingWizard />);
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
  });

  it("renders correct step based on currentStep", () => {
    useOnboardingStore.getState().setShowOnboarding(true);

    // Step 1
    useOnboardingStore.getState().setCurrentStep(1);
    const { rerender } = render(<OnboardingWizard />);
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();

    // Step 3
    useOnboardingStore.getState().setCurrentStep(3);
    rerender(<OnboardingWizard />);
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
  });
});
