// src/components/RevisionHistoryPanel.test.tsx
// Tests for revision history panel (Story 6.3)

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import type { RevisionSummary, ProposalRevision } from "../types/revisions";

import { RevisionHistoryPanel } from "./RevisionHistoryPanel";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock date utils
vi.mock("../utils/dateUtils", () => ({
  formatRelativeTime: (timestamp: string) => `formatted:${timestamp}`,
}));

describe("RevisionHistoryPanel", () => {
  const mockRevisions: RevisionSummary[] = [
    {
      id: 3,
      proposalId: 1,
      revisionType: "edit",
      restoredFromId: null,
      createdAt: "2024-01-01T12:00:00Z",
      contentPreview: "Third revision",
    },
    {
      id: 2,
      proposalId: 1,
      revisionType: "edit",
      restoredFromId: null,
      createdAt: "2024-01-01T11:00:00Z",
      contentPreview: "Second revision",
    },
    {
      id: 1,
      proposalId: 1,
      revisionType: "generation",
      restoredFromId: null,
      createdAt: "2024-01-01T10:00:00Z",
      contentPreview: "First revision",
    },
  ];

  const mockRevisionContent: ProposalRevision = {
    id: 2,
    proposalId: 1,
    content: "Full content of second revision",
    revisionType: "edit",
    restoredFromId: null,
    createdAt: "2024-01-01T11:00:00Z",
  };

  const mockOnRestore = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    expect(screen.getByText("Loading revisions...")).toBeInTheDocument();
  });

  it("renders revision list when loaded", async () => {
    mockInvoke.mockResolvedValue(mockRevisions);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Third revision...")).toBeInTheDocument();
    });

    expect(screen.getByText("Second revision...")).toBeInTheDocument();
    expect(screen.getByText("First revision...")).toBeInTheDocument();
  });

  it('marks the first revision as "Current"', async () => {
    mockInvoke.mockResolvedValue(mockRevisions);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Current")).toBeInTheDocument();
    });
  });

  it("shows restore type for restored revisions", async () => {
    const revisionsWithRestore: RevisionSummary[] = [
      {
        id: 4,
        proposalId: 1,
        revisionType: "edit",
        restoredFromId: null,
        createdAt: "2024-01-01T13:00:00Z",
        contentPreview: "Current content",
      },
      {
        id: 3,
        proposalId: 1,
        revisionType: "restore",
        restoredFromId: 1,
        createdAt: "2024-01-01T12:00:00Z",
        contentPreview: "Restored content",
      },
    ];
    mockInvoke.mockResolvedValue(revisionsWithRestore);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      // First item shows "Current", second item shows "restore (restored)"
      expect(screen.getByText("restore (restored)")).toBeInTheDocument();
    });
  });

  it("clicking revision shows preview", async () => {
    // H1/M4 fix: Mock both initial calls (revisions + archived) before subsequent calls
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve([]);
      if (cmd === "get_revision_content" && args?.revisionId === 2)
        return Promise.resolve(mockRevisionContent);
      return Promise.reject(`Unknown command: ${cmd}`);
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Second revision...")).toBeInTheDocument();
    });

    const revisionItem = screen.getByText("Second revision...").closest("button")!;
    await userEvent.click(revisionItem);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_revision_content", { revisionId: 2 });
    });

    await waitFor(() => {
      expect(screen.getByText("Full content of second revision")).toBeInTheDocument();
    });
  });

  it("shows restore button for non-current revisions", async () => {
    // H1/M4 fix: Mock both initial calls (revisions + archived) before subsequent calls
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve([]);
      if (cmd === "get_revision_content" && args?.revisionId === 2)
        return Promise.resolve(mockRevisionContent);
      return Promise.reject(`Unknown command: ${cmd}`);
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Second revision...")).toBeInTheDocument();
    });

    const revisionItem = screen.getByText("Second revision...").closest("button")!;
    await userEvent.click(revisionItem);

    await waitFor(() => {
      expect(screen.getByText("Restore this version")).toBeInTheDocument();
    });
  });

  it("does not show restore button for current revision", async () => {
    // H1/M4 fix: Mock both initial calls (revisions + archived) before subsequent calls
    const currentRevisionContent = {
      ...mockRevisions[0],
      content: "Full content of third revision",
    };
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve([]);
      if (cmd === "get_revision_content" && args?.revisionId === 3)
        return Promise.resolve(currentRevisionContent);
      return Promise.reject(`Unknown command: ${cmd}`);
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Third revision...")).toBeInTheDocument();
    });

    const revisionItem = screen.getByText("Third revision...").closest("button")!;
    await userEvent.click(revisionItem);

    await waitFor(() => {
      expect(screen.getByText("Full content of third revision")).toBeInTheDocument();
    });

    expect(screen.queryByText("Restore this version")).not.toBeInTheDocument();
  });

  it("shows confirmation dialog on restore", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    // H1/M4 fix: Mock both initial calls (revisions + archived) before subsequent calls
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve([]);
      if (cmd === "get_revision_content" && args?.revisionId === 2)
        return Promise.resolve(mockRevisionContent);
      return Promise.reject(`Unknown command: ${cmd}`);
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Second revision...")).toBeInTheDocument();
    });

    const revisionItem = screen.getByText("Second revision...").closest("button")!;
    await userEvent.click(revisionItem);

    await waitFor(() => {
      expect(screen.getByText("Restore this version")).toBeInTheDocument();
    });

    const restoreButton = screen.getByText("Restore this version");
    await userEvent.click(restoreButton);

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("restores revision and calls callbacks on confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    // H1/M4 fix: Mock both initial calls (revisions + archived) before subsequent calls
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve([]);
      if (cmd === "get_revision_content" && args?.revisionId === 2)
        return Promise.resolve(mockRevisionContent);
      if (cmd === "restore_revision") return Promise.resolve(4); // New revision ID
      return Promise.reject(`Unknown command: ${cmd}`);
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Second revision...")).toBeInTheDocument();
    });

    const revisionItem = screen.getByText("Second revision...").closest("button")!;
    await userEvent.click(revisionItem);

    await waitFor(() => {
      expect(screen.getByText("Restore this version")).toBeInTheDocument();
    });

    const restoreButton = screen.getByText("Restore this version");
    await userEvent.click(restoreButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("restore_revision", {
        proposalId: 1,
        sourceRevisionId: 2,
      });
    });

    expect(mockOnRestore).toHaveBeenCalledWith("Full content of second revision");
    expect(mockOnClose).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("closes panel on close button click", async () => {
    mockInvoke.mockResolvedValue(mockRevisions);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Third revision...")).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText("Close history panel");
    await userEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("closes panel on Escape key", async () => {
    mockInvoke.mockResolvedValue(mockRevisions);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Third revision...")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("shows warning when more than 5 revisions", async () => {
    const manyRevisions: RevisionSummary[] = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      proposalId: 1,
      revisionType: "edit" as const,
      restoredFromId: null,
      createdAt: `2024-01-01T${10 + i}:00:00Z`,
      contentPreview: `Revision ${i + 1}`,
    }));

    mockInvoke.mockResolvedValue(manyRevisions);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/You have 7 revisions/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Consider archiving older versions/)).toBeInTheDocument();
  });

  it("does not show warning when 5 or fewer revisions", async () => {
    const fewRevisions = mockRevisions.slice(0, 3);
    mockInvoke.mockResolvedValue(fewRevisions);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Third revision...")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Consider archiving/)).not.toBeInTheDocument();
  });

  it("shows error message on load failure", async () => {
    mockInvoke.mockRejectedValue("Network error");

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows empty state when no revisions exist", async () => {
    mockInvoke.mockResolvedValue([]);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/No revision history yet/)).toBeInTheDocument();
    });
  });

  it("calls onFocusEditor when panel closes via button", async () => {
    const mockOnFocusEditor = vi.fn();
    mockInvoke.mockResolvedValue(mockRevisions);

    render(
      <RevisionHistoryPanel
        proposalId={1}
        onRestore={mockOnRestore}
        onClose={mockOnClose}
        onFocusEditor={mockOnFocusEditor}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Third revision...")).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText("Close history panel");
    await userEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnFocusEditor).toHaveBeenCalled();
  });

  it("calls onFocusEditor when panel closes via Escape", async () => {
    const mockOnFocusEditor = vi.fn();
    mockInvoke.mockResolvedValue(mockRevisions);

    render(
      <RevisionHistoryPanel
        proposalId={1}
        onRestore={mockOnRestore}
        onClose={mockOnClose}
        onFocusEditor={mockOnFocusEditor}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Third revision...")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnFocusEditor).toHaveBeenCalled();
  });

  it("locks body scroll when panel is open", async () => {
    mockInvoke.mockResolvedValue(mockRevisions);

    const { unmount } = render(
      <RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Third revision...")).toBeInTheDocument();
    });

    // Body should have overflow hidden
    expect(document.body.style.overflow).toBe("hidden");

    // Unmount and check scroll is restored
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("sanitizes HTML content in preview to prevent XSS", async () => {
    const maliciousRevision: ProposalRevision = {
      id: 2,
      proposalId: 1,
      content: '<p>Safe content</p><script>alert("xss")</script><img onerror="alert(1)" src="x">',
      revisionType: "edit",
      restoredFromId: null,
      createdAt: "2024-01-01T11:00:00Z",
    };

    // H1/M4 fix: Mock both initial calls (revisions + archived) before subsequent calls
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve([]);
      if (cmd === "get_revision_content" && args?.revisionId === 2)
        return Promise.resolve(maliciousRevision);
      return Promise.reject(`Unknown command: ${cmd}`);
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Second revision...")).toBeInTheDocument();
    });

    const revisionItem = screen.getByText("Second revision...").closest("button")!;
    await userEvent.click(revisionItem);

    await waitFor(() => {
      expect(screen.getByText("Safe content")).toBeInTheDocument();
    });

    // Script and dangerous img should be removed
    const previewContent = document.querySelector(".preview-content");
    expect(previewContent?.innerHTML).not.toContain("<script>");
    expect(previewContent?.innerHTML).not.toContain("onerror");
  });
});

