# Windows Code Signing Setup Guide

## Overview

Windows code signing prevents SmartScreen warnings when users download and run the Upwork Research Agent installer. This guide covers:

1. **EV Certificate Requirements** — Why Extended Validation certificates are needed
2. **Cloud HSM Providers** — SSL.com, Azure, DigiCert options for CI/CD signing
3. **GitHub Secrets Configuration** — How to configure CI signing credentials
4. **Local Testing** — How to test unsigned builds during development

---

## EV Certificate Requirement (NFR-15)

**Why EV certificates:**
- Standard code signing certificates no longer work in CI/CD (USB token required since 2023)
- EV (Extended Validation) certificates require hardware security modules (HSMs)
- Cloud HSM providers enable remote signing for GitHub Actions workflows
- Prevents "Unknown publisher" SmartScreen warnings on Windows

**SmartScreen Reputation:**
- EV certificates provide immediate publisher identity in UAC prompts
- SmartScreen reputation builds over time based on download volume and user behavior
- First signed release may still show brief warning until Microsoft builds reputation history
- Azure Trusted Signing provides fastest SmartScreen reputation (Microsoft-backed)

---

## Cloud HSM Signing Options

### Option 1: SSL.com eSigner (Hash-Only Signing)

**Pros:**
- GitHub Action available: `SSLcom/esigner-codesign`
- Only sends file hashes to SSL.com (most secure)
- No private key material leaves SSL.com HSM
- Supports OV and EV code signing certificates

**Cons:**
- Requires TOTP secret for MFA (additional secret to manage)
- Less immediate SmartScreen reputation than Azure

**Required GitHub Secrets:**
```yaml
WINDOWS_CERTIFICATE: (base64-encoded PFX from SSL.com)
WINDOWS_CERTIFICATE_PASSWORD: (PFX password)
ESIGNER_USERNAME: (SSL.com account email)
ESIGNER_PASSWORD: (SSL.com account password)
ESIGNER_CREDENTIAL_ID: (from SSL.com dashboard)
ESIGNER_TOTP_SECRET: (MFA seed from SSL.com)
```

**Workflow Integration:**
```yaml
- name: Sign Windows Installer (SSL.com eSigner)
  if: startsWith(github.ref, 'refs/tags/v') && env.WINDOWS_CERTIFICATE != ''
  uses: SSLcom/esigner-codesign@v1
  with:
    command: sign
    username: ${{ secrets.ESIGNER_USERNAME }}
    password: ${{ secrets.ESIGNER_PASSWORD }}
    credential_id: ${{ secrets.ESIGNER_CREDENTIAL_ID }}
    totp_secret: ${{ secrets.ESIGNER_TOTP_SECRET }}
    file_path: ${{ github.workspace }}/upwork-researcher/src-tauri/target/release/bundle/msi/*.msi
    override: true
```

**Procurement:**
1. Purchase EV code signing certificate from SSL.com ($299-$474/year)
2. Complete identity validation (business registration, phone verification, 1-2 weeks)
3. Download PFX file and note credential ID from dashboard
4. Add secrets to GitHub repository settings

---

### Option 2: Azure Trusted Signing (Fastest Reputation)

**Pros:**
- Official Microsoft service ($9.99/month Public Trust pricing)
- **Immediate SmartScreen reputation** (Microsoft-backed certificates)
- Daily certificate renewal (24-hour validity + RFC 3161 timestamp = long-term validity)
- GitHub Action available: `Azure/trusted-signing-action@v0.4.0`
- No EV certificate procurement needed (Microsoft handles cert issuance)

**Cons:**
- Requires Azure subscription
- Monthly recurring cost vs one-time certificate purchase
- Newer service (renamed from "Azure Code Signing" in Jan 2026)

**Required GitHub Secrets:**
```yaml
AZURE_TENANT_ID: (Azure AD tenant ID)
AZURE_CLIENT_ID: (Service principal app ID)
AZURE_CLIENT_SECRET: (Service principal secret)
AZURE_ENDPOINT: (Trusted Signing endpoint URL)
AZURE_CODE_SIGNING_NAME: (Certificate profile name)
```

