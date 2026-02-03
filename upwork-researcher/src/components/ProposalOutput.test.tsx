import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProposalOutput from "./ProposalOutput";

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

  it("prioritizes error state over proposal", () => {
    render(
      <ProposalOutput proposal="Some proposal" loading={false} error="Error!" />
    );
    expect(screen.getByText(/error!/i)).toBeInTheDocument();
    expect(screen.queryByText(/some proposal/i)).not.toBeInTheDocument();
  });
});
