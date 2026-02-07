---
status: ready-for-dev
assignedTo: null
tasksCompleted: 0
testsWritten: 0
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

---

## Implementation Tasks

### Task 1: Update Tauri CSP Configuration (Layer 1 - Frontend)
**File:** `src-tauri/tauri.conf.json`

- [ ] 1.1 Add `connect-src` directive to CSP: `connect-src 'self' https://api.anthropic.com`
- [ ] 1.2 Verify CSP blocks XHR/fetch to unauthorized domains in dev tools
- [ ] 1.3 Document CSP in architecture.md network audit table

**Current CSP:**
```json
"csp": "default-src 'self'; style-src 'self' 'unsafe-inline'"
```

**Target CSP:**
```json
"csp": "default-src 'self'; connect-src 'self' https://api.anthropic.com; style-src 'self' 'unsafe-inline'"
```

---

### Task 2: Create Network Allowlist Module (Layer 2 - Rust Backend)
**File:** `src-tauri/src/network.rs` (new)

- [ ] 2.1 Create `network.rs` module with ALLOWED_DOMAINS constant
- [ ] 2.2 Implement `validate_url(url: &str) -> Result<(), NetworkError>` function
- [ ] 2.3 Extract domain from URL and check against allowlist
- [ ] 2.4 Log blocked requests with `tracing::warn!`
- [ ] 2.5 Export module in `lib.rs`

**Suggested API:**
```rust
// src-tauri/src/network.rs
const ALLOWED_DOMAINS: &[&str] = &["api.anthropic.com"];

pub enum NetworkError {
    BlockedDomain(String),
    InvalidUrl(String),
}

pub fn validate_url(url: &str) -> Result<(), NetworkError> {
    // Parse URL, extract host, check against ALLOWED_DOMAINS
}
```

---

### Task 3: Integrate Validation into HTTP Client (Enforcement)
**File:** `src-tauri/src/claude.rs`

- [ ] 3.1 Import network module
- [ ] 3.2 Call `network::validate_url()` before every `client.post()` call
- [ ] 3.3 Return descriptive error if domain blocked
- [ ] 3.4 Verify `ANTHROPIC_API_URL` passes validation (sanity check)

**Integration points in claude.rs:**
- `generate_proposal_with_key()` line ~163
- `generate_proposal_streaming_with_key()` line ~265
- `analyze_perplexity()` line ~561
- `analyze_perplexity_with_sentences()` line ~667

---

### Task 4: Add Blocked Request Notification (UX)
**Files:** `src-tauri/src/lib.rs`, frontend components

- [ ] 4.1 Create Tauri command `get_blocked_requests() -> Vec<BlockedRequest>`
- [ ] 4.2 Emit event `network:blocked` when domain is blocked
- [ ] 4.3 (Optional) Show toast notification in frontend for blocked requests
- [ ] 4.4 Store blocked attempts in memory for debugging (not persisted)

---

### Task 5: Write Tests
**Files:** `src-tauri/src/network.rs` (inline tests), `src/tests/`

- [ ] 5.1 Unit test: `validate_url("https://api.anthropic.com/v1/messages")` passes
- [ ] 5.2 Unit test: `validate_url("https://evil.com/exfiltrate")` fails with BlockedDomain
- [ ] 5.3 Unit test: `validate_url("not-a-url")` fails with InvalidUrl
- [ ] 5.4 Unit test: subdomain attack `validate_url("https://api.anthropic.com.evil.com")` fails
- [ ] 5.5 Integration test: verify CSP blocks fetch in webview (manual or E2E)

---

### Task 6: Documentation
**Files:** `_bmad-output/planning-artifacts/architecture.md`, `docs/`

- [ ] 6.1 Update Network Audit table in architecture.md
- [ ] 6.2 Document dual enforcement in security section
- [ ] 6.3 Add troubleshooting guide for "blocked domain" errors

---

## Validation Checklist

- [ ] CSP rejects fetch to `https://google.com` (browser console shows CSP error)
- [ ] Rust rejects requests to non-allowlisted domains (returns error before network call)
- [ ] Anthropic API calls continue working normally
- [ ] Blocked requests are logged with domain name
- [ ] No regression in proposal generation or perplexity analysis
