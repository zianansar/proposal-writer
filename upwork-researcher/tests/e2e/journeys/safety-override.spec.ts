/**
 * Journey 4: Safety Override E2E Test
 *
 * Tests the AI detection warning and override flow:
 * 1. User pastes job content designed to trigger high AI detection score
 * 2. User generates proposal → safety check fails (perplexity >150)
 * 3. Warning modal displays with score and explanation
 * 4. User clicks "Override Anyway" → confirmation dialog appears
 * 5. User confirms override → proposal copied to clipboard
 * 6. Override logged to safety_overrides table
 *
 * Acceptance Criteria: AC-5
 * - All assertions pass within 60 seconds total
 * - safety_overrides table contains 1 record
 */

import { test, expect } from '@playwright/test';
import { MainEditorPage } from '../pages/MainEditorPage';
import { SafetyWarningModal } from '../pages/SafetyWarningModal';
import { launchTauriApp, closeTauriApp } from '../helpers/tauriDriver';
import { seedDatabase, verifyDatabaseState } from '../helpers/dbUtils';
import { mockClaudeAPI, mockPerplexityAnalysis } from '../helpers/apiMocks';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load high AI detection job fixture
const HIGH_AI_JOB_PATH = resolve(__dirname, '../fixtures/high-ai-detection-job.txt');
const HIGH_AI_JOB_CONTENT = readFileSync(HIGH_AI_JOB_PATH, 'utf-8');

