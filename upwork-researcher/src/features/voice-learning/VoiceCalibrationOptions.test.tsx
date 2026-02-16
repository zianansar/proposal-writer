// Unit tests for VoiceCalibrationOptions component (Story 5.7)
// M2 fix: Add test coverage for entry point component

import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { VoiceCalibrationOptions } from "./VoiceCalibrationOptions";

// Mock child components to isolate VoiceCalibrationOptions tests
vi.mock("./QuickCalibration", () => ({
  QuickCalibration: ({
    onComplete,
    existingAnswers,
  }: {
    onComplete: () => void;
    existingAnswers?: unknown;
  }) => (
    <div data-testid="quick-calibration-mock">
      <span>QuickCalibration Mock</span>
      {existingAnswers && <span data-testid="has-existing-answers">Has existing answers</span>}
      <button onClick={onComplete}>Complete</button>
    </div>
  ),
}));

vi.mock("./components/GoldenSetUpload", () => ({
  GoldenSetUpload: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="golden-set-mock">
      <span>GoldenSetUpload Mock</span>
      <button onClick={onComplete}>Complete</button>
    </div>
  ),
}));

describe("VoiceCalibrationOptions", () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <VoiceCalibrationOptions onComplete={mockOnComplete} {...props} />
      </BrowserRouter>,
    );
  };

  describe("choice screen (AC-1)", () => {
    it("renders calibration choice screen by default", () => {
      renderComponent();

      expect(screen.getByText("Voice Calibration")).toBeInTheDocument();
      expect(screen.getByText(/Choose how you'd like to calibrate/i)).toBeInTheDocument();
    });

    it("shows Upload Past Proposals option", () => {
      renderComponent();

      expect(screen.getByText("Upload Past Proposals")).toBeInTheDocument();
      expect(screen.getByText(/3-5 successful proposals/i)).toBeInTheDocument();
      expect(screen.getByTestId("upload-proposals-button")).toBeInTheDocument();
    });

    it("shows Quick Calibration option with time estimate", () => {
      renderComponent();

      // Use getAllBy since "Quick Calibration" appears in both heading and button
      expect(screen.getAllByText(/Quick Calibration/).length).toBeGreaterThan(0);
      expect(screen.getByText(/No uploads needed/i)).toBeInTheDocument();
      expect(screen.getByText(/Takes about 30 seconds/i)).toBeInTheDocument();
      expect(screen.getByTestId("quick-calibration-button")).toBeInTheDocument();
    });

    it("mentions privacy - proposals never leave device", () => {
      renderComponent();

      expect(screen.getByText(/proposals never leave your device/i)).toBeInTheDocument();
    });
  });

  describe("mode switching", () => {
    it("switches to Golden Set Upload when Upload Proposals is clicked", () => {
      renderComponent();

      fireEvent.click(screen.getByTestId("upload-proposals-button"));

      expect(screen.getByTestId("golden-set-mock")).toBeInTheDocument();
      expect(screen.queryByText("Voice Calibration")).not.toBeInTheDocument();
    });

    it("switches to Quick Calibration when Quick Calibration is clicked", () => {
      renderComponent();

      fireEvent.click(screen.getByTestId("quick-calibration-button"));

      expect(screen.getByTestId("quick-calibration-mock")).toBeInTheDocument();
      expect(screen.queryByText("Voice Calibration")).not.toBeInTheDocument();
    });
  });

  describe("recalibration flow (AC-6)", () => {
    it("shows Recalibrate title when isRecalibration is true", () => {
      renderComponent({ isRecalibration: true });

      expect(screen.getByText("Recalibrate Voice Profile")).toBeInTheDocument();
    });

    it("passes existingAnswers to QuickCalibration", () => {
      const existingAnswers = { tone: "formal" };
      renderComponent({ existingAnswers });

      fireEvent.click(screen.getByTestId("quick-calibration-button"));

      expect(screen.getByTestId("has-existing-answers")).toBeInTheDocument();
    });
  });

  describe("completion callback", () => {
    it("calls onComplete when Golden Set completes", () => {
      renderComponent();

      fireEvent.click(screen.getByTestId("upload-proposals-button"));
      fireEvent.click(screen.getByText("Complete"));

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it("calls onComplete when Quick Calibration completes", () => {
      renderComponent();

      fireEvent.click(screen.getByTestId("quick-calibration-button"));
      fireEvent.click(screen.getByText("Complete"));

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });
});