**Workflow Integration:**
```yaml
- name: Sign Windows Installer (Azure Trusted Signing)
  if: startsWith(github.ref, 'refs/tags/v') && env.AZURE_CLIENT_ID != ''
  uses: Azure/trusted-signing-action@v0.4.0
  with:
    azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
    azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
    endpoint: ${{ secrets.AZURE_ENDPOINT }}
    code-signing-account-name: ${{ secrets.AZURE_CODE_SIGNING_NAME }}
    certificate-profile-name: Upwork-Research-Agent
    files: |
      ${{ github.workspace }}/upwork-researcher/src-tauri/target/release/bundle/msi/*.msi
      ${{ github.workspace }}/upwork-researcher/src-tauri/target/release/bundle/nsis/*-setup.exe
    timestamp-rfc3161: http://timestamp.acs.microsoft.com
    timestamp-digest: sha256
```

**Procurement:**
1. Create Azure subscription (if not existing)
2. Enable "Azure Artifact Signing" service (formerly "Trusted Signing")
3. Create service principal with signing permissions
4. Configure certificate profile with identity validation
5. Add secrets to GitHub repository settings

**Note:** Public Trust tier ($9.99/mo) supports EV-equivalent signing. Private Trust tier ($99.99/mo) adds custom CA.

---

### Option 3: DigiCert KeyLocker (Enterprise)

**Pros:**
- FIPS 140-2 Level 3 cloud HSM
- Enterprise-grade with automated certificate renewal
- CertCentral REST API for programmatic signing
- Established reputation (DigiCert is major CA)

**Cons:**
- Higher cost (enterprise pricing, typically $500-1000/year)
- More complex setup (API client certificates, REST API integration)
- Requires custom signing script (no official GitHub Action)

**Required Configuration:**
- DigiCert CertCentral account with KeyLocker enabled
- API client certificate for authentication
- Custom signing script using DigiCert SMCTL (command-line tool)

**Not recommended unless:**
- Already using DigiCert enterprise certificates
- Need multi-platform signing (Windows + Java JARs + Office macros)
- Require audit logging and compliance features

---

## Current Implementation: PFX-Based Signing

The current `scripts/windows-sign.ps1` implementation uses base64-encoded PFX certificates:

**How it works:**
1. Tauri build invokes `windows-sign.ps1` for each installer file
2. Script checks `WINDOWS_CERTIFICATE` environment variable
3. If present: decode base64 → write password-protected PFX to temp file → import to Windows cert store → sign with signtool → cleanup temp file and cert from store
4. If absent: exit gracefully (unsigned build for development)

**Security note:** The PFX certificate is temporarily written to a temp file during step 3. The file is password-protected (not plaintext) and is deleted in a `finally` block that runs even on errors. GitHub Actions runners are ephemeral and destroyed after each job, limiting the exposure window. This follows the standard CI signing pattern used by major signing tools.

**This supports:**
- SSL.com eSigner (PFX export)
- Traditional EV certificates with PFX export capability
- Local development with self-signed certificates (testing only)

**Migration to cloud signing:**
To use Azure Trusted Signing or SSL.com eSigner GitHub Actions:
1. Modify `.github/workflows/release.yml` to call respective action instead of `tauri-action` built-in signing
2. Remove `signCommand` from `tauri.conf.json` to disable script-based signing
3. Cloud action signs artifacts after Tauri build completes

---

## GitHub Secrets Configuration

**Step-by-step setup:**

### 1. Generate Base64-Encoded PFX (SSL.com or traditional cert)

```powershell
# PowerShell on Windows
$pfxPath = "C:\path\to\your-certificate.pfx"
$bytes = [System.IO.File]::ReadAllBytes($pfxPath)
$base64 = [System.Convert]::ToBase64String($bytes)
Write-Output $base64
```

```bash
# Bash on macOS/Linux
base64 -i /path/to/your-certificate.pfx | tr -d '\n'
```

### 2. Add Secrets to GitHub Repository

Go to: **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | Required For |
|-------------|-------|--------------|
| `WINDOWS_CERTIFICATE` | Base64-encoded PFX file | All signing methods |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX password | All signing methods |
| `TAURI_WINDOWS_SIGNTOOL_PATH` | Custom signtool.exe path (optional) | Non-standard Windows SDK installs |

