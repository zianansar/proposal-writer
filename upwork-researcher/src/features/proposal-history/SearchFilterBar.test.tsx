// Tests for SearchFilterBar component (Story 7.3)
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { SearchFilterBar } from "./SearchFilterBar";
import { DEFAULT_FILTERS } from "./useSearchProposals";
import type { ProposalFilters } from "./useSearchProposals";

describe("SearchFilterBar", () => {
  let onFilterChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onFilterChange = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderBar = (
    overrides?: Partial<{
      filters: ProposalFilters;
      hookStrategies: string[];
      resultCount: number;
    }>,
  ) =>
    render(
      <SearchFilterBar
        filters={overrides?.filters ?? DEFAULT_FILTERS}
        onFilterChange={onFilterChange}
        hookStrategies={overrides?.hookStrategies ?? []}
        resultCount={overrides?.resultCount}
      />,
    );

  it("renders search input and filter dropdowns", () => {
    renderBar();

    expect(screen.getByLabelText(/Search proposals/)).toBeInTheDocument();
    expect(screen.getByLabelText(/outcome status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date range/i)).toBeInTheDocument();
  });

  it('has role="search" on container', () => {
    renderBar();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("renders hook strategy dropdown when strategies exist", () => {
    renderBar({ hookStrategies: ["social_proof", "contrarian"] });

    expect(screen.getByLabelText(/hook strategy/i)).toBeInTheDocument();
    expect(screen.getByText("Social Proof")).toBeInTheDocument();
    expect(screen.getByText("Contrarian")).toBeInTheDocument();
  });

  it("hides hook strategy dropdown when no strategies", () => {
    renderBar({ hookStrategies: [] });
    expect(screen.queryByLabelText(/hook strategy/i)).not.toBeInTheDocument();
  });

  // Debounce tests
  it("debounces search input by 300ms (AC-1)", () => {
    renderBar();

    const input = screen.getByLabelText(/Search proposals/);
    fireEvent.change(input, { target: { value: "React" } });

    // Not called immediately
    expect(onFilterChange).not.toHaveBeenCalled();

    // Called after 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      searchText: "React",
    });
  });

  it("resets debounce timer on rapid typing", () => {
    renderBar();

    const input = screen.getByLabelText(/Search proposals/);

    fireEvent.change(input, { target: { value: "R" } });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: "Re" } });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: "React" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only the final value should trigger callback
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      searchText: "React",
    });
  });

  it("debounced search preserves concurrent dropdown changes (CR M-1)", () => {
    // Scenario: user types "React" then immediately changes outcome filter
    // The debounced search should NOT overwrite the outcome filter
    const { rerender } = render(
      <SearchFilterBar
        filters={DEFAULT_FILTERS}
        onFilterChange={onFilterChange}
        hookStrategies={[]}
      />,
    );

    const input = screen.getByLabelText(/Search proposals/);

    // Step 1: User types "React" — debounce starts (300ms)
    fireEvent.change(input, { target: { value: "React" } });

    // Step 2: At ~100ms, user selects outcome "hired" — fires immediately
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const updatedFilters = { ...DEFAULT_FILTERS, outcomeStatus: "hired" };

    // Simulate parent state update: rerender with new filters
    rerender(
      <SearchFilterBar
        filters={updatedFilters}
        onFilterChange={onFilterChange}
        hookStrategies={[]}
      />,
    );

    // Step 3: At 300ms from typing, debounce fires
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // The debounced call should include BOTH the search text AND the outcome filter
    const lastCall = onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0];
    expect(lastCall.searchText).toBe("React");
    expect(lastCall.outcomeStatus).toBe("hired");
  });

  // Filter selection tests
  it("emits outcome status filter immediately (no debounce)", () => {
    renderBar();

    const select = screen.getByLabelText(/outcome status/i);
    fireEvent.change(select, { target: { value: "hired" } });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      outcomeStatus: "hired",
    });
  });

  it("emits date range filter", () => {
    renderBar();

    const select = screen.getByLabelText(/date range/i);
    fireEvent.change(select, { target: { value: "30" } });

    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      dateRangeDays: 30,
    });
  });

  it("emits hook strategy filter", () => {
    renderBar({ hookStrategies: ["social_proof"] });

    const select = screen.getByLabelText(/hook strategy/i);
    fireEvent.change(select, { target: { value: "social_proof" } });

    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      hookStrategy: "social_proof",
    });
  });

  // Clear filters tests
  it("hides clear button when no filters active (AC-5)", () => {
    renderBar();
    expect(screen.queryByText(/Clear filters/)).not.toBeInTheDocument();
  });

  it("shows clear button when filters are active (AC-5)", () => {
    renderBar({ filters: { ...DEFAULT_FILTERS, outcomeStatus: "hired" } });
    expect(screen.getByText(/Clear filters/)).toBeInTheDocument();
  });

  it("resets all filters on clear click (AC-5)", () => {
    renderBar({
      filters: {
        searchText: "test",
        outcomeStatus: "hired",
        dateRangeDays: 30,
        hookStrategy: "social_proof",
      },
    });

    fireEvent.click(screen.getByText(/Clear filters/));

    expect(onFilterChange).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });

  it("shows active filter count", () => {
    renderBar({
      filters: { searchText: "test", outcomeStatus: "hired", dateRangeDays: 0, hookStrategy: "" },
    });
    expect(screen.getByText(/Clear filters \(2\)/)).toBeInTheDocument();
  });

  // Result count tests
  it("shows result count when provided", () => {
    renderBar({ resultCount: 42 });
    expect(screen.getByText("Showing 42 proposals")).toBeInTheDocument();
  });

  it("shows filtered result count with active filters", () => {
    renderBar({
      filters: { ...DEFAULT_FILTERS, searchText: "test" },
      resultCount: 5,
    });
    expect(screen.getByText("5 results found")).toBeInTheDocument();
  });

  it("uses singular form for 1 result", () => {
    renderBar({
      filters: { ...DEFAULT_FILTERS, searchText: "test" },
      resultCount: 1,
    });
    expect(screen.getByText("1 result found")).toBeInTheDocument();
  });

  it("clears search input value when filters reset externally", () => {
    const { rerender } = render(
      <SearchFilterBar
        filters={{ ...DEFAULT_FILTERS, searchText: "test" }}
        onFilterChange={onFilterChange}
        hookStrategies={[]}
      />,
    );

    const input = screen.getByLabelText(/Search proposals/) as HTMLInputElement;
    expect(input.value).toBe("test");

    // Rerender with empty filters (simulating external clear)
    rerender(
      <SearchFilterBar
        filters={DEFAULT_FILTERS}
        onFilterChange={onFilterChange}
        hookStrategies={[]}
      />,
    );

    expect(input.value).toBe("");
  });

  it("shows all outcome status options", () => {
    renderBar();

    const select = screen.getByLabelText(/outcome status/i);
    const options = select.querySelectorAll("option");

    // "All statuses" + 7 outcome statuses
    expect(options.length).toBe(8);
  });

  it("shows all date range options", () => {
    renderBar();

    const select = screen.getByLabelText(/date range/i);
    const options = select.querySelectorAll("option");

    expect(options.length).toBe(4);
    expect(screen.getByText("All time")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
    expect(screen.getByText("Last 90 days")).toBeInTheDocument();
  });
});
