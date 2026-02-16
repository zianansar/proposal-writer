/**
 * Page Object Model for Passphrase Dialog
 *
 * Represents the database encryption passphrase UI (Story 2.1)
 * Two modes:
 * 1. Initial Setup: Create new passphrase
 * 2. Unlock: Enter existing passphrase to decrypt database
 */

import { Page, Locator, expect } from "@playwright/test";

export class PassphraseDialog {
  readonly page: Page;

  // Dialog structure
  readonly dialog: Locator;
  readonly dialogOverlay: Locator;

  // Setup mode (first time)
  readonly setupHeading: Locator;
  readonly setupDescription: Locator;
  readonly passphraseInput: Locator;
  readonly confirmPassphraseInput: Locator;
  readonly strengthIndicator: Locator;
  readonly createButton: Locator;

  // Unlock mode (returning user)
  readonly unlockHeading: Locator;
  readonly unlockDescription: Locator;
  readonly unlockPassphraseInput: Locator;
  readonly unlockButton: Locator;
  readonly forgotPassphraseLink: Locator;

  // Validation and errors
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  // Security info
  readonly securityNote: Locator;
  readonly encryptionBadge: Locator;

  constructor(page: Page) {
    this.page = page;

    // Dialog
    this.dialog = page.getByTestId("passphrase-dialog");
    this.dialogOverlay = page.locator("[data-modal-overlay]");

    // Setup mode
    this.setupHeading = page.getByRole("heading", { name: /create.*passphrase/i });
    this.setupDescription = page.getByText(/secure.*database.*passphrase/i);
    this.passphraseInput = page.getByTestId("passphrase-input");
    this.confirmPassphraseInput = page.getByTestId("confirm-passphrase-input");
    this.strengthIndicator = page.getByTestId("passphrase-strength");
    this.createButton = page.getByRole("button", { name: /create|set.*passphrase/i });

    // Unlock mode
    this.unlockHeading = page.getByRole("heading", { name: /unlock|enter.*passphrase/i });
    this.unlockDescription = page.getByText(/enter.*passphrase.*unlock/i);
    this.unlockPassphraseInput = page.getByTestId("unlock-passphrase-input");
    this.unlockButton = page.getByRole("button", { name: /unlock|submit/i });
    this.forgotPassphraseLink = page.getByRole("link", { name: /forgot.*passphrase/i });

    // Validation
    this.errorMessage = page.getByRole("alert");
    this.successMessage = page.getByText(/passphrase.*set|database.*unlocked/i);

    // Security info
    this.securityNote = page.getByText(/passphrase.*not.*recoverable/i);
    this.encryptionBadge = page.getByText(/sqlcipher.*encrypted/i);
  }

  /**
   * Check if dialog is visible
   */
  async isVisible(): Promise<boolean> {
    return this.dialog.isVisible();
  }

  /**
   * Check if in setup mode (creating new passphrase)
   */
  async isSetupMode(): Promise<boolean> {
    return this.setupHeading.isVisible();
  }

  /**
   * Check if in unlock mode (entering existing passphrase)
   */
  async isUnlockMode(): Promise<boolean> {
    return this.unlockHeading.isVisible();
  }

  /**
   * Create new passphrase (setup mode)
   */
  async createPassphrase(passphrase: string, confirm?: string): Promise<void> {
    await expect(this.setupHeading).toBeVisible();

    await this.passphraseInput.fill(passphrase);
    await this.confirmPassphraseInput.fill(confirm ?? passphrase);
  }

  /**
   * Submit passphrase creation
   */
  async submitCreate(): Promise<void> {
    await this.createButton.click();
  }

  /**
   * Complete passphrase setup (create + submit)
   */
  async completeSetup(passphrase: string): Promise<void> {
    await this.createPassphrase(passphrase);
    await this.submitCreate();
    await expect(this.successMessage).toBeVisible({ timeout: 5000 });
  }

  /**
   * Enter passphrase to unlock database
   */
  async enterPassphrase(passphrase: string): Promise<void> {
    await expect(this.unlockHeading).toBeVisible();
    await this.unlockPassphraseInput.fill(passphrase);
  }

  /**
   * Submit unlock
   */
  async submitUnlock(): Promise<void> {
    await this.unlockButton.click();
  }

  /**
   * Complete unlock flow (enter + submit)
   */
  async unlock(passphrase: string): Promise<void> {
    await this.enterPassphrase(passphrase);
    await this.submitUnlock();

    // Wait for dialog to close (successful unlock)
    await expect(this.dialog).toBeHidden({ timeout: 5000 });
  }

  /**
   * Get passphrase strength indicator text
   */
  async getStrengthIndicator(): Promise<string> {
    return (await this.strengthIndicator.textContent()) ?? "";
  }

  /**
   * Check if error message is visible
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) ?? "";
  }

  /**
   * Click "Forgot Passphrase" link
   */
  async clickForgotPassphrase(): Promise<void> {
    await this.forgotPassphraseLink.click();
    // Should open recovery options dialog (Story 2.9)
  }

  /**
   * Verify security information is displayed
   */
  async verifySecurityInfo(): Promise<void> {
    await expect(this.securityNote).toBeVisible();
    await expect(this.encryptionBadge).toBeVisible();
  }

  /**
   * Close dialog (if dismissible)
   */
  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.dialog).toBeHidden();
  }
}
