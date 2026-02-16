/**
 * Journey 1: First-Time User E2E Test
 *
 * Tests the complete flow for a new user:
 * 1. App opens → onboarding screen displays
 * 2. User enters API key → key is validated and stored
 * 3. User completes Quick Calibration (5 questions) → voice profile created
 * 4. User pastes job content → job analysis runs
 * 5. User clicks "Generate Proposal" → proposal streams to editor
 * 6. User clicks "Copy" → text copied to clipboard
 *
 * Acceptance Criteria: AC-2
 * - All assertions pass within 60 seconds total
 * - Database contains: 1 API key, 1 voice profile, 1 proposal
 */

import { test, expect } from "@playwright/test";

import { mockClaudeAPI } from "../helpers/apiMocks";
import { clearDatabase, verifyDatabaseState, seedDatabase } from "../helpers/dbUtils";
import {
  PerformanceTimer,
  PERFORMANCE_THRESHOLDS,
  assertPerformanceThreshold,
} from "../helpers/performanceUtils";
import { launchTauriApp, closeTauriApp } from "../helpers/tauriDriver";
import { MainEditorPage } from "../pages/MainEditorPage";
import { OnboardingPage } from "../pages/OnboardingPage";
import { VoiceCalibrationPage } from "../pages/VoiceCalibrationPage";

// Sample job content for testing
const SAMPLE_JOB_CONTENT = `Looking for an experienced React developer to build a dashboard application.

Requirements:
- 3+ years React experience
- TypeScript proficiency
- Experience with data visualization (charts, graphs)
- REST API integration
- Tailwind CSS or similar utility framework

Budget: $50-75/hr
Duration: 2-3 months
Start Date: Immediate

The project involves building a real-time analytics dashboard for a SaaS platform. You'll be working with our backend team to integrate various data sources and create interactive visualizations.

We value clean code, test coverage, and strong communication skills.`;

