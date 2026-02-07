import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ProposalOutput from "./ProposalOutput";

// Mock Tauri invoke for delete tests
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("ProposalOutput", () => {
  it("renders nothing when no proposal, not loading, no error", () => {
    const { container } = render(
      <ProposalOutput proposal={null} loading={false} error={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows loading message when loading", () => {
    render(<ProposalOutput proposal={null} loading={true} error={null} />);
    expect(screen.getByText(/generating your proposal/i)).toBeInTheDocument();
  });

  it("shows error message when error is present", () => {
    render(
      <ProposalOutput proposal={null} loading={false} error="API error occurred" />
    );
    expect(screen.getByText(/api error occurred/i)).toBeInTheDocument();
  });

  it("shows proposal text when proposal is present", () => {
    const proposalText = "This is a great proposal...";
    render(
      <ProposalOutput proposal={proposalText} loading={false} error={null} />
    );
    expect(screen.getByText(proposalText)).toBeInTheDocument();
  });

  it("shows label when proposal is present", () => {
    render(
      <ProposalOutput proposal="Some proposal" loading={false} error={null} />
    );
    expect(screen.getByText(/generated proposal/i)).toBeInTheDocument();
  });

  it("prioritizes loading state over error", () => {
    render(
      <ProposalOutput proposal={null} loading={true} error="Some error" />
    );
    expect(screen.getByText(/generating your proposal/i)).toBeInTheDocument();
    expect(screen.queryByText(/some error/i)).not.toBeInTheDocument();
  });

  it("shows error with partial result preserved", () => {
    render(
      <ProposalOutput proposal="Some partial proposal" loading={false} error="Error!" />
    );
    // Both error and partial content should be visible
    expect(screen.getByText(/error!/i)).toBeInTheDocument();
    expect(screen.getByText(/some partial proposal/i)).toBeInTheDocument();
    expect(screen.getByText(/partial result/i)).toBeInTheDocument();
  });

  it("shows streaming indicator when loading with content", () => {
    render(
      <ProposalOutput proposal="Streaming content" loading={true} error={null} />
    );
    expect(screen.getByText(/streaming content/i)).toBeInTheDocument();
    expect(screen.getByText(/generating proposal/i)).toBeInTheDocument();
  });

  // CopyButton integration tests
  it("shows copy button when proposal is complete", () => {
    render(
      <ProposalOutput proposal="Complete proposal" loading={false} error={null} />
    );
    expect(screen.getByRole("button", { name: /copy to clipboard/i })).toBeInTheDocument();
  });

  it("does not show copy button when loading without content", () => {
    render(
      <ProposalOutput proposal={null} loading={true} error={null} />
    );
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });

  it("does not show copy button while streaming", () => {
    render(
      <ProposalOutput proposal="Streaming content" loading={true} error={null} />
    );
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });

  it("shows copy button with partial result on error", () => {
    render(
      <ProposalOutput proposal="Partial content" loading={false} error="Error occurred" />
    );
    expect(screen.getByRole("button", { name: /copy to clipboard/i })).toBeInTheDocument();
  });

  it("does not show copy button when error with no partial result", () => {
    render(
      <ProposalOutput proposal={null} loading={false} error="Error occurred" />
    );
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });

  // Saved indicator tests
  it("shows saved indicator when isSaved is true", () => {
    render(
      <ProposalOutput proposal="Complete proposal" loading={false} error={null} isSaved={true} />
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("does not show saved indicator when isSaved is false", () => {
    render(
      <ProposalOutput proposal="Complete proposal" loading={false} error={null} isSaved={false} />
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("does not show saved indicator by default", () => {
    render(
      <ProposalOutput proposal="Complete proposal" loading={false} error={null} />
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  // Story 6.8: Delete button tests
  describe("Delete functionality", () => {
    it("shows delete button for saved proposals with proposalId", () => {
      render(
        <ProposalOutput
          proposal="Complete proposal"
          loading={false}
          error={null}
          isSaved={true}
          proposalId={123}
        />
      );
      expect(screen.getByRole("button", { name: /delete proposal/i })).toBeInTheDocument();
    });

    it("does not show delete button when not saved", () => {
      render(
        <ProposalOutput
          proposal="Complete proposal"
          loading={false}
          error={null}
          isSaved={false}
          proposalId={123}
        />
      );
      expect(screen.queryByRole("button", { name: /delete proposal/i })).not.toBeInTheDocument();
    });

    it("does not show delete button without proposalId", () => {
      render(
        <ProposalOutput
          proposal="Complete proposal"
          loading={false}
          error={null}
          isSaved={true}
        />
      );
      expect(screen.queryByRole("button", { name: /delete proposal/i })).not.toBeInTheDocument();
    });

    it("opens confirmation dialog when delete button clicked", () => {
      render(
        <ProposalOutput
          proposal="Complete proposal"
          loading={false}
          error={null}
          isSaved={true}
          proposalId={123}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /delete proposal/i }));

      // Confirmation dialog should appear
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByText(/⚠️ This will permanently delete/)).toBeInTheDocument();
    });

    it("closes confirmation dialog when cancel clicked", () => {
      render(
        <ProposalOutput
          proposal="Complete proposal"
          loading={false}
          error={null}
          isSaved={true}
          proposalId={123}
        />
      );

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /delete proposal/i }));
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();

      // Click cancel
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      // Dialog should be closed
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
