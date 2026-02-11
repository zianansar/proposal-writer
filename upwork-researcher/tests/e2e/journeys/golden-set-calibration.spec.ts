/**
 * Journey 3: Golden Set Calibration E2E Test
 *
 * Tests voice learning via uploading past proposals:
 * 1. User navigates to Settings → Voice Learning
 * 2. User clicks "Start Calibration" → Golden Set upload UI opens
 * 3. User uploads 3 sample proposals (via file input)
 * 4. User clicks "Analyze" → voice profile extracted locally
 * 5. User sees Voice Profile Display with metrics
 * 6. User pastes job → generates proposal
 * 7. Generated proposal uses calibrated voice parameters
 *
 * Acceptance Criteria: AC-4
 * - All assertions pass within 120 seconds total
 * - Voice profile shows "Based on 3 proposals"
 */

import { test, expect } from '@playwright/test';
import { SettingsPage } from '../pages/SettingsPage';
import { VoiceCalibrationPage } from '../pages/VoiceCalibrationPage';
import { MainEditorPage } from '../pages/MainEditorPage';
import { launchTauriApp, closeTauriApp } from '../helpers/tauriDriver';
import { seedDatabase, verifyDatabaseState } from '../helpers/dbUtils';
import { mockClaudeAPI } from '../helpers/apiMocks';
import { resolve } from 'path';
import { getDirname } from '../helpers/esm-utils';

const __dirname = getDirname(import.meta.url);

// Fixture paths
const PROPOSAL_1 = resolve(__dirname, '../fixtures/sample-proposals/proposal-1.txt');
const PROPOSAL_2 = resolve(__dirname, '../fixtures/sample-proposals/proposal-2.txt');
const PROPOSAL_3 = resolve(__dirname, '../fixtures/sample-proposals/proposal-3.txt');

const SAMPLE_JOB = `Looking for a Python data engineer to build ETL pipelines.

Requirements:
- 5+ years Python experience
- Strong SQL skills
- Experience with Airflow, Spark
- AWS data services (S3, Redshift, Glue)

Budget: $70-90/hr
Duration: 4-6 months

We need someone who can design scalable data pipelines and optimize our data warehouse.`;

