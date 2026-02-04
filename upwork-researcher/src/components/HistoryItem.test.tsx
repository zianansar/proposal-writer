import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HistoryItem from "./HistoryItem";

describe("HistoryItem", () => {
  const mockProposal = {
    id: 1,
    jobContent: "Looking for a React developer to build a dashboard",
    createdAt: "2026-02-04T10:30:00Z",
  };

  it("renders job content", () => {
    render(<HistoryItem proposal={mockProposal} />);

    expect(screen.getByText(/Looking for a React developer/)).toBeInTheDocument();
  });

  it("renders formatted date", () => {
    render(<HistoryItem proposal={mockProposal} />);

    // Date formatting may vary by locale, but should contain key parts
    expect(screen.getByText(/Feb/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("truncates long job content to 100 characters", () => {
    const longContent = "A".repeat(150);
    const proposal = { ...mockProposal, jobContent: longContent };

    render(<HistoryItem proposal={proposal} />);

    // Should show truncated text with ellipsis
    const displayedText = screen.getByText(/A{100}\.\.\./);
    expect(displayedText).toBeInTheDocument();
  });

  it("does not truncate short job content", () => {
    const shortContent = "Short job description";
    const proposal = { ...mockProposal, jobContent: shortContent };

    render(<HistoryItem proposal={proposal} />);

    expect(screen.getByText(shortContent)).toBeInTheDocument();
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
  });

  it("handles exactly 100 character content without ellipsis", () => {
    const exactContent = "A".repeat(100);
    const proposal = { ...mockProposal, jobContent: exactContent };

    render(<HistoryItem proposal={proposal} />);

    expect(screen.getByText(exactContent)).toBeInTheDocument();
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
  });
});
