---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 10
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 8.9: Comprehensive E2E Test Suite

## Story

As a developer,
I want end-to-end tests covering full user journeys,
So that we can ship with confidence.

## Acceptance Criteria

**AC-1: E2E Test Infrastructure Setup**

**Given** the project codebase
**When** I run `npm run test:e2e`
**Then** Playwright launches the Tauri application
**And** WebDriver protocol connects to the app window
**And** tests can interact with UI elements via selectors
**And** setup completes in <30 seconds

**AC-2: Journey 1 - First-Time User**

**Given** the app is freshly installed (no database)
**When** the E2E test runs the first-time user journey
**Then** the following flow completes successfully:

1. App opens → onboarding screen displays
2. User enters API key → key is validated and stored
3. User completes Quick Calibration (5 questions) → voice profile created
4. User pastes job content → job analysis runs
5. User clicks "Generate Proposal" → proposal streams to editor
6. User clicks "Copy" → text copied to clipboard

**And** all assertions pass within 60 seconds total
**And** database contains: 1 API key, 1 voice profile, 1 proposal

**AC-3: Journey 2 - Returning User**

**Given** an existing database with passphrase, API key, and 3 proposals
**When** the E2E test runs the returning user journey
**Then** the following flow completes successfully:

1. App opens → passphrase prompt displays
2. User enters passphrase → database unlocks
3. User navigates to History → proposal list displays (3 items)
4. User returns to main view, pastes job → analysis runs
5. User generates proposal → streams to editor
6. User edits proposal text → changes persist
7. User clicks "Copy" → edited text copied to clipboard

**And** all assertions pass within 90 seconds total
**And** database contains 4 proposals after journey

**AC-4: Journey 3 - Golden Set Calibration**

**Given** an existing database with API key (no voice profile)
**When** the E2E test runs the golden set calibration journey
**Then** the following flow completes successfully:

1. User navigates to Settings → Voice Learning
2. User clicks "Start Calibration" → Golden Set upload UI opens
3. User uploads 3 sample proposals (via file input)
4. User clicks "Analyze" → voice profile extracted locally
5. User sees Voice Profile Display with metrics
6. User pastes job → generates proposal
7. Generated proposal uses calibrated voice parameters

**And** all assertions pass within 120 seconds total
**And** voice profile shows "Based on 3 proposals"

**AC-5: Journey 4 - Safety Override**

**Given** an existing database with API key and voice profile
**When** the E2E test runs the safety override journey
**Then** the following flow completes successfully:

1. User pastes job content designed to trigger high AI detection score
2. User generates proposal → safety check fails (perplexity >150)
3. Warning modal displays with score and explanation
4. User clicks "Override Anyway" → confirmation dialog appears
5. User confirms override → proposal copied to clipboard
6. Override logged to safety_overrides table

**And** all assertions pass within 60 seconds total
**And** safety_overrides table contains 1 record

**AC-6: Cross-Platform Compatibility**

**Given** the E2E test suite
**When** tests run on macOS (WebKit WebView)
**And** tests run on Windows (Edge WebView2)
**Then** all 4 journeys pass on both platforms
**And** no platform-specific failures or flakiness
**And** CI reports success for both matrix entries

**AC-7: Performance Validation**

**Given** the E2E test suite with performance assertions
**When** tests run Journey 1
**Then** app startup (cold launch to onboarding visible) completes in <2s (NFR-1)
**And** proposal generation (click to first token) completes in <1.5s (NFR-5)
**And** full generation completes in <8s (NFR-6)
**And** copy to clipboard completes in <100ms (NFR-4)

**And** performance metrics are logged for each run
**And** test fails if any NFR threshold exceeded

**AC-8: Accessibility Testing**

**Given** the E2E test suite with accessibility checks
**When** tests run any journey
**Then** keyboard-only navigation works for entire flow:
- Tab navigates between focusable elements
- Enter/Space activates buttons
- Escape closes modals
- Arrow keys navigate lists

**And** axe-core accessibility audit passes with no critical violations
**And** WCAG AA color contrast verified on key elements

**AC-9: Test Reliability (No Flakiness)**

**Given** the E2E test suite runs 10 times consecutively
**When** on the same machine with same seed data
**Then** all 10 runs produce identical pass/fail results
**And** no intermittent failures from timing issues
**And** tests use explicit waits (not arbitrary sleeps)
**And** API calls are mocked for determinism

