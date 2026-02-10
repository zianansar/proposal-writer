/**
 * Page Object Model for Voice Calibration
 *
 * Represents the voice learning calibration UI (Story 5.7)
 * Two modes:
 * 1. Quick Calibration: 5 questions about writing style
 * 2. Golden Set Upload: Upload past proposals for analysis
 */

import { Page, Locator, expect } from '@playwright/test';

export class VoiceCalibrationPage {
  readonly page: Page;

  // Quick Calibration (5 questions)
  readonly calibrationContainer: Locator;
  readonly questionHeading: Locator;
  readonly questionNumber: Locator;

  // Question 1: Tone
  readonly toneOptions: Locator;

  // Question 2: Structure
  readonly structureOptions: Locator;

  // Question 3: Technical depth
  readonly technicalOptions: Locator;

  // Question 4: Persuasion style
  readonly persuasionOptions: Locator;

  // Question 5: Length preference
  readonly lengthOptions: Locator;

  // Navigation
  readonly backButton: Locator;
  readonly nextButton: Locator;
  readonly skipButton: Locator;
  readonly completeButton: Locator;

  // Success/Completion
  readonly successMessage: Locator;
  readonly viewProfileButton: Locator;

  // Golden Set Upload (alternative path)
  readonly goldenSetContainer: Locator;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly fileList: Locator;
  readonly analyzeButton: Locator;
  readonly analysisProgress: Locator;

  // Voice Profile Display
  readonly voiceProfileDisplay: Locator;
  readonly toneParameter: Locator;
  readonly lengthParameter: Locator;
  readonly complexityParameter: Locator;
  readonly proposalCountBadge: Locator;

  // Privacy indicator
  readonly privacyIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Quick Calibration
    this.calibrationContainer = page.getByTestId('voice-calibration-container');
    this.questionHeading = page.getByTestId('calibration-question');
    this.questionNumber = page.getByTestId('question-number');

    this.toneOptions = page.getByTestId(/tone-option-/);
    this.structureOptions = page.getByTestId(/structure-option-/);
    this.technicalOptions = page.getByTestId(/technical-option-/);
    this.persuasionOptions = page.getByTestId(/persuasion-option-/);
    this.lengthOptions = page.getByTestId(/length-option-/);

    // Navigation
    this.backButton = page.getByRole('button', { name: /back/i });
    this.nextButton = page.getByRole('button', { name: /next/i });
    this.skipButton = page.getByRole('button', { name: /skip/i });
    this.completeButton = page.getByRole('button', { name: /complete|finish/i });

    // Success
    this.successMessage = page.getByText(/calibration.*complete|profile.*created/i);
    this.viewProfileButton = page.getByRole('button', { name: /view.*profile/i });

    // Golden Set Upload
    this.goldenSetContainer = page.getByTestId('golden-set-upload');
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.getByRole('button', { name: /upload/i });
    this.fileList = page.getByTestId('file-list');
    this.analyzeButton = page.getByRole('button', { name: /analyze/i });
    this.analysisProgress = page.getByTestId('analysis-progress');

    // Voice Profile
    this.voiceProfileDisplay = page.getByTestId('voice-profile-display');
    this.toneParameter = page.getByTestId('voice-tone');
    this.lengthParameter = page.getByTestId('voice-length');
    this.complexityParameter = page.getByTestId('voice-complexity');
    this.proposalCountBadge = page.getByTestId('proposal-count');

    // Privacy
    this.privacyIndicator = page.getByTestId('privacy-indicator');
  }

  /**
   * Answer a question in Quick Calibration by question number (1-5)
   */
  async answerQuestion(questionNumber: number, optionText: string): Promise<void> {
    const optionButton = this.page.getByRole('button', { name: new RegExp(optionText, 'i') });
    await optionButton.click();

    // If not the last question, advance to next
    if (questionNumber < 5) {
      await this.nextButton.click();
    }
  }

  /**
   * Complete calibration (after answering all questions)
   */
  async completeCalibration(): Promise<void> {
    await this.completeButton.click();
    await expect(this.successMessage).toBeVisible();
  }

  /**
   * Skip a question
   */
  async skipQuestion(): Promise<void> {
    await this.skipButton.click();
  }

  /**
   * Go back to previous question
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
  }

  /**
   * Get current question number
   */
  async getCurrentQuestionNumber(): Promise<number> {
    const text = (await this.questionNumber.textContent()) ?? '0';
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * Upload golden set proposals
   */
  async uploadProposals(filePaths: string[]): Promise<void> {
    await this.fileInput.setInputFiles(filePaths);
    await expect(this.fileList).toBeVisible();
  }

  /**
   * Analyze uploaded proposals
   */
  async analyzeProposals(): Promise<void> {
    await this.analyzeButton.click();
    await expect(this.analysisProgress).toBeVisible();
  }

  /**
   * Wait for analysis to complete
   */
  async waitForAnalysisComplete(): Promise<void> {
    await expect(this.analysisProgress).toBeHidden({ timeout: 30_000 });
    await expect(this.voiceProfileDisplay).toBeVisible();
  }

  /**
   * Get voice profile parameters
   */
  async getVoiceProfile(): Promise<{
    tone: string;
    length: string;
    complexity: string;
    proposalCount: number;
  }> {
    const tone = (await this.toneParameter.textContent()) ?? '';
    const length = (await this.lengthParameter.textContent()) ?? '';
    const complexity = (await this.complexityParameter.textContent()) ?? '';
    const countText = (await this.proposalCountBadge.textContent()) ?? '0';
    const proposalCount = parseInt(countText.replace(/\D/g, ''), 10);

    return { tone, length, complexity, proposalCount };
  }

  /**
   * Verify privacy indicator is visible
   */
  async verifyPrivacyIndicator(): Promise<void> {
    await expect(this.privacyIndicator).toBeVisible();
    await expect(this.privacyIndicator).toContainText(/never.*leave.*device|local.*only/i);
  }

  /**
   * View voice profile
   */
  async viewProfile(): Promise<void> {
    await this.viewProfileButton.click();
    await expect(this.voiceProfileDisplay).toBeVisible();
  }
}
