/**
 * Page Object Model for Safety Warning Modal
 *
 * Represents the AI detection warning UI (Story 3.2, 3.6)
 * Displayed when proposal fails perplexity check
 * Allows user to:
 * - View flagged sentences
 * - See perplexity score
 * - Override warning
 * - Cancel and regenerate
 */

import { Page, Locator, expect } from '@playwright/test';

export class SafetyWarningModal {
  readonly page: Page;

  // Modal structure
  readonly modal: Locator;
  readonly modalOverlay: Locator;
  readonly closeButton: Locator;

  // Content
  readonly heading: Locator;
  readonly perplexityScore: Locator;
  readonly explanation: Locator;
  readonly flaggedSentences: Locator;
  readonly flaggedSentencesList: Locator;

  // Threshold information
  readonly currentThreshold: Locator;
  readonly adjustThresholdLink: Locator;

  // Actions
  readonly cancelButton: Locator;
  readonly rehumanizeButton: Locator;
  readonly overrideButton: Locator;

  // Override confirmation dialog
  readonly overrideConfirmDialog: Locator;
  readonly overrideConfirmText: Locator;
  readonly confirmOverrideButton: Locator;
  readonly cancelOverrideButton: Locator;

  // Feedback
  readonly reportFeedbackButton: Locator;
  readonly overrideSuccessMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Modal
    this.modal = page.getByTestId('safety-warning-modal');
    this.modalOverlay = page.locator('[data-modal-overlay]');
    this.closeButton = page.getByRole('button', { name: /close/i });

    // Content
    this.heading = page.getByRole('heading', { name: /ai detection.*warning/i });
    this.perplexityScore = page.getByTestId('perplexity-score');
    this.explanation = page.getByTestId('warning-explanation');
    this.flaggedSentences = page.getByTestId('flagged-sentences-section');
    this.flaggedSentencesList = page.getByTestId(/flagged-sentence-/);

    // Threshold
    this.currentThreshold = page.getByTestId('current-threshold');
    this.adjustThresholdLink = page.getByRole('link', { name: /adjust.*threshold/i });

    // Actions
    this.cancelButton = page.getByRole('button', { name: /cancel|go back/i });
    this.rehumanizeButton = page.getByRole('button', { name: /rehumanize/i });
    this.overrideButton = page.getByRole('button', { name: /override|copy anyway/i });

    // Override confirmation
    this.overrideConfirmDialog = page.getByTestId('override-confirm-dialog');
    this.overrideConfirmText = page.getByText(/are you sure.*override/i);
    this.confirmOverrideButton = page.getByRole('button', { name: /yes.*override|confirm/i });
    this.cancelOverrideButton = page.getByRole('button', { name: /cancel/i });

    // Feedback
    this.reportFeedbackButton = page.getByRole('button', { name: /report.*feedback/i });
    this.overrideSuccessMessage = page.getByText(/copied.*clipboard/i);
  }

  /**
   * Check if modal is visible
   */
  async isVisible(): Promise<boolean> {
    return this.modal.isVisible();
  }

  /**
   * Get perplexity score from modal
   */
  async getPerplexityScore(): Promise<number> {
    const scoreText = (await this.perplexityScore.textContent()) ?? '0';
    const match = scoreText.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  /**
   * Get flagged sentences
   */
  async getFlaggedSentences(): Promise<string[]> {
    const sentences = await this.flaggedSentencesList.all();
    return Promise.all(sentences.map((s) => s.textContent().then((t) => t?.trim() ?? '')));
  }

  /**
   * Get current threshold value
   */
  async getCurrentThreshold(): Promise<number> {
    const thresholdText = (await this.currentThreshold.textContent()) ?? '0';
    const match = thresholdText.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * Cancel and close modal
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.modal).toBeHidden();
  }

  /**
   * Click rehumanize to regenerate proposal
   */
  async rehumanize(): Promise<void> {
    await this.rehumanizeButton.click();
    await expect(this.modal).toBeHidden();
  }

  /**
   * Override warning and copy anyway
   */
  async overrideWarning(): Promise<void> {
    await this.overrideButton.click();

    // Wait for confirmation dialog
    await expect(this.overrideConfirmDialog).toBeVisible();
  }

  /**
   * Confirm override in confirmation dialog
   */
  async confirmOverride(): Promise<void> {
    await expect(this.overrideConfirmDialog).toBeVisible();
    await this.confirmOverrideButton.click();

    // Wait for modal to close and success message
    await expect(this.modal).toBeHidden();
  }

  /**
   * Cancel override confirmation
   */
  async cancelOverrideConfirmation(): Promise<void> {
    await this.cancelOverrideButton.click();
    await expect(this.overrideConfirmDialog).toBeHidden();
    // Modal should still be visible
    await expect(this.modal).toBeVisible();
  }

  /**
   * Complete override flow (override + confirm)
   */
  async overrideAndConfirm(): Promise<void> {
    await this.overrideWarning();
    await this.confirmOverride();
  }

  /**
   * Adjust threshold (navigate to settings)
   */
  async adjustThreshold(): Promise<void> {
    await this.adjustThresholdLink.click();
    // Should navigate to settings
  }

  /**
   * Report feedback for bad scoring
   */
  async reportFeedback(): Promise<void> {
    await this.reportFeedbackButton.click();
    // Opens feedback dialog (Story 4b.10)
  }

  /**
   * Close modal using close button
   */
  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }

  /**
   * Close modal using Escape key
   */
  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.modal).toBeHidden();
  }
}
