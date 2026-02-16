# Required Status Checks Configuration

This document describes the required status checks that must pass before merging PRs.

## GitHub Branch Protection Setup

To enforce E2E tests before merging, configure branch protection rules in GitHub:

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Add rule for `main` branch
3. Enable the following settings:

### Required Status Checks

- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

#### Select the following status checks:

- `e2e (macos-latest)` - E2E tests on macOS
- `e2e (windows-latest)` - E2E tests on Windows

### Additional Recommended Settings

- ✅ **Require a pull request before merging**
  - Required approvals: 1
- ✅ **Require conversation resolution before merging**
- ✅ **Do not allow bypassing the above settings**

## Workflow Configuration

The E2E test workflow (`.github/workflows/e2e.yml`) runs automatically on:

- **Push** to `main` branch
- **Pull request** targeting `main` branch

### Matrix Strategy

Tests run in parallel on:

- macOS-latest (WebKit WebView)
- windows-latest (Edge WebView2)

### Failure Handling

If tests fail:

- PR merge is blocked
- Artifacts uploaded:
  - Test results (playwright-report/)
  - Screenshots (tests/e2e/screenshots/)
  - Videos (tests/e2e/videos/)
  - Trace files (trace.zip)
- Retention: 7 days

### Environment Secrets Required

Configure these secrets in **Settings** → **Secrets and variables** → **Actions**:

- `TEST_API_KEY` - Test API key for Claude API (mock mode recommended for CI)
- `TAURI_PRIVATE_KEY` - Tauri updater private key (optional)
- `TAURI_KEY_PASSWORD` - Tauri key password (optional)

## Local Testing Before PR

Run E2E tests locally before creating PR:

```bash
cd upwork-researcher
npm run test:e2e
```

### Platform-Specific Testing

**macOS:**

```bash
npm run tauri build
npm run test:e2e
```

**Windows:**

```powershell
npm run tauri build
npm run test:e2e
```

## Troubleshooting Failed Checks

If E2E tests fail in CI:

1. Download test artifacts from failed workflow run
2. Review screenshots/videos to identify failure point
3. Check trace files in Playwright Trace Viewer
4. Run tests locally to reproduce
5. Fix issues and push updated code

## Bypassing Checks (Emergency Only)

If absolutely necessary to bypass checks:

1. Admin must temporarily disable branch protection
2. Merge with clear justification in PR comment
3. Re-enable branch protection immediately
4. Create follow-up issue to fix failing tests

**Note:** This should be extremely rare and well-documented.
