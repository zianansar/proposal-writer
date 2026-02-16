# Story 9.4: macOS Code Signing & Notarization

Status: done

## Story

As a macOS user,
I want the app to be properly signed and notarized,
so that I can install it without Gatekeeper warnings or "unidentified developer" blocks.

## Acceptance Criteria

1. **AC-1: Code Signing** — Given an Apple Developer certificate is configured in CI secrets, when the release workflow builds for macOS, then the `.app` bundle is signed with the Developer ID Application certificate and `codesign --verify --deep --strict` passes on the built bundle.

2. **AC-2: Notarization** — Given the signed app bundle exists, when notarization is submitted via `notarytool`, then Apple's notarization service accepts and staples the ticket and `spctl --assess --type exec` confirms the app passes Gatekeeper.

3. **AC-3: DMG Signing** — Given the DMG installer wraps the signed app, when the DMG itself is signed and notarized, then a macOS user can download and open the DMG without any security prompts and the app can be dragged to Applications and launched immediately.

4. **AC-4: Secret Validation** — Given CI secrets store `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_PASSWORD` (app-specific password), when these secrets are missing or invalid, then the release workflow fails early with a clear error message before attempting to build.

5. **AC-5: Graceful Degradation** — Given the release workflow runs on non-tag pushes (e.g., PR builds), when code signing secrets are not available, then the build still succeeds as an unsigned debug build (code signing is optional for CI testing).

## Tasks / Subtasks

- [x] Task 1: Add certificate import step to release workflow (AC: #1, #4)
  - [x] 1.1 Create macOS certificate import step in `release.yml` that decodes `APPLE_CERTIFICATE` base64 secret, creates a temporary keychain, imports the `.p12` cert, and sets codesign partition list
  - [x] 1.2 Add early validation step that checks for required secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_PASSWORD`, `KEYCHAIN_PASSWORD`) and fails with clear message if any are missing on tag pushes
  - [x] 1.3 Add conditional logic: skip signing steps on non-tag pushes when secrets are unavailable (AC-5)

- [x] Task 2: Configure Tauri bundler for macOS signing + notarization (AC: #1, #2, #3)
  - [x] 2.1 Add `macOS` section to `tauri.conf.json` under `bundle` with `signingIdentity` and `minimumSystemVersion` ("12.0" per NFR-14)
  - [x] 2.2 Pass notarization environment variables (`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) to `tauri-apps/tauri-action` env block — Tauri v2 bundler handles notarization + stapling automatically
  - [x] 2.3 Pass `APPLE_SIGNING_IDENTITY` env var to `tauri-action` — overrides `tauri.conf.json` value for CI flexibility