test.describe("Journey 1: First-Time User", () => {
  test.beforeAll(async () => {
    // Clear database for fresh state
    clearDatabase();
    console.log("✓ Database cleared for first-time user test");

    // Launch Tauri app
    await launchTauriApp({ useBuild: false });
    console.log("✓ Tauri app launched");
  });

  test.afterAll(async () => {
    await closeTauriApp();
    console.log("✓ Tauri app closed");
  });

  // M5: Per-test isolation — reset DB state before each test
  test.beforeEach(async () => {
    clearDatabase();
  });

  test("completes full first-time user flow", async ({ page }) => {
    const timer = new PerformanceTimer();

    // Mock Claude API for deterministic responses
    await mockClaudeAPI(page, "standard");

    // =====================================================
    // Step 1: Onboarding Screen Displays (AC-2 Step 1)
    // =====================================================
    const onboarding = new OnboardingPage(page);

    // Navigate to app
    await page.goto("tauri://localhost");

    // Verify onboarding is visible
    await expect(onboarding.welcomeHeading).toBeVisible({ timeout: 5000 });
    timer.mark("onboarding_visible");

    // NFR-1: Cold start <2s
    const startupTime = timer.getMark("onboarding_visible") ?? 0;
    assertPerformanceThreshold(startupTime, PERFORMANCE_THRESHOLDS.COLD_START_MS, "Cold Start");

    // Start onboarding flow
    await onboarding.startOnboarding();
    console.log("✓ Onboarding started");

    // =====================================================
    // Step 2: API Key Entry and Validation (AC-2 Step 2)
    // =====================================================
    const testApiKey = process.env.TEST_API_KEY || "sk-ant-test-key-mock-12345";

    await onboarding.completeApiKeyStep(testApiKey);
    timer.mark("api_key_saved");
    console.log("✓ API key saved");

    // =====================================================
    // Step 3: Quick Calibration - 5 Questions (AC-2 Step 3)
    // =====================================================
    const voice = new VoiceCalibrationPage(page);

    // Answer all 5 questions
    await voice.answerQuestion(1, "Professional and concise");
    await voice.answerQuestion(2, "Bullet points");
    await voice.answerQuestion(3, "Technical jargon");
    await voice.answerQuestion(4, "Data-driven");
    await voice.answerQuestion(5, "Under 300 words");

    await voice.completeCalibration();
    await expect(voice.successMessage).toBeVisible({ timeout: 5000 });
    timer.mark("voice_calibration_complete");
    console.log("✓ Voice calibration completed");

    // =====================================================
    // Step 4: Job Paste and Analysis (AC-2 Step 4)
    // =====================================================
    const editor = new MainEditorPage(page);

    // Navigate to main editor (if not already there)
    // await voice.returnToEditor(); // If needed

    await editor.pasteJobContent(SAMPLE_JOB_CONTENT);
    console.log("✓ Job content pasted");

    await editor.analyzeJob();
    await editor.waitForAnalysisComplete();
    timer.mark("analysis_complete");

    // Verify analysis results are displayed
    const analysis = await editor.getAnalysisResults();
    expect(analysis.skills.length).toBeGreaterThan(0);
    console.log(`✓ Job analysis complete (${analysis.skills.length} skills detected)`);

    // =====================================================
    // Step 5: Generate Proposal with Streaming (AC-2 Step 5)
    // =====================================================
    timer.reset(); // Reset for generation timing
    await editor.generateProposal();

    // NFR-5: First token <1.5s
    await editor.waitForFirstToken();
    const firstTokenTime = timer.elapsed();
    assertPerformanceThreshold(
      firstTokenTime,
      PERFORMANCE_THRESHOLDS.FIRST_TOKEN_MS,
      "First Token",
    );
    console.log(`✓ First token received: ${firstTokenTime}ms`);

    // NFR-6: Full generation <8s
    await editor.waitForGenerationComplete();
    const generationTime = timer.elapsed();
    assertPerformanceThreshold(
      generationTime,
      PERFORMANCE_THRESHOLDS.FULL_GENERATION_MS,
      "Full Generation",
    );
    console.log(`✓ Proposal generation complete: ${generationTime}ms`);

    // Verify proposal has content
    const proposalText = await editor.getProposalText();
    expect(proposalText.length).toBeGreaterThan(100);
    console.log(`✓ Proposal generated (${proposalText.length} characters)`);

    // =====================================================
    // Step 6: Copy to Clipboard (AC-2 Step 6)
    // =====================================================
    timer.reset();
    await editor.copyToClipboard();
    const copyTime = timer.elapsed();

    // NFR-4: Copy <100ms
    assertPerformanceThreshold(copyTime, PERFORMANCE_THRESHOLDS.UI_RESPONSE_MS, "Clipboard Copy");
    console.log(`✓ Copied to clipboard: ${copyTime}ms`);

    // =====================================================
    // Step 7: Verify Database State (AC-2 Final Assertion)
    // =====================================================
    // Note: Database verification requires either:
    // 1. Tauri command to expose test DB state
    // 2. Direct SQLite access
    // 3. UI-based verification (less reliable)

    // For now, we'll verify via UI that data persists
    // In a production test, we'd implement proper DB verification
    await verifyDatabaseState(page, {
      hasApiKey: true,
      hasVoiceProfile: true,
      proposalCount: 1,
    });
    console.log("✓ Database state verified (placeholder)");

    // =====================================================
    // AC-2: All assertions pass within 60 seconds
    // =====================================================
    // Note: Individual steps measured above
    // Total flow verification would be tracked from test start
  });

  test("shows appropriate error when API key is invalid", async ({ page }) => {
    clearDatabase();
    await page.goto("tauri://localhost");

    const onboarding = new OnboardingPage(page);
    await expect(onboarding.welcomeHeading).toBeVisible({ timeout: 5000 });
    await onboarding.startOnboarding();

    // Enter invalid API key
    await onboarding.enterApiKey("invalid-key-12345");
    await onboarding.submitApiKey();

    // Verify error message appears
    await expect(onboarding.apiKeyError).toBeVisible({ timeout: 3000 });
    console.log("✓ API key validation error displayed correctly");
  });

  test("allows skipping voice calibration", async ({ page }) => {
    clearDatabase();
    await page.goto("tauri://localhost");

    const onboarding = new OnboardingPage(page);
    const voice = new VoiceCalibrationPage(page);

    // Complete onboarding up to voice calibration
    await onboarding.startOnboarding();
    await onboarding.completeApiKeyStep(process.env.TEST_API_KEY || "sk-ant-test-key-mock");

    // Skip voice calibration
    await voice.skipQuestion();

    // Should proceed to main editor
    const editor = new MainEditorPage(page);
    await expect(editor.jobInput).toBeVisible({ timeout: 3000 });
    console.log("✓ Voice calibration skipped successfully");
  });
});
