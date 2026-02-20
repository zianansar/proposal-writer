import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useSettings } from "../hooks/useSettings";
import { HookStrategy } from "../types/hooks";

import HookStrategySelector from "./HookStrategySelector";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Story 10.5 C-3/C-4: Mock useSettings for badge visibility logic
const mockSetNewStrategiesDismissed = vi.fn().mockResolvedValue(undefined);
vi.mock("../hooks/useSettings", () => ({
  useSettings: vi.fn(() => ({
    newStrategiesFirstSeen: {},
    newStrategiesDismissed: {},
    setNewStrategiesDismissed: mockSetNewStrategiesDismissed,
  })),
}));

// Story 10.3: Mock useStrategySyncListener (Tauri event listener)
vi.mock("../hooks/useStrategySyncListener", () => ({
  useStrategySyncListener: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

const mockUseSettings = vi.mocked(useSettings);

describe("HookStrategySelector", () => {
  // M3 Code Review Fix: Mock console methods to silence expected error/warn logs
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });
  const mockStrategies: HookStrategy[] = [
    {
      id: 1,
      name: "Social Proof",
      description: "Lead with relevant experience",
      examples_json: '["Example 1", "Example 2"]',
      best_for: "Experienced freelancers",
      created_at: "2026-02-09",
      status: "active",
      remote_id: null,
      ab_weight: 0.2,
    },
    {
      id: 2,
      name: "Contrarian",
      description: "Challenge assumptions",
      examples_json: '["Example A", "Example B"]',
      best_for: "Bold freelancers",
      created_at: "2026-02-09",
      status: "active",
      remote_id: null,
      ab_weight: 0.2,
    },
    {
      id: 3,
      name: "Immediate Value",
      description: "Show quick wins",
      examples_json: '["Example X", "Example Y"]',
      best_for: "Results-driven freelancers",
      created_at: "2026-02-09",
      status: "active",
      remote_id: null,
      ab_weight: 0.2,
    },
    {
      id: 4,
      name: "Problem-Aware",
      description: "Demonstrate understanding",
      examples_json: '["Example M", "Example N"]',
      best_for: "Consultative freelancers",
      created_at: "2026-02-09",
      status: "active",
      remote_id: null,
      ab_weight: 0.2,
    },
    {
      id: 5,
      name: "Question-Based",
      description: "Ask insightful questions",
      examples_json: '["Example P", "Example Q"]',
      best_for: "Curious freelancers",
      created_at: "2026-02-09",
      status: "active",
      remote_id: null,
      ab_weight: 0.2,
    },
  ];

  const mockOnSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display loading skeleton while fetching", async () => {
    // Story 5.2: AC-6 - Loading state
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    expect(screen.getByTestId("hook-selector-loading")).toBeInTheDocument();
    // Verify 5 skeleton cards are present
    const skeletons = document.querySelectorAll(".hook-card-skeleton");
    expect(skeletons).toHaveLength(5);
  });

  it("should fetch strategies from Tauri on mount", async () => {
    // Story 5.2: AC-1, Subtask 4.2
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_hook_strategies");
    });
  });

  it("should display 5 strategy cards when data loads", async () => {
    // Story 5.2: AC-1
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    const cards = screen.getAllByRole("radio");
    expect(cards).toHaveLength(5);
  });

  it("should pre-select 'Social Proof' by default", async () => {
    // Story 5.2: AC-2, Subtask 4.4
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      const socialProofCard = screen.getByLabelText(/Social Proof.*Selected/);
      expect(socialProofCard).toBeInTheDocument();
      expect(socialProofCard).toHaveAttribute("aria-checked", "true");
    });
  });

  it("should call onSelectionChange with Social Proof id on load", async () => {
    // Story 5.2: AC-2, Subtask 4.9
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(mockOnSelectionChange).toHaveBeenCalledWith(1); // Social Proof id = 1
    });
  });

  it("should update selection when a different card is clicked", async () => {
    // Story 5.2: AC-3
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // Clear initial selection call
    mockOnSelectionChange.mockClear();

    // Click on "Contrarian" card
    const contrarianCard = screen.getByLabelText(/Contrarian.*Not selected/);
    fireEvent.click(contrarianCard);

    expect(mockOnSelectionChange).toHaveBeenCalledWith(2); // Contrarian id = 2
  });

  it("should update visual state when selection changes", async () => {
    // Story 5.2: AC-3 - Visual feedback
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // Click on "Contrarian" card
    const contrarianCard = screen.getByLabelText(/Contrarian.*Not selected/);
    fireEvent.click(contrarianCard);

    await waitFor(() => {
      expect(screen.getByLabelText(/Contrarian.*Selected/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Social Proof.*Not selected/)).toBeInTheDocument();
    });
  });

  it("should display error message on fetch failure", async () => {
    // Story 5.2: AC-6 - Error handling
    mockInvoke.mockRejectedValue(new Error("Database error"));

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByTestId("hook-selector-error")).toBeInTheDocument();
      expect(screen.getByText(/Unable to load hook strategies/)).toBeInTheDocument();
    });
  });

  it("should display retry button on error", async () => {
    // Story 5.2: AC-6 - Retry capability
    mockInvoke.mockRejectedValue(new Error("Network error"));

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByTestId("retry-button")).toBeInTheDocument();
    });
  });

  it("should retry fetch when retry button is clicked", async () => {
    // Story 5.2: AC-6 - Retry mechanism
    mockInvoke
      .mockRejectedValueOnce(new Error("First attempt failed"))
      .mockResolvedValueOnce(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    // Wait for error
    await waitFor(() => {
      expect(screen.getByTestId("retry-button")).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByTestId("retry-button");
    fireEvent.click(retryButton);

    // Should show loading
    expect(screen.getByTestId("hook-selector-loading")).toBeInTheDocument();

    // Should fetch again and succeed
    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("should default to first strategy if Social Proof not found", async () => {
    // Story 5.2: Subtask 4.4 - Fallback behavior
    const strategiesWithoutSocialProof = mockStrategies.filter((s) => s.name !== "Social Proof");

    mockInvoke.mockResolvedValue(strategiesWithoutSocialProof);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(mockOnSelectionChange).toHaveBeenCalledWith(2); // Contrarian id = 2 (first in filtered list)
    });
  });

  it("should parse examples_json and pass firstExample to cards", async () => {
    // Story 5.2: Integration with parseHookStrategy
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      // First example from Social Proof: "Example 1"
      expect(screen.getByText(/"Example 1"/)).toBeInTheDocument();
    });
  });

  it("should have role=radiogroup for accessibility", async () => {
    // Story 5.2: AC-5 (via AC-6) - Accessibility
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup).toHaveAttribute("aria-label", "Hook strategies");
    });
  });

  it("should navigate to next card with ArrowRight key", async () => {
    // Story 5.2: AC-5 - Arrow key navigation (Code Review H1 fix)
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // Focus first card and press ArrowRight
    const cards = screen.getAllByRole("radio");
    cards[0].focus();
    fireEvent.keyDown(cards[0], { key: "ArrowRight" });

    // Second card should now be focused
    expect(document.activeElement).toBe(cards[1]);
  });

  it("should navigate to previous card with ArrowLeft key", async () => {
    // Story 5.2: AC-5 - Arrow key navigation (Code Review H1 fix)
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // Focus second card and press ArrowLeft
    const cards = screen.getAllByRole("radio");
    cards[1].focus();
    fireEvent.keyDown(cards[1], { key: "ArrowLeft" });

    // First card should now be focused
    expect(document.activeElement).toBe(cards[0]);
  });

  it("should wrap around when navigating past last card", async () => {
    // Story 5.2: AC-5 - Arrow key navigation wraps around
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // Focus last card and press ArrowRight
    const cards = screen.getAllByRole("radio");
    cards[4].focus();
    fireEvent.keyDown(cards[4], { key: "ArrowRight" });

    // Should wrap to first card
    expect(document.activeElement).toBe(cards[0]);
  });

  it("should navigate with ArrowDown like ArrowRight", async () => {
    // Story 5.2: AC-5 - ArrowDown should work same as ArrowRight
    mockInvoke.mockResolvedValue(mockStrategies);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    const cards = screen.getAllByRole("radio");
    cards[0].focus();
    fireEvent.keyDown(cards[0], { key: "ArrowDown" });

    expect(document.activeElement).toBe(cards[1]);
  });
});

