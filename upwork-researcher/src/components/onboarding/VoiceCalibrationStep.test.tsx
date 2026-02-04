import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useOnboardingStore } from "../../stores/useOnboardingStore";
import VoiceCalibrationStep from "./VoiceCalibrationStep";

describe("VoiceCalibrationStep", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it("displays voice calibration heading with optional label", () => {
    render(<VoiceCalibrationStep />);
    expect(
      screen.getByText("Voice Calibration (Optional)")
    ).toBeInTheDocument();
  });

  it("displays both upload and questionnaire options", () => {
    render(<VoiceCalibrationStep />);
    expect(
      screen.getByText("Option 1: Upload Past Proposals")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Option 2: Quick Questionnaire")
    ).toBeInTheDocument();
  });

  it("shows placeholder text for Epic 6 features", () => {
    render(<VoiceCalibrationStep />);
    expect(
      screen.getByText(/File upload will be implemented in Epic 6/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Questionnaire will be implemented in Epic 6/)
    ).toBeInTheDocument();
  });

  it("has Skip for now button prominently displayed", () => {
    render(<VoiceCalibrationStep />);
    const skipButton = screen.getByRole("button", { name: /skip for now/i });
    expect(skipButton).toBeInTheDocument();
    expect(skipButton).toHaveClass("button--primary"); // Primary button makes it prominent
  });

  it("advances to step 4 when Skip is clicked", async () => {
    const user = userEvent.setup();
    useOnboardingStore.getState().setCurrentStep(3);

    render(<VoiceCalibrationStep />);

    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    expect(useOnboardingStore.getState().currentStep).toBe(4);
  });

  it("goes back to step 2 when Back button is clicked", async () => {
    const user = userEvent.setup();
    useOnboardingStore.getState().setCurrentStep(3);

    render(<VoiceCalibrationStep />);

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(useOnboardingStore.getState().currentStep).toBe(2);
  });
});
