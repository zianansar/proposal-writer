---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 8
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 8.10: Performance Validation Tests

## Story

As a developer,
I want automated tests for performance targets,
So that we don't regress on NFRs.

## Acceptance Criteria

**AC-1: Startup Time Benchmark (NFR-1)**

**Given** the performance test suite runs
**When** measuring app startup time
**Then** time from process spawn to "Ready to Paste" state is measured
**And** startup completes in <2 seconds (cold start)
**And** test fails immediately if threshold exceeded
**And** timing is logged: `[PERF] Startup: 1.23s ✓`

**AC-2: Memory Usage Benchmark (NFR-2)**

**Given** the performance test suite runs
**When** measuring memory usage
**Then** RAM usage is captured at:
- App idle (just started)
- After loading 100 proposals
- After generating 5 proposals
- After scrolling through history

**And** peak RAM stays <300MB
**And** idle RAM stays <200MB
**And** memory growth per proposal is <5MB
**And** test fails if any threshold exceeded

**AC-3: UI Response Time Benchmark (NFR-4)**

**Given** the performance test suite runs
**When** measuring UI response times
**Then** the following interactions are timed:
- Button click to visual feedback: <100ms
- Navigation between views: <100ms
- Modal open/close: <100ms
- Settings toggle: <100ms

**And** all UI responses complete in <100ms
**And** test fails if any interaction exceeds threshold

**AC-4: Streaming Start Benchmark (NFR-5)**

**Given** the performance test suite runs with mocked Claude API
**When** measuring time to first streaming token
**Then** time from "Generate" click to first visible character is measured
**And** first token appears in <1.5 seconds
**And** test uses realistic mock that simulates API latency
**And** test fails if threshold exceeded

**AC-5: Full Generation Benchmark (NFR-6)**

**Given** the performance test suite runs with mocked Claude API
**When** measuring full generation time
**Then** time from "Generate" click to "Complete" indicator is measured
**And** full generation completes in <8 seconds
**And** mock simulates realistic streaming rate (50 tokens/second)
**And** test fails if threshold exceeded

**AC-6: Database Query Benchmark (NFR-17)**

**Given** the performance test suite runs with seeded database
**When** measuring query performance
**Then** the following queries are timed with 100+ records:
- Proposal history list: <500ms
- Job queue sort by score: <500ms
- Voice profile load: <100ms
- Settings load: <50ms

**And** all queries complete within thresholds
**And** test seeds database with 500 proposals before measuring
**And** test fails if any query exceeds threshold

**AC-7: CI Integration**

**Given** the performance test suite is configured
**When** a PR is opened or push to main occurs
**Then** performance tests run on CI (macOS and Windows)
**And** results appear in PR checks as pass/fail
**And** detailed timing report uploaded as artifact
**And** failure blocks merge
**And** historical trends visible (optional: GitHub Actions summary)

**AC-8: Regression Detection**

**Given** the performance test suite tracks historical results
**When** a new commit introduces a performance regression
**Then** test fails with clear message: "Regression detected: Startup 2.3s (was 1.8s, threshold 2.0s)"
**And** baseline values are stored in repository
**And** baseline can be updated intentionally with documented justification

## Tasks/Subtasks

- [ ] Task 1: Create performance test infrastructure (AC-1 through AC-6)
  - [ ] Subtask 1.1: Create `tests/performance/` directory structure
  - [ ] Subtask 1.2: Create `tests/performance/config.ts` with NFR thresholds
  - [ ] Subtask 1.3: Create `tests/performance/helpers/timing.ts` for measurement utilities
  - [ ] Subtask 1.4: Create `tests/performance/helpers/memory.ts` for RAM measurement
  - [ ] Subtask 1.5: Create `tests/performance/helpers/dbSeeder.ts` for test data
  - [ ] Subtask 1.6: Add `npm run test:perf` script to package.json

- [ ] Task 2: Implement startup time benchmark (AC-1)
  - [ ] Subtask 2.1: Create `tests/performance/startup.bench.ts`
  - [ ] Subtask 2.2: Measure time from Tauri app spawn to WebView ready
  - [ ] Subtask 2.3: Verify "Ready to Paste" element is visible
  - [ ] Subtask 2.4: Assert <2s threshold
  - [ ] Subtask 2.5: Run 5 iterations, use median for reliability

