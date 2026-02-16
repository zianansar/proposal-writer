/**
 * Story 4a.4: Hidden Needs Display Tests
 * Task 6.8-6.10: Component rendering tests
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import HiddenNeedsDisplay from "./HiddenNeedsDisplay";

describe("HiddenNeedsDisplay", () => {
  it("Task 6.8: renders need and evidence for 2 items", () => {
    const hiddenNeeds = [
      {
        need: "Time-pressured",
        evidence: "Mentions 'urgent' and 'ASAP'",
      },
      {
        need: "Budget-conscious",
        evidence: "Emphasizes 'cost-effective solution'",
      },
    ];

    render(<HiddenNeedsDisplay hiddenNeeds={hiddenNeeds} />);

    // Verify first need (label now provided by parent panel, not this component)
    expect(screen.getByText("Time-pressured")).toBeInTheDocument();
    expect(screen.getByText("→ Mentions 'urgent' and 'ASAP'")).toBeInTheDocument();

    // Verify second need
    expect(screen.getByText("Budget-conscious")).toBeInTheDocument();
    expect(screen.getByText("→ Emphasizes 'cost-effective solution'")).toBeInTheDocument();
  });

  it("Task 6.9: shows 'No hidden needs detected' for empty array", () => {
    render(<HiddenNeedsDisplay hiddenNeeds={[]} />);

    expect(screen.getByText("No hidden needs detected")).toBeInTheDocument();

    // Should NOT show "Hidden Needs:" label when empty
    expect(screen.queryByText("Hidden Needs:")).not.toBeInTheDocument();
  });

  it("renders single hidden need correctly", () => {
    const hiddenNeeds = [
      {
        need: "Risk-averse",
        evidence: "Requires 'proven track record'",
      },
    ];

    render(<HiddenNeedsDisplay hiddenNeeds={hiddenNeeds} />);

    // Label now provided by parent panel, component just renders the list
    expect(screen.getByText("Risk-averse")).toBeInTheDocument();
    expect(screen.getByText("→ Requires 'proven track record'")).toBeInTheDocument();
  });

  it("Task 6.10: component handles conditional rendering based on analysis state", () => {
    // This test verifies the component itself handles empty state correctly
    // The actual "not rendered before analysis" logic is in App.tsx via hasAnalyzed flag
    // When hasAnalyzed is false, App.tsx doesn't render HiddenNeedsDisplay at all
    // Here we verify the component returns appropriate UI for empty array (pre-analysis equivalent)
    const { container } = render(<HiddenNeedsDisplay hiddenNeeds={[]} />);

    // Should show empty state, not the list container
    expect(screen.queryByText("Hidden Needs:")).not.toBeInTheDocument();
    expect(container.querySelector(".hidden-needs-container")).not.toBeInTheDocument();
    expect(screen.getByText("No hidden needs detected")).toBeInTheDocument();
  });

  it("AC-2: renders need as primary text and evidence as secondary", () => {
    const hiddenNeeds = [
      {
        need: "Long-term partnership",
        evidence: "States 'ongoing monthly project'",
      },
    ];

    const { container } = render(<HiddenNeedsDisplay hiddenNeeds={hiddenNeeds} />);

    // Verify structure
    const needLabel = container.querySelector(".hidden-need-label");
    const needEvidence = container.querySelector(".hidden-need-evidence");

    expect(needLabel).toHaveTextContent("Long-term partnership");
    expect(needEvidence).toHaveTextContent("→ States 'ongoing monthly project'");
  });

  it("renders multiple needs in a list", () => {
    const hiddenNeeds = [
      { need: "Need 1", evidence: "Evidence 1" },
      { need: "Need 2", evidence: "Evidence 2" },
      { need: "Need 3", evidence: "Evidence 3" },
    ];

    const { container } = render(<HiddenNeedsDisplay hiddenNeeds={hiddenNeeds} />);

    const listItems = container.querySelectorAll(".hidden-need-item");
    expect(listItems).toHaveLength(3);
  });

  it("has proper accessibility attributes", () => {
    const hiddenNeeds = [{ need: "Test Need", evidence: "Test Evidence" }];

    render(<HiddenNeedsDisplay hiddenNeeds={hiddenNeeds} />);

    // Check for list role and aria-label (label provided by parent panel)
    expect(screen.getByRole("list", { name: "Hidden needs list" })).toBeInTheDocument();
  });

  it("empty state has status role for accessibility", () => {
    render(<HiddenNeedsDisplay hiddenNeeds={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("No hidden needs detected");
  });
});
