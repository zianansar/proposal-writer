# Upwork Research Agent

**Version:** 0.1.1

## Critical Updates

This application supports **mandatory critical updates** for security and privacy. When a critical update is available (e.g., AI detection evasion patches), you'll see a non-dismissible update dialog that blocks all app functionality until the update is installed. This ensures you always have the latest security protections.

Critical updates are non-dismissible and block app usage until installed. The app will automatically restart after the update completes.

# Upwork Research Agent

Desktop application for AI-assisted Upwork proposal generation.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Release Build Requirements

**Auto-Updater Signing** (Story 9.6):
- `TAURI_SIGNING_PRIVATE_KEY` - Private key for update signing (NOT the v1 name `TAURI_PRIVATE_KEY`)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Password for the private key (NOT the v1 name `TAURI_KEY_PASSWORD`)
- These must be set in GitHub Actions secrets for CI/CD release builds
- Key generation: `npx tauri signer generate -- -w ~/.tauri/upwork-researcher.key`
- Public key is stored in `tauri.conf.json` → `plugins.updater.pubkey`
