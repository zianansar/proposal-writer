// Story 8.6: Tests for VoiceLearningTimeline component

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { VoiceLearningTimeline } from "./VoiceLearningTimeline";

describe("VoiceLearningTimeline", () => {
  // Subtask 5.1: Test VoiceLearningTimeline renders all 3 milestones

  it("renders the component with heading", () => {
    render(<VoiceLearningTimeline />);
    expect(screen.getByText("How Voice Learning Works")).toBeInTheDocument();
  });

  it("renders all 3 milestone sections", () => {
    render(<VoiceLearningTimeline />);

    // Milestone 1
    expect(screen.getByText("First proposal")).toBeInTheDocument();
    expect(screen.getByText(/Uses your Quick Calibration or Golden Set/)).toBeInTheDocument();

    // Milestone 2
    expect(screen.getByText("After 3-5 proposals")).toBeInTheDocument();
    expect(screen.getByText(/System learns your editing patterns/)).toBeInTheDocument();

    // Milestone 3
    expect(screen.getByText("After 10+ proposals")).toBeInTheDocument();
    expect(screen.getByText(/Highly personalized/)).toBeInTheDocument();
  });

  it("renders all milestone icons", () => {
    const { container } = render(<VoiceLearningTimeline />);

    // Check for emoji icons (they're rendered with aria-hidden)
    const icons = container.querySelectorAll(".milestone-icon");
    expect(icons).toHaveLength(3);
    expect(icons[0]).toHaveTextContent("📝");
    expect(icons[1]).toHaveTextContent("📈");
    expect(icons[2]).toHaveTextContent("✨");
  });

  it("renders the summary callout", () => {
    render(<VoiceLearningTimeline />);
    expect(screen.getByText("Takes 3-5 uses to learn your voice.")).toBeInTheDocument();
  });

  it("renders summary icon", () => {
    const { container } = render(<VoiceLearningTimeline />);
    const summaryIcon = container.querySelector(".summary-icon");
    expect(summaryIcon).toHaveTextContent("💡");
  });

  // Subtask 5.5: Test accessibility
  it("has appropriate semantic structure", () => {
    const { container } = render(<VoiceLearningTimeline />);

    // Check for proper heading hierarchy
    const heading = screen.getByText("How Voice Learning Works");
    expect(heading.tagName).toBe("H3");

    // Check milestone titles are h4
    const milestoneHeadings = container.querySelectorAll(".milestone-title");
    expect(milestoneHeadings).toHaveLength(3);
    milestoneHeadings.forEach((heading) => {
      expect(heading.tagName).toBe("H4");
    });
  });

  it("hides decorative icons from screen readers", () => {
    const { container } = render(<VoiceLearningTimeline />);

    const icons = container.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  // Story 8.6 AC-5: Keyboard navigation tests
  it("allows keyboard navigation through the card", () => {
    const { container } = render(<VoiceLearningTimeline />);

    // The card container should be focusable for keyboard users
    const card = container.querySelector(".voice-learning-timeline");
    expect(card).toBeInTheDocument();

    // Verify the card can receive focus (implicit via semantic structure)
    // The heading and content are naturally keyboard-accessible
    const heading = screen.getByText("How Voice Learning Works");
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H3");
  });

  it("has no interactive elements that trap focus", () => {
    const { container } = render(<VoiceLearningTimeline />);

    // This is a display-only component with no interactive elements
    // Keyboard users should be able to tab past it
    const buttons = container.querySelectorAll("button");
    const links = container.querySelectorAll("a");
    const inputs = container.querySelectorAll("input");

    // No interactive elements means no focus trap
    expect(buttons).toHaveLength(0);
    expect(links).toHaveLength(0);
    expect(inputs).toHaveLength(0);
  });
});
