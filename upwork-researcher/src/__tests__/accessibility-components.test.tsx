/**
 * Component-Specific Accessibility Audits
 * Story 8-11: Task 3 - Comprehensive audit of all pages/views
 *
 * This test suite audits each major component and view in the application.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { runAxeAudit, assertNoViolations, generateAuditReport } from "../test/axe-utils";

// Import components to audit
import ProposalOutput from "../components/ProposalOutput";
import JobInput from "../components/JobInput";
import SettingsPanel from "../components/SettingsPanel";
import JobAnalysisPanel from "../components/JobAnalysisPanel";
import HistoryList from "../components/HistoryList";
import HistoryItem from "../components/HistoryItem";
import OnboardingWizard from "../components/OnboardingWizard";
import SafetyWarningModal from "../components/SafetyWarningModal";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";
import EncryptionDetailsModal from "../components/EncryptionDetailsModal";
import DraftRecoveryModal from "../components/DraftRecoveryModal";
import Navigation from "../components/Navigation";
import SkipLink from "../components/SkipLink";

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
        />
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[ProposalOutput] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for ProposalOutput while generating", async () => {
      const { container } = render(
        <ProposalOutput
          text="Generating..."
          generating={true}
        />
      );

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });

    it("should pass accessibility audit for JobInput component", async () => {
      const mockOnChange = vi.fn();
      const mockOnKeyDown = vi.fn();

      const { container } = render(
        <JobInput
          value=""
          onChange={mockOnChange}
          onKeyDown={mockOnKeyDown}
        />
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

      const { container } = render(
        <SettingsPanel onClose={mockClose} />
      );

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

      const { container } = render(
        <JobAnalysisPanel analysis={mockAnalysis} />
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[JobAnalysisPanel] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for JobAnalysisPanel without analysis", async () => {
      const { container} = render(
        <JobAnalysisPanel analysis={null} />
      );

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
        <HistoryList
          proposals={mockProposals}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
        />
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
        <HistoryItem
          proposal={mockProposal}
          onClick={vi.fn()}
          onDelete={vi.fn()}
        />
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
        />
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
        />
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
        <EncryptionDetailsModal
          status={mockStatus}
          onClose={vi.fn()}
        />
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
        />
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
          <OnboardingWizard
            isOpen={true}
            onComplete={vi.fn()}
          />
        </BrowserRouter>
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
        </BrowserRouter>
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[Navigation] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should pass accessibility audit for SkipLink", async () => {
      const { container } = render(
        <SkipLink targetId="main-content" />
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n[SkipLink] Audit Report:");
        console.log(generateAuditReport(results));
      }

      assertNoViolations(results);
    });
  });
});