// ============================================================================
// Story 6-7: Archive Old Revisions Tests
// ============================================================================

describe("RevisionHistoryPanel - Archived Revisions (Story 6-7)", () => {
  const mockRevisions: RevisionSummary[] = [
    {
      id: 3,
      proposalId: 1,
      revisionType: "edit",
      restoredFromId: null,
      createdAt: "2024-01-01T12:00:00Z",
      contentPreview: "Third revision",
    },
  ];

  const mockOnRestore = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockInvoke.mockReset();
    mockOnRestore.mockClear();
    mockOnClose.mockClear();
  });

  it("does not show archived section when no archived revisions", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve([]);
      return Promise.reject("Unknown command");
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.queryByText(/archived revision/i)).not.toBeInTheDocument();
    });
  });

  it("shows archived count correctly (AC5)", async () => {
    const archivedRevisions = [
      {
        id: 101,
        proposalId: 1,
        content: "Old revision 1",
        revisionType: "edit" as const,
        restoredFromId: null,
        createdAt: "2024-01-01T10:00:00Z",
      },
      {
        id: 102,
        proposalId: 1,
        content: "Old revision 2",
        revisionType: "edit" as const,
        restoredFromId: null,
        createdAt: "2024-01-01T11:00:00Z",
      },
    ];

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve(archivedRevisions);
      return Promise.reject("Unknown command");
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("2 archived revisions")).toBeInTheDocument();
    });
  });

  it("expands and collapses archived list on click (AC5)", async () => {
    const archivedRevisions = [
      {
        id: 101,
        proposalId: 1,
        content: "Old revision content",
        revisionType: "edit" as const,
        restoredFromId: null,
        createdAt: "2024-01-01T10:00:00Z",
      },
    ];

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve(archivedRevisions);
      return Promise.reject("Unknown command");
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    const expandButton = await screen.findByText("1 archived revision");

    // Initially collapsed
    expect(screen.queryByText("Old revision content...")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(expandButton);
    expect(await screen.findByText(/Old revision content/)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(expandButton);
    await waitFor(() => {
      expect(screen.queryByText("Old revision content...")).not.toBeInTheDocument();
    });
  });

  it("displays archived revision preview when selected (AC3)", async () => {
    const archivedRevisions = [
      {
        id: 101,
        proposalId: 1,
        content: "Archived content preview",
        revisionType: "edit" as const,
        restoredFromId: null,
        createdAt: "2024-01-01T10:00:00Z",
      },
    ];

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve(archivedRevisions);
      return Promise.reject("Unknown command");
    });

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    // Expand archived section
    const expandButton = await screen.findByText("1 archived revision");
    fireEvent.click(expandButton);

    // Click on archived revision
    const archivedItem = await screen.findByText(/Archived content preview/);
    fireEvent.click(archivedItem);

    // Preview should show with restore button
    expect(await screen.findByText("Restore this version")).toBeInTheDocument();
    expect(screen.getByText("Archived content preview")).toBeInTheDocument();
  });

  it("calls restore_archived_revision command with correct index (AC3)", async () => {
    const archivedRevisions = [
      {
        id: 101,
        proposalId: 1,
        content: "Archived rev 1",
        revisionType: "edit" as const,
        restoredFromId: null,
        createdAt: "2024-01-01T10:00:00Z",
      },
      {
        id: 102,
        proposalId: 1,
        content: "Archived rev 2",
        revisionType: "edit" as const,
        restoredFromId: null,
        createdAt: "2024-01-01T11:00:00Z",
      },
    ];

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_revisions") return Promise.resolve(mockRevisions);
      if (cmd === "get_archived_revisions") return Promise.resolve(archivedRevisions);
      if (cmd === "restore_archived_revision") return Promise.resolve(999);
      return Promise.reject("Unknown command");
    });

    window.confirm = vi.fn(() => true);

    render(<RevisionHistoryPanel proposalId={1} onRestore={mockOnRestore} onClose={mockOnClose} />);

    // Expand and select second archived revision
    const expandButton = await screen.findByText("2 archived revisions");
    fireEvent.click(expandButton);

    const archivedItem = await screen.findByText(/Archived rev 2/);
    fireEvent.click(archivedItem);

    // Click restore
    const restoreButton = await screen.findByText("Restore this version");
    fireEvent.click(restoreButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("restore_archived_revision", {
        proposalId: 1,
        archivedIndex: 1, // Second item, index 1
      });
    });
  });
});