// Story 10.5 C-3/C-4: New badge integration tests
describe("HookStrategySelector - New Badge Integration (Story 10.5)", () => {
  const mockStrategiesWithRemoteId: HookStrategy[] = [
    {
      id: 1,
      name: "Social Proof",
      description: "Lead with relevant experience",
      examples_json: '["Example 1"]',
      best_for: "Experienced freelancers",
      created_at: "2026-02-09",
      status: "active",
      remote_id: "remote-1",
      ab_weight: 0.2,
    },
    {
      id: 2,
      name: "Contrarian",
      description: "Challenge assumptions",
      examples_json: '["Example A"]',
      best_for: "Bold freelancers",
      created_at: "2026-02-09",
      status: "active",
      remote_id: "remote-2",
      ab_weight: 0.2,
    },
  ];

  const mockOnSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset useSettings mock to default
    mockUseSettings.mockReturnValue({
      newStrategiesFirstSeen: {},
      newStrategiesDismissed: {},
      setNewStrategiesDismissed: mockSetNewStrategiesDismissed,
    } as any);
  });

  it("should show NEW badge for strategy with recent firstSeen (C-3)", async () => {
    const now = new Date().toISOString();
    mockUseSettings.mockReturnValue({
      newStrategiesFirstSeen: { "remote-2": now },
      newStrategiesDismissed: {},
      setNewStrategiesDismissed: mockSetNewStrategiesDismissed,
    } as any);
    mockInvoke.mockResolvedValue(mockStrategiesWithRemoteId);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // "Contrarian" (remote-2) should show NEW badge
    expect(screen.getByText("NEW")).toBeInTheDocument();
  });

  it("should not show NEW badge for dismissed strategy (C-3)", async () => {
    const now = new Date().toISOString();
    mockUseSettings.mockReturnValue({
      newStrategiesFirstSeen: { "remote-2": now },
      newStrategiesDismissed: { "remote-2": true },
      setNewStrategiesDismissed: mockSetNewStrategiesDismissed,
    } as any);
    mockInvoke.mockResolvedValue(mockStrategiesWithRemoteId);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // Badge should NOT appear (dismissed)
    expect(screen.queryByText("NEW")).not.toBeInTheDocument();
  });

  it("should not show NEW badge for strategy older than 7 days (C-3)", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    mockUseSettings.mockReturnValue({
      newStrategiesFirstSeen: { "remote-2": eightDaysAgo },
      newStrategiesDismissed: {},
      setNewStrategiesDismissed: mockSetNewStrategiesDismissed,
    } as any);
    mockInvoke.mockResolvedValue(mockStrategiesWithRemoteId);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // Badge should NOT appear (expired)
    expect(screen.queryByText("NEW")).not.toBeInTheDocument();
  });

  it("should dismiss badge on selection (C-4)", async () => {
    const now = new Date().toISOString();
    mockUseSettings.mockReturnValue({
      newStrategiesFirstSeen: { "remote-2": now },
      newStrategiesDismissed: {},
      setNewStrategiesDismissed: mockSetNewStrategiesDismissed,
    } as any);
    mockInvoke.mockResolvedValue(mockStrategiesWithRemoteId);

    render(<HookStrategySelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    // Click on the strategy with the NEW badge
    const contrarianCard = screen.getByLabelText(/Contrarian/);
    fireEvent.click(contrarianCard);

    // setNewStrategiesDismissed should be called with remote-2 dismissed
    expect(mockSetNewStrategiesDismissed).toHaveBeenCalledWith({
      "remote-2": true,
    });
  });
});
