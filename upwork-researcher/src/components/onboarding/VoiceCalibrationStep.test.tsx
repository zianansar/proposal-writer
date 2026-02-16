import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useOnboardingStore } from "../../stores/useOnboardingStore";

import VoiceCalibrationStep from "./VoiceCalibrationStep";

// Mock GoldenSetUpload to avoid Tauri API calls in tests
vi.mock("../../features/voice-learning", () => ({
  GoldenSetUpload: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="mock-golden-set-upload">
      <button onClick={onComplete}>Mock Complete</button>
    </div>
  ),
}));

// Wrapper for components that use react-router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe("VoiceCalibrationStep", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it("displays voice calibration heading with optional label", () => {
    renderWithRouter(<VoiceCalibrationStep />);
    expect(screen.getByText("Voice Calibration (Optional)")).toBeInTheDocument();
  });

  it("displays both upload and questionnaire options", () => {
    renderWithRouter(<VoiceCalibrationStep />);
    expect(screen.getByText("Option 1: Upload Past Proposals")).toBeInTheDocument();
    expect(screen.getByText("Option 2: Quick Questionnaire")).toBeInTheDocument();
  });

  it("shows option hints and questionnaire coming soon placeholder", () => {
    renderWithRouter(<VoiceCalibrationStep />);
    expect(screen.getByText(/Upload 3-5 of your best proposals/)).toBeInTheDocument();
    expect(screen.getByText(/Answer 5 questions about your approach/)).toBeInTheDocument();
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();
  });

  it("has Skip for now button prominently displayed", () => {
    renderWithRouter(<VoiceCalibrationStep />);
    const skipButton = screen.getByRole("button", { name: /skip for now/i });
    expect(skipButton).toBeInTheDocument();
    expect(skipButton).toHaveClass("button--primary"); // Primary button makes it prominent
  });

  it("advances to step 4 when Skip is clicked", async () => {
    const user = userEvent.setup();
    useOnboardingStore.getState().setCurrentStep(3);

    renderWithRouter(<VoiceCalibrationStep />);

    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    expect(useOnboardingStore.getState().currentStep).toBe(4);
  });

  it("goes back to step 2 when Back button is clicked", async () => {
    const user = userEvent.setup();
    useOnboardingStore.getState().setCurrentStep(3);

    renderWithRouter(<VoiceCalibrationStep />);

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(useOnboardingStore.getState().currentStep).toBe(2);
  });

  // Story 8.6 AC-3: Condensed timeline after calibration complete
  describe("Voice Learning Timeline (AC-3)", () => {
    it("shows condensed timeline message after calibration completes", async () => {
      const user = userEvent.setup();
      renderWithRouter(<VoiceCalibrationStep />);

      // Click Upload Proposals to enter golden-set mode
      await user.click(screen.getByRole("button", { name: /upload proposals/i }));

      // The mock GoldenSetUpload should be rendered
      expect(screen.getByTestId("mock-golden-set-upload")).toBeInTheDocument();

      // Click the mock complete button to trigger handleGoldenSetComplete
      await user.click(screen.getByRole("button", { name: /mock complete/i }));

      // Now we should see the condensed timeline message
      expect(screen.getByText("Voice Profile Created!")).toBeInTheDocument();
      expect(screen.getByText("Takes 3-5 uses to learn your voice.")).toBeInTheDocument();
    });

    it("displays Learn More link after calibration", async () => {
      const user = userEvent.setup();
      renderWithRouter(<VoiceCalibrationStep />);

      // Enter golden-set mode and complete
      await user.click(screen.getByRole("button", { name: /upload proposals/i }));
      await user.click(screen.getByRole("button", { name: /mock complete/i }));

      // Verify the Learn More link is present
      expect(screen.getByRole("button", { name: /learn more/i })).toBeInTheDocument();
    });

    it("has Continue button after calibration", async () => {
      const user = userEvent.setup();
      renderWithRouter(<VoiceCalibrationStep />);

      // Enter golden-set mode and complete
      await user.click(screen.getByRole("button", { name: /upload proposals/i }));
      await user.click(screen.getByRole("button", { name: /mock complete/i }));

      // Verify Continue button advances to step 4
      await user.click(screen.getByRole("button", { name: /continue/i }));
      expect(useOnboardingStore.getState().currentStep).toBe(4);
    });
  });
});
