/**
 * JobScoreBadge Component Tests (Story 4b.5 Task 4.4)
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { JobScoreBadge } from "./JobScoreBadge";

describe("JobScoreBadge", () => {
  it("renders green badge for green flag", () => {
    render(<JobScoreBadge overallScore={85.0} colorFlag="green" />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveClass("job-score-badge--green");
    expect(badge).toHaveTextContent("Overall: 85.0");
    expect(badge).toHaveTextContent("Green");
  });

  it("renders yellow badge for yellow flag", () => {
    render(<JobScoreBadge overallScore={65.5} colorFlag="yellow" />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveClass("job-score-badge--yellow");
    expect(badge).toHaveTextContent("Overall: 65.5");
    expect(badge).toHaveTextContent("Yellow");
  });

  it("renders red badge for red flag", () => {
    render(<JobScoreBadge overallScore={40.0} colorFlag="red" />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveClass("job-score-badge--red");
    expect(badge).toHaveTextContent("Overall: 40.0");
    expect(badge).toHaveTextContent("Red");
  });

  it("renders gray badge for null score", () => {
    render(<JobScoreBadge overallScore={null} colorFlag="gray" />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveClass("job-score-badge--gray");
    expect(badge).toHaveTextContent("Configure skills in Settings");
    expect(badge).not.toHaveTextContent("Gray"); // No flag shown for null score
  });

  it("displays score with 1 decimal place", () => {
    // L1 note: This test verifies the FRONTEND display formatting (JavaScript toFixed).
    // The Rust backend rounds to 1 decimal BEFORE sending to frontend (scoring.rs:60).
    // Backend rounding is tested in scoring::tests::test_rounding.
    // This test ensures the frontend doesn't add additional rounding artifacts.
    render(<JobScoreBadge overallScore={72.456} colorFlag="yellow" />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Overall: 72.5"); // Frontend toFixed(1)
  });

  it("has correct aria-label for accessibility", () => {
    render(<JobScoreBadge overallScore={78.5} colorFlag="yellow" />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Overall job score: 78.5 out of 100, Yellow priority",
    );
  });

  it("has correct aria-label for null score", () => {
    render(<JobScoreBadge overallScore={null} colorFlag="gray" />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Overall job score not available. Please configure your skills in Settings.",
    );
  });

  it("applies correct CSS class per color flag", () => {
    const { rerender } = render(<JobScoreBadge overallScore={50} colorFlag="green" />);
    expect(screen.getByRole("status")).toHaveClass("job-score-badge--green");

    rerender(<JobScoreBadge overallScore={50} colorFlag="yellow" />);
    expect(screen.getByRole("status")).toHaveClass("job-score-badge--yellow");

    rerender(<JobScoreBadge overallScore={50} colorFlag="red" />);
    expect(screen.getByRole("status")).toHaveClass("job-score-badge--red");

    rerender(<JobScoreBadge overallScore={null} colorFlag="gray" />);
    expect(screen.getByRole("status")).toHaveClass("job-score-badge--gray");
  });

  it("renders at threshold boundaries correctly", () => {
    // Green threshold: skills ≥75 AND quality ≥80
    render(<JobScoreBadge overallScore={82.0} colorFlag="green" />);
    expect(screen.getByRole("status")).toHaveTextContent("Overall: 82.0");
    expect(screen.getByRole("status")).toHaveTextContent("Green");
  });

  it("renders yellow at boundary (just below green)", () => {
    // Yellow: skills 74.9 or quality 79
    render(<JobScoreBadge overallScore={76.5} colorFlag="yellow" />);
    expect(screen.getByRole("status")).toHaveTextContent("Overall: 76.5");
    expect(screen.getByRole("status")).toHaveTextContent("Yellow");
  });

  it("renders red at boundary (just below yellow)", () => {
    // Red: skills <50 or quality <60
    render(<JobScoreBadge overallScore={45.0} colorFlag="red" />);
    expect(screen.getByRole("status")).toHaveTextContent("Overall: 45.0");
    expect(screen.getByRole("status")).toHaveTextContent("Red");
  });

  // Story 4b.6 Review: Clickable badge tests (AC #5)
  describe("Clickable badge with onToggle", () => {
    it("renders as button when onToggle is provided", () => {
      const onToggle = vi.fn();
      render(<JobScoreBadge overallScore={75.0} colorFlag="yellow" onToggle={onToggle} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-controls", "scoring-breakdown");
    });

    it("calls onToggle when clicked", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<JobScoreBadge overallScore={75.0} colorFlag="yellow" onToggle={onToggle} />);

      await user.click(screen.getByRole("button"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("calls onToggle when Enter key is pressed", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<JobScoreBadge overallScore={75.0} colorFlag="yellow" onToggle={onToggle} />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("calls onToggle when Space key is pressed", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<JobScoreBadge overallScore={75.0} colorFlag="yellow" onToggle={onToggle} />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("calls onToggle when Escape key is pressed and isExpanded is true (AC #5)", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(
        <JobScoreBadge
          overallScore={75.0}
          colorFlag="yellow"
          onToggle={onToggle}
          isExpanded={true}
        />,
      );

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Escape}");
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("does not call onToggle when Escape key is pressed and isExpanded is false", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(
        <JobScoreBadge
          overallScore={75.0}
          colorFlag="yellow"
          onToggle={onToggle}
          isExpanded={false}
        />,
      );

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Escape}");
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("shows chevron icon when score is not null", () => {
      const onToggle = vi.fn();
      render(<JobScoreBadge overallScore={75.0} colorFlag="yellow" onToggle={onToggle} />);

      const chevron = screen.getByText("▼");
      expect(chevron).toBeInTheDocument();
      expect(chevron).toHaveClass("job-score-badge__chevron");
    });

    it("rotates chevron when isExpanded is true", () => {
      const onToggle = vi.fn();
      render(
        <JobScoreBadge
          overallScore={75.0}
          colorFlag="yellow"
          onToggle={onToggle}
          isExpanded={true}
        />,
      );

      const chevron = screen.getByText("▼");
      expect(chevron).toHaveClass("job-score-badge__chevron--rotated");
    });

    it("updates aria-expanded based on isExpanded prop", () => {
      const onToggle = vi.fn();
      const { rerender } = render(
        <JobScoreBadge
          overallScore={75.0}
          colorFlag="yellow"
          onToggle={onToggle}
          isExpanded={false}
        />,
      );

      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");

      rerender(
        <JobScoreBadge
          overallScore={75.0}
          colorFlag="yellow"
          onToggle={onToggle}
          isExpanded={true}
        />,
      );

      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    });

    it('includes "Click for breakdown" in aria-label when onToggle provided', () => {
      const onToggle = vi.fn();
      render(<JobScoreBadge overallScore={75.0} colorFlag="yellow" onToggle={onToggle} />);

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Click for breakdown"),
      );
    });
  });
});
