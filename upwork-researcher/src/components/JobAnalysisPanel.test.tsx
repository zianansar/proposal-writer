/**
 * JobAnalysisPanel Component Tests (Story 4a.7: Task 5)
 * Tests unified panel displaying job analysis results
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import JobAnalysisPanel from "./JobAnalysisPanel";

// Helper to wrap component with QueryClientProvider for tests that trigger ScoringBreakdown
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("JobAnalysisPanel", () => {
  const mockOnGenerateClick = vi.fn();

  const defaultProps = {
    clientName: "John Smith",
    keySkills: ["React", "TypeScript", "API Integration"],
    hiddenNeeds: [
      { need: "Fast turnaround", evidence: "Project deadline is tight" },
      { need: "Budget conscious", evidence: "Fixed price preferred" },
    ],
    onGenerateClick: mockOnGenerateClick,
    visible: true,
    isGenerating: false,
  };

  beforeEach(() => {
    mockOnGenerateClick.mockClear();
  });

  it("renders nothing when visible is false (AC-4, Task 5.1)", () => {
    const { container } = render(<JobAnalysisPanel {...defaultProps} visible={false} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("job-analysis-panel")).not.toBeInTheDocument();
  });

  it("renders all three sections when analysis data is provided (AC-1, Task 5.2)", () => {
    render(<JobAnalysisPanel {...defaultProps} />);

    // Panel exists
    const panel = screen.getByTestId("job-analysis-panel");
    expect(panel).toBeInTheDocument();

    // All three section headers
    expect(screen.getByText("Client", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("Key Skills", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("Hidden Needs", { selector: "h3" })).toBeInTheDocument();
  });

  it('renders "Client: Unknown" when clientName is null (AC-2, Task 5.3)', () => {
    render(<JobAnalysisPanel {...defaultProps} clientName={null} />);

    const clientDisplay = screen.getByTestId("panel-client-name");
    expect(clientDisplay).toHaveTextContent("Client: Unknown");
  });

  it("renders client name when provided (AC-2)", () => {
    render(<JobAnalysisPanel {...defaultProps} clientName="Jane Doe" />);

    const clientDisplay = screen.getByTestId("panel-client-name");
    expect(clientDisplay).toHaveTextContent("Client: Jane Doe");
  });

  it("renders skill tags for provided skills array (AC-2, Task 5.4)", () => {
    render(<JobAnalysisPanel {...defaultProps} />);

    const skillTags = screen.getAllByTestId("skill-tag");
    expect(skillTags).toHaveLength(3);
    expect(skillTags[0]).toHaveTextContent("React");
    expect(skillTags[1]).toHaveTextContent("TypeScript");
    expect(skillTags[2]).toHaveTextContent("API Integration");
  });

  it('renders "No skills detected" when skills array is empty (AC-2, Task 5.5)', () => {
    render(<JobAnalysisPanel {...defaultProps} keySkills={[]} />);

    expect(screen.getByTestId("no-skills")).toBeInTheDocument();
    expect(screen.getByText("No skills detected")).toBeInTheDocument();
  });

  it("renders hidden needs with need + evidence for each item (AC-2, Task 5.6)", () => {
    render(<JobAnalysisPanel {...defaultProps} />);

    // Check first hidden need
    expect(screen.getByText("Fast turnaround")).toBeInTheDocument();
    expect(screen.getByText("→ Project deadline is tight")).toBeInTheDocument();

    // Check second hidden need
    expect(screen.getByText("Budget conscious")).toBeInTheDocument();
    expect(screen.getByText("→ Fixed price preferred")).toBeInTheDocument();
  });

  it('renders "No hidden needs detected" when array is empty (AC-2, Task 5.7)', () => {
    render(<JobAnalysisPanel {...defaultProps} hiddenNeeds={[]} />);

    expect(screen.getByText("No hidden needs detected")).toBeInTheDocument();
  });

  it("calls onGenerateClick when Generate Proposal button is clicked (AC-3, Task 5.8)", async () => {
    const user = userEvent.setup();
    render(<JobAnalysisPanel {...defaultProps} />);

    const generateButton = screen.getByTestId("panel-generate-button");
    await user.click(generateButton);

    expect(mockOnGenerateClick).toHaveBeenCalledTimes(1);
  });

  it("disables Generate Proposal button during active generation (AC-3, Task 5.9)", () => {
    render(<JobAnalysisPanel {...defaultProps} isGenerating={true} />);

    const generateButton = screen.getByTestId("panel-generate-button");
    expect(generateButton).toBeDisabled();
    expect(generateButton).toHaveTextContent("Generating...");
  });

  it("enables Generate Proposal button when not generating", () => {
    render(<JobAnalysisPanel {...defaultProps} isGenerating={false} />);

    const generateButton = screen.getByTestId("panel-generate-button");
    expect(generateButton).not.toBeDisabled();
    expect(generateButton).toHaveTextContent("Generate Proposal");
  });

  it('has role="region" and proper aria-label (AC-7, Task 5.10)', () => {
    render(<JobAnalysisPanel {...defaultProps} />);

    const panel = screen.getByRole("region", { name: "Job Analysis Results" });
    expect(panel).toBeInTheDocument();
  });

  it("renders section headings as semantic heading elements (AC-7, Task 5.11)", () => {
    render(<JobAnalysisPanel {...defaultProps} />);

    // All section headers should be h3 elements
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(3);

    expect(headings[0]).toHaveTextContent("Client");
    expect(headings[1]).toHaveTextContent("Key Skills");
    expect(headings[2]).toHaveTextContent("Hidden Needs");
  });

  it("handles partial results - client name only", () => {
    render(<JobAnalysisPanel {...defaultProps} keySkills={[]} hiddenNeeds={[]} />);

    // Client section shows data
    expect(screen.getByText("Client: John Smith")).toBeInTheDocument();

    // Other sections show empty states
    expect(screen.getByText("No skills detected")).toBeInTheDocument();
    expect(screen.getByText("No hidden needs detected")).toBeInTheDocument();
  });

  it("handles partial results - skills only", () => {
    render(<JobAnalysisPanel {...defaultProps} clientName={null} hiddenNeeds={[]} />);

    // Skills section shows data
    const skillTags = screen.getAllByTestId("skill-tag");
    expect(skillTags).toHaveLength(3);

    // Other sections show empty/unknown states
    expect(screen.getByText("Client: Unknown")).toBeInTheDocument();
    expect(screen.getByText("No hidden needs detected")).toBeInTheDocument();
  });

  it("displays all sections with proper visual hierarchy (AC-5)", () => {
    render(<JobAnalysisPanel {...defaultProps} />);

    const panel = screen.getByTestId("job-analysis-panel");
    expect(panel).toHaveClass("job-analysis-panel");

    // All section headers should have the proper class for muted styling
    const headers = screen.getAllByRole("heading", { level: 3 });
    headers.forEach((header) => {
      expect(header).toHaveClass("job-analysis-section__header");
    });
  });

  // Story 4b.5: Overall Score Section
  it("renders Overall Score section when colorFlag is provided", () => {
    render(<JobAnalysisPanel {...defaultProps} overallScore={78.5} colorFlag="yellow" />);

    // Section header exists
    expect(screen.getByText("Overall Score", { selector: "h3" })).toBeInTheDocument();

    // JobScoreBadge is rendered (Story 4b.6: now a button with onToggle)
    const badge = screen.getByRole("button", { name: /Overall job score/i });
    expect(badge).toHaveTextContent("Overall: 78.5");
    expect(badge).toHaveTextContent("Yellow");
  });

  it("hides Overall Score section when colorFlag is undefined", () => {
    render(
      <JobAnalysisPanel
        {...defaultProps}
        overallScore={78.5}
        // colorFlag undefined (not provided)
      />,
    );

    // Section should not exist
    expect(screen.queryByText("Overall Score", { selector: "h3" })).not.toBeInTheDocument();
  });

  it("renders Overall Score with gray flag when score is null", () => {
    render(<JobAnalysisPanel {...defaultProps} overallScore={null} colorFlag="gray" />);

    expect(screen.getByText("Overall Score", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("Configure skills in Settings")).toBeInTheDocument();
  });

  // Story 4b.6 Review: Scoring Breakdown integration tests
  describe("Scoring Breakdown (Story 4b.6)", () => {
    it("toggles breakdown visibility when JobScoreBadge is clicked", async () => {
      const user = userEvent.setup();

      // Mock the Tauri invoke for get_scoring_breakdown and check_can_report_score
      vi.mock("@tauri-apps/api/core", () => ({
        invoke: vi.fn().mockImplementation((cmd: string) => {
          if (cmd === "get_scoring_breakdown") {
            return Promise.resolve({
              overallScore: 75.0,
              colorFlag: "yellow",
              skillsMatchPct: 75.0,
              skillsMatchedCount: 3,
              skillsTotalCount: 4,
              skillsMatchedList: ["React", "TypeScript", "Node.js"],
              skillsMissingList: ["Docker"],
              clientQualityScore: 70,
              clientQualitySignals: "Limited client history",
              budgetAlignmentPct: 90,
              budgetDisplay: "$55/hr vs your $50/hr",
              budgetType: "hourly",
              recommendation: "Proceed with caution.",
            });
          }
          if (cmd === "check_can_report_score") {
            return Promise.resolve({ canReport: true, lastReportedAt: null });
          }
          return Promise.resolve(null);
        }),
      }));

      // H3 fix: Use QueryClientProvider wrapper since ScoringBreakdown uses useCanReportScore hook
      renderWithQueryClient(
        <JobAnalysisPanel
          {...defaultProps}
          overallScore={75.0}
          colorFlag="yellow"
          jobPostId={123}
        />,
      );

      const badge = screen.getByRole("button", { name: /Overall job score/i });

      // Initially no breakdown visible
      expect(
        screen.queryByRole("region", { name: /scoring-breakdown-title/i }),
      ).not.toBeInTheDocument();

      // Click to expand
      await user.click(badge);

      // Badge should now show aria-expanded="true"
      expect(badge).toHaveAttribute("aria-expanded", "true");
    });

    it("renders JobScoreBadge as clickable button with chevron when colorFlag is provided", () => {
      // H3 fix: Use QueryClientProvider wrapper for consistency
      renderWithQueryClient(
        <JobAnalysisPanel
          {...defaultProps}
          overallScore={78.5}
          colorFlag="yellow"
          jobPostId={123}
        />,
      );

      const badge = screen.getByRole("button", { name: /Overall job score/i });
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("aria-expanded", "false");
      expect(badge).toHaveAttribute("aria-controls", "scoring-breakdown");

      // Chevron icon should be visible
      expect(screen.getByText("▼")).toBeInTheDocument();
    });
  });
});