- [ ] Task 3: Implement memory usage benchmark (AC-2)
  - [ ] Subtask 3.1: Create `tests/performance/memory.bench.ts`
  - [ ] Subtask 3.2: Use process memory APIs to measure RSS
  - [ ] Subtask 3.3: Measure at idle, after load, after operations
  - [ ] Subtask 3.4: Assert <300MB peak, <200MB idle
  - [ ] Subtask 3.5: Detect memory leaks by comparing before/after

- [ ] Task 4: Implement UI response benchmark (AC-3)
  - [ ] Subtask 4.1: Create `tests/performance/ui-response.bench.ts`
  - [ ] Subtask 4.2: Measure button click to visual feedback
  - [ ] Subtask 4.3: Measure navigation transitions
  - [ ] Subtask 4.4: Measure modal animations
  - [ ] Subtask 4.5: Assert all <100ms

- [ ] Task 5: Implement generation benchmarks (AC-4, AC-5)
  - [ ] Subtask 5.1: Create `tests/performance/generation.bench.ts`
  - [ ] Subtask 5.2: Mock Claude API with realistic latency simulation
  - [ ] Subtask 5.3: Measure time to first token (<1.5s)
  - [ ] Subtask 5.4: Measure full generation time (<8s)
  - [ ] Subtask 5.5: Use consistent mock response for determinism

- [ ] Task 6: Implement database query benchmark (AC-6)
  - [ ] Subtask 6.1: Create `tests/performance/database.bench.ts`
  - [ ] Subtask 6.2: Create seeder that populates 500 proposals
  - [ ] Subtask 6.3: Measure proposal history query
  - [ ] Subtask 6.4: Measure job queue sort query
  - [ ] Subtask 6.5: Measure voice profile load
  - [ ] Subtask 6.6: Assert all within thresholds

- [ ] Task 7: Configure CI pipeline (AC-7)
  - [ ] Subtask 7.1: Add performance tests to `.github/workflows/ci.yml`
  - [ ] Subtask 7.2: Configure matrix for macOS and Windows
  - [ ] Subtask 7.3: Generate timing report as JSON artifact
  - [ ] Subtask 7.4: Add PR comment with performance summary
  - [ ] Subtask 7.5: Configure required status check

- [ ] Task 8: Implement regression detection (AC-8)
  - [ ] Subtask 8.1: Create `tests/performance/baseline.json` for expected values
  - [ ] Subtask 8.2: Compare current run against baseline
  - [ ] Subtask 8.3: Fail with clear regression message if exceeded
  - [ ] Subtask 8.4: Add script to update baseline: `npm run test:perf:update-baseline`
  - [ ] Subtask 8.5: Document baseline update process in CONVENTIONS.md

## Dev Notes

### Architecture Requirements

**NFR-1: Startup Time <2 seconds**
- "Ready to Paste" means job input is visible and interactive
- Cold start (no cache) is the measurement target
- Measured from process spawn, not from user click (OS adds ~100-200ms)

**NFR-2: RAM <300MB**
- Peak usage during normal operation
- Idle should be <200MB (realistic working set)
- Memory shouldn't grow unbounded with usage

**NFR-4: UI Response <100ms**
- Perceived responsiveness threshold
- Includes render time, not just event handling
- Matches standard UX research on perceived latency

**NFR-5: Streaming Start <1.5s**
- Time from click to first visible character
- Includes: IPC to Rust, API call, first token, render
- Streaming UX makes 8s generation feel fast

**NFR-6: Full Generation <8s**
- Complete proposal ready for review
- With realistic ~300 word proposal
- Dependent on Claude API (mock for determinism)

**NFR-17: Query Performance <500ms**
- Database queries even with 100+ records
- Enables responsive History and Job Queue views
- Depends on proper indexes

### Performance Test Configuration

