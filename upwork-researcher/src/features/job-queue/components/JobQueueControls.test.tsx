/**
 * Job Queue Controls tests - Story 4b.9 Task 8
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import JobQueueControls from "./JobQueueControls";

describe("JobQueueControls", () => {
  const defaultProps = {
    sortBy: "score" as const,
    filter: "all" as const,
    colorCounts: {
      green: 10,
      yellow: 15,
      red: 12,
      gray: 5,
    },
    onSortChange: vi.fn(),
    onFilterChange: vi.fn(),
  };

  it("renders sort dropdown with correct initial value", () => {
    render(<JobQueueControls {...defaultProps} />);

    const select = screen.getByLabelText("Sort by:");
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("score");
  });

  it("renders all sort options (AC-3)", () => {
    render(<JobQueueControls {...defaultProps} />);

    expect(screen.getByRole("option", { name: "Score (High → Low)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Date (Newest)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Client (A-Z)" })).toBeInTheDocument();
  });

  it("calls onSortChange when sort selection changes", () => {
    const onSortChange = vi.fn();
    render(<JobQueueControls {...defaultProps} onSortChange={onSortChange} />);

    const select = screen.getByLabelText("Sort by:");
    fireEvent.change(select, { target: { value: "date" } });

    expect(onSortChange).toHaveBeenCalledWith("date");
  });

  it("renders filter chips with correct labels and counts (AC-5)", () => {
    render(<JobQueueControls {...defaultProps} />);

    // All: 10 + 15 + 12 + 5 = 42
    expect(screen.getByRole("button", { name: /All \(42\)/ })).toBeInTheDocument();
    // Yellow+: 10 + 15 = 25
    expect(screen.getByRole("button", { name: /Yellow\+ \(25\)/ })).toBeInTheDocument();
    // Green Only: 10
    expect(screen.getByRole("button", { name: /Green Only \(10\)/ })).toBeInTheDocument();
  });

  it("shows active class on current filter", () => {
    render(<JobQueueControls {...defaultProps} filter="greenOnly" />);

    const greenButton = screen.getByRole("button", { name: /Green Only \(10\)/ });
    expect(greenButton).toHaveClass("active");
    expect(greenButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onFilterChange when All button clicked", () => {
    const onFilterChange = vi.fn();
    render(
      <JobQueueControls {...defaultProps} onFilterChange={onFilterChange} filter="greenOnly" />,
    );

    const allButton = screen.getByRole("button", { name: /All/ });
    fireEvent.click(allButton);

    expect(onFilterChange).toHaveBeenCalledWith("all");
  });

  it("calls onFilterChange when Yellow+ button clicked", () => {
    const onFilterChange = vi.fn();
    render(<JobQueueControls {...defaultProps} onFilterChange={onFilterChange} />);

    const yellowButton = screen.getByRole("button", { name: /Yellow\+ \(25\)/ });
    fireEvent.click(yellowButton);

    expect(onFilterChange).toHaveBeenCalledWith("yellowAndGreen");
  });

  it("calls onFilterChange when Green Only button clicked", () => {
    const onFilterChange = vi.fn();
    render(<JobQueueControls {...defaultProps} onFilterChange={onFilterChange} />);

    const greenButton = screen.getByRole("button", { name: /Green Only \(10\)/ });
    fireEvent.click(greenButton);

    expect(onFilterChange).toHaveBeenCalledWith("greenOnly");
  });

  it("updates displayed counts when colorCounts changes", () => {
    const { rerender } = render(
      <JobQueueControls {...defaultProps} colorCounts={{ green: 5, yellow: 3, red: 2, gray: 0 }} />,
    );

    // All: 5 + 3 + 2 + 0 = 10
    expect(screen.getByRole("button", { name: /All \(10\)/ })).toBeInTheDocument();
    // Yellow+: 5 + 3 = 8
    expect(screen.getByRole("button", { name: /Yellow\+ \(8\)/ })).toBeInTheDocument();
    // Green Only: 5
    expect(screen.getByRole("button", { name: /Green Only \(5\)/ })).toBeInTheDocument();

    rerender(
      <JobQueueControls
        {...defaultProps}
        colorCounts={{ green: 50, yellow: 30, red: 15, gray: 4 }}
      />,
    );

    // All: 50 + 30 + 15 + 4 = 99
    expect(screen.getByRole("button", { name: /All \(99\)/ })).toBeInTheDocument();
    // Yellow+: 50 + 30 = 80
    expect(screen.getByRole("button", { name: /Yellow\+ \(80\)/ })).toBeInTheDocument();
    // Green Only: 50
    expect(screen.getByRole("button", { name: /Green Only \(50\)/ })).toBeInTheDocument();
  });

  it("reflects sortBy prop changes", () => {
    const { rerender } = render(<JobQueueControls {...defaultProps} sortBy="score" />);

    expect(screen.getByLabelText("Sort by:")).toHaveValue("score");

    rerender(<JobQueueControls {...defaultProps} sortBy="clientName" />);

    expect(screen.getByLabelText("Sort by:")).toHaveValue("clientName");
  });

  it("is keyboard accessible", () => {
    render(<JobQueueControls {...defaultProps} />);

    const select = screen.getByLabelText("Sort by:");
    expect(select).toHaveAttribute("id", "sort-select");

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("aria-pressed");
    });
  });
});
