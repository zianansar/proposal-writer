/**
 * Component-Specific Accessibility Audits
 * Story 8-11: Task 3 - Comprehensive audit of all pages/views
 *
 * This test suite audits each major component and view in the application.
 * Includes Epic 5/6 components (M3) and VoiceLearningTimeline.
 */

import { render } from "@testing-library/react";
import React from "react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Import components to audit
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";
import DraftRecoveryModal from "../components/DraftRecoveryModal";

// Epic 5/6 component imports

// Mock TipTap editor for ProposalEditor and EditorToolbar tests
vi.mock("@tiptap/react", () => {
  const ReactImport = require("react");
  return {
    useEditor: () => ({
      chain: () => ({
        focus: () => ({
          toggleBold: () => ({ run: vi.fn() }),
          toggleItalic: () => ({ run: vi.fn() }),
          toggleBulletList: () => ({ run: vi.fn() }),
          toggleOrderedList: () => ({ run: vi.fn() }),
          unsetAllMarks: () => ({
            clearNodes: () => ({ run: vi.fn() }),
          }),
          undo: () => ({ run: vi.fn() }),
          redo: () => ({ run: vi.fn() }),
        }),
      }),
      can: () => ({
        chain: () => ({
          focus: () => ({
            toggleBold: () => ({ run: () => true }),
            toggleItalic: () => ({ run: () => true }),
            toggleBulletList: () => ({ run: () => true }),
            toggleOrderedList: () => ({ run: () => true }),
            undo: () => ({ run: () => true }),
            redo: () => ({ run: () => true }),
          }),
        }),
      }),
      isActive: () => false,
      getHTML: () => "<p>Test content</p>",
      getText: () => "Test content",
      on: vi.fn(),
      off: vi.fn(),
      commands: {
        setContent: vi.fn(),
        focus: vi.fn(),
      },
    }),
    EditorContent: ({ editor }: { editor: unknown }) => {
      return ReactImport.createElement("div", {
        "data-testid": "editor-content",
        className: "proposal-editor-content",
      });
    },
  };
});

// Mock useCanReportScore for ScoringBreakdown
vi.mock("../features/scoring-feedback/hooks/useCanReportScore", () => ({
  useCanReportScore: () => ({
    data: { canReport: true },
    isLoading: false,
  }),
}));

// Mock ReportScoreModal for ScoringBreakdown
vi.mock("../features/scoring-feedback/components/ReportScoreModal", () => ({
  ReportScoreModal: () => null,
}));

// Mock useInfiniteJobQueue for JobQueuePage
vi.mock("../features/job-queue/hooks/useInfiniteJobQueue", () => ({
  useInfiniteJobQueue: () => ({
    data: {
      pages: [
        {
          jobs: [
            {
              id: 1,
              title: "React Developer",
              clientName: "Test Client",
              score: 85,
              colorFlag: "green",
              createdAt: "2026-02-10",
            },
          ],
          totalCount: 1,
          colorCounts: { green: 1, yellow: 0, red: 0, gray: 0 },
        },
      ],
    },
    isLoading: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  }),
}));

// Mock useInfiniteScroll for JobQueuePage
vi.mock("../features/job-queue/hooks/useInfiniteScroll", () => ({
  useInfiniteScroll: () => ({ current: null }),
}));

// Mock VirtualizedJobList to avoid virtualization complexity
vi.mock("../features/job-queue/components/VirtualizedJobList", () => ({
  default: ({ jobs }: { jobs: unknown[] }) => {
    const ReactImport = require("react");
    return ReactImport.createElement(
      "div",
      { "data-testid": "virtualized-job-list", role: "list" },
      ReactImport.createElement("div", { role: "listitem" }, "Job item"),
    );
  },
}));

// Mock JobQueueControls to avoid complex child dependencies
vi.mock("../features/job-queue/components/JobQueueControls", () => ({
  default: () => {
    const ReactImport = require("react");
    return ReactImport.createElement("div", { "data-testid": "job-queue-controls" }, "Controls");
  },
}));

