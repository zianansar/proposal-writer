import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProposalDetailView } from "./ProposalDetailView";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

const mockProposal = {
  id: 1,
  jobContent: "Looking for a React developer with TypeScript experience.",
  generatedText: "Dear hiring manager,\n\nI am excited to apply for this position.",
  createdAt: "2026-02-10T12:00:00",
  updatedAt: null,
  status: "draft",
  outcomeStatus: "pending",
  outcomeUpdatedAt: null,
  hookStrategyId: "social_proof",
  jobPostId: 42,
  jobTitle: "Acme Corp",
  revisionCount: 2,
};

const mockRevisions = [
  { id: 10, proposalId: 1, revisionNumber: 1, createdAt: "2026-02-10T11:00:00" },
  { id: 11, proposalId: 1, revisionNumber: 2, createdAt: "2026-02-10T11:30:00" },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("ProposalDetailView", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return the proposal detail
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_proposal_detail") return mockProposal;
      if (cmd === "get_proposal_revisions") return mockRevisions;
      if (cmd === "get_revision_content")
        return {
          id: 10,
          content: "Revision 1 text",
          revisionNumber: 1,
          createdAt: "2026-02-10T11:00:00",
        };
      if (cmd === "delete_proposal") return true;
      if (cmd === "update_proposal_outcome") return true;
      return null;
    });
  });

  it("renders loading state initially", () => {
    // Make invoke never resolve for loading state
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId("proposal-detail-loading")).toBeInTheDocument();
    expect(screen.getByText("Proposal Details")).toBeInTheDocument();
  });

  it("renders proposal data when loaded", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Dear hiring manager/)).toBeInTheDocument();
    });

    // Metadata
    expect(screen.getByText(/Feb 10, 2026/)).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Social Proof")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();

    // Revision count
    expect(screen.getByText(/Revision History \(2 revisions\)/)).toBeInTheDocument();
  });

  it("renders error state with retry", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Network error"));

    render(<ProposalDetailView proposalId={999} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId("proposal-detail-error")).toBeInTheDocument();
    });

    expect(screen.getByText("Failed to load proposal")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("calls onBack when back button clicked", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Dear hiring manager/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Back to history"));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when Escape pressed (AC-2)", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Dear hiring manager/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("copies proposal text and shows Copied indicator (AC-3)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Copy Proposal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Copy proposal text to clipboard"));

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });

    expect(writeText).toHaveBeenCalledWith(mockProposal.generatedText);
  });

  it("expands original job content on click", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Original Job Content")).toBeInTheDocument();
    });

    // Job content should be collapsed
    expect(screen.queryByText(mockProposal.jobContent)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText("Original Job Content"));

    expect(screen.getByText(mockProposal.jobContent)).toBeInTheDocument();
  });

  it("expands revision history and loads revisions (AC-4)", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Revision History/)).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByText(/Revision History/));

    await waitFor(() => {
      expect(screen.getByText("Revision #1")).toBeInTheDocument();
      expect(screen.getByText("Revision #2")).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_proposal_revisions", { proposalId: 1 });
  });

  it("loads revision content on click (AC-4)", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Revision History/)).toBeInTheDocument();
    });

    // Expand revision list
    fireEvent.click(screen.getByText(/Revision History/));

    await waitFor(() => {
      expect(screen.getByText("Revision #1")).toBeInTheDocument();
    });

    // Click revision to load content
    fireEvent.click(screen.getByText("Revision #1"));

    await waitFor(() => {
      expect(screen.getByText("Revision 1 text")).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_revision_content", { revisionId: 10 });
  });

  it("shows delete confirmation dialog (AC-6)", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Delete Proposal")).toBeInTheDocument();
    });

    // Click delete
    fireEvent.click(screen.getByText("Delete Proposal"));

    // Dialog should appear
    expect(screen.getByText("Delete Permanently")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("cancels delete dialog", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Delete Proposal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Delete Proposal"));
    fireEvent.click(screen.getByText("Cancel"));

    // Dialog should close
    expect(screen.queryByText("Delete Permanently")).not.toBeInTheDocument();
  });

  it("confirms delete and navigates back (AC-6)", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Delete Proposal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Delete Proposal"));

    await act(async () => {
      fireEvent.click(screen.getByText("Delete Permanently"));
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("delete_proposal", { id: 1 });
      expect(onBack).toHaveBeenCalled();
    });
  });

  it("does not show revision section when revisionCount is 0", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_proposal_detail") return { ...mockProposal, revisionCount: 0 };
      return null;
    });

    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Dear hiring manager/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Revision History/)).not.toBeInTheDocument();
  });

  it("updates outcome optimistically and shows toast (AC-5)", async () => {
    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    // Click badge to open dropdown
    const badge = screen.getByLabelText(/Outcome:/);
    fireEvent.click(badge);

    // Select 'hired' from dropdown
    const hiredOption = document.getElementById("outcome-option-hired")!;
    fireEvent.mouseDown(hiredOption);

    // Badge should update optimistically before mutation resolves
    await waitFor(() => {
      expect(screen.getByText("Hired")).toBeInTheDocument();
    });

    // Mutation should fire
    expect(mockInvoke).toHaveBeenCalledWith("update_proposal_outcome", {
      proposalId: 1,
      outcomeStatus: "hired",
    });

    // Success toast
    await waitFor(() => {
      expect(screen.getByText(/Outcome updated to 'Hired'/)).toBeInTheDocument();
    });
  });

  it("reverts optimistic outcome on mutation error (AC-5)", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_proposal_detail") return mockProposal;
      if (cmd === "update_proposal_outcome") throw new Error("Network error");
      return null;
    });

    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    // Click badge to open dropdown
    const badge = screen.getByLabelText(/Outcome:/);
    fireEvent.click(badge);

    // Select 'hired'
    const hiredOption = document.getElementById("outcome-option-hired")!;
    fireEvent.mouseDown(hiredOption);

    // Should revert to original status after error
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    // Badge should revert to Pending
    await waitFor(() => {
      expect(screen.getByLabelText(/Outcome: Pending/)).toBeInTheDocument();
    });
  });

  it("does not show hook strategy when null", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_proposal_detail") return { ...mockProposal, hookStrategyId: null };
      return null;
    });

    render(<ProposalDetailView proposalId={1} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Dear hiring manager/)).toBeInTheDocument();
    });

    expect(screen.queryByText("Social Proof")).not.toBeInTheDocument();
  });
});
