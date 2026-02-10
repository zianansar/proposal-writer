/**
 * Page Object Model for Settings Panel
 *
 * Represents the settings/configuration UI:
 * - API key management
 * - Safety threshold configuration
 * - User profile (skills, rates)
 * - Voice learning settings
 * - Theme preferences
 */

import { Page, Locator, expect } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  // Navigation
  readonly settingsButton: Locator;
  readonly settingsModal: Locator;
  readonly closeButton: Locator;

  // Tabs/Sections
  readonly generalTab: Locator;
  readonly apiTab: Locator;
  readonly safetyTab: Locator;
  readonly profileTab: Locator;
  readonly voiceTab: Locator;
  readonly appearanceTab: Locator;

  // API Key Section
  readonly apiKeyInput: Locator;
  readonly apiKeyUpdateButton: Locator;
  readonly apiKeyStatus: Locator;

  // Safety Configuration
  readonly safetyThresholdSlider: Locator;
  readonly thresholdValue: Locator;
  readonly resetThresholdButton: Locator;

  // User Profile
  readonly skillsInput: Locator;
  readonly addSkillButton: Locator;
  readonly skillTags: Locator;
  readonly hourlyRateInput: Locator;
  readonly minimumRateInput: Locator;

  // Voice Learning
  readonly voiceSettingsSection: Locator;
  readonly startCalibrationButton: Locator;
  readonly uploadGoldenSetButton: Locator;
  readonly voiceProfileDisplay: Locator;

  // Theme
  readonly darkModeToggle: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.settingsButton = page.getByRole('button', { name: /settings/i });
    this.settingsModal = page.getByTestId('settings-modal');
    this.closeButton = page.getByRole('button', { name: /close/i });

    // Tabs
    this.generalTab = page.getByRole('tab', { name: /general/i });
    this.apiTab = page.getByRole('tab', { name: /api/i });
    this.safetyTab = page.getByRole('tab', { name: /safety/i });
    this.profileTab = page.getByRole('tab', { name: /profile/i });
    this.voiceTab = page.getByRole('tab', { name: /voice/i });
    this.appearanceTab = page.getByRole('tab', { name: /appearance/i });

    // API Key
    this.apiKeyInput = page.getByTestId('api-key-input');
    this.apiKeyUpdateButton = page.getByRole('button', { name: /update.*key/i });
    this.apiKeyStatus = page.getByTestId('api-key-status');

    // Safety
    this.safetyThresholdSlider = page.getByTestId('safety-threshold-slider');
    this.thresholdValue = page.getByTestId('threshold-value');
    this.resetThresholdButton = page.getByRole('button', { name: /reset.*threshold/i });

    // Profile
    this.skillsInput = page.getByTestId('skills-input');
    this.addSkillButton = page.getByRole('button', { name: /add skill/i });
    this.skillTags = page.getByTestId(/skill-tag-/);
    this.hourlyRateInput = page.getByTestId('hourly-rate-input');
    this.minimumRateInput = page.getByTestId('minimum-rate-input');

    // Voice
    this.voiceSettingsSection = page.getByTestId('voice-settings');
    this.startCalibrationButton = page.getByRole('button', { name: /start.*calibration/i });
    this.uploadGoldenSetButton = page.getByRole('button', { name: /upload.*proposals/i });
    this.voiceProfileDisplay = page.getByTestId('voice-profile-display');

    // Theme
    this.darkModeToggle = page.getByTestId('dark-mode-toggle');
  }

  /**
   * Open settings modal
   */
  async openSettings(): Promise<void> {
    await this.settingsButton.click();
    await expect(this.settingsModal).toBeVisible();
  }

  /**
   * Close settings modal
   */
  async closeSettings(): Promise<void> {
    await this.closeButton.click();
    await expect(this.settingsModal).toBeHidden();
  }

  /**
   * Navigate to specific tab
   */
  async goToTab(
    tab: 'general' | 'api' | 'safety' | 'profile' | 'voice' | 'appearance'
  ): Promise<void> {
    const tabMap = {
      general: this.generalTab,
      api: this.apiTab,
      safety: this.safetyTab,
      profile: this.profileTab,
      voice: this.voiceTab,
      appearance: this.appearanceTab,
    };

    await tabMap[tab].click();
  }

  /**
   * Update API key
   */
  async updateApiKey(newKey: string): Promise<void> {
    await this.goToTab('api');
    await this.apiKeyInput.fill(newKey);
    await this.apiKeyUpdateButton.click();
  }

  /**
   * Set safety threshold
   */
  async setSafetyThreshold(value: number): Promise<void> {
    await this.goToTab('safety');
    await this.safetyThresholdSlider.fill(value.toString());
  }

  /**
   * Get current safety threshold
   */
  async getSafetyThreshold(): Promise<number> {
    const valueText = (await this.thresholdValue.textContent()) ?? '0';
    return parseInt(valueText, 10);
  }

  /**
   * Reset safety threshold to default
   */
  async resetSafetyThreshold(): Promise<void> {
    await this.goToTab('safety');
    await this.resetThresholdButton.click();
  }

  /**
   * Add skill to profile
   */
  async addSkill(skill: string): Promise<void> {
    await this.goToTab('profile');
    await this.skillsInput.fill(skill);
    await this.addSkillButton.click();
  }

  /**
   * Get list of skills
   */
  async getSkills(): Promise<string[]> {
    await this.goToTab('profile');
    const tags = await this.skillTags.all();
    return Promise.all(tags.map((tag) => tag.textContent().then((t) => t?.trim() ?? '')));
  }

  /**
   * Set hourly rate
   */
  async setHourlyRate(rate: number): Promise<void> {
    await this.goToTab('profile');
    await this.hourlyRateInput.fill(rate.toString());
  }

  /**
   * Navigate to voice learning
   */
  async navigateToVoiceLearning(): Promise<void> {
    await this.goToTab('voice');
    await expect(this.voiceSettingsSection).toBeVisible();
  }

  /**
   * Start quick calibration
   */
  async startCalibration(): Promise<void> {
    await this.navigateToVoiceLearning();
    await this.startCalibrationButton.click();
  }

  /**
   * Upload golden set proposals
   */
  async uploadGoldenSet(filePaths: string[]): Promise<void> {
    await this.navigateToVoiceLearning();

    // Set input files
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePaths);
  }

  /**
   * Check if voice profile exists
   */
  async hasVoiceProfile(): Promise<boolean> {
    await this.navigateToVoiceLearning();
    return this.voiceProfileDisplay.isVisible();
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode(): Promise<void> {
    await this.goToTab('appearance');
    await this.darkModeToggle.click();
  }

  /**
   * Check if dark mode is enabled
   */
  async isDarkModeEnabled(): Promise<boolean> {
    await this.goToTab('appearance');
    return this.darkModeToggle.isChecked();
  }
}