```typescript
// tests/performance/config.ts

export const NFR_THRESHOLDS = {
  // NFR-1: Startup
  STARTUP_COLD_MS: 2000,

  // NFR-2: Memory
  MEMORY_PEAK_MB: 300,
  MEMORY_IDLE_MB: 200,
  MEMORY_PER_PROPOSAL_MB: 5,

  // NFR-4: UI Response
  UI_RESPONSE_MS: 100,

  // NFR-5: First Token
  FIRST_TOKEN_MS: 1500,

  // NFR-6: Full Generation
  FULL_GENERATION_MS: 8000,

  // NFR-17: Database Queries
  QUERY_PROPOSAL_HISTORY_MS: 500,
  QUERY_JOB_QUEUE_MS: 500,
  QUERY_VOICE_PROFILE_MS: 100,
  QUERY_SETTINGS_MS: 50,
} as const;

export const BENCHMARK_CONFIG = {
  // Number of iterations for statistical reliability
  ITERATIONS: 5,

  // Use median instead of mean (more robust to outliers)
  USE_MEDIAN: true,

  // Seed data for database benchmarks
  SEED_PROPOSAL_COUNT: 500,
  SEED_JOB_COUNT: 100,

  // Tolerance for regression detection (10% above baseline)
  REGRESSION_TOLERANCE: 0.10,
} as const;
```

### Timing Utilities

```typescript
// tests/performance/helpers/timing.ts

export interface TimingResult {
  name: string;
  durationMs: number;
  threshold: number;
  passed: boolean;
  iterations: number[];
}

export async function measureTiming(
  name: string,
  fn: () => Promise<void>,
  threshold: number,
  iterations: number = 5
): Promise<TimingResult> {
  const timings: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings.push(end - start);
  }

  // Use median for robustness
  const sorted = [...timings].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const passed = median <= threshold;

  console.log(
    `[PERF] ${name}: ${median.toFixed(1)}ms ${passed ? '✓' : '✗'} (threshold: ${threshold}ms)`
  );

  return {
    name,
    durationMs: median,
    threshold,
    passed,
    iterations: timings,
  };
}

export function assertTiming(result: TimingResult): void {
  if (!result.passed) {
    throw new Error(
      `Performance threshold exceeded: ${result.name} took ${result.durationMs.toFixed(1)}ms (threshold: ${result.threshold}ms)`
    );
  }
}
```

### Memory Measurement Utilities

```typescript
// tests/performance/helpers/memory.ts

import { invoke } from '@tauri-apps/api/core';

export interface MemorySnapshot {
  rssBytes: number;
  heapUsedBytes: number;
  timestamp: number;
}

export async function getMemoryUsage(): Promise<MemorySnapshot> {
  // Get Rust-side memory via Tauri command
  const rustMemory = await invoke<{ rss_bytes: number }>('get_memory_usage');

  // Get JS heap usage
  const jsMemory = (performance as any).memory?.usedJSHeapSize ?? 0;

  return {
    rssBytes: rustMemory.rss_bytes,
    heapUsedBytes: jsMemory,
    timestamp: Date.now(),
  };
}

export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

export async function measureMemoryDelta(
  fn: () => Promise<void>
): Promise<{ before: MemorySnapshot; after: MemorySnapshot; deltaMB: number }> {
  // Force GC if available
  if (typeof gc === 'function') gc();

  const before = await getMemoryUsage();
  await fn();

  // Allow cleanup
  await new Promise(r => setTimeout(r, 100));
  if (typeof gc === 'function') gc();

  const after = await getMemoryUsage();

  return {
    before,
    after,
    deltaMB: bytesToMB(after.rssBytes - before.rssBytes),
  };
}
```

### Startup Benchmark

```typescript
// tests/performance/startup.bench.ts

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { NFR_THRESHOLDS, BENCHMARK_CONFIG } from './config';
import { measureTiming, assertTiming } from './helpers/timing';

describe('NFR-1: Startup Time', () => {
  it('cold starts in <2 seconds', async () => {
    const appPath = resolve(__dirname, '../../src-tauri/target/release/upwork-research-agent');

    const result = await measureTiming(
      'Cold Startup',
      async () => {
        return new Promise<void>((resolve, reject) => {
          const start = performance.now();

          const app = spawn(appPath, [], {
            env: { ...process.env, PERF_TEST: 'true' },
          });

          // Wait for "ready" signal from app
          app.stdout.on('data', (data) => {
            if (data.toString().includes('READY_TO_PASTE')) {
              const elapsed = performance.now() - start;
              app.kill();
              resolve();
            }
          });

          // Timeout after threshold + buffer
          setTimeout(() => {
            app.kill();
            reject(new Error('Startup timeout'));
          }, NFR_THRESHOLDS.STARTUP_COLD_MS + 1000);
        });
      },
      NFR_THRESHOLDS.STARTUP_COLD_MS,
      BENCHMARK_CONFIG.ITERATIONS
    );

    assertTiming(result);
  });
});
```

