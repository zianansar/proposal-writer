/**
 * Validation tests for Page Object Models (L1 fix)
 *
 * Verifies page objects have correct locator strategies
 * and methods return expected types. Tests actual locator
 * selectors against known data-testid patterns, replacing
 * trivial `toBeDefined()` assertions.
 */

import { test, expect } from "@playwright/test";

import { HistoryPage } from "./HistoryPage";
import { MainEditorPage } from "./MainEditorPage";
import { OnboardingPage } from "./OnboardingPage";
import { PassphraseDialog } from "./PassphraseDialog";
import { SafetyWarningModal } from "./SafetyWarningModal";
import { SettingsPage } from "./SettingsPage";
import { VoiceCalibrationPage } from "./VoiceCalibrationPage";

test.describe("Page Object Model Validation", () => {
  test("OnboardingPage locators use correct selectors", async ({ page }) => {
    const onboarding = new OnboardingPage(page);

    // Verify locators resolve to expected selector patterns
    expect(String(onboarding.apiKeyInput)).toContain("api-key-input");
    expect(String(onboarding.wizardContainer)).toContain("onboarding-wizard");
    expect(String(onboarding.stepIndicator)).toContain("onboarding-step-indicator");

    // Verify methods are callable (type check)
    expect(onboarding.startOnboarding).toBeInstanceOf(Function);
    expect(onboarding.enterApiKey).toBeInstanceOf(Function);
    expect(onboarding.completeApiKeyStep).toBeInstanceOf(Function);
    expect(onboarding.skipCurrentStep).toBeInstanceOf(Function);
  });

  test("MainEditorPage locators use correct selectors", async ({ page }) => {
    const editor = new MainEditorPage(page);

    expect(String(editor.jobInput)).toContain("job-input");
    expect(String(editor.generateButton)).toContain("generate-button");
    expect(String(editor.proposalEditor)).toContain("proposal-editor");
    expect(String(editor.copyButton)).toContain("copy-button");
    expect(String(editor.loadingIndicator)).toContain("loading-indicator");
    expect(String(editor.analysisPanel)).toContain("job-analysis-panel");

    expect(editor.pasteJobContent).toBeInstanceOf(Function);
    expect(editor.generateProposal).toBeInstanceOf(Function);
    expect(editor.copyToClipboard).toBeInstanceOf(Function);
    expect(editor.getProposalText).toBeInstanceOf(Function);
    expect(editor.editProposalText).toBeInstanceOf(Function);
  });

  test("HistoryPage locators use correct selectors", async ({ page }) => {
    const history = new HistoryPage(page);

    expect(String(history.historyNav)).toContain("history-nav");
    expect(String(history.proposalList)).toContain("history-list");
    expect(String(history.emptyState)).toBeTruthy();

    expect(history.navigateToHistory).toBeInstanceOf(Function);
    expect(history.getProposalCount).toBeInstanceOf(Function);
    expect(history.viewProposal).toBeInstanceOf(Function);
    expect(history.deleteProposal).toBeInstanceOf(Function);
    expect(history.searchProposals).toBeInstanceOf(Function);
  });

  test("SettingsPage locators use correct selectors", async ({ page }) => {
    const settings = new SettingsPage(page);

    expect(String(settings.settingsModal)).toContain("settings-modal");
    expect(String(settings.apiKeyInput)).toContain("api-key-input");
    expect(String(settings.safetyThresholdSlider)).toContain("safety-threshold-slider");
    expect(String(settings.darkModeToggle)).toContain("dark-mode-toggle");

    expect(settings.openSettings).toBeInstanceOf(Function);
    expect(settings.closeSettings).toBeInstanceOf(Function);
    expect(settings.updateApiKey).toBeInstanceOf(Function);
    expect(settings.setSafetyThreshold).toBeInstanceOf(Function);
    expect(settings.navigateToVoiceLearning).toBeInstanceOf(Function);
  });

  test("VoiceCalibrationPage locators use correct selectors", async ({ page }) => {
    const voice = new VoiceCalibrationPage(page);

    expect(String(voice.calibrationContainer)).toContain("voice-calibration-container");
    expect(String(voice.questionHeading)).toContain("calibration-question");
    expect(String(voice.goldenSetContainer)).toContain("golden-set-upload");
    expect(String(voice.voiceProfileDisplay)).toContain("voice-profile-display");
    expect(String(voice.privacyIndicator)).toContain("privacy-indicator");

    expect(voice.answerQuestion).toBeInstanceOf(Function);
    expect(voice.completeCalibration).toBeInstanceOf(Function);
    expect(voice.uploadProposals).toBeInstanceOf(Function);
    expect(voice.getVoiceProfile).toBeInstanceOf(Function);
    expect(voice.verifyPrivacyIndicator).toBeInstanceOf(Function);
  });

  test("SafetyWarningModal locators use correct selectors", async ({ page }) => {
    const modal = new SafetyWarningModal(page);

    expect(String(modal.modal)).toContain("safety-warning-modal");
    expect(String(modal.perplexityScore)).toContain("perplexity-score");
    expect(String(modal.flaggedSentences)).toContain("flagged-sentences-section");
    expect(String(modal.overrideConfirmDialog)).toContain("override-confirm-dialog");

    expect(modal.isVisible).toBeInstanceOf(Function);
    expect(modal.getPerplexityScore).toBeInstanceOf(Function);
    expect(modal.getFlaggedSentences).toBeInstanceOf(Function);
    expect(modal.overrideWarning).toBeInstanceOf(Function);
    expect(modal.confirmOverride).toBeInstanceOf(Function);
    expect(modal.closeWithEscape).toBeInstanceOf(Function);
  });

  test("PassphraseDialog locators use correct selectors", async ({ page }) => {
    const passphrase = new PassphraseDialog(page);

    expect(String(passphrase.dialog)).toContain("passphrase-dialog");
    expect(String(passphrase.passphraseInput)).toContain("passphrase-input");
    expect(String(passphrase.unlockPassphraseInput)).toContain("unlock-passphrase-input");
    expect(String(passphrase.strengthIndicator)).toContain("passphrase-strength");

    expect(passphrase.isVisible).toBeInstanceOf(Function);
    expect(passphrase.createPassphrase).toBeInstanceOf(Function);
    expect(passphrase.unlock).toBeInstanceOf(Function);
    expect(passphrase.isSetupMode).toBeInstanceOf(Function);
    expect(passphrase.isUnlockMode).toBeInstanceOf(Function);
  });
});
