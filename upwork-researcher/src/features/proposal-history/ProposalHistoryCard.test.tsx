// Tests for ProposalHistoryCard component (Story 8.7 + Story 7.2 + Story 7.4)
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProposalHistoryCard } from "./ProposalHistoryCard";
import type { ProposalListItem } from "./types";

describe("ProposalHistoryCard", () => {
  const mockProposal: ProposalListItem = {
    id: 1,
    jobExcerpt: "Looking for a React developer",
    previewText: "I am excited to apply for this position...",
    createdAt: new Date().toISOString(),
    outcomeStatus: "pending",
    hookStrategyId: null,
  };

  const mockStyle = {
    position: "absolute" as const,
    top: 0,
    height: 72,
    width: "100%",
  };

  const mockOnStatusChange = vi.fn();
  const mockOnCardClick = vi.fn();

  beforeEach(() => {
    mockOnStatusChange.mockClear();
    mockOnCardClick.mockClear();
  });

  // Helper to get card div (role=button with aria-label containing "View proposal")
  const getCard = () => screen.getByRole("button", { name: /View proposal/ });

  it("renders proposal details correctly (AC-1)", () => {
    render(<ProposalHistoryCard proposal={mockProposal} style={mockStyle} />);

    expect(screen.getByText("Looking for a React developer")).toBeInTheDocument();
    expect(screen.getByText(/I am excited to apply/)).toBeInTheDocument();
  });

  it("displays relative time for created_at", () => {
    const recentProposal = {
      ...mockProposal,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    };

    render(<ProposalHistoryCard proposal={recentProposal} style={mockStyle} />);

    expect(screen.getByText(/5 minutes ago/)).toBeInTheDocument();
  });

  it("calls onCardClick with proposal id on card click (Story 7.4)", () => {
    render(
      <ProposalHistoryCard
        proposal={mockProposal}
        style={mockStyle}
        onCardClick={mockOnCardClick}
      />,
    );

    fireEvent.click(getCard());
    expect(mockOnCardClick).toHaveBeenCalledWith(1);
  });

  it("calls onCardClick on Enter key press on card", () => {
    render(
      <ProposalHistoryCard
        proposal={mockProposal}
        style={mockStyle}
        onCardClick={mockOnCardClick}
      />,
    );

    fireEvent.keyDown(getCard(), { key: "Enter" });
    expect(mockOnCardClick).toHaveBeenCalledWith(1);
  });

  it("calls onCardClick on Space key press on card", () => {
    render(
      <ProposalHistoryCard
        proposal={mockProposal}
        style={mockStyle}
        onCardClick={mockOnCardClick}
      />,
    );

    fireEvent.keyDown(getCard(), { key: " " });
    expect(mockOnCardClick).toHaveBeenCalledWith(1);
  });

  it("does not crash when onCardClick is not provided", () => {
    render(<ProposalHistoryCard proposal={mockProposal} style={mockStyle} />);

    // Should not throw
    fireEvent.click(getCard());
  });

  it("has correct accessibility attributes on card", () => {
    render(<ProposalHistoryCard proposal={mockProposal} style={mockStyle} />);

    const card = getCard();
    expect(card).toHaveAttribute("tabIndex", "0");
    expect(card).toHaveAttribute("aria-label");
  });

  it("applies correct style prop", () => {
    const { container } = render(<ProposalHistoryCard proposal={mockProposal} style={mockStyle} />);

    const card = container.querySelector(".proposal-history-card") as HTMLElement;
    expect(card.style.height).toBe("72px");
  });

  it("handles empty job excerpt", () => {
    const emptyProposal = {
      ...mockProposal,
      jobExcerpt: "",
    };

    render(<ProposalHistoryCard proposal={emptyProposal} style={mockStyle} />);

    expect(screen.getByText("Untitled Job")).toBeInTheDocument();
  });

  it("handles empty preview text", () => {
    const emptyPreview = {
      ...mockProposal,
      previewText: "",
    };

    render(<ProposalHistoryCard proposal={emptyPreview} style={mockStyle} />);

    expect(screen.getByText("No preview available")).toBeInTheDocument();
  });

  // Story 7.1 AC-4: Outcome status display tests

  it("displays outcome status badge (AC-4)", () => {
    render(<ProposalHistoryCard proposal={mockProposal} style={mockStyle} />);

    const badge = screen.getByText("Pending");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("proposal-outcome-badge");
    expect(badge).toHaveClass("proposal-outcome-badge--pending");
  });

  it("displays hired outcome with correct class", () => {
    const hiredProposal: ProposalListItem = {
      ...mockProposal,
      outcomeStatus: "hired",
    };

    render(<ProposalHistoryCard proposal={hiredProposal} style={mockStyle} />);

    const badge = screen.getByText("Hired");
    expect(badge).toHaveClass("proposal-outcome-badge--hired");
  });

  it("displays response_received with formatted label", () => {
    const receivedProposal: ProposalListItem = {
      ...mockProposal,
      outcomeStatus: "response_received",
    };

    render(<ProposalHistoryCard proposal={receivedProposal} style={mockStyle} />);

    expect(screen.getByText("Response Received")).toBeInTheDocument();
  });

  it("outcome badge has accessible label", () => {
    const submittedProposal: ProposalListItem = {
      ...mockProposal,
      outcomeStatus: "submitted",
    };

    render(<ProposalHistoryCard proposal={submittedProposal} style={mockStyle} />);

    const badge = screen.getByLabelText("Outcome: Submitted");
    expect(badge).toBeInTheDocument();
  });

  // Story 7.2: Interactive dropdown integration tests

  it("badge has aria-haspopup and aria-expanded attributes (AC-1)", () => {
    render(<ProposalHistoryCard proposal={mockProposal} style={mockStyle} />);

    const badge = screen.getByLabelText(/Outcome:/);
    expect(badge).toHaveAttribute("aria-haspopup", "listbox");
    expect(badge).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking badge opens dropdown without calling onCardClick (AC-1, AC-3)", () => {
    render(
      <ProposalHistoryCard
        proposal={mockProposal}
        style={mockStyle}
        onStatusChange={mockOnStatusChange}
        onCardClick={mockOnCardClick}
      />,
    );

    const badge = screen.getByLabelText(/Outcome:/);
    fireEvent.click(badge);

    // Dropdown should appear
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    // Card should NOT navigate
    expect(mockOnCardClick).not.toHaveBeenCalled();
  });

  it("selecting status from dropdown calls onStatusChange (AC-2)", () => {
    render(
      <ProposalHistoryCard
        proposal={mockProposal}
        style={mockStyle}
        onStatusChange={mockOnStatusChange}
      />,
    );

    // Open dropdown
    const badge = screen.getByLabelText(/Outcome:/);
    fireEvent.click(badge);

    // Select "Hired"
    fireEvent.mouseDown(screen.getByText("Hired"));

    expect(mockOnStatusChange).toHaveBeenCalledWith(1, "hired");
  });

  it("does not call onStatusChange if same status selected", () => {
    render(
      <ProposalHistoryCard
        proposal={mockProposal}
        style={mockStyle}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const badge = screen.getByLabelText(/Outcome:/);
    fireEvent.click(badge);

    // Select the current status ("pending") — target the dropdown option, not the badge
    const pendingOption = screen.getByRole("option", { name: "Pending" });
    fireEvent.mouseDown(pendingOption);

    expect(mockOnStatusChange).not.toHaveBeenCalled();
  });

  it("clicking badge toggles dropdown closed (AC-3)", () => {
    render(<ProposalHistoryCard proposal={mockProposal} style={mockStyle} />);

    const badge = screen.getByLabelText(/Outcome:/);

    // Open
    fireEvent.click(badge);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Close
    fireEvent.click(badge);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clicking card body calls onCardClick when dropdown is closed (AC-3)", () => {
    render(
      <ProposalHistoryCard
        proposal={mockProposal}
        style={mockStyle}
        onCardClick={mockOnCardClick}
      />,
    );

    // Click card body (not badge)
    fireEvent.click(getCard());
    expect(mockOnCardClick).toHaveBeenCalledWith(1);
  });
});
