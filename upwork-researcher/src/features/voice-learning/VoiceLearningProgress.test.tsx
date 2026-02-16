// Story 8.6: Tests for VoiceLearningProgress component

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { getVoiceLearningStatus } from "./types";
import { VoiceLearningProgress } from "./VoiceLearningProgress";

describe("VoiceLearningProgress", () => {
  // Subtask 5.2: Test progress indicator shows correct status for 0, 3, 5, 10, 15 proposals

  it("shows correct message for 0 proposals", () => {
    const progress = getVoiceLearningStatus(0);
    render(<VoiceLearningProgress progress={progress} />);
    expect(screen.getByText("Proposals edited: 0 (no proposals yet)")).toBeInTheDocument();
  });

  it("shows correct message for 3 proposals (learning)", () => {
    const progress = getVoiceLearningStatus(3);
    render(<VoiceLearningProgress progress={progress} />);
    expect(screen.getByText("Proposals edited: 3/5 (learning in progress)")).toBeInTheDocument();
  });

  it("shows correct message for 5 proposals (refining)", () => {
    const progress = getVoiceLearningStatus(5);
    render(<VoiceLearningProgress progress={progress} />);
    expect(screen.getByText("Proposals edited: 5/10 (refining your style)")).toBeInTheDocument();
  });

  it("shows correct message for 10 proposals (personalized)", () => {
    const progress = getVoiceLearningStatus(10);
    render(<VoiceLearningProgress progress={progress} />);
    expect(screen.getByText("Proposals edited: 10 ✓ (highly personalized)")).toBeInTheDocument();
  });

  it("shows correct message for 15 proposals (personalized)", () => {
    const progress = getVoiceLearningStatus(15);
    render(<VoiceLearningProgress progress={progress} />);
    expect(screen.getByText("Proposals edited: 15 ✓ (highly personalized)")).toBeInTheDocument();
  });

  // Subtask 5.3: Test progress bar fills proportionally

  it("renders progress bar with correct percentage", () => {
    const progress = getVoiceLearningStatus(5);
    const { container } = render(<VoiceLearningProgress progress={progress} />);

    const progressIndicator = container.querySelector(".progress-indicator");
    expect(progressIndicator).toHaveStyle({ width: "50%" });
  });

  it("renders progress bar at 0% for 0 proposals", () => {
    const progress = getVoiceLearningStatus(0);
    const { container } = render(<VoiceLearningProgress progress={progress} />);

    const progressIndicator = container.querySelector(".progress-indicator");
    expect(progressIndicator).toHaveStyle({ width: "0%" });
  });

  it("renders progress bar at 100% for 10+ proposals", () => {
    const progress10 = getVoiceLearningStatus(10);
    const { container: container10 } = render(<VoiceLearningProgress progress={progress10} />);
    const indicator10 = container10.querySelector(".progress-indicator");
    expect(indicator10).toHaveStyle({ width: "100%" });

    const progress15 = getVoiceLearningStatus(15);
    const { container: container15 } = render(<VoiceLearningProgress progress={progress15} />);
    const indicator15 = container15.querySelector(".progress-indicator");
    expect(indicator15).toHaveStyle({ width: "100%" });
  });

  // Subtask 5.5: Test accessibility

  it("has aria-live region for progress updates", () => {
    const progress = getVoiceLearningStatus(3);
    render(<VoiceLearningProgress progress={progress} />);

    const liveRegion = screen.getByText(/Proposals edited:/);
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-atomic", "true");
  });

  it("has accessible aria-label on progress bar", () => {
    const progress = getVoiceLearningStatus(5);
    const { container } = render(<VoiceLearningProgress progress={progress} />);

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveAttribute(
      "aria-label",
      "Voice learning progress: 5 proposals edited, 50% complete",
    );
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  // Milestone markers

  it("renders milestone markers at 5 and 10", () => {
    const progress = getVoiceLearningStatus(3);
    const { container } = render(<VoiceLearningProgress progress={progress} />);

    const markers = container.querySelectorAll(".progress-marker");
    expect(markers).toHaveLength(2);

    expect(markers[0]).toHaveStyle({ left: "50%" });
    expect(markers[0].querySelector(".marker-label")).toHaveTextContent("5");

    expect(markers[1]).toHaveStyle({ left: "100%" });
    expect(markers[1].querySelector(".marker-label")).toHaveTextContent("10");
  });

  it("highlights markers when milestones are reached", () => {
    const progress = getVoiceLearningStatus(7);
    const { container } = render(<VoiceLearningProgress progress={progress} />);

    const markers = container.querySelectorAll(".progress-marker");

    // Marker at 5 should be reached
    expect(markers[0]).toHaveClass("progress-marker--reached");

    // Marker at 10 should NOT be reached
    expect(markers[1]).not.toHaveClass("progress-marker--reached");
  });

  it("highlights both markers when count >= 10", () => {
    const progress = getVoiceLearningStatus(10);
    const { container } = render(<VoiceLearningProgress progress={progress} />);

    const markers = container.querySelectorAll(".progress-marker");
    expect(markers[0]).toHaveClass("progress-marker--reached");
    expect(markers[1]).toHaveClass("progress-marker--reached");
  });
});
