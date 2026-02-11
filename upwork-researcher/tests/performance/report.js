// Performance test report generator
// Reads vitest results and generates human-readable report

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULTS_PATH = path.resolve(__dirname, '../../test-results/perf-results.json');
const REPORT_PATH = path.resolve(__dirname, '../../test-results/perf-report.json');

async function generateReport() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error('[PERF] No test results found at:', RESULTS_PATH);
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.numTotalTests,
      passed: results.numPassedTests,
      failed: results.numFailedTests,
      duration: results.duration,
    },
    results: results.testResults?.map(test => ({
      name: test.name,
      status: test.status,
      duration: test.duration,
    })) || [],
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('[PERF] Report generated:', REPORT_PATH);
  console.log(JSON.stringify(report.summary, null, 2));
}

generateReport().catch(error => {
  console.error('[PERF] Report generation failed:', error);
  process.exit(1);
});
