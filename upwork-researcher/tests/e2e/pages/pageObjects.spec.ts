/**
 * Validation tests for Page Object Models
 *
 * These tests verify that page objects are properly structured
 * and can be instantiated correctly.
 */

import { test, expect } from '@playwright/test';
import { OnboardingPage } from './OnboardingPage';
import { MainEditorPage } from './MainEditorPage';
import { HistoryPage } from './HistoryPage';
import { SettingsPage } from './SettingsPage';
import { VoiceCalibrationPage } from './VoiceCalibrationPage';
import { SafetyWarningModal } from './SafetyWarningModal';
import { PassphraseDialog } from './PassphraseDialog';

test.describe('Page Object Model Structure Validation', () => {
  test('OnboardingPage should be properly structured', async ({ page }) => {
    const onboarding = new OnboardingPage(page);

    // Verify key locators are defined
    expect(onboarding.page).toBeDefined();
    expect(onboarding.welcomeHeading).toBeDefined();
    expect(onboarding.apiKeyInput).toBeDefined();
    expect(onboarding.getStartedButton).toBeDefined();

    // Verify methods are defined
    expect(typeof onboarding.startOnboarding).toBe('function');
    expect(typeof onboarding.enterApiKey).toBe('function');
    expect(typeof onboarding.completeApiKeyStep).toBe('function');
  });

  test('MainEditorPage should be properly structured', async ({ page }) => {
    const editor = new MainEditorPage(page);

    // Verify key locators
    expect(editor.page).toBeDefined();
    expect(editor.jobInput).toBeDefined();
    expect(editor.generateButton).toBeDefined();
    expect(editor.proposalEditor).toBeDefined();
    expect(editor.copyButton).toBeDefined();

    // Verify methods
    expect(typeof editor.pasteJobContent).toBe('function');
    expect(typeof editor.generateProposal).toBe('function');
    expect(typeof editor.copyToClipboard).toBe('function');
    expect(typeof editor.getProposalText).toBe('function');
  });

  test('HistoryPage should be properly structured', async ({ page }) => {
    const history = new HistoryPage(page);

    // Verify key locators
    expect(history.page).toBeDefined();
    expect(history.proposalList).toBeDefined();
    expect(history.proposalItems).toBeDefined();

    // Verify methods
    expect(typeof history.navigateToHistory).toBe('function');
    expect(typeof history.getProposalCount).toBe('function');
    expect(typeof history.viewProposal).toBe('function');
  });

  test('SettingsPage should be properly structured', async ({ page }) => {
    const settings = new SettingsPage(page);

    // Verify key locators
    expect(settings.page).toBeDefined();
    expect(settings.settingsButton).toBeDefined();
    expect(settings.apiKeyInput).toBeDefined();
    expect(settings.safetyThresholdSlider).toBeDefined();

    // Verify methods
    expect(typeof settings.openSettings).toBe('function');
    expect(typeof settings.updateApiKey).toBe('function');
    expect(typeof settings.setSafetyThreshold).toBe('function');
  });

  test('VoiceCalibrationPage should be properly structured', async ({ page }) => {
    const voice = new VoiceCalibrationPage(page);

    // Verify key locators
    expect(voice.page).toBeDefined();
    expect(voice.calibrationContainer).toBeDefined();
    expect(voice.questionHeading).toBeDefined();
    expect(voice.voiceProfileDisplay).toBeDefined();

    // Verify methods
    expect(typeof voice.answerQuestion).toBe('function');
    expect(typeof voice.completeCalibration).toBe('function');
    expect(typeof voice.uploadProposals).toBe('function');
    expect(typeof voice.getVoiceProfile).toBe('function');
  });

  test('SafetyWarningModal should be properly structured', async ({ page }) => {
    const modal = new SafetyWarningModal(page);

    // Verify key locators
    expect(modal.page).toBeDefined();
    expect(modal.modal).toBeDefined();
    expect(modal.perplexityScore).toBeDefined();
    expect(modal.overrideButton).toBeDefined();

    // Verify methods
    expect(typeof modal.isVisible).toBe('function');
    expect(typeof modal.getPerplexityScore).toBe('function');
    expect(typeof modal.overrideWarning).toBe('function');
    expect(typeof modal.confirmOverride).toBe('function');
  });

  test('PassphraseDialog should be properly structured', async ({ page }) => {
    const passphrase = new PassphraseDialog(page);

    // Verify key locators
    expect(passphrase.page).toBeDefined();
    expect(passphrase.dialog).toBeDefined();
    expect(passphrase.passphraseInput).toBeDefined();
    expect(passphrase.unlockButton).toBeDefined();

    // Verify methods
    expect(typeof passphrase.isVisible).toBe('function');
    expect(typeof passphrase.createPassphrase).toBe('function');
    expect(typeof passphrase.unlock).toBe('function');
  });
});