**AC-10: CI Integration**

**Given** the E2E tests are configured
**When** a PR is opened or push to main occurs
**Then** GitHub Actions runs E2E tests on:
- macOS-latest (WebKit)
- windows-latest (Edge WebView2)

**And** test results appear in PR checks
**And** failure blocks merge
**And** test artifacts (screenshots, videos) uploaded on failure

## Tasks/Subtasks

- [ ] Task 1: Configure Playwright with Tauri WebDriver (AC-1)
  - [ ] Subtask 1.1: Install dependencies: `npm install -D @playwright/test @tauri-apps/webdriver`
  - [ ] Subtask 1.2: Create `playwright.config.ts` with Tauri-specific settings
  - [ ] Subtask 1.3: Create `tests/e2e/` directory structure
  - [ ] Subtask 1.4: Configure WebDriver connection to Tauri app
  - [ ] Subtask 1.5: Create `tests/e2e/fixtures/` for test data (seed proposals, job content)
  - [ ] Subtask 1.6: Create `tests/e2e/helpers/` for reusable page object models
  - [ ] Subtask 1.7: Add `npm run test:e2e` script to package.json
  - [ ] Subtask 1.8: Verify basic app launch and element interaction works

- [ ] Task 2: Create Page Object Models (AC-2 through AC-5)
  - [ ] Subtask 2.1: Create `tests/e2e/pages/OnboardingPage.ts`
  - [ ] Subtask 2.2: Create `tests/e2e/pages/MainEditorPage.ts`
  - [ ] Subtask 2.3: Create `tests/e2e/pages/HistoryPage.ts`
  - [ ] Subtask 2.4: Create `tests/e2e/pages/SettingsPage.ts`
  - [ ] Subtask 2.5: Create `tests/e2e/pages/VoiceCalibrationPage.ts`
  - [ ] Subtask 2.6: Create `tests/e2e/pages/SafetyWarningModal.ts`
  - [ ] Subtask 2.7: Create `tests/e2e/pages/PassphraseDialog.ts`

- [ ] Task 3: Implement Journey 1 - First-Time User (AC-2)
  - [ ] Subtask 3.1: Create `tests/e2e/journeys/first-time-user.spec.ts`
  - [ ] Subtask 3.2: Test: app opens to onboarding when no database exists
  - [ ] Subtask 3.3: Test: API key entry and validation
  - [ ] Subtask 3.4: Test: Quick Calibration 5-question flow
  - [ ] Subtask 3.5: Test: job paste and analysis display
  - [ ] Subtask 3.6: Test: proposal generation with streaming
  - [ ] Subtask 3.7: Test: copy to clipboard and confirmation
  - [ ] Subtask 3.8: Verify database state after journey

- [ ] Task 4: Implement Journey 2 - Returning User (AC-3)
  - [ ] Subtask 4.1: Create `tests/e2e/journeys/returning-user.spec.ts`
  - [ ] Subtask 4.2: Create seed database with passphrase, API key, 3 proposals
  - [ ] Subtask 4.3: Test: passphrase entry and unlock
  - [ ] Subtask 4.4: Test: history view displays 3 proposals
  - [ ] Subtask 4.5: Test: proposal generation flow
  - [ ] Subtask 4.6: Test: TipTap editor editing
  - [ ] Subtask 4.7: Test: copy edited content
  - [ ] Subtask 4.8: Verify proposal count increased to 4

- [ ] Task 5: Implement Journey 3 - Golden Set Calibration (AC-4)
  - [ ] Subtask 5.1: Create `tests/e2e/journeys/golden-set-calibration.spec.ts`
  - [ ] Subtask 5.2: Create fixture files: 3 sample proposals (TXT format)
  - [ ] Subtask 5.3: Test: navigation to Voice Learning settings
  - [ ] Subtask 5.4: Test: file upload via input element
  - [ ] Subtask 5.5: Test: voice analysis completion
  - [ ] Subtask 5.6: Test: voice profile metrics display
  - [ ] Subtask 5.7: Test: proposal generation uses voice profile
  - [ ] Subtask 5.8: Verify voice profile in database

