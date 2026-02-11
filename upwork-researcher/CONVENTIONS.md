# Development Conventions

> **Scope:** This document covers performance test baseline management conventions only.
> For general project conventions, see the project README.
> See also: [tests/performance/README.md](tests/performance/README.md) for the performance testing overview.

## Performance Testing

### Performance Baseline Management

Performance baselines track expected timing values for benchmarks to detect regressions. The baseline file (`tests/performance/baseline.json`) stores historical performance data.

#### When to Update Baselines

Update baselines when:
1. **Intentional performance improvements** - Code optimizations that legitimately improve speed
2. **Infrastructure changes** - New hardware, updated dependencies that affect timing
3. **Test refinements** - Adjusted test methodology that changes baseline expectations

**Never update baselines to "fix" failing tests** - Investigate and resolve performance regressions instead.

#### How to Update Baselines

**Step 1: Run Performance Tests**
```bash
npm run test:perf
```

This generates `test-results/perf-results.json` with timing data.

**Step 2: Review Current vs Baseline**
Check `tests/performance/baseline.json` to see current baseline values.
Compare against your recent test run results.

**Step 3: Update Baseline (with justification)**
```bash
npm run test:perf:update-baseline
```

The script will:
1. Load recent test results
2. Extract timing data
3. Show proposed baseline values
4. Prompt for confirmation (yes/no)
5. Update `baseline.json` with timestamp and version

**Step 4: Document Justification**
When committing baseline updates, include clear justification:

```bash
git add tests/performance/baseline.json
git commit -m "Update performance baseline: [reason]

- Database query optimization reduced average time by 30%
- New indexes on job_posts table (Story 4b.9)
- Baseline: Proposal History 500ms -> 350ms
- Baseline: Job Queue Sort 450ms -> 320ms

Verified on: macOS, Windows CI runners
Tests passing: 13/13"
```

#### Baseline Format

```json
{
  "version": "0.1.0",
  "updatedAt": "2026-02-10T12:00:00.000Z",
  "results": {
    "Proposal History Query": 350,
    "Job Queue Query (sorted)": 320,
    "Voice Profile Query": 50,
    "Settings Query": 25,
    "Cold Startup": 1800,
    "Memory at Idle": 180
  }
}
```

- **version**: npm package version when baseline was set
- **updatedAt**: ISO timestamp of last update
- **results**: Map of test name to median timing (milliseconds)

#### Regression Detection

Baselines use **10% tolerance** for regression detection:
- Baseline: 500ms
- Threshold: 550ms (500ms + 10%)
- Test fails if: median timing > 550ms

This allows for minor CI machine variance while catching real regressions.

#### CI Integration

Performance tests run on every PR via GitHub Actions:
- `.github/workflows/performance.yml`
- Tests run on macOS and Windows
- Results posted as PR comments
- Failing tests block merge

#### Troubleshooting

**"No test results found"**
- Run `npm run test:perf` first to generate results

**"Could not extract timing data"**
- Vitest output format may have changed
- Check `test-results/perf-results.json` structure
- Update `updateBaseline.js` extraction logic

**Baseline keeps failing on CI**
- CI machines have performance variance
- Consider if 10% tolerance is appropriate
- Check for legitimate regressions (memory leaks, N+1 queries)
- Don't update baseline without investigation

---

## Related Documentation

- [tests/performance/README.md](tests/performance/README.md) - Performance testing overview
- [tests/performance/config.ts](tests/performance/config.ts) - NFR thresholds
- Story 8.10: Performance Validation Tests