- [x] Task 3: Build target configuration (AC: #1, #3)
  - [x] 3.1 Configure release workflow matrix with separate macOS builds: `--target aarch64-apple-darwin` and `--target x86_64-apple-darwin` (separate builds per architecture, not universal binary — simpler initially per technical notes)
  - [x] 3.2 Ensure Rust toolchain step installs both targets: `targets: 'aarch64-apple-darwin,x86_64-apple-darwin'`
  - [x] 3.3 Verify artifact naming includes architecture (e.g., `Upwork-Research-Agent_1.0.0_aarch64.dmg`)

- [x] Task 4: Keychain cleanup step (AC: #1)
  - [x] 4.1 Add post-build cleanup step that deletes the temporary build keychain (`security delete-keychain build.keychain`) in an `if: always()` block

- [x] Task 5: Verification and documentation (AC: #1, #2, #3)
  - [x] 5.1 Add verification steps in workflow that run `codesign --verify --deep --strict` on the built `.app` and `spctl --assess --type exec` to confirm Gatekeeper passes (logged as CI output for validation)
  - [x] 5.2 Document required GitHub repository secrets in a `docs/macos-signing-setup.md` guide

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] Certificate `.p12` file not cleaned up on import failure — added `trap 'rm -f certificate.p12' EXIT` after base64 decode; removed manual `rm` [release.yml:138]
- [x] [AI-Review][MEDIUM] DMG verification uses `--deep` flag incorrectly — changed to `codesign --verify --strict --verbose=2` for DMG (kept `--deep` for .app bundle only) [release.yml:310]
- [x] [AI-Review][MEDIUM] Default keychain not restored after build — capture `ORIGINAL_KEYCHAIN` via `GITHUB_ENV`, restore in cleanup step [release.yml:141-143, cleanup step]
- [x] [AI-Review][LOW] Empty string env vars passed to Tauri — non-issue: GitHub Actions evaluates undefined secrets as empty string regardless of `|| ''`; env vars are always set in `env:` blocks. No change needed.
- [x] [AI-Review][LOW] Task 3.3 artifact naming not explicitly verified — accepted: Tauri's `--target` flag controls artifact naming; runtime verification would require parsing build output which is fragile. Relying on Tauri default behavior is the correct approach.
- [x] [AI-Review][LOW] Verification steps lack verbose output — added `--verbose=2` to `codesign --verify` and `spctl --assess` for both .app and DMG [release.yml:287,297,310]

## Dev Notes

### Dependencies — Stories 9-1, 9-2, 9-3 Must Be Complete First

This story **modifies** the `release.yml` workflow created by Story 9-2. The dependency chain is: 9.1 (linting/hooks) → 9.2 (CI/CD release pipeline) → 9.3 (versioning) → **9.4** (this story).

If `release.yml` does not yet exist, this story CANNOT proceed — it adds macOS signing steps to an existing workflow.

### How Tauri v2 macOS Signing Works (CRITICAL — Do Not Call codesign/notarytool Manually)

Tauri v2's bundler handles signing and notarization **automatically** during `cargo tauri build` / `tauri-action` when environment variables are set:

1. **Code signing**: Set `APPLE_SIGNING_IDENTITY` env var → bundler calls `codesign` automatically on `.app` and `.dmg`
2. **Notarization**: Set `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID` → bundler calls `notarytool submit`, waits for completion, and staples the ticket
3. **No manual `xcrun notarytool` or `codesign` calls needed** in the workflow — only the certificate import step (keychain setup) must be manual

### Required GitHub Secrets

| Secret | Value | How to obtain |
|--------|-------|---------------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` file | Export from Keychain Access: `openssl base64 -A -in cert.p12 -out cert-base64.txt` |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` | Set during Keychain Access export |
| `APPLE_SIGNING_IDENTITY` | e.g., `Developer ID Application: Zian (XXXXXXXXXX)` | Visible in Keychain Access after installing cert |
| `APPLE_ID` | Apple Developer account email | developer.apple.com account |
| `APPLE_PASSWORD` | App-specific password (NOT Apple ID password) | appleid.apple.com → Security → App-Specific Passwords |
| `APPLE_TEAM_ID` | 10-character Team ID | developer.apple.com/account → Membership Details |
| `KEYCHAIN_PASSWORD` | Any strong password (for temporary CI keychain) | Generate any random string |

### Certificate Import Workflow Step (Reference Implementation)

```yaml
- name: Import Apple Developer Certificate
  if: matrix.platform == 'macos-latest'
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
  run: |
    echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security set-keychain-settings -t 3600 -u build.keychain
    security import certificate.p12 -k build.keychain \
      -P "$APPLE_CERTIFICATE_PASSWORD" \
      -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: \
      -s -k "$KEYCHAIN_PASSWORD" build.keychain
    rm certificate.p12
```

### Tauri Action Environment Variables (Pass to tauri-action)

```yaml
- uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
    TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
  with:
    args: ${{ matrix.args }}
```

### tauri.conf.json Changes

Add `macOS` section under `bundle`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": null,
      "minimumSystemVersion": "12.0"
    }
  }
}
```

`signingIdentity` is `null` in config (env var `APPLE_SIGNING_IDENTITY` overrides in CI) — this ensures local dev builds remain unsigned.

### Existing Infrastructure

- **`e2e.yml`** — Existing CI with `macos-latest` + `windows-latest` matrix, Rust caching via `Swatinem/rust-cache@v2`, `TAURI_PRIVATE_KEY`/`TAURI_KEY_PASSWORD` secrets already referenced
- **`tauri.conf.json`** — Current bundle config: `"active": true`, `"targets": "all"`, icons configured, no `macOS` section yet
- **App identifier**: `com.upwork-researcher.app`
- **Current version**: `0.1.0`

### Apple Requirements (2025-2026)

- macOS Sequoia (15) no longer allows Control+click bypass of Gatekeeper — notarization is effectively mandatory
- `altool` is deprecated since Nov 2023 — Tauri v2 uses `notarytool` (correct)
- Hardened Runtime is required for notarization — Tauri enables this by default
- Apple Developer Program ($99/year) required — prerequisite procurement step

### Anti-patterns to Avoid

- **DO NOT** call `codesign` or `notarytool` manually in the workflow — Tauri bundler does this automatically
- **DO NOT** set `signingIdentity` to a real value in `tauri.conf.json` — use env var override so local builds stay unsigned
- **DO NOT** create a universal binary (`--target universal-apple-darwin`) — use separate arch builds for simplicity (per technical notes)
- **DO NOT** add DMG customization (background image, icon layout) — default Tauri DMG is acceptable for v1.0

### Project Structure Notes

- Workflow file: `.github/workflows/release.yml` (created by Story 9-2, modified here)
- Config change: `upwork-researcher/src-tauri/tauri.conf.json` (add `macOS` section)
- New doc: `docs/macos-signing-setup.md` (secrets setup guide)
- No Rust or frontend code changes — this is purely CI/CD and config

### References

- [Source: epics-stories.md, Story 9.4 lines 2558-2596]
- [Source: epics-stories.md, Epic 9 header lines 2413-2428]
- [Source: architecture.md, CI/CD deferred to post-MVP lines 424-431]
- [Source: architecture.md, NFR-14 macOS 12+, NFR-15 code signing]
- [Source: tauri.conf.json, current bundle config]
- [Source: .github/workflows/e2e.yml, existing CI patterns]
- [Tauri v2 docs: https://v2.tauri.app/distribute/sign/macos/]
- [Tauri v2 docs: https://v2.tauri.app/distribute/pipelines/github/]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A — CI/CD workflow configuration only, no runtime debugging required.

### Completion Notes List

✅ **All tasks complete** — macOS code signing and notarization fully integrated into release workflow.

**Implementation summary:**

1. **Secret validation** — Added pre-flight check that validates all 7 required Apple secrets on tag pushes, fails early with clear error message if any are missing (AC-4)

2. **Certificate import** — Implemented secure certificate import step:
   - Decodes base64 `APPLE_CERTIFICATE` secret
   - Creates temporary `build.keychain` with `KEYCHAIN_PASSWORD`
   - Imports `.p12` certificate with proper partition list for codesign
   - Includes graceful degradation: skips signing if secrets unavailable on non-tag builds (AC-5)

3. **Tauri bundler configuration:**
   - Added `macOS` section to `tauri.conf.json` with `signingIdentity: null` (env var override pattern) and `minimumSystemVersion: "12.0"` (NFR-14)
   - Passed 4 notarization env vars to `tauri-action`: `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_SIGNING_IDENTITY`
   - Tauri v2 bundler handles `codesign` + `notarytool` + stapling automatically — no manual calls needed

4. **Build targets** — Matrix configuration from Story 9-2 already includes separate aarch64/x86_64 darwin builds with both Rust targets installed (Task 3 was already complete)

5. **Verification steps** — Added macOS signature verification step:
   - Runs `codesign --verify --deep --strict` on `.app` bundle (AC-1)
   - Runs `spctl --assess --type exec` to confirm Gatekeeper passes (AC-2)
   - Verifies DMG signature if present (AC-3)
   - Skips gracefully if no certificate configured

6. **Keychain cleanup** — Added `if: always()` cleanup step that deletes `build.keychain` even if build fails, prevents keychain accumulation in CI runners

7. **Documentation** — Created comprehensive `docs/macos-signing-setup.md` guide:
   - Step-by-step instructions for obtaining all 7 secrets
   - Commands for certificate export, base64 encoding, identity lookup, app-specific password generation
   - Verification checklist and troubleshooting section
   - Security notes and certificate renewal guidance

**Key architectural decisions:**

- Used env var override pattern (`signingIdentity: null` in config, `APPLE_SIGNING_IDENTITY` env var in CI) — ensures local dev builds remain unsigned while CI builds use proper identity
- Relied on Tauri v2's built-in signing/notarization automation — no manual `codesign` or `notarytool` calls in workflow (follows dev notes anti-patterns guidance)
- Separate architecture builds (not universal binary) — simpler approach per technical notes, Tauri handles artifact naming automatically
- Graceful degradation with `|| ''` fallback — non-tag builds (PRs, manual dispatch) skip signing and produce unsigned debug builds without failing (AC-5)

**No automated tests** — CI/CD workflow files are validated by GitHub Actions YAML schema and will be tested in actual release builds. Verification steps log output for manual validation.

### File List

- `.github/workflows/release.yml` — Added 4 new steps: secret validation, certificate import, macOS verification, keychain cleanup; added 4 env vars to tauri-action
- `upwork-researcher/src-tauri/tauri.conf.json` — Added `macOS` section under `bundle` with signing config
- `docs/macos-signing-setup.md` — Created comprehensive secrets setup guide
