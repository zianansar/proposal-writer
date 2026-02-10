// Updates performance baseline from recent test run
// Run with: npm run test:perf:update-baseline

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const RESULTS_PATH = path.resolve(__dirname, '../../test-results/perf-results.json');
const BASELINE_PATH = path.resolve(__dirname, 'baseline.json');

async function updateBaseline() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error('[PERF] No test results found. Run npm run test:perf first.');
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));

  // Extract timing results from vitest results
  // Parse test names and extract timing data
  const timings = {};

  if (results.testResults && Array.isArray(results.testResults)) {
    results.testResults.forEach(testFile => {
      if (testFile.assertionResults && Array.isArray(testFile.assertionResults)) {
        testFile.assertionResults.forEach(test => {
          // Extract test name and duration
          if (test.title && test.duration !== undefined) {
            // Store median timing for each benchmark
            timings[test.title] = test.duration;
          }
        });
      }
    });
  }

  // If no timing data extracted, try alternate format
  if (Object.keys(timings).length === 0) {
    console.warn('[PERF] Warning: Could not extract timing data from test results.');
    console.warn('[PERF] Results format may have changed. Please verify test output structure.');
  }

  console.log('[PERF] Current baseline will be replaced with new values:');
  console.log(JSON.stringify(timings, null, 2));
  console.log(`\n[PERF] Found ${Object.keys(timings).length} benchmark results`);

  // Prompt for confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('\nUpdate baseline? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
      const baseline = {
        version: process.env.npm_package_version || '0.0.0',
        updatedAt: new Date().toISOString(),
        results: timings,
      };

      fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
      console.log('[PERF] Baseline updated successfully');
    } else {
      console.log('[PERF] Baseline update cancelled');
    }
    rl.close();
  });
}

updateBaseline().catch(error => {
  console.error('[PERF] Baseline update failed:', error);
  process.exit(1);
});