- [ ] Task 6: Implement Journey 4 - Safety Override (AC-5)
  - [ ] Subtask 6.1: Create `tests/e2e/journeys/safety-override.spec.ts`
  - [ ] Subtask 6.2: Create fixture: job content that triggers high AI detection
  - [ ] Subtask 6.3: Mock Claude API to return high-perplexity proposal
  - [ ] Subtask 6.4: Test: safety warning modal displays
  - [ ] Subtask 6.5: Test: override button and confirmation flow
  - [ ] Subtask 6.6: Test: proposal copies despite warning
  - [ ] Subtask 6.7: Verify safety_overrides table record

- [ ] Task 7: Add Performance Assertions (AC-7)
  - [ ] Subtask 7.1: Create `tests/e2e/helpers/performanceUtils.ts`
  - [ ] Subtask 7.2: Measure app startup time (launch to first paint)
  - [ ] Subtask 7.3: Measure generation time (click to first token)
  - [ ] Subtask 7.4: Measure full generation time
  - [ ] Subtask 7.5: Measure clipboard copy time
  - [ ] Subtask 7.6: Add assertions against NFR thresholds
  - [ ] Subtask 7.7: Log performance metrics to test output

- [ ] Task 8: Add Accessibility Testing (AC-8)
  - [ ] Subtask 8.1: Install `@axe-core/playwright` for accessibility audits
  - [ ] Subtask 8.2: Create `tests/e2e/accessibility/` directory
  - [ ] Subtask 8.3: Test: full keyboard navigation through Journey 1
  - [ ] Subtask 8.4: Test: Tab order is logical
  - [ ] Subtask 8.5: Test: Enter/Space activates buttons
  - [ ] Subtask 8.6: Test: Escape closes modals
  - [ ] Subtask 8.7: Run axe-core audit on each major view
  - [ ] Subtask 8.8: Assert no critical/serious violations

- [ ] Task 9: Configure CI Pipeline (AC-10)
  - [ ] Subtask 9.1: Create `.github/workflows/e2e.yml`
  - [ ] Subtask 9.2: Configure matrix: macOS-latest, windows-latest
  - [ ] Subtask 9.3: Install Tauri build dependencies per platform
  - [ ] Subtask 9.4: Build app before running E2E tests
  - [ ] Subtask 9.5: Run `npm run test:e2e` on each platform
  - [ ] Subtask 9.6: Upload screenshots/videos on failure
  - [ ] Subtask 9.7: Configure required status checks for PRs

- [ ] Task 10: Ensure Determinism and Reliability (AC-9)
  - [ ] Subtask 10.1: Replace all `page.waitForTimeout()` with explicit conditions
  - [ ] Subtask 10.2: Mock Claude API responses for consistent test data
  - [ ] Subtask 10.3: Use fixed seed for any random elements
  - [ ] Subtask 10.4: Create `tests/e2e/helpers/apiMocks.ts` for API mocking
  - [ ] Subtask 10.5: Run full suite 10x locally to verify no flakiness
  - [ ] Subtask 10.6: Document retry strategy for network-dependent tests

## Dev Notes

### Architecture Requirements

**NFR-1: Cold Start <2 seconds**
- E2E tests measure from app launch to first meaningful paint
- Fail test if startup exceeds threshold

**NFR-4: <100ms UI Response**
- Copy to clipboard action measured and asserted

**NFR-5: <1.5s First Token**
- Time from "Generate" click to first streaming token visible

**NFR-6: <8s Full Generation**
- Time from "Generate" click to "Complete" indicator

**Cross-Platform Testing Requirement (Architecture):**
- Every UI story tested on macOS and Windows
- WebView divergence (WebKit vs Edge WebView2) is high-likelihood risk
- CI matrix enforces both platforms pass before merge

### Playwright + Tauri Configuration

```typescript
// playwright.config.ts

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run journeys sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Tauri app
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  timeout: 120_000, // 2 minute timeout per test

  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'tauri',
      use: {
        // Tauri WebDriver connection
        baseURL: 'tauri://localhost',
      },
    },
  ],
});
```

### Tauri WebDriver Setup

```typescript
// tests/e2e/helpers/tauriDriver.ts

import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';

let tauriApp: ChildProcess | null = null;

export async function launchTauriApp(): Promise<void> {
  const appPath = resolve(__dirname, '../../../src-tauri/target/release/upwork-research-agent');

  tauriApp = spawn(appPath, [], {
    env: {
      ...process.env,
      TAURI_WEBDRIVER: 'true', // Enable WebDriver protocol
    },
  });

  // Wait for app to be ready
  await waitForAppReady();
}

export async function closeTauriApp(): Promise<void> {
  if (tauriApp) {
    tauriApp.kill();
    tauriApp = null;
  }
}

async function waitForAppReady(): Promise<void> {
  // Poll WebDriver endpoint until responsive
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:4444/status');
      if (response.ok) return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Tauri app failed to start within 30 seconds');
}
```