### Memory Benchmark

```typescript
// tests/performance/memory.bench.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { NFR_THRESHOLDS, BENCHMARK_CONFIG } from './config';
import { getMemoryUsage, bytesToMB, measureMemoryDelta } from './helpers/memory';
import { seedDatabase, clearDatabase } from './helpers/dbSeeder';

describe('NFR-2: Memory Usage', () => {
  beforeAll(async () => {
    await clearDatabase();
  });

  it('stays under 200MB at idle', async () => {
    const snapshot = await getMemoryUsage();
    const memoryMB = bytesToMB(snapshot.rssBytes);

    console.log(`[PERF] Idle Memory: ${memoryMB.toFixed(1)}MB`);

    expect(memoryMB).toBeLessThan(NFR_THRESHOLDS.MEMORY_IDLE_MB);
  });

  it('stays under 300MB after loading 500 proposals', async () => {
    await seedDatabase({ proposals: BENCHMARK_CONFIG.SEED_PROPOSAL_COUNT });

    // Navigate to history to trigger load
    await loadProposalHistory();

    const snapshot = await getMemoryUsage();
    const memoryMB = bytesToMB(snapshot.rssBytes);

    console.log(`[PERF] Memory after 500 proposals: ${memoryMB.toFixed(1)}MB`);

    expect(memoryMB).toBeLessThan(NFR_THRESHOLDS.MEMORY_PEAK_MB);
  });

  it('does not leak memory during scrolling', async () => {
    const { before, after, deltaMB } = await measureMemoryDelta(async () => {
      // Scroll through entire list multiple times
      for (let i = 0; i < 5; i++) {
        await scrollToBottom();
        await scrollToTop();
      }
    });

    console.log(`[PERF] Memory delta after scrolling: ${deltaMB.toFixed(2)}MB`);

    // Should not grow significantly (allow 10MB tolerance for transient allocations)
    expect(deltaMB).toBeLessThan(10);
  });
});
```

### Database Query Benchmark

```typescript
// tests/performance/database.bench.ts

import { describe, it, beforeAll } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { NFR_THRESHOLDS, BENCHMARK_CONFIG } from './config';
import { measureTiming, assertTiming } from './helpers/timing';
import { seedDatabase } from './helpers/dbSeeder';

describe('NFR-17: Database Query Performance', () => {
  beforeAll(async () => {
    // Seed database with test data
    await seedDatabase({
      proposals: BENCHMARK_CONFIG.SEED_PROPOSAL_COUNT,
      jobs: BENCHMARK_CONFIG.SEED_JOB_COUNT,
    });
  });

  it('loads proposal history in <500ms', async () => {
    const result = await measureTiming(
      'Proposal History Query',
      async () => {
        await invoke('get_proposal_history', { limit: 50, offset: 0 });
      },
      NFR_THRESHOLDS.QUERY_PROPOSAL_HISTORY_MS
    );

    assertTiming(result);
  });

  it('loads job queue sorted by score in <500ms', async () => {
    const result = await measureTiming(
      'Job Queue Query (sorted)',
      async () => {
        await invoke('get_job_queue', {
          sortBy: 'Score',
          filter: 'All',
          limit: 50,
          offset: 0,
        });
      },
      NFR_THRESHOLDS.QUERY_JOB_QUEUE_MS
    );

    assertTiming(result);
  });

  it('loads voice profile in <100ms', async () => {
    const result = await measureTiming(
      'Voice Profile Query',
      async () => {
        await invoke('get_voice_profile');
      },
      NFR_THRESHOLDS.QUERY_VOICE_PROFILE_MS
    );

    assertTiming(result);
  });

  it('loads settings in <50ms', async () => {
    const result = await measureTiming(
      'Settings Query',
      async () => {
        await invoke('get_settings');
      },
      NFR_THRESHOLDS.QUERY_SETTINGS_MS
    );

    assertTiming(result);
  });
});
```

