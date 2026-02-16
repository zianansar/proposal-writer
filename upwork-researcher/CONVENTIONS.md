# Development Conventions

> **Scope:** This document covers release management and performance test baseline management.
> For general project conventions, see the project README.
> See also: [tests/performance/README.md](tests/performance/README.md) for the performance testing overview.

## Release Management

### Marking Releases as Critical

Critical releases (e.g., AI detection evasion patches, security fixes) trigger mandatory, non-dismissible updates for all users. The app will block all functionality until the update is installed.

#### When to Mark a Release as Critical

Use critical releases for:

1. **AI detection evasion patches** - Updates to humanization algorithms that prevent proposal flagging
2. **Security vulnerabilities** - Fixes for data leaks, encryption bypasses, or privilege escalation
3. **Data corruption fixes** - Bugs that could cause database corruption or data loss
4. **Critical API changes** - Breaking changes in Claude API that would cause app failure

**Do not use for:**
- Feature additions
- UI improvements
- Performance optimizations
- Minor bug fixes

#### How to Mark a Release as Critical

**Option 1: Tag Name (Recommended)**

Add `[CRITICAL]` to the version tag when creating the release:

```bash
git tag v1.0.1-CRITICAL
git push origin v1.0.1-CRITICAL
```

**Option 2: Changelog Body**

Add `critical: true` anywhere in the changelog/release notes:

```markdown
## [1.0.1] - 2026-02-16

critical: true

### Security
- Fix AI detection bypass for GPT-4 output patterns
- Update forbidden words list (35 words, 15 phrases)
```

#### What Happens for Critical Releases

1. **CI Workflow Detection** - `.github/workflows/release.yml` detects the critical marker
2. **latest.json Injection** - The `critical: true` boolean is added to the update manifest
3. **Mandatory Update UI** - App displays non-dismissible modal on launch (Story 9.8)
4. **App Blocking** - Users cannot generate proposals or navigate until update is installed
5. **Automatic Restart** - After download completes, app restarts automatically

#### Testing Critical Release Flow

**Dry Run (without publishing):**

```bash
# Create draft release with critical flag
gh release create v0.1.2-CRITICAL --draft --notes "critical: true\n\nTest critical update flow"

# Verify latest.json includes critical field
curl https://api.github.com/repos/YOUR_ORG/upwork-researcher/releases/latest | jq '.assets[] | select(.name=="latest.json")'

# Delete draft after testing
gh release delete v0.1.2-CRITICAL
```

**Validation Checklist:**

- [ ] `latest.json` includes `"critical": true` field
- [ ] Release notes explain why update is mandatory
- [ ] All platform builds succeeded (macOS ARM64, Intel, Windows x64)
- [ ] Code signatures valid (macOS notarized, Windows signed)

#### latest.json Schema with Critical Flag

```json
{
  "version": "1.0.1",
  "notes": "CRITICAL: Fixes AI detection bypass. All users must update immediately.",
  "pub_date": "2026-02-16T12:00:00Z",
  "critical": true,
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../upwork-researcher-1.0.1-setup.exe"
    },
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://github.com/.../upwork-researcher-1.0.1-aarch64.dmg"
    }
  }
}
```

See Story 9.8 for implementation details.

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