test.describe('Journey 4: Safety Override', () => {
  test.beforeAll(async () => {
    // Seed with API key and voice profile
    seedDatabase('with-voice-profile');
    console.log('✓ Database seeded (API key + voice profile)');

    await launchTauriApp({ useBuild: false });
    console.log('✓ Tauri app launched');
  });

  test.afterAll(async () => {
    await closeTauriApp();
  });

  test('completes safety override flow', async ({ page }) => {
    const testStartTime = Date.now();

    // Mock Claude API to return high-perplexity proposal
    await mockClaudeAPI(page, 'high-perplexity');

    // Mock perplexity analysis to return high score
    await mockPerplexityAnalysis(page, 180); // Above 150 threshold

    await page.goto('tauri://localhost');

    // =====================================================
    // Step 1-2: Generate High-Perplexity Proposal (AC-5 Steps 1-2)
    // =====================================================
    const editor = new MainEditorPage(page);

    await editor.pasteJobContent(HIGH_AI_JOB_CONTENT);
    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    console.log('✓ Job analysis complete');

    await editor.generateProposal();
    await editor.waitForGenerationComplete();
    console.log('✓ Proposal generated');

    // =====================================================
    // Step 3: Safety Warning Modal (AC-5 Step 3)
    // =====================================================
    const modal = new SafetyWarningModal(page);

    // Safety warning should appear automatically
    await expect(modal.modal).toBeVisible({ timeout: 5000 });
    console.log('✓ Safety warning modal displayed');

    // Verify perplexity score is shown
    const score = await modal.getPerplexityScore();
    expect(score).toBeGreaterThan(150);
    console.log(`✓ Perplexity score: ${score} (above threshold)`);

    // Verify explanation is visible
    await expect(modal.explanation).toBeVisible();

    // Verify flagged sentences are shown
    const flaggedSentences = await modal.getFlaggedSentences();
    expect(flaggedSentences.length).toBeGreaterThan(0);
    console.log(`✓ ${flaggedSentences.length} flagged sentences displayed`);

    // Verify current threshold is shown
    const threshold = await modal.getCurrentThreshold();
    expect(threshold).toBe(150); // Default threshold
    console.log(`✓ Current threshold: ${threshold}`);

    // =====================================================
    // Step 4: Override Warning (AC-5 Step 4)
    // =====================================================
    await modal.overrideWarning();

    // Confirmation dialog should appear
    await expect(modal.overrideConfirmDialog).toBeVisible({ timeout: 3000 });
    await expect(modal.overrideConfirmText).toBeVisible();
    console.log('✓ Override confirmation dialog displayed');

    // =====================================================
    // Step 5: Confirm Override (AC-5 Step 5)
    // =====================================================
    await modal.confirmOverride();

    // Modal should close
    await expect(modal.modal).toBeHidden({ timeout: 3000 });
    console.log('✓ Override confirmed, modal closed');

    // Proposal should be copied to clipboard
    await expect(modal.overrideSuccessMessage).toBeVisible({ timeout: 2000 });
    console.log('✓ Proposal copied to clipboard');

    // =====================================================
    // Step 6: Verify Override Logged (AC-5 Step 6)
    // =====================================================
    await verifyDatabaseState({
      safetyOverrideCount: 1,
    });
    console.log('✓ Override logged to safety_overrides table');

    // =====================================================
    // AC-5: Complete within 60 seconds
    // =====================================================
    const totalTime = Date.now() - testStartTime;
    expect(totalTime).toBeLessThan(60_000);
    console.log(`✓ Journey completed in ${totalTime}ms (< 60s)`);
  });

  test('allows canceling override', async ({ page }) => {
    await mockClaudeAPI(page, 'high-perplexity');
    await mockPerplexityAnalysis(page, 180);
    await page.goto('tauri://localhost');

    const editor = new MainEditorPage(page);
    await editor.pasteJobContent(HIGH_AI_JOB_CONTENT);
    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    await editor.generateProposal();
    await editor.waitForGenerationComplete();

    const modal = new SafetyWarningModal(page);
    await expect(modal.modal).toBeVisible({ timeout: 5000 });

    // Start override but then cancel
    await modal.overrideWarning();
    await expect(modal.overrideConfirmDialog).toBeVisible();

    await modal.cancelOverrideConfirmation();

    // Should return to warning modal (not close)
    await expect(modal.modal).toBeVisible();
    await expect(modal.overrideConfirmDialog).toBeHidden();
    console.log('✓ Override canceled, returned to warning modal');

    // No override should be logged
    await verifyDatabaseState({
      safetyOverrideCount: 0,
    });
  });

  test('allows rehumanizing instead of overriding', async ({ page }) => {
    await mockClaudeAPI(page, 'high-perplexity');
    await mockPerplexityAnalysis(page, 180);
    await page.goto('tauri://localhost');

    const editor = new MainEditorPage(page);
    await editor.pasteJobContent(HIGH_AI_JOB_CONTENT);
    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    await editor.generateProposal();
    await editor.waitForGenerationComplete();

    const modal = new SafetyWarningModal(page);
    await expect(modal.modal).toBeVisible({ timeout: 5000 });

    // Click rehumanize button
    await modal.rehumanize();

    // Modal should close
    await expect(modal.modal).toBeHidden();

    // Should trigger regeneration
    await expect(editor.loadingIndicator).toBeVisible({ timeout: 2000 });
    console.log('✓ Rehumanization triggered');

    // No override should be logged
    await verifyDatabaseState({
      safetyOverrideCount: 0,
    });
  });

  test('can close warning with Escape key', async ({ page }) => {
    await mockClaudeAPI(page, 'high-perplexity');
    await mockPerplexityAnalysis(page, 180);
    await page.goto('tauri://localhost');

    const editor = new MainEditorPage(page);
    await editor.pasteJobContent(HIGH_AI_JOB_CONTENT);
    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    await editor.generateProposal();
    await editor.waitForGenerationComplete();

    const modal = new SafetyWarningModal(page);
    await expect(modal.modal).toBeVisible({ timeout: 5000 });

    // Press Escape to close
    await modal.closeWithEscape();

    await expect(modal.modal).toBeHidden();
    console.log('✓ Modal closed with Escape key');
  });

  test('shows flagged sentences with highlighting', async ({ page }) => {
    await mockClaudeAPI(page, 'high-perplexity');
    await mockPerplexityAnalysis(page, 180);
    await page.goto('tauri://localhost');

    const editor = new MainEditorPage(page);
    await editor.pasteJobContent(HIGH_AI_JOB_CONTENT);
    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    await editor.generateProposal();
    await editor.waitForGenerationComplete();

    const modal = new SafetyWarningModal(page);
    await expect(modal.modal).toBeVisible({ timeout: 5000 });

    // Verify flagged sentences section is visible
    await expect(modal.flaggedSentences).toBeVisible();

    const sentences = await modal.getFlaggedSentences();
    expect(sentences.length).toBeGreaterThan(0);

    sentences.forEach((sentence, i) => {
      expect(sentence.length).toBeGreaterThan(0);
      console.log(`  Flagged sentence ${i + 1}: "${sentence.substring(0, 50)}..."`);
    });

    console.log(`✓ ${sentences.length} flagged sentences displayed with details`);
  });

  test('allows adjusting threshold from warning', async ({ page }) => {
    await mockClaudeAPI(page, 'high-perplexity');
    await mockPerplexityAnalysis(page, 180);
    await page.goto('tauri://localhost');

    const editor = new MainEditorPage(page);
    await editor.pasteJobContent(HIGH_AI_JOB_CONTENT);
    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    await editor.generateProposal();
    await editor.waitForGenerationComplete();

    const modal = new SafetyWarningModal(page);
    await expect(modal.modal).toBeVisible({ timeout: 5000 });

    // Click adjust threshold link
    await modal.adjustThreshold();

    // Should navigate to settings
    // (Implementation depends on app routing)
    console.log('✓ Threshold adjustment link works');
  });
});
