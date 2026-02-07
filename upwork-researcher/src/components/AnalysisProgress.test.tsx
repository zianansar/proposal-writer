/**
 * AnalysisProgress Component Tests (Story 4a.6)
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AnalysisProgress from "./AnalysisProgress";

describe("AnalysisProgress", () => {
  // Task 4.1: Renders nothing when stage is idle
  it("renders nothing when stage is idle", () => {
    const { container } = render(<AnalysisProgress stage="idle" />);
    expect(container.firstChild).toBeNull();
  });

  // Task 4.2: Renders "Analyzing job post..." when analyzing
  it('renders "Analyzing job post..." when stage is analyzing', () => {
    render(<AnalysisProgress stage="analyzing" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Analyzing job post...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  // Task 4.3: Renders "Extracting details..." when extracting
  it('renders "Extracting details..." when stage is extracting', () => {
    render(<AnalysisProgress stage="extracting" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Extracting details...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  // Task 4.4: Renders "Complete ✓" with success styling when complete
  it('renders "Complete ✓" with success styling when stage is complete', () => {
    render(<AnalysisProgress stage="complete" />);

    const status = screen.getByTestId("analysis-progress");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    // L4 fix: checkmark now has role="img" with aria-label
    expect(screen.getByRole("img", { name: "success" })).toBeInTheDocument();
    expect(status).toHaveClass("analysis-progress--complete");
    expect(status).toHaveAttribute("aria-busy", "false");
  });

  // Task 4.5: Renders error message with error styling when error
  it("renders error message with error styling when stage is error", () => {
    render(<AnalysisProgress stage="error" errorMessage="API rate limit exceeded" />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
    expect(status).toHaveClass("analysis-progress--error");
    expect(status).toHaveAttribute("aria-busy", "false");
  });

  it("renders default error message when no errorMessage provided", () => {
    render(<AnalysisProgress stage="error" />);

    expect(screen.getByText("Analysis failed")).toBeInTheDocument();
  });

  // Accessibility tests
  it("has aria-live='polite' for screen reader announcements", () => {
    render(<AnalysisProgress stage="analyzing" />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("shows pulsing dot during in-progress stages", () => {
    const { container } = render(<AnalysisProgress stage="analyzing" />);

    const dot = container.querySelector(".analysis-progress__dot");
    expect(dot).toBeInTheDocument();
  });

  it("shows checkmark during complete stage with accessible role", () => {
    render(<AnalysisProgress stage="complete" />);

    // L4 fix: checkmark now has role="img" with aria-label for accessibility
    const checkmark = screen.getByRole("img", { name: "success" });
    expect(checkmark).toBeInTheDocument();
    expect(checkmark).toHaveTextContent("✓");
  });

  // M2 fix: Add AC-3 fast-skip behavior test
  // When fast API response occurs (<1.5s), component should transition directly to complete
  // without showing extracting stage. This is a presentational test - the timer logic
  // is in App.tsx, but component must correctly render skip from analyzing → complete
  it("can skip extracting stage and show complete directly (AC-3 fast-skip)", () => {
    const { rerender } = render(<AnalysisProgress stage="analyzing" />);
    expect(screen.getByText("Analyzing job post...")).toBeInTheDocument();

    // Simulate fast response: skip extracting, go straight to complete
    rerender(<AnalysisProgress stage="complete" />);
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryByText("Extracting details...")).not.toBeInTheDocument();
  });

  // ====================
  // Story 4a.8 Tests: "Saved" Indicator
  // ====================

  // Task 5.10: "Saved" indicator appears after successful analysis
  it('renders "Saved ✓" when stage is saved', () => {
    render(<AnalysisProgress stage="saved" />);

    const status = screen.getByTestId("analysis-progress");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "saved" })).toBeInTheDocument();
    expect(status).toHaveClass("analysis-progress--saved");
    expect(status).toHaveAttribute("aria-busy", "false");
  });

  // Task 5.11: "Saved" indicator auto-dismisses (timer logic in App.tsx)
  it("transitions from complete to saved to idle", () => {
    const { rerender } = render(<AnalysisProgress stage="complete" />);
    expect(screen.getByText("Complete")).toBeInTheDocument();

    // Transition to saved
    rerender(<AnalysisProgress stage="saved" />);
    expect(screen.getByText("Saved")).toBeInTheDocument();

    // Transition to idle (dismissed)
    rerender(<AnalysisProgress stage="idle" />);
    const { container } = render(<AnalysisProgress stage="idle" />);
    expect(container.firstChild).toBeNull();
  });
});
