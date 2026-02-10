/**
 * Page Object Model for Onboarding Flow
 *
 * Represents the onboarding wizard UI (Story 1.15)
 * Supports Journey 1 (first-time user) testing
 */

import { Page, Locator, expect } from '@playwright/test';

export class OnboardingPage {
  readonly page: Page;

  // Navigation
  readonly wizardContainer: Locator;
  readonly stepIndicator: Locator;

  // Welcome Step
  readonly welcomeHeading: Locator;
  readonly getStartedButton: Locator;

  // API Key Step
  readonly apiKeyInput: Locator;
  readonly apiKeySubmitButton: Locator;
  readonly apiKeySuccess: Locator;
  readonly apiKeyError: Locator;

  // Voice Calibration Step (Quick Calibration)
  readonly calibrationHeading: Locator;
  readonly calibrationForm: Locator;

  // Progress indicators
  readonly skipButton: Locator;
  readonly backButton: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.wizardContainer = page.getByTestId('onboarding-wizard');
    this.stepIndicator = page.getByTestId('onboarding-step-indicator');

    // Welcome Step
    this.welcomeHeading = page.getByRole('heading', { name: /welcome/i });
    this.getStartedButton = page.getByRole('button', { name: /get started/i });

    // API Key Step
    this.apiKeyInput = page.getByTestId('api-key-input');
    this.apiKeySubmitButton = page.getByRole('button', { name: /save.*key/i });
    this.apiKeySuccess = page.getByText(/api key.*saved/i);
    this.apiKeyError = page.getByRole('alert');

    // Voice Calibration Step
    this.calibrationHeading = page.getByRole('heading', { name: /voice.*calibration/i });
    this.calibrationForm = page.getByTestId('voice-calibration-form');

    // Progress indicators
    this.skipButton = page.getByRole('button', { name: /skip/i });
    this.backButton = page.getByRole('button', { name: /back/i });
    this.nextButton = page.getByRole('button', { name: /next|continue/i });
  }

  /**
   * Navigate through onboarding welcome step
   */
  async startOnboarding(): Promise<void> {
    await expect(this.welcomeHeading).toBeVisible();
    await this.getStartedButton.click();
  }

  /**
   * Enter and submit API key
   */
  async enterApiKey(apiKey: string): Promise<void> {
    await expect(this.apiKeyInput).toBeVisible();
    await this.apiKeyInput.fill(apiKey);
  }

  async submitApiKey(): Promise<void> {
    await this.apiKeySubmitButton.click();
  }

  /**
   * Complete API key step (enter + submit)
   */
  async completeApiKeyStep(apiKey: string): Promise<void> {
    await this.enterApiKey(apiKey);
    await this.submitApiKey();
    await expect(this.apiKeySuccess).toBeVisible();
  }

  /**
   * Skip current step
   */
  async skipCurrentStep(): Promise<void> {
    await this.skipButton.click();
  }

  /**
   * Go to next step
   */
  async goToNextStep(): Promise<void> {
    await this.nextButton.click();
  }

  /**
   * Go back to previous step
   */
  async goBackToPreviousStep(): Promise<void> {
    await this.backButton.click();
  }

  /**
   * Check if onboarding is visible (for first-time users)
   */
  async isOnboardingVisible(): Promise<boolean> {
    return this.wizardContainer.isVisible();
  }

  /**
   * Get current step number from indicator
   */
  async getCurrentStep(): Promise<string> {
    return this.stepIndicator.textContent() ?? '';
  }
}