### Page Object Model Example

```typescript
// tests/e2e/pages/MainEditorPage.ts

import { Page, Locator, expect } from '@playwright/test';

export class MainEditorPage {
  readonly page: Page;
  readonly jobInput: Locator;
  readonly generateButton: Locator;
  readonly proposalEditor: Locator;
  readonly copyButton: Locator;
  readonly loadingIndicator: Locator;
  readonly streamingText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.jobInput = page.getByTestId('job-input');
    this.generateButton = page.getByTestId('generate-button');
    this.proposalEditor = page.getByTestId('proposal-editor');
    this.copyButton = page.getByTestId('copy-button');
    this.loadingIndicator = page.getByTestId('loading-indicator');
    this.streamingText = page.locator('.ProseMirror');
  }

  async pasteJobContent(content: string): Promise<void> {
    await this.jobInput.fill(content);
    await expect(this.jobInput).toHaveValue(content);
  }

  async generateProposal(): Promise<void> {
    await this.generateButton.click();
    await expect(this.loadingIndicator).toBeVisible();
  }

  async waitForGenerationComplete(): Promise<void> {
    await expect(this.loadingIndicator).toBeHidden({ timeout: 10_000 });
    await expect(this.proposalEditor).toContainText(/.{100,}/); // At least 100 chars
  }

  async copyToClipboard(): Promise<void> {
    await this.copyButton.click();
    await expect(this.page.getByText('Copied!')).toBeVisible();
  }

  async getProposalText(): Promise<string> {
    return this.streamingText.textContent() ?? '';
  }
}
```

### Journey Test Example

```typescript
// tests/e2e/journeys/first-time-user.spec.ts

import { test, expect } from '@playwright/test';
import { OnboardingPage } from '../pages/OnboardingPage';
import { MainEditorPage } from '../pages/MainEditorPage';
import { VoiceCalibrationPage } from '../pages/VoiceCalibrationPage';
import { launchTauriApp, closeTauriApp } from '../helpers/tauriDriver';
import { clearDatabase } from '../helpers/dbUtils';
import { mockClaudeAPI } from '../helpers/apiMocks';

test.describe('Journey 1: First-Time User', () => {
  test.beforeAll(async () => {
    await clearDatabase(); // Ensure fresh state
    await mockClaudeAPI(); // Deterministic responses
    await launchTauriApp();
  });

  test.afterAll(async () => {
    await closeTauriApp();
  });

  test('completes full first-time user flow', async ({ page }) => {
    const startTime = Date.now();

    // Step 1: Onboarding
    const onboarding = new OnboardingPage(page);
    await expect(onboarding.welcomeHeading).toBeVisible();

    const startupTime = Date.now() - startTime;
    expect(startupTime).toBeLessThan(2000); // NFR-1: <2s startup

    // Step 2: API Key
    await onboarding.enterApiKey(process.env.TEST_API_KEY!);
    await onboarding.submitApiKey();
    await expect(onboarding.apiKeySuccess).toBeVisible();

    // Step 3: Quick Calibration
    const calibration = new VoiceCalibrationPage(page);
    await calibration.answerQuestion(1, 'Professional and concise');
    await calibration.answerQuestion(2, 'Bullet points');
    await calibration.answerQuestion(3, 'Technical jargon');
    await calibration.answerQuestion(4, 'Data-driven');
    await calibration.answerQuestion(5, 'Under 300 words');
    await calibration.completeCalibration();
    await expect(calibration.successMessage).toBeVisible();

    // Step 4: Generate Proposal
    const editor = new MainEditorPage(page);
    await editor.pasteJobContent(SAMPLE_JOB_CONTENT);

    const generateStart = Date.now();
    await editor.generateProposal();

    // NFR-5: First token <1.5s
    await expect(editor.streamingText).toContainText(/.+/, { timeout: 1500 });

    // NFR-6: Full generation <8s
    await editor.waitForGenerationComplete();
    const generateTime = Date.now() - generateStart;
    expect(generateTime).toBeLessThan(8000);

    // Step 5: Copy
    const copyStart = Date.now();
    await editor.copyToClipboard();
    const copyTime = Date.now() - copyStart;
    expect(copyTime).toBeLessThan(100); // NFR-4: <100ms

    // Verify database state
    // (Implementation depends on how we expose DB state for testing)
  });
});

const SAMPLE_JOB_CONTENT = `
Looking for an experienced React developer to build a dashboard application.