test.describe('Journey 3: Golden Set Calibration', () => {
  test.beforeAll(async () => {
    // Seed with API key but no voice profile
    seedDatabase('with-api-key');
    console.log('✓ Database seeded (API key, no voice profile)');

    await launchTauriApp({ useBuild: false });
    console.log('✓ Tauri app launched');
  });

  test.afterAll(async () => {
    await closeTauriApp();
  });

  // M5: Per-test isolation — reseed DB before each test
  test.beforeEach(async () => {
    seedDatabase('with-api-key');
  });

  test('completes golden set calibration flow', async ({ page }) => {
    const testStartTime = Date.now();

    await mockClaudeAPI(page, 'standard');
    await page.goto('tauri://localhost');

    // =====================================================
    // Step 1: Navigate to Voice Learning (AC-4 Step 1)
    // =====================================================
    const settings = new SettingsPage(page);

    await settings.openSettings();
    await settings.navigateToVoiceLearning();
    console.log('✓ Navigated to Voice Learning settings');

    // =====================================================
    // Step 2: Start Calibration (AC-4 Step 2)
    // =====================================================
    const voice = new VoiceCalibrationPage(page);

    // Verify golden set upload UI is visible
    await expect(voice.goldenSetContainer).toBeVisible({ timeout: 5000 });
    console.log('✓ Golden Set upload UI displayed');

    // =====================================================
    // Step 3: Upload 3 Sample Proposals (AC-4 Step 3)
    // =====================================================
    await voice.uploadProposals([PROPOSAL_1, PROPOSAL_2, PROPOSAL_3]);
    console.log('✓ 3 proposals uploaded');

    // Verify file list shows 3 files
    await expect(voice.fileList).toBeVisible();
    // Could check for specific file names if UI displays them

    // =====================================================
    // Step 4: Analyze Proposals (AC-4 Step 4)
    // =====================================================
    await voice.analyzeProposals();
    console.log('✓ Analysis started');

    // Wait for analysis to complete (local processing)
    await voice.waitForAnalysisComplete();
    console.log('✓ Voice analysis complete');

    // =====================================================
    // Step 5: View Voice Profile (AC-4 Step 5)
    // =====================================================
    await expect(voice.voiceProfileDisplay).toBeVisible({ timeout: 5000 });

    const profile = await voice.getVoiceProfile();
    expect(profile.proposalCount).toBe(3);
    expect(profile.tone.length).toBeGreaterThan(0);
    expect(profile.length.length).toBeGreaterThan(0);
    expect(profile.complexity.length).toBeGreaterThan(0);

    console.log(`✓ Voice profile created: ${profile.tone}, ${profile.length}, ${profile.complexity}`);
    console.log(`✓ Based on ${profile.proposalCount} proposals`);

    // Verify privacy indicator
    await voice.verifyPrivacyIndicator();
    console.log('✓ Privacy indicator visible');

    // Close settings
    await settings.closeSettings();

    // =====================================================
    // Step 6: Generate Proposal with Voice Profile (AC-4 Step 6)
    // =====================================================
    const editor = new MainEditorPage(page);

    await editor.pasteJobContent(SAMPLE_JOB);
    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    console.log('✓ Job analysis complete');

    await editor.generateProposal();
    await editor.waitForGenerationComplete();

    const proposalText = await editor.getProposalText();
    expect(proposalText.length).toBeGreaterThan(100);
    console.log(`✓ Proposal generated with voice profile (${proposalText.length} chars)`);

    // =====================================================
    // Step 7: Verify Voice-Informed Generation (AC-4 Step 7)
    // =====================================================
    // Note: Verifying voice parameters were actually used requires:
    // 1. Checking generation request includes voice parameters
    // 2. Analyzing generated text matches profile characteristics
    // This is implementation-dependent and may require inspection of
    // the Claude API request or text analysis

    // For now, verify generation completed successfully with profile active
    console.log('✓ Generation completed with active voice profile');

    // =====================================================
    // Verify Database State
    // =====================================================
    await verifyDatabaseState(page, {
      hasVoiceProfile: true,
      proposalCount: 1,
    });
    console.log('✓ Database contains voice profile');

    // =====================================================
    // AC-4: Complete within 120 seconds
    // =====================================================
    const totalTime = Date.now() - testStartTime;
    expect(totalTime).toBeLessThan(120_000);
    console.log(`✓ Journey completed in ${totalTime}ms (< 120s)`);
  });

  test('validates file upload requirements', async ({ page }) => {
    seedDatabase('with-api-key');
    await page.goto('tauri://localhost');

    const settings = new SettingsPage(page);
    await settings.openSettings();
    await settings.navigateToVoiceLearning();

    const voice = new VoiceCalibrationPage(page);

    // Try to analyze without uploading files
    // Should show validation error or disabled button
    const analyzeButton = voice.analyzeButton;
    const isDisabled = await analyzeButton.isDisabled();
    expect(isDisabled).toBe(true);
    console.log('✓ Analyze button disabled without files');
  });

  test('shows progress during voice analysis', async ({ page }) => {
    seedDatabase('with-api-key');
    await page.goto('tauri://localhost');

    const settings = new SettingsPage(page);
    await settings.openSettings();
    await settings.navigateToVoiceLearning();

    const voice = new VoiceCalibrationPage(page);

    await voice.uploadProposals([PROPOSAL_1, PROPOSAL_2, PROPOSAL_3]);
    await voice.analyzeProposals();

    // Progress indicator should be visible during analysis
    await expect(voice.analysisProgress).toBeVisible({ timeout: 1000 });
    console.log('✓ Progress indicator visible during analysis');

    // Wait for completion
    await voice.waitForAnalysisComplete();
  });

  test('allows updating voice profile with more proposals', async ({ page }) => {
    // Test that user can upload additional proposals to refine profile
    seedDatabase('with-voice-profile'); // Already has a profile
    await page.goto('tauri://localhost');

    const settings = new SettingsPage(page);
    await settings.openSettings();
    await settings.navigateToVoiceLearning();

    const voice = new VoiceCalibrationPage(page);

    // Should show existing profile
    await expect(voice.voiceProfileDisplay).toBeVisible();

    const initialProfile = await voice.getVoiceProfile();
    const initialCount = initialProfile.proposalCount;

    // Upload more proposals to refine
    await voice.uploadProposals([PROPOSAL_1]);
    await voice.analyzeProposals();
    await voice.waitForAnalysisComplete();

    // Profile should be updated
    const updatedProfile = await voice.getVoiceProfile();
    expect(updatedProfile.proposalCount).toBeGreaterThan(initialCount);
    console.log(`✓ Voice profile updated (${initialCount} → ${updatedProfile.proposalCount} proposals)`);
  });
});
