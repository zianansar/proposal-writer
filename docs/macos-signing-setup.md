# macOS Code Signing & Notarization Setup Guide

This guide explains how to configure GitHub repository secrets for macOS code signing and notarization in the release workflow.

## Prerequisites

1. **Apple Developer Program membership** ($99/year)
   - Enroll at: https://developer.apple.com/programs/

2. **Developer ID Application certificate** installed in Keychain Access
   - Log in to https://developer.apple.com/account/
   - Navigate to **Certificates, Identifiers & Profiles**
   - Create a new **Developer ID Application** certificate
   - Download and install the certificate in Keychain Access

## Required GitHub Secrets

Configure the following secrets in your GitHub repository settings:

**Repository Settings → Secrets and variables → Actions → New repository secret**

### 1. `APPLE_CERTIFICATE`

**Description:** Base64-encoded `.p12` certificate file

**How to obtain:**

```bash
# Step 1: Export certificate from Keychain Access
# - Open Keychain Access
# - Find your "Developer ID Application" certificate
# - Right-click → Export → Save as .p12 file
# - Set a password when prompted (you'll use this for APPLE_CERTIFICATE_PASSWORD)

# Step 2: Encode the .p12 file to base64
openssl base64 -A -in /path/to/certificate.p12 -out cert-base64.txt

# Step 3: Copy contents of cert-base64.txt to GitHub secret
cat cert-base64.txt
```

### 2. `APPLE_CERTIFICATE_PASSWORD`

**Description:** Password used when exporting the `.p12` file

**How to obtain:** Use the password you set during the Keychain Access export step above.

### 3. `APPLE_SIGNING_IDENTITY`

**Description:** Full name of the signing identity (e.g., `Developer ID Application: Your Name (TEAMID)`)

**How to obtain:**

```bash
# List all code signing identities in Keychain Access
security find-identity -v -p codesigning

# Look for a line like:
# 1) ABCD1234... "Developer ID Application: Zian (XXXXXXXXXX)"

# Copy the full quoted string (including "Developer ID Application: ...")
```

Alternatively, open **Keychain Access**, find your Developer ID Application certificate, and copy the full name exactly as shown.

### 4. `APPLE_ID`

**Description:** Your Apple Developer account email address

**How to obtain:** The email you use to log in to https://developer.apple.com

### 5. `APPLE_PASSWORD`

**Description:** App-specific password for notarization (NOT your Apple ID password)

**How to obtain:**

1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. Navigate to **Security** → **App-Specific Passwords**
4. Click **Generate Password**
5. Enter a label (e.g., "GitHub Actions Notarization")
6. Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)

⚠️ **Important:** This is NOT your regular Apple ID password. You must generate a new app-specific password.

### 6. `APPLE_TEAM_ID`

**Description:** Your 10-character Apple Developer Team ID

**How to obtain:**

1. Go to https://developer.apple.com/account/
2. Navigate to **Membership Details**
3. Look for **Team ID** (e.g., `AB12CD34EF`)

Alternatively, run:

```bash
# If you have the certificate installed
security find-identity -v -p codesigning | grep "Developer ID Application"

# The Team ID is the 10-character string in parentheses at the end
# Example: "Developer ID Application: Zian (AB12CD34EF)"
#                                              ^^^^^^^^^^
```

### 7. `KEYCHAIN_PASSWORD`

**Description:** Temporary password for CI build keychain

**How to obtain:** Generate any strong random password (this is only used in CI, not related to your actual keychain):

```bash
# Generate a random password
openssl rand -base64 32
```

## Verification Checklist

After configuring all secrets, verify:

- [ ] All 7 secrets are added to GitHub repository settings
- [ ] `APPLE_CERTIFICATE` is base64-encoded (no line breaks)
- [ ] `APPLE_PASSWORD` is an app-specific password (not your Apple ID password)
- [ ] `APPLE_SIGNING_IDENTITY` matches exactly what's shown in Keychain Access
- [ ] `APPLE_TEAM_ID` is exactly 10 characters

## Testing the Workflow

### Local Pre-flight Check

Before pushing a tag, you can verify your certificate locally:

```bash
# Verify certificate is installed
security find-identity -v -p codesigning

# Check certificate expiration
security find-certificate -c "Developer ID Application" -p | openssl x509 -noout -dates
```

### Trigger a Release Build

1. Create and push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

2. Monitor the workflow:
   - Go to **Actions** tab in GitHub
   - Watch the "Release Build" workflow
   - Check logs for "✅ Certificate imported successfully" and "✅ All macOS signatures and notarization checks passed"

3. Verify the release artifacts:
   - Download the `.dmg` file from the release
   - Open it on a macOS machine
   - Verify no Gatekeeper warnings appear

## Troubleshooting

### "Certificate import failed"

- Ensure `APPLE_CERTIFICATE` is properly base64-encoded with no line breaks
- Verify `APPLE_CERTIFICATE_PASSWORD` matches the export password
- Check certificate is not expired: `security find-certificate -c "Developer ID Application" -p | openssl x509 -noout -dates`

### "Notarization failed"

- Verify `APPLE_PASSWORD` is an app-specific password (not regular Apple ID password)
- Check `APPLE_ID` is correct (the email for your Apple Developer account)
- Verify `APPLE_TEAM_ID` is exactly 10 characters
- Ensure your Apple Developer Program membership is active

### "Gatekeeper assessment failed"

- Wait a few minutes after notarization completes (Apple's servers need time to propagate)
- Verify notarization succeeded in the workflow logs
- Check certificate is a "Developer ID Application" (not "Mac App Distribution")

### "Missing required macOS signing secrets"

This error only appears on **tag pushes** (`v*`). If you see this:

1. Verify all 7 secrets are configured in GitHub repository settings
2. Check secret names match exactly (case-sensitive)
3. Ensure secrets are not empty

For non-tag builds (PR builds, manual workflow dispatch without tags), the workflow will skip signing and build an unsigned debug build — this is expected behavior per AC-5 (graceful degradation).

## Certificate Renewal

Developer ID Application certificates are valid for 5 years. When your certificate expires:

1. Generate a new certificate at https://developer.apple.com/account/
2. Export the new certificate as `.p12` from Keychain Access
3. Update `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD` secrets
4. Update `APPLE_SIGNING_IDENTITY` if the name changed

## Security Notes

- ⚠️ **Never commit** `.p12` files or certificates to git
- 🔒 GitHub Secrets are encrypted and only exposed during workflow runs
- 🔐 The temporary keychain (`build.keychain`) is deleted after each build
- 🧹 Certificate files are cleaned up immediately after import

## References

- [Tauri v2 macOS Signing Documentation](https://v2.tauri.app/distribute/sign/macos/)
- [Apple Developer: Creating Certificates](https://developer.apple.com/help/account/create-certificates/)
- [Apple Developer: Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Actions: Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
