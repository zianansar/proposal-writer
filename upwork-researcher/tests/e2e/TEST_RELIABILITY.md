# E2E Test Reliability Guide

This document describes strategies to ensure deterministic, flake-free E2E tests.

## AC-9: Test Reliability Requirements

**Goal:** 10 consecutive runs produce identical pass/fail results

- No intermittent failures from timing issues
- Tests use explicit waits (not arbitrary sleeps)
- API calls mocked for determinism

## Running Tests 10x Locally (Subtask 10.5)

### Automated 10x Test Run

**Bash/Linux/macOS:**

```bash
cd upwork-researcher

# Run tests 10 times and log results
for i in {1..10}; do
  echo "=== Run $i/10 ===" | tee -a test-reliability.log
  npm run test:e2e 2>&1 | tee -a test-reliability.log
  echo "Exit code: $?" >> test-reliability.log
  echo "" >> test-reliability.log
done

# Check for inconsistent results
echo "Analyzing results..."
grep -c "passed" test-reliability.log
grep -c "failed" test-reliability.log
```

**PowerShell/Windows:**

```powershell
cd upwork-researcher

# Run tests 10 times and log results
for ($i = 1; $i -le 10; $i++) {
  Write-Host "=== Run $i/10 ===" | Tee-Object -Append test-reliability.log
  npm run test:e2e 2>&1 | Tee-Object -Append test-reliability.log
  Write-Host "Exit code: $LASTEXITCODE" | Add-Content test-reliability.log
  Add-Content test-reliability.log ""
}

# Check for inconsistent results
Write-Host "Analyzing results..."
(Select-String -Path test-reliability.log -Pattern "passed").Count
(Select-String -Path test-reliability.log -Pattern "failed").Count
```

### Single-Script Reliability Test

Create `scripts/test-reliability.sh`:

```bash
#!/bin/bash
set -e

RUNS=10
PASSED=0
FAILED=0

echo "Running E2E tests $RUNS times to verify determinism..."

for i in $(seq 1 $RUNS); do
  echo ""
  echo "=========================================="
  echo "Run $i/$RUNS"
  echo "=========================================="

  if npm run test:e2e; then
    PASSED=$((PASSED + 1))
    echo "✓ Run $i PASSED"
  else
    FAILED=$((FAILED + 1))
    echo "✗ Run $i FAILED"
  fi
done

echo ""
echo "=========================================="
echo "RELIABILITY TEST RESULTS"
echo "=========================================="
echo "Total runs:  $RUNS"
echo "Passed:      $PASSED"
echo "Failed:      $FAILED"
echo "Success rate: $(echo "scale=1; $PASSED * 100 / $RUNS" | bc)%"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo "⚠️  FLAKINESS DETECTED: Tests failed $FAILED out of $RUNS runs"
  echo "Review logs above to identify timing issues or race conditions"
  exit 1
else
  echo ""
  echo "✅ ALL TESTS PASSED - No flakiness detected"
  exit 0
fi
```

Make executable: `chmod +x scripts/test-reliability.sh`

Run: `./scripts/test-reliability.sh`

## Determinism Strategies

### 1. API Mocking (AC-9)

**Implementation:** `tests/e2e/helpers/apiMocks.ts`

All Claude API calls are mocked with deterministic responses:

```typescript
import { mockClaudeAPI } from "../helpers/apiMocks";

test.beforeAll(async () => {
  await mockClaudeAPI(page, "standard"); // Deterministic proposal text
});
```

**Mock scenarios:**

- `standard` - Normal proposal generation
- `high-perplexity` - Triggers safety warning (>150)
- `streaming` - Realistic streaming behavior
- `error` - API error response

**Benefits:**

- ✅ Consistent test data across runs
- ✅ No API costs during testing
- ✅ Faster test execution (no network calls)
- ✅ Tests work offline

### 2. Explicit Waits (No Arbitrary Sleeps)

**❌ Bad (Flaky):**

```typescript
await page.waitForTimeout(1000); // Arbitrary wait
```

**✅ Good (Deterministic):**

```typescript
await expect(element).toBeVisible({ timeout: 5000 }); // Explicit condition
await page.waitForSelector('[data-testid="loaded"]', { state: "visible" });
await page.waitForLoadState("networkidle");
```

**Replaced instances:**

- `HistoryPage.getProposalCount()` - Now waits for visible list or empty state
- `HistoryPage.searchProposals()` - Now waits for networkidle

### 3. Fixed Test Data

**Database seeding:**

```typescript
import { clearDatabase, seedDatabase } from "../helpers/dbUtils";

test.beforeEach(async () => {
  clearDatabase(); // Start from known state
  seedDatabase("returning-user"); // Load fixture data
});
```