**For SSL.com eSigner (if using GitHub Action):**
- `ESIGNER_USERNAME`
- `ESIGNER_PASSWORD`
- `ESIGNER_CREDENTIAL_ID`
- `ESIGNER_TOTP_SECRET`

**For Azure Trusted Signing:**
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_ENDPOINT`
- `AZURE_CODE_SIGNING_NAME`

### 3. Test Secrets Configuration

Create a test workflow or add a verification step:

```yaml
- name: Verify Signing Configuration
  shell: pwsh
  run: |
    if ($env:WINDOWS_CERTIFICATE) {
      Write-Host "✓ WINDOWS_CERTIFICATE secret configured ($($env:WINDOWS_CERTIFICATE.Length) chars)"
    } else {
      Write-Host "⚠ WINDOWS_CERTIFICATE not configured - builds will be unsigned"
    }
  env:
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
```

---

## Release Workflow Integration

**When Story 9.2 creates `.github/workflows/release.yml`, add:**

### Environment Variables (Top-level or Windows Job)

```yaml
env:
  WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
  WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  TAURI_WINDOWS_SIGNTOOL_PATH: ${{ secrets.TAURI_WINDOWS_SIGNTOOL_PATH }}
```

### Conditional Signing Step (After Tauri Build)

```yaml
- name: Verify Windows Code Signatures
  if: runner.os == 'Windows'
  shell: pwsh
  env:
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE || '' }}
  run: |
    if ([string]::IsNullOrEmpty($env:WINDOWS_CERTIFICATE)) {
      Write-Host "Skipping signature verification - no signing certificate configured"
      exit 0
    }

    # Verify all MSI and EXE installers are signed
    $artifacts = Get-ChildItem -Path "upwork-researcher/src-tauri/target/release/bundle" -Recurse -Include "*.msi","*-setup.exe"

    foreach ($file in $artifacts) {
      Write-Host "Verifying: $($file.Name)"
      & signtool verify /pa /v $file.FullName

      if ($LASTEXITCODE -ne 0) {
        Write-Error "Signature verification failed for: $($file.Name)"
        exit 1
      }
    }

    Write-Host "All installers have valid signatures"
```

### Unsigned Build Fallback (PR Builds)

```yaml
- name: Build Tauri App
  uses: tauri-apps/tauri-action@v0
  with:
    releaseBody: "See the assets below to download."
    releaseDraft: true
    prerelease: false
    args: ${{ runner.os == 'Windows' && env.WINDOWS_CERTIFICATE == '' && '--no-sign' || '' }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
```

**Notes:**
- `--no-sign` flag skips signing entirely when `WINDOWS_CERTIFICATE` is not configured
- Non-tag pushes (PR builds) automatically skip signing via `if: startsWith(github.ref, 'refs/tags/v')` condition
- Tag-triggered release builds warn (but don't fail) if signing secrets are missing

---

## Local Development Testing

**Unsigned builds (default):**
```bash
# Build without signing (required for local dev — signCommand path
# resolves from workspace root which differs from local CWD)
cd upwork-researcher
npm run tauri build -- --no-sign
```

The `--no-sign` flag is **required** for local builds because `signCommand` in `tauri.conf.json` uses a relative path (`scripts/windows-sign.ps1`) that resolves from the CI workspace root. In local development, the CWD differs and the script won't be found.

The installer will work locally but show SmartScreen warnings when distributed.

**Testing with self-signed certificate (Windows only):**
```powershell
# Generate self-signed cert (for testing ONLY)
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Upwork Research Agent Test" `
  -CertStoreLocation Cert:\CurrentUser\My

# Export to PFX
$pfxPath = "test-cert.pfx"
$password = ConvertTo-SecureString -String "TestPassword123" -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password

# Set environment variables
$env:WINDOWS_CERTIFICATE = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath))
$env:WINDOWS_CERTIFICATE_PASSWORD = "TestPassword123"

