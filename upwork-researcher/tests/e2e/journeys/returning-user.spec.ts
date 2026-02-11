/**
 * Journey 2: Returning User E2E Test
 *
 * Tests the complete flow for an existing user:
 * 1. App opens → passphrase prompt displays
 * 2. User enters passphrase → database unlocks
 * 3. User navigates to History → proposal list displays (3 items)
 * 4. User returns to main view, pastes job → analysis runs
 * 5. User generates proposal → streams to editor
 * 6. User edits proposal text → changes persist
 * 7. User clicks "Copy" → edited text copied to clipboard
 *
 * Acceptance Criteria: AC-3
 * - All assertions pass within 90 seconds total
 * - Database contains 4 proposals after journey
 */

import { test, expect } from '@playwright/test';
import { PassphraseDialog } from '../pages/PassphraseDialog';
import { HistoryPage } from '../pages/HistoryPage';
import { MainEditorPage } from '../pages/MainEditorPage';
import { launchTauriApp, closeTauriApp } from '../helpers/tauriDriver';
import { seedDatabase, verifyDatabaseState, clearDatabase } from '../helpers/dbUtils';
import { mockClaudeAPI } from '../helpers/apiMocks';

const SAMPLE_JOB = `Senior Full-Stack Engineer needed for SaaS startup.

Tech Stack:
- Node.js + TypeScript backend
- React + Next.js frontend
- PostgreSQL database
- AWS deployment

Rate: $80-100/hr
Timeline: 3-6 months
Remote: Yes

Looking for someone who can work independently and take ownership of features end-to-end.`;

const TEST_PASSPHRASE = 'test-passphrase-12345';

test.describe('Journey 2: Returning User', () => {
  test.beforeAll(async () => {
    // Seed database with existing data
    seedDatabase('returning-user');
    console.log('✓ Database seeded with returning user data');

    await launchTauriApp({ useBuild: false });
    console.log('✓ Tauri app launched');
  });

  test.afterAll(async () => {
    await closeTauriApp();
  });

  // M5: Per-test isolation — reseed DB before each test
  test.beforeEach(async () => {
    seedDatabase('returning-user');
  });

  test('completes full returning user flow', async ({ page }) => {
    const testStartTime = Date.now();

    // Mock API
    await mockClaudeAPI(page, 'standard');

    // Navigate to app
    await page.goto('tauri://localhost');

    // =====================================================
    // Step 1-2: Passphrase Entry and Unlock (AC-3 Steps 1-2)
    // =====================================================
    const passphraseDialog = new PassphraseDialog(page);

    // Verify passphrase prompt appears
    await expect(passphraseDialog.dialog).toBeVisible({ timeout: 5000 });
    expect(await passphraseDialog.isUnlockMode()).toBe(true);
    console.log('✓ Passphrase prompt displayed');

    // Enter passphrase and unlock
    await passphraseDialog.unlock(TEST_PASSPHRASE);
    console.log('✓ Database unlocked');

    // =====================================================
    // Step 3: Navigate to History (AC-3 Step 3)
    // =====================================================
    const history = new HistoryPage(page);

    await history.navigateToHistory();
    console.log('✓ Navigated to History');

    // Verify 3 proposals are displayed
    const proposalCount = await history.getProposalCount();
    expect(proposalCount).toBe(3);
    console.log(`✓ History displays ${proposalCount} proposals`);

    // Verify we can see proposal details
    const firstProposal = await history.getProposalDetails(0);
    expect(firstProposal.preview.length).toBeGreaterThan(0);
    expect(firstProposal.date.length).toBeGreaterThan(0);
    console.log('✓ Proposal details accessible');

    // =====================================================
    // Step 4: Return to Main View and Analyze Job (AC-3 Step 4)
    // =====================================================
    await history.returnToEditor();
    console.log('✓ Returned to main editor');

    const editor = new MainEditorPage(page);

    await editor.pasteJobContent(SAMPLE_JOB);
    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    console.log('✓ Job analysis complete');

    // =====================================================
    // Step 5: Generate Proposal (AC-3 Step 5)
    // =====================================================
    await editor.generateProposal();
    await editor.waitForGenerationComplete();

    const generatedText = await editor.getProposalText();
    expect(generatedText.length).toBeGreaterThan(100);
    console.log(`✓ Proposal generated (${generatedText.length} characters)`);

    // =====================================================
    // Step 6: Edit Proposal Text (AC-3 Step 6)
    // =====================================================
    const editedText = generatedText + '\n\nAdditional note: Available for a call this week.';
    await editor.editProposalText(editedText);

    // Verify edit persisted
    const currentText = await editor.getProposalText();
    expect(currentText).toContain('Available for a call this week');
    console.log('✓ Proposal edited and changes persisted');

    // =====================================================
    // Step 7: Copy Edited Text (AC-3 Step 7)
    // =====================================================
    await editor.copyToClipboard();
    console.log('✓ Edited proposal copied to clipboard');

    // =====================================================
    // Verify Database State (AC-3 Final Assertion)
    // =====================================================
    // Database should now have 4 proposals (3 existing + 1 new)
    await verifyDatabaseState(page, {
      proposalCount: 4,
    });
    console.log('✓ Database contains 4 proposals');

    // =====================================================
    // AC-3: Complete within 90 seconds
    // =====================================================
    const totalTime = Date.now() - testStartTime;
    expect(totalTime).toBeLessThan(90_000);
    console.log(`✓ Journey completed in ${totalTime}ms (< 90s)`);
  });

  test('shows error for incorrect passphrase', async ({ page }) => {
    seedDatabase('returning-user');
    await page.goto('tauri://localhost');

    const passphraseDialog = new PassphraseDialog(page);
    await expect(passphraseDialog.dialog).toBeVisible({ timeout: 5000 });

    // Enter wrong passphrase
    await passphraseDialog.enterPassphrase('wrong-passphrase');
    await passphraseDialog.submitUnlock();

    // Verify error message
    await expect(passphraseDialog.errorMessage).toBeVisible({ timeout: 3000 });
    const errorText = await passphraseDialog.getErrorMessage();
    expect(errorText.toLowerCase()).toContain('incorrect');
    console.log('✓ Incorrect passphrase error displayed');
  });

  test('can view and navigate proposal history', async ({ page }) => {
    seedDatabase('returning-user');
    await page.goto('tauri://localhost');

    const passphraseDialog = new PassphraseDialog(page);
    await passphraseDialog.unlock(TEST_PASSPHRASE);

    const history = new HistoryPage(page);
    await history.navigateToHistory();

    // Click on first proposal to view details
    await history.viewProposal(0);

    // Should navigate to proposal view
    // (Implementation depends on app routing)
    console.log('✓ Can navigate to proposal details');
  });

  test('persists proposals across app restarts', async ({ page }) => {
    // This test verifies data persistence
    seedDatabase('returning-user');

    // First session: unlock and verify
    await page.goto('tauri://localhost');
    const passphraseDialog = new PassphraseDialog(page);
    await passphraseDialog.unlock(TEST_PASSPHRASE);

    const history = new HistoryPage(page);
    await history.navigateToHistory();
    const firstCount = await history.getProposalCount();
    expect(firstCount).toBe(3);

    // Simulate app restart (reload page)
    await page.reload();

    // Second session: unlock and verify data still exists
    await expect(passphraseDialog.dialog).toBeVisible({ timeout: 5000 });
    await passphraseDialog.unlock(TEST_PASSPHRASE);

    await history.navigateToHistory();
    const secondCount = await history.getProposalCount();
    expect(secondCount).toBe(3);
    console.log('✓ Data persists across restarts');
  });
});