**Fixture data locations:**

- `tests/e2e/fixtures/sample-job-content.txt`
- `tests/e2e/fixtures/sample-proposals/proposal-1.txt`
- `tests/e2e/fixtures/high-ai-detection-job.txt`

**No random elements:**

- Tests use fixed timestamps (not `Date.now()` for data generation)
- No UUID generation in test data
- Proposal content is deterministic

### 4. Idempotent Tests

Each test:

- Starts from clean database state
- Doesn't depend on previous test outcomes
- Can run in any order
- Can run in isolation

**Playwright config:**

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: false, // Sequential execution for Tauri
  workers: 1, // Single worker
  retries: process.env.CI ? 2 : 0, // Retries only in CI
});
```

## Retry Strategy (Subtask 10.6)

### Local Development

**No retries by default** - If a test fails locally, it should be fixed, not retried.

```typescript
// playwright.config.ts
retries: 0, // Local: no retries
```

### CI Environment

**Limited retries for transient failures:**

```typescript
// playwright.config.ts
retries: process.env.CI ? 2 : 0, // CI: 2 retries
```

**Retry triggers:**

- Network timeouts (rare with mocked APIs)
- Platform-specific WebView issues
- Resource contention on CI runners

**Not eligible for retry:**

- Assertion failures (test logic errors)
- Element not found (UI regression)
- Incorrect test data

### Network-Dependent Tests

**Current approach:** Mock all external APIs

If real network calls needed:

```typescript
test("network-dependent test", async ({ page }) => {
  // Retry-specific network calls
  await page.route("**/external-api/**", async (route) => {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(route.request());
        await route.fulfill({ response });
        return;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  });
});
```

**However:** Our E2E tests mock all Claude API calls, so network retries are not needed.

## Diagnosing Flaky Tests

### Step 1: Reproduce Locally

Run test 10x:

```bash
./scripts/test-reliability.sh
```

### Step 2: Check for Timing Issues

Enable trace on failure:

```typescript
// playwright.config.ts
use: {
  trace: 'on-first-retry',
  video: 'retain-on-failure',
  screenshot: 'only-on-failure',
}
```

View trace:

```bash
npx playwright show-trace trace.zip
```

### Step 3: Review Logs

Check for:

- `waitForTimeout()` calls (should be explicit waits)
- Race conditions (element appears/disappears quickly)
- State leaks (previous test data affects current test)

### Step 4: Isolate Test

Run single test:

```bash
npm run test:e2e -- --grep "test name"
```

Run with debug:

```bash
PWDEBUG=1 npm run test:e2e -- --grep "test name"
```

### Step 5: Fix Root Cause

Common fixes:

- Replace `waitForTimeout()` with explicit conditions
- Add `test.beforeEach()` cleanup
- Use `toBeVisible()` instead of `toExist()`
- Increase timeout for slow CI: `{ timeout: 10000 }`

## Performance Timing Assertions

Performance tests use `Date.now()` for timing:

```typescript
const startTime = Date.now();
await editor.generateProposal();
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(8000); // NFR-6: <8s
```

**Why this is deterministic:**

- Measures actual elapsed time (not random)
- Assertions have reasonable thresholds
- Slower CI runners still pass (thresholds are upper bounds)

## CI-Specific Configuration

**GitHub Actions** (`.github/workflows/e2e.yml`):

- Runs on `macos-latest` and `windows-latest`
- Installs Playwright browsers: `npx playwright install --with-deps chromium`
- Sets `CI=true` environment variable (enables retries)
- Uploads artifacts on failure (screenshots, videos, traces)
- Timeout: 30 minutes per test run

## Success Criteria

✅ **Passing reliability test:**

- 10 consecutive runs
- All runs produce same result (all pass or all fail consistently)
- No intermittent failures
- Total runtime variance <10%

❌ **Failing reliability test:**

- Any run produces different result than others
- Timeout on one run but pass on another
- Race condition detected

## Monitoring Test Reliability

**Track metrics:**

- Pass rate over last 100 CI runs
- Flakiness percentage (inconsistent pass/fail)
- Average test duration (should be stable)

**Alert thresholds:**

- Flakiness >2% → Investigate timing issues
- Duration increase >20% → Check for performance regression
- Failure rate >5% → Likely real bug, not flakiness

## References

- [Playwright Best Practices: Test Isolation](https://playwright.dev/docs/best-practices#test-isolation)
- [Playwright Best Practices: Avoid Arbitrary Waits](https://playwright.dev/docs/best-practices#avoid-arbitrary-waits)
- [Playwright Retries](https://playwright.dev/docs/test-retries)