# Build with signing
npm run tauri build
```

**Warning:** Self-signed certificates will NOT prevent SmartScreen warnings. Only EV certificates from trusted CAs work for production.

---

## Troubleshooting

### Issue: "signtool.exe not found"

**Solution:**
1. Install Windows SDK (includes signtool.exe): https://developer.microsoft.com/windows/downloads/windows-sdk/
2. Or set `TAURI_WINDOWS_SIGNTOOL_PATH` environment variable to custom path

### Issue: "No signing certificate configured - skipping signing"

**Expected behavior:**
- PR builds and development builds skip signing intentionally
- Only tag-triggered release builds require signing

**If signing should happen:**
- Verify `WINDOWS_CERTIFICATE` secret is set in GitHub repository settings
- Check workflow environment variables are passed correctly

### Issue: "Failed to import certificate"

**Possible causes:**
- Incorrect PFX password → Check `WINDOWS_CERTIFICATE_PASSWORD` secret
- Corrupted base64 encoding → Re-encode PFX without line breaks
- Expired certificate → Check certificate validity period

### Issue: "signtool failed with exit code: 1"

**Possible causes:**
- Timestamp server unreachable → Retry build (transient network issue)
- Certificate not trusted → Install intermediate CA certificates
- File already signed → Signing script re-signs by default, should succeed

### Issue: SmartScreen still shows warning on signed installer

**Expected for new publishers:**
- First signed release may show warning until Microsoft SmartScreen reputation builds
- Reputation increases with download volume over weeks/months
- Azure Trusted Signing provides fastest reputation path (Microsoft-backed)

**Check signature validity:**
```powershell
# Right-click installer → Properties → Digital Signatures tab
# Should show publisher name, timestamp, and valid status
```

---

## Certificate Procurement Timeline

**Plan for 1-2 weeks lead time:**

| Step | Duration | Notes |
|------|----------|-------|
| Purchase certificate | Immediate | SSL.com, DigiCert, Sectigo, etc. |
| Identity validation | 3-10 business days | Business registration, phone verification |
| Certificate issuance | 1-2 days | After validation approved |
| **Total** | **1-2 weeks** | Start early to avoid delays |

**Azure Trusted Signing:**
- Setup: 1-2 hours (if Azure subscription exists)
- No separate EV cert procurement needed
- Identity validation required but faster than traditional CAs

---

## Security Best Practices

1. **Never commit certificates to source control** — Use GitHub secrets only
2. **Rotate certificates before expiration** — Set calendar reminder 30 days before expiry
3. **Use separate certificates for dev/prod** — Self-signed for testing, EV for releases
4. **Audit signing logs** — Monitor GitHub Actions logs for failed signing attempts
5. **Timestamp all signatures** — Ensures signatures remain valid after cert expires
6. **Revoke compromised certificates immediately** — Contact CA if private key exposed

---

## Cost Comparison (2026 Pricing)

| Provider | Annual Cost | SmartScreen Reputation | Lead Time | CI Integration |
|----------|-------------|------------------------|-----------|----------------|
| SSL.com eSigner OV | $299/year | Standard (weeks) | 1-2 weeks | GitHub Action ✓ |
| SSL.com eSigner EV | $474/year | Standard (weeks) | 1-2 weeks | GitHub Action ✓ |
| Azure Trusted Signing | $120/year ($9.99/mo) | **Immediate** (Microsoft) | 1-2 hours | GitHub Action ✓ |
| DigiCert KeyLocker | $500-1000/year | Standard (weeks) | 1-2 weeks | Custom script |

**Recommendation:** Azure Trusted Signing for fastest time-to-market with immediate reputation.

---

## References

- [Tauri v2 Windows Signing Docs](https://v2.tauri.app/distribute/sign/windows/)
- [SSL.com eSigner GitHub Action](https://github.com/SSLcom/esigner-codesign)
- [Azure Trusted Signing Docs](https://learn.microsoft.com/azure/trusted-signing/)
- [Microsoft SignTool Documentation](https://learn.microsoft.com/windows/win32/seccrypto/signtool)
- [RFC 3161 Timestamping](https://www.ietf.org/rfc/rfc3161.txt)
- [CA/Browser Forum Code Signing Requirements](https://cabforum.org/working-groups/code-signing/)

---

**Last Updated:** 2026-02-16 (Story 9.5)
