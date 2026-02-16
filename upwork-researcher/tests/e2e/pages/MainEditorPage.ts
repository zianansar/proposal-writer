/**
 * Page Object Model for Main Editor View
 *
 * Represents the primary proposal generation interface:
 * - Job input
 * - Analysis results
 * - Proposal editor (TipTap)
 * - Copy button
 * - Generation controls
 */

import { Page, Locator, expect } from "@playwright/test";

export class MainEditorPage {
  readonly page: Page;

  // Job Input Section
  readonly jobInput: Locator;
  readonly analyzeButton: Locator;
  readonly clearButton: Locator;

  // Analysis Results
  readonly analysisPanel: Locator;
  readonly clientName: Locator;
  readonly skillsList: Locator;
  readonly hiddenNeeds: Locator;
  readonly analysisLoading: Locator;

  // Job Scoring (Story 4b)
  readonly jobScoreBadge: Locator;
  readonly scoringBreakdown: Locator;

  // Proposal Generation
  readonly generateButton: Locator;
  readonly loadingIndicator: Locator;
  readonly pipelineIndicator: Locator;

  // Proposal Editor (TipTap)
  readonly proposalEditor: Locator;
  readonly proseMirrorContent: Locator; // TipTap's editable div
  readonly editorToolbar: Locator;

  // Editor Actions
  readonly copyButton: Locator;
  readonly rehumanizeButton: Locator;
  readonly copyConfirmation: Locator;

  // Status indicators
  readonly characterCount: Locator;
  readonly wordCount: Locator;
  readonly truncationWarning: Locator;

  constructor(page: Page) {
    this.page = page;

    // Job Input
    this.jobInput = page.getByTestId("job-input");
    this.analyzeButton = page.getByTestId("analyze-button");
    this.clearButton = page.getByRole("button", { name: /clear/i });

    // Analysis Results
    this.analysisPanel = page.getByTestId("job-analysis-panel");
    this.clientName = page.getByTestId("client-name");
    this.skillsList = page.getByTestId("skills-list");
    this.hiddenNeeds = page.getByTestId("hidden-needs");
    this.analysisLoading = page.getByTestId("analysis-loading");

    // Job Scoring
    this.jobScoreBadge = page.getByTestId("job-score-badge");
    this.scoringBreakdown = page.getByTestId("scoring-breakdown");

    // Generation
    this.generateButton = page.getByTestId("generate-button");
    this.loadingIndicator = page.getByTestId("loading-indicator");
    this.pipelineIndicator = page.getByTestId("pipeline-indicator");

    // Editor
    this.proposalEditor = page.getByTestId("proposal-editor");
    this.proseMirrorContent = page.locator(".ProseMirror");
    this.editorToolbar = page.getByTestId("editor-toolbar");

    // Actions
    this.copyButton = page.getByTestId("copy-button");
    this.rehumanizeButton = page.getByRole("button", { name: /rehumanize/i });
    this.copyConfirmation = page.getByText(/copied/i);

    // Status
    this.characterCount = page.getByTestId("character-count");
    this.wordCount = page.getByTestId("word-count");
    this.truncationWarning = page.getByText(/truncated/i);
  }

  /**
   * Paste job content into input
   */
  async pasteJobContent(content: string): Promise<void> {
    await this.jobInput.fill(content);
    await expect(this.jobInput).toHaveValue(content);
  }

  /**
   * Click analyze button
   */
  async analyzeJob(): Promise<void> {
    await this.analyzeButton.click();
    await expect(this.analysisLoading).toBeVisible();
  }

  /**
   * Wait for analysis to complete
   */
  async waitForAnalysisComplete(): Promise<void> {
    await expect(this.analysisLoading).toBeHidden({ timeout: 10_000 });
    await expect(this.analysisPanel).toBeVisible();
  }

  /**
   * Generate proposal (click button and wait for streaming to start)
   */
  async generateProposal(): Promise<void> {
    await this.generateButton.click();
    await expect(this.loadingIndicator).toBeVisible();
  }

  /**
   * Wait for generation to complete
   * Waits for loading indicator to disappear and editor to have content
   */
  async waitForGenerationComplete(): Promise<void> {
    // Wait for loading to finish
    await expect(this.loadingIndicator).toBeHidden({ timeout: 10_000 });

    // Ensure editor has substantial content (at least 100 characters)
    await expect(this.proseMirrorContent).toContainText(/.{100,}/);
  }

  /**
   * Wait for first token to appear during streaming
   * Used for NFR-5 performance testing (<1.5s first token)
   */
  async waitForFirstToken(): Promise<void> {
    await expect(this.proseMirrorContent).toContainText(/.+/, { timeout: 2000 });
  }

  /**
   * Copy proposal to clipboard
   */
  async copyToClipboard(): Promise<void> {
    await this.copyButton.click();
    await expect(this.copyConfirmation).toBeVisible();
  }

  /**
   * Get proposal text from editor
   */
  async getProposalText(): Promise<string> {
    return (await this.proseMirrorContent.textContent()) ?? "";
  }

  /**
   * Edit proposal text in editor
   */
  async editProposalText(newText: string): Promise<void> {
    await this.proseMirrorContent.click();
    await this.proseMirrorContent.clear();
    await this.proseMirrorContent.fill(newText);
  }

  /**
   * Get analysis results
   */
  async getAnalysisResults(): Promise<{
    clientName: string;
    skills: string[];
    hiddenNeeds: string;
  }> {
    const clientName = (await this.clientName.textContent()) ?? "";
    const skillsText = (await this.skillsList.textContent()) ?? "";
    const skills = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const hiddenNeeds = (await this.hiddenNeeds.textContent()) ?? "";

    return { clientName, skills, hiddenNeeds };
  }

  /**
   * Get job score from badge
   */
  async getJobScore(): Promise<string> {
    return (await this.jobScoreBadge.textContent()) ?? "";
  }

  /**
   * Check if truncation warning is visible
   */
  async isTruncationWarningVisible(): Promise<boolean> {
    return this.truncationWarning.isVisible();
  }

  /**
   * Get character and word counts
   */
  async getCounts(): Promise<{ characters: number; words: number }> {
    const charText = (await this.characterCount.textContent()) ?? "0";
    const wordText = (await this.wordCount.textContent()) ?? "0";

    return {
      characters: parseInt(charText.replace(/\D/g, ""), 10),
      words: parseInt(wordText.replace(/\D/g, ""), 10),
    };
  }

  /**
   * Use formatting toolbar (bold, italic, etc.)
   */
  async applyFormatting(format: "bold" | "italic" | "bulletList"): Promise<void> {
    const button = this.editorToolbar.getByRole("button", { name: new RegExp(format, "i") });
    await button.click();
  }

  /**
   * Rehumanize proposal (one-click re-humanization)
   */
  async rehumanizeProposal(): Promise<void> {
    await this.rehumanizeButton.click();
    await expect(this.loadingIndicator).toBeVisible();
    await this.waitForGenerationComplete();
  }
}
