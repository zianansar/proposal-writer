---
status: ready-for-dev
---

# Story 8.13: Network Allowlist Enforcement

## Story

As a security-conscious user,
I want the app to block all network connections except approved APIs,
So that my data cannot be exfiltrated by malicious code.

## Acceptance Criteria

**Given** the app is running
**When** any component attempts network connection
**Then** the system:

1. Checks against allowlist: [api.anthropic.com]
2. Blocks all other domains with error log
3. Shows notification if blocked: "Blocked network request to unauthorized domain"

**And** allowlist is configured via Tauri CSP (AR-14)
**And** Rust backend also checks domains (dual enforcement per AR-14)

## Technical Notes

- From Round 5 Security Audit: AR-14 mentioned but no story implemented it
- NFR-9: block ALL traffic except allowlisted domains
- Dual enforcement: CSP + Rust-side check