Requirements:
- 3+ years React experience
- TypeScript proficiency
- Experience with data visualization (charts, graphs)
- REST API integration

Budget: $50-75/hr
Duration: 2-3 months
`;
```

### API Mocking for Determinism

```typescript
// tests/e2e/helpers/apiMocks.ts

import { Page } from '@playwright/test';

export async function mockClaudeAPI(page: Page): Promise<void> {
  await page.route('**/v1/messages', async (route) => {
    const request = route.request();
    const body = JSON.parse(request.postData() ?? '{}');

    // Deterministic response based on input
    const mockResponse = generateMockResponse(body.messages);

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: createStreamingResponse(mockResponse),
    });
  });
}

function generateMockResponse(messages: unknown[]): string {
  return `Thank you for considering me for this React dashboard project.

With over 5 years of React and TypeScript experience, I've built multiple data visualization dashboards using Chart.js and D3. My recent project for a fintech client involved real-time data streaming and complex charting requirements similar to your needs.

I'm available to start immediately and can commit 30+ hours per week to this project. Would you be open to a brief call to discuss the technical requirements in more detail?`;
}

function createStreamingResponse(text: string): string {
  const chunks = text.match(/.{1,50}/g) ?? [];
  return chunks
    .map((chunk, i) => `data: ${JSON.stringify({ type: 'content_block_delta', delta: { text: chunk } })}\n\n`)
    .join('') + 'data: [DONE]\n\n';
}
```

### Accessibility Testing

```typescript
// tests/e2e/accessibility/keyboard-navigation.spec.ts

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility: Keyboard Navigation', () => {
  test('can complete Journey 1 with keyboard only', async ({ page }) => {
    // Tab to API key input
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('api-key-input')).toBeFocused();

    // Type API key
    await page.keyboard.type(process.env.TEST_API_KEY!);

    // Tab to submit and press Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Continue through flow with Tab and Enter...
  });

  test('has no critical accessibility violations', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    )).toHaveLength(0);
  });

  test('Escape closes modals', async ({ page }) => {
    // Open a modal
    await page.getByTestId('settings-button').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-modal')).toBeHidden();
  });
});
```

### CI Workflow

```yaml
# .github/workflows/e2e.yml

name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, windows-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Rust
        uses: dtolnay/rust-action@stable

      - name: Install Tauri dependencies (macOS)
        if: matrix.os == 'macos-latest'
        run: |
          brew install pkg-config

      - name: Install Tauri dependencies (Windows)
        if: matrix.os == 'windows-latest'
        run: |
          # Windows dependencies handled by Tauri

      - name: Install dependencies
        run: npm ci

      - name: Build Tauri app
        run: npm run tauri build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          TEST_API_KEY: ${{ secrets.TEST_API_KEY }}

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-artifacts-${{ matrix.os }}
          path: |
            tests/e2e/results/
            tests/e2e/screenshots/
            tests/e2e/videos/
          retention-days: 7
```

### File Structure

```
tests/
  e2e/
    fixtures/
      sample-job-content.txt          # Job post for testing
      sample-proposals/               # Golden Set test files
        proposal-1.txt
        proposal-2.txt
        proposal-3.txt
      high-ai-detection-job.txt       # Triggers safety warning
    helpers/
      tauriDriver.ts                  # Launch/close Tauri app
      dbUtils.ts                      # Clear/seed database
      apiMocks.ts                     # Mock Claude API
      performanceUtils.ts             # Timing utilities
    pages/
      OnboardingPage.ts               # Page object model
      MainEditorPage.ts
      HistoryPage.ts
      SettingsPage.ts
      VoiceCalibrationPage.ts
      SafetyWarningModal.ts
      PassphraseDialog.ts
    journeys/
      first-time-user.spec.ts         # Journey 1
      returning-user.spec.ts          # Journey 2
      golden-set-calibration.spec.ts  # Journey 3
      safety-override.spec.ts         # Journey 4
    accessibility/
      keyboard-navigation.spec.ts     # Keyboard-only tests
      axe-audit.spec.ts               # axe-core violations
    global-setup.ts                   # Playwright global setup
    global-teardown.ts                # Cleanup after all tests
