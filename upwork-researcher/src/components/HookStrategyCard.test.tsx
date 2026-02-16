import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import HookStrategyCard from "./HookStrategyCard";

describe("HookStrategyCard", () => {
  const mockStrategy = {
    id: 1,
    name: "Social Proof",
    description: "Lead with relevant experience and quantified results",
    firstExample: "I've helped 12 clients in your industry achieve...",
    bestFor: "Experienced freelancers",
  };

  const mockOnSelect = vi.fn();

  beforeEach(() => {
    // Clear mock call history before each test
    mockOnSelect.mockClear();
  });

  it("should render strategy data correctly", () => {
    // Story 5.2: AC-1 - Display name, description, example, best_for
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    expect(screen.getByText("Social Proof")).toBeInTheDocument();
    expect(
      screen.getByText("Lead with relevant experience and quantified results"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/"I've helped 12 clients in your industry achieve..."/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Best for: Experienced freelancers/)).toBeInTheDocument();
  });

  it("should show checkmark when isSelected is true", () => {
    // Story 5.2: AC-3 - Checkmark icon in top-right when selected
    render(<HookStrategyCard {...mockStrategy} isSelected={true} onSelect={mockOnSelect} />);

    const checkmark = screen.getByText("✓");
    expect(checkmark).toBeInTheDocument();
    expect(checkmark).toHaveClass("hook-card__checkmark");
  });

  it("should not show checkmark when isSelected is false", () => {
    // Story 5.2: AC-3 - No checkmark in default state
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });

  it("should call onSelect when clicked", () => {
    // Story 5.2: AC-3 - Click handler triggers selection callback
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    fireEvent.click(card);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(1); // id = 1
  });

  it("should call onSelect when Enter key is pressed", () => {
    // Story 5.2: AC-5 - Keyboard navigation (Enter key)
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    fireEvent.keyDown(card, { key: "Enter" });

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(1);
  });

  it("should call onSelect when Space key is pressed", () => {
    // Story 5.2: AC-5 - Keyboard navigation (Space key)
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    fireEvent.keyDown(card, { key: " " });

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(1);
  });

  it("should have role=radio", () => {
    // Story 5.2: AC-5 - Keyboard accessibility (role="radio")
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    expect(card).toBeInTheDocument();
  });

  it("should have aria-checked based on isSelected", () => {
    // Story 5.2: AC-5 - ARIA attributes for screen readers
    const { rerender } = render(
      <HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />,
    );

    let card = screen.getByRole("radio");
    expect(card).toHaveAttribute("aria-checked", "false");

    // Rerender with isSelected=true
    rerender(<HookStrategyCard {...mockStrategy} isSelected={true} onSelect={mockOnSelect} />);

    card = screen.getByRole("radio");
    expect(card).toHaveAttribute("aria-checked", "true");
  });

  it("should have aria-label with strategy details", () => {
    // Story 5.2: AC-5 - Screen reader support
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    const ariaLabel = card.getAttribute("aria-label");

    expect(ariaLabel).toContain("Social Proof");
    expect(ariaLabel).toContain("Lead with relevant experience");
    expect(ariaLabel).toContain("Not selected");
  });

  it("should announce 'Selected' in aria-label when isSelected is true", () => {
    // Story 5.2: AC-5 - Screen reader announces selection state
    render(<HookStrategyCard {...mockStrategy} isSelected={true} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    const ariaLabel = card.getAttribute("aria-label");

    expect(ariaLabel).toContain("Selected");
    expect(ariaLabel).not.toContain("Not selected");
  });

  it("should have tabIndex=0 for keyboard focus", () => {
    // Story 5.2: AC-5 - Card is keyboard focusable
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    expect(card).toHaveAttribute("tabIndex", "0");
  });

  it("should apply --selected class when isSelected is true", () => {
    // Story 5.2: AC-3 - Visual styling for selected state
    render(<HookStrategyCard {...mockStrategy} isSelected={true} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    expect(card).toHaveClass("hook-card--selected");
  });

  it("should not apply --selected class when isSelected is false", () => {
    // Story 5.2: AC-3 - Default state has no selected class
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    const card = screen.getByRole("radio");
    expect(card).not.toHaveClass("hook-card--selected");
  });

  it("should have data-testid with strategy id", () => {
    // Testing utility - makes it easy to target specific cards
    render(<HookStrategyCard {...mockStrategy} isSelected={false} onSelect={mockOnSelect} />);

    expect(screen.getByTestId("hook-card-1")).toBeInTheDocument();
  });
});