// Import components after mocks are set up
import EditorToolbar from "../components/EditorToolbar";
import EncryptionDetailsModal from "../components/EncryptionDetailsModal";
import HistoryItem from "../components/HistoryItem";
import HistoryList from "../components/HistoryList";
import JobAnalysisPanel from "../components/JobAnalysisPanel";
import JobInput from "../components/JobInput";
import Navigation from "../components/Navigation";
import OnboardingWizard from "../components/OnboardingWizard";
import ProposalEditor from "../components/ProposalEditor";
import ProposalOutput from "../components/ProposalOutput";
import SafetyWarningModal from "../components/SafetyWarningModal";
import ScoringBreakdownCard from "../components/ScoringBreakdown";
import SettingsPanel from "../components/SettingsPanel";
import SkipLink from "../components/SkipLink";
import JobQueuePage from "../features/job-queue/components/JobQueuePage";
import { VoiceLearningTimeline } from "../features/voice-learning/VoiceLearningTimeline";
import { runAxeAudit, assertNoViolations, generateAuditReport } from "../test/axe-utils";

describe("Component-Specific Accessibility Audits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Task 3.1: Main Proposal Generation Flow", () => {
    it("should pass accessibility audit for ProposalOutput component", async () => {
      const { container } = render(
        <ProposalOutput
          text="This is a sample proposal text for accessibility testing."
          generating={false}
        />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[ProposalOutput] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for ProposalOutput while generating", async () => {
      const { container } = render(<ProposalOutput text="Generating..." generating={true} />);

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });

    it("should pass accessibility audit for JobInput component", async () => {
      const mockOnChange = vi.fn();
      const mockOnKeyDown = vi.fn();

      const { container } = render(
        <JobInput value="" onChange={mockOnChange} onKeyDown={mockOnKeyDown} />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[JobInput] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });

  describe("Task 3.2: Settings Panel", () => {
    it("should pass accessibility audit for SettingsPanel", async () => {
      const mockClose = vi.fn();

      const { container } = render(<SettingsPanel onClose={mockClose} />);

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[SettingsPanel] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });

  describe("Task 3.3: Job Analysis Panel", () => {
    it("should pass accessibility audit for JobAnalysisPanel with analysis", async () => {
      const mockAnalysis = {
        client_name: "Test Client",
        key_skills: ["React", "TypeScript", "Node.js"],
        hidden_needs: ["Good communication", "Team collaboration"],
        score: {
          overall_score: 85,
          skills_match_percentage: 90,
          client_quality_score: 80,
          budget_alignment: "good" as const,
          color_flag: "green" as const,
        },
      };

      const { container } = render(<JobAnalysisPanel analysis={mockAnalysis} />);

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[JobAnalysisPanel] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for JobAnalysisPanel without analysis", async () => {
      const { container } = render(<JobAnalysisPanel analysis={null} />);

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });
  });

  describe("Task 3.4: History View", () => {
    it("should pass accessibility audit for HistoryList", async () => {
      const mockProposals = [
        {
          id: 1,
          proposalText: "Test proposal 1",
          jobContent: "Job content 1",
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          proposalText: "Test proposal 2",
          jobContent: "Job content 2",
          createdAt: new Date().toISOString(),
        },
      ];

      const { container } = render(
        <HistoryList proposals={mockProposals} onSelect={vi.fn()} onDelete={vi.fn()} />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[HistoryList] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for HistoryItem", async () => {
      const mockProposal = {
        id: 1,
        proposalText: "Test proposal",
        jobContent: "Job content",
        createdAt: new Date().toISOString(),
      };

      const { container } = render(
        <HistoryItem proposal={mockProposal} onClick={vi.fn()} onDelete={vi.fn()} />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[HistoryItem] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });

  describe("Task 3.5: Modal Dialogs", () => {
    it("should pass accessibility audit for SafetyWarningModal", async () => {
      const { container } = render(
        <SafetyWarningModal
          isOpen={true}
          onClose={vi.fn()}
          onContinue={vi.fn()}
          flaggedSentences={["This sentence might be AI-generated"]}
          score={220}
          threshold={180}
        />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[SafetyWarningModal] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for DeleteConfirmDialog", async () => {
      const { container } = render(
        <DeleteConfirmDialog
          isOpen={true}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          itemName="Test Proposal"
        />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[DeleteConfirmDialog] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for EncryptionDetailsModal", async () => {
      const mockStatus = {
        databaseEncrypted: true,
        apiKeyInKeychain: true,
        cipherVersion: "4.5.5",
      };

      const { container } = render(
        <EncryptionDetailsModal status={mockStatus} onClose={vi.fn()} />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[EncryptionDetailsModal] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for DraftRecoveryModal", async () => {
      const { container } = render(
        <DraftRecoveryModal
          isOpen={true}
          draftContent="Recovered draft content"
          onRecover={vi.fn()}
          onDiscard={vi.fn()}
        />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[DraftRecoveryModal] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });

  describe("Task 3.6: Onboarding Wizard", () => {
    it("should pass accessibility audit for OnboardingWizard", async () => {
      const { container } = render(
        <BrowserRouter>
          <OnboardingWizard isOpen={true} onComplete={vi.fn()} />
        </BrowserRouter>,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[OnboardingWizard] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });

  describe("Task 3.7: Navigation and Accessibility Features", () => {
    it("should pass accessibility audit for Navigation", async () => {
      const { container } = render(
        <BrowserRouter>
          <Navigation />
        </BrowserRouter>,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[Navigation] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for SkipLink", async () => {
      const { container } = render(<SkipLink targetId="main-content" />);

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[SkipLink] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });

  describe("Epic 5/6 Components - Proposal Editor", () => {
    it("should pass accessibility audit for ProposalEditor", async () => {
      const { container } = render(
        <ProposalEditor content="<p>Test proposal content</p>" proposalId={1} />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[ProposalEditor] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for EditorToolbar", async () => {
      // Create a mock editor object that matches TipTap Editor interface
      const mockEditor = {
        chain: () => ({
          focus: () => ({
            toggleBold: () => ({ run: vi.fn() }),
            toggleItalic: () => ({ run: vi.fn() }),
            toggleBulletList: () => ({ run: vi.fn() }),
            toggleOrderedList: () => ({ run: vi.fn() }),
            unsetAllMarks: () => ({
              clearNodes: () => ({ run: vi.fn() }),
            }),
            undo: () => ({ run: vi.fn() }),
            redo: () => ({ run: vi.fn() }),
          }),
        }),
        can: () => ({
          chain: () => ({
            focus: () => ({
              toggleBold: () => ({ run: () => true }),
              toggleItalic: () => ({ run: () => true }),
              toggleBulletList: () => ({ run: () => true }),
              toggleOrderedList: () => ({ run: () => true }),
              undo: () => ({ run: () => true }),
              redo: () => ({ run: () => true }),
            }),
          }),
        }),
        isActive: () => false,
      };

      const { container } = render(
        <EditorToolbar editor={mockEditor as any} onViewHistory={vi.fn()} />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[EditorToolbar] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });

  describe("Epic 5/6 Components - Scoring and Job Queue", () => {
    it("should pass accessibility audit for ScoringBreakdown", async () => {
      const mockBreakdown = {
        overallScore: 85,
        colorFlag: "green",
        skillsMatchPct: 90,
        skillsMatchedCount: 9,
        skillsTotalCount: 10,
        skillsMatchedList: ["React", "TypeScript", "Node.js"],
        skillsMissingList: ["Go"],
        clientQualityScore: 80,
        clientQualitySignals: "Verified payment, 4.8 rating, 50+ hires",
        budgetAlignmentPct: 100,
        budgetDisplay: "$50-80/hr (matches your rate)",
        budgetType: "hourly",
        recommendation: "Strong match - apply with confidence",
      };

      const { container } = render(
        <ScoringBreakdownCard breakdown={mockBreakdown} isExpanded={true} jobPostId={1} />,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[ScoringBreakdown] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for JobQueuePage", async () => {
      const { container } = render(
        <MemoryRouter initialEntries={["/?sort=score&filter=all"]}>
          <JobQueuePage />
        </MemoryRouter>,
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[JobQueuePage] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });

  describe("Voice Learning Components", () => {
    it("should pass accessibility audit for VoiceLearningTimeline", async () => {
      const { container } = render(<VoiceLearningTimeline />);

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[VoiceLearningTimeline] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });
});