### Generation Benchmark

```typescript
// tests/performance/generation.bench.ts

import { describe, it, beforeAll } from 'vitest';
import { NFR_THRESHOLDS } from './config';
import { measureTiming, assertTiming } from './helpers/timing';
import { mockClaudeAPIWithLatency } from './helpers/apiMocks';

describe('NFR-5 & NFR-6: Generation Performance', () => {
  beforeAll(async () => {
    // Mock API with realistic latency simulation
    await mockClaudeAPIWithLatency({
      firstTokenDelayMs: 800,  // Realistic API latency
      tokensPerSecond: 50,     // Realistic streaming rate
      totalTokens: 300,        // ~300 word proposal
    });
  });

  it('shows first token in <1.5s (NFR-5)', async () => {
    const result = await measureTiming(
      'First Token Latency',
      async () => {
        await clickGenerateAndWaitForFirstToken();
      },
      NFR_THRESHOLDS.FIRST_TOKEN_MS
    );

    assertTiming(result);
  });

  it('completes generation in <8s (NFR-6)', async () => {
    const result = await measureTiming(
      'Full Generation Time',
      async () => {
        await clickGenerateAndWaitForComplete();
      },
      NFR_THRESHOLDS.FULL_GENERATION_MS
    );

    assertTiming(result);
  });
});
```

### Rust Memory Command

```rust
// src-tauri/src/commands/system.rs

use sysinfo::{ProcessExt, System, SystemExt};

#[tauri::command]
#[specta::specta]
pub fn get_memory_usage() -> Result<MemoryUsage, String> {
    let mut sys = System::new();
    sys.refresh_processes();

    let pid = std::process::id();
    let process = sys.process(sysinfo::Pid::from_u32(pid))
        .ok_or("Could not find current process")?;

    Ok(MemoryUsage {
        rss_bytes: process.memory() as i64,
        virtual_bytes: process.virtual_memory() as i64,
    })
}

#[derive(Debug, serde::Serialize, specta::Type)]
pub struct MemoryUsage {
    pub rss_bytes: i64,
    pub virtual_bytes: i64,
}
```

### CI Workflow Integration

```yaml
# .github/workflows/ci.yml (add to existing)

  performance:
    name: Performance Tests
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Rust
        uses: dtolnay/rust-action@stable

      - name: Install dependencies
        run: npm ci

      - name: Build Tauri app (release)
        run: npm run tauri build

      - name: Run performance tests
        run: npm run test:perf
        env:
          PERF_TEST: 'true'

      - name: Generate performance report
        run: npm run test:perf:report

      - name: Upload performance report
        uses: actions/upload-artifact@v4
        with:
          name: perf-report-${{ matrix.os }}
          path: tests/performance/report.json

      - name: Comment on PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('tests/performance/report.json'));

            const summary = report.results.map(r =>
              `| ${r.name} | ${r.durationMs.toFixed(1)}ms | ${r.threshold}ms | ${r.passed ? '✅' : '❌'} |`
            ).join('\n');

            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `## Performance Test Results\n\n| Test | Result | Threshold | Status |\n|------|--------|-----------|--------|\n${summary}`
            });
```

### Baseline Management

```typescript
// tests/performance/baseline.ts

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { BENCHMARK_CONFIG } from './config';

const BASELINE_PATH = resolve(__dirname, 'baseline.json');

interface Baseline {
  version: string;
  updatedAt: string;
  results: Record<string, number>;
}

export function loadBaseline(): Baseline {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
  } catch {
    return {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      results: {},
    };
  }
}

export function checkRegression(name: string, current: number): void {
  const baseline = loadBaseline();
  const expected = baseline.results[name];

  if (expected === undefined) {
    console.log(`[PERF] No baseline for ${name}, skipping regression check`);
    return;
  }

  const tolerance = expected * BENCHMARK_CONFIG.REGRESSION_TOLERANCE;
  const threshold = expected + tolerance;

  if (current > threshold) {
    throw new Error(
      `Regression detected: ${name} took ${current.toFixed(1)}ms ` +
      `(was ${expected.toFixed(1)}ms, threshold ${threshold.toFixed(1)}ms with ${BENCHMARK_CONFIG.REGRESSION_TOLERANCE * 100}% tolerance)`
    );
  }
}

