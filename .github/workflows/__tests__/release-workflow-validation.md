# Release Workflow Validation Guide

Story: 9.2 — CI/CD Release Build Pipeline
Workflow: `.github/workflows/release.yml`

## Manual Trigger Test

1. Go to **Actions** tab in GitHub repository
2. Select **Release Build** workflow
3. Click **Run workflow** (workflow_dispatch trigger)
4. Monitor all 3 matrix jobs: macOS ARM64, macOS Intel, Windows x64

## Tag Trigger Test

```bash
# Create and push a test tag
git tag v0.0.1-test
git push origin v0.0.1-test

# Monitor the workflow at:
# https://github.com/<owner>/<repo>/actions/workflows/release.yml

# Clean up test tag after validation
git tag -d v0.0.1-test
git push origin :refs/tags/v0.0.1-test
```

## Validation Checklist

### AC-1: Tag-triggered workflow
- [ ] Push a `v*` tag and verify the workflow triggers automatically
- [ ] Verify all 3 matrix jobs start (macOS ARM64, macOS Intel, Windows x64)
- [ ] Verify `workflow_dispatch` manual trigger also works

### AC-2: macOS artifacts
- [ ] Verify `.dmg` artifact is uploaded to the draft release (ARM64)
- [ ] Verify `.dmg` artifact is uploaded to the draft release (Intel/x86_64)
- [ ] Verify artifact naming includes version and platform

### AC-3: Windows artifacts
- [ ] Verify `.msi` installer artifact is uploaded to the draft release
- [ ] Verify `.exe` (NSIS) installer artifact is uploaded
- [ ] Verify artifact naming includes version and platform
- [ ] Verify OpenSSL/vcpkg step completes without errors

### AC-4: Dependency caching
- [ ] Run workflow twice in succession
- [ ] Compare build times — second run should be >30% faster
- [ ] Verify Rust cache hit messages in log (`Swatinem/rust-cache`)
- [ ] Verify npm cache hit messages in log (`actions/setup-node`)

### AC-5: Draft release creation
- [ ] Verify GitHub Release is created as **draft** (not published)
- [ ] Verify all installer artifacts are attached to the release
- [ ] Verify `release-status` job outputs the release URL in step summary
- [ ] Verify `latest.json` updater file is uploaded (`uploadUpdaterJson: true`)

### AC-6: Quality gates
- [ ] Verify `npm run lint` step runs before the build
- [ ] Verify `cargo fmt --check` step runs before the build
- [ ] Verify `cargo clippy -- -D warnings` step runs before the build
- [ ] Test: introduce a lint error and verify the build aborts

## Expected Build Artifacts

| Platform | Artifacts |
|----------|-----------|
| macOS ARM64 | `.dmg`, `.app.tar.gz`, `.app.tar.gz.sig` |
| macOS Intel | `.dmg`, `.app.tar.gz`, `.app.tar.gz.sig` |
| Windows x64 | `.msi`, `.nsis.zip`, `.nsis.zip.sig` |

## Known Considerations

- **Signing keys required:** `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets must be configured in the repository. Without them, the tauri-action will fail at the signing step.
- **Code signing not configured yet:** macOS notarization (Story 9-4) and Windows code signing (Story 9-5) are separate stories. Release builds will be unsigned until those are complete.
- **Windows `signCommand`:** `tauri.conf.json` has `bundle.windows.signCommand` pointing to `scripts/windows-sign.ps1`. This script exists but is part of Story 9-5. If it fails, the Windows build may error on signing — this is expected until 9-5 is complete.
- **Lint script:** Currently `eslint .` (configured by Story 9-1).

## Troubleshooting

### Windows build fails on OpenSSL
The vcpkg step installs OpenSSL at `C:\vcpkg\installed\x64-windows-static-md`. If this path changes on newer runner images, update the `OPENSSL_DIR` environment variable in the workflow.

### macOS cross-compilation fails
Both `aarch64-apple-darwin` and `x86_64-apple-darwin` Rust targets are installed on macOS matrix entries. If cross-compilation fails, verify the `dtolnay/rust-toolchain` targets parameter is being applied.

### Draft release not created
Ensure `permissions: contents: write` is set and `GITHUB_TOKEN` is passed. The tauri-action needs write access to create releases.