playwright.config.ts                  # Playwright configuration
.github/
  workflows/
    e2e.yml                           # CI pipeline
```

### Test Data Management

```typescript
// tests/e2e/helpers/dbUtils.ts

import { resolve } from 'path';
import { existsSync, unlinkSync, copyFileSync } from 'fs';

const TEST_DB_PATH = resolve(__dirname, '../../../test-data/test.db');
const SEED_DB_PATH = resolve(__dirname, '../fixtures/seed.db');

export function clearDatabase(): void {
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
}

export function seedDatabase(scenario: 'returning-user' | 'with-api-key'): void {
  clearDatabase();
  const seedFile = resolve(__dirname, `../fixtures/seed-${scenario}.db`);
  copyFileSync(seedFile, TEST_DB_PATH);
}

export async function verifyDatabaseState(expected: {
  proposalCount?: number;
  hasVoiceProfile?: boolean;
  hasApiKey?: boolean;
}): Promise<void> {
  // Query database via Tauri command or direct SQLite access
  // Assert expected state
}
```

### Dependencies

**Depends On:**
- **All MVP stories** (0.x - 6.x) - E2E tests exercise complete app functionality
- **Story 1.15: Onboarding Flow** - Journey 1 tests onboarding
- **Story 5.7: Quick Calibration** - Journey 1 tests calibration
- **Story 5.3: Golden Set Upload** - Journey 3 tests file upload
- **Story 3.6: Override Safety Warning** - Journey 4 tests override flow

**Depended On By:**
- **Release readiness** - E2E tests must pass before shipping

**NPM Dependencies:**
```json
{
  "devDependencies": {
    "@playwright/test": "^1.42.0",
    "@tauri-apps/webdriver": "^2.0.0",
    "@axe-core/playwright": "^4.8.0"
  }
}
```

### Potential Gotchas

1. **Tauri WebDriver availability** — Ensure `TAURI_WEBDRIVER=true` env var is set
2. **WebView differences** — Some CSS/JS may behave differently on WebKit vs Edge WebView2
3. **File upload on Windows** — Path separators differ; use `path.resolve()` consistently
4. **CI timing** — CI runners are slower; use generous timeouts (2-3x local)
5. **Clipboard access** — Clipboard assertions may need platform-specific handling
6. **Database file locking** — Ensure app fully closes before clearing database
7. **API key in CI** — Store as GitHub secret, never commit to code
8. **Playwright browser install** — CI needs `npx playwright install --with-deps`

### Testing Strategy Notes

**Why Playwright over other options:**
- First-class WebDriver protocol support
- Excellent TypeScript support
- Built-in video/screenshot capture
- axe-core integration for accessibility
- Active maintenance and community

**Why mock Claude API:**
- Deterministic responses enable reliable assertions
- No API costs during test runs
- Faster test execution
- Tests work offline

**Why Page Object Model:**
- Reusable selectors across tests
- Easier maintenance when UI changes
- Clear separation of concerns
- Readable test code

### Effort Estimate

**Round 6 Shark Tank Assessment:** 24-32 hours total

| Task | Hours |
|------|-------|
| Infrastructure setup (Task 1) | 4-6 |
| Page object models (Task 2) | 3-4 |
| Journey 1-4 implementation (Tasks 3-6) | 8-12 |
| Performance assertions (Task 7) | 2-3 |
| Accessibility testing (Task 8) | 3-4 |
| CI configuration (Task 9) | 2-3 |
| Reliability/debugging (Task 10) | 2-4 |

### References

- [Source: epics-stories.md#Story 8.9: Comprehensive E2E Test Suite]
- [Source: architecture.md#Cross-Platform Testing Requirement]
- [Source: architecture.md#WebView divergence risk]
- [Source: prd.md#NFR-1: Cold start <2s]
- [Source: prd.md#NFR-4: <100ms UI response]
- [Source: prd.md#NFR-5: <1.5s first token]
- [Source: prd.md#NFR-6: <8s full generation]
- [Playwright documentation: https://playwright.dev/]
- [Tauri E2E testing: https://tauri.app/v2/guides/testing/]
- [axe-core: https://github.com/dequelabs/axe-core]