export function updateBaseline(results: Record<string, number>): void {
  const baseline: Baseline = {
    version: process.env.npm_package_version ?? '0.0.0',
    updatedAt: new Date().toISOString(),
    results,
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`[PERF] Baseline updated at ${baseline.updatedAt}`);
}
```

### File Structure

```
tests/
  performance/
    config.ts                    # NFR thresholds and benchmark config
    baseline.json                # Historical baseline values
    helpers/
      timing.ts                  # Timing measurement utilities
      memory.ts                  # Memory measurement utilities
      dbSeeder.ts                # Database seeding for benchmarks
      apiMocks.ts                # Claude API mocking with latency
    startup.bench.ts             # NFR-1: Startup time
    memory.bench.ts              # NFR-2: Memory usage
    ui-response.bench.ts         # NFR-4: UI response time
    generation.bench.ts          # NFR-5, NFR-6: Generation times
    database.bench.ts            # NFR-17: Query performance
    baseline.ts                  # Baseline comparison utilities
    report.ts                    # Report generation
src-tauri/
  src/commands/
    system.rs                    # Memory usage Tauri command
```

### Dependencies

**Depends On:**
- **Story 8.9: E2E Test Suite** - Shares test infrastructure and helpers
- **All MVP stories** - Features must exist to benchmark
- **sysinfo Rust crate** - For memory measurement

**NPM Dependencies:**
```json
{
  "devDependencies": {
    "@playwright/test": "^1.42.0"
  }
}
```

**Cargo Dependencies:**
```toml
[dependencies]
sysinfo = "0.30"
```

### Relationship to Story 8.9

Story 8.9 (E2E Tests) and Story 8.10 (Performance Tests) are complementary:

| Aspect | 8.9 E2E Tests | 8.10 Performance Tests |
|--------|---------------|------------------------|
| **Focus** | Functional correctness | Performance regression |
| **NFR Coverage** | Inline assertions in journeys | Dedicated benchmarks |
| **Measurement** | Pass/fail per journey | Detailed timing data |
| **Baseline** | No baseline tracking | Baseline comparison |
| **Report** | Test results | Performance trends |
| **CI Trigger** | Every PR | Every PR |

**Shared Infrastructure:**
- Both use Playwright for app interaction
- Both mock Claude API for determinism
- Both run on macOS and Windows CI
- Database seeders can be shared

### Potential Gotchas

1. **CI Machine Variability** — CI runners have inconsistent performance; use tolerances and multiple runs
2. **Memory Measurement Accuracy** — RSS varies by platform; use relative comparisons
3. **GC Timing** — JavaScript GC can skew memory measurements; force GC before snapshots
4. **Mock Latency** — Ensure mocks simulate realistic network latency for meaningful benchmarks
5. **Cold vs Warm Start** — Always measure cold start; clear any caches between runs
6. **Release Build** — Always benchmark release builds, not dev builds
7. **Background Processes** — CI machines may have background load; use median of multiple runs

### Testing Requirements

This story IS the testing requirements. Success criteria:

1. All NFR thresholds documented in `config.ts`
2. Each NFR has dedicated benchmark test
3. Tests run in CI on every PR
4. Regressions detected and block merge
5. Baseline can be updated intentionally
6. Performance report generated and attached to PR

### References

- [Source: epics-stories.md#Story 8.10: Performance Validation Tests]
- [Source: prd.md#Section 6: Non-Functional Requirements]
- [Source: prd.md#NFR-1: Startup <2s]
- [Source: prd.md#NFR-2: RAM <300MB]
- [Source: prd.md#NFR-4: UI Response <100ms]
- [Source: prd.md#NFR-5: First Token <1.5s]
- [Source: prd.md#NFR-6: Full Generation <8s]
- [Source: prd.md#NFR-17: Query <500ms]
- [Source: architecture.md#Performance monitoring in CI]
- [Story 8.9: E2E Test Suite — shared infrastructure]
