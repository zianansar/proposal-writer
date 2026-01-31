---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/prd-validation-report-2026-01-31.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/product-brief-Upwork Research Agent-2026-01-30.md'
  - '_bmad-output/planning-artifacts/research/domain-upwork-freelancer-success-strategies-research-2026-01-30.md'
  - '_bmad-output/planning-artifacts/research/domain-upwork-proposal-strategies-research-2026-01-29.md'
  - '_bmad-output/planning-artifacts/research/technical-proposal-automation-app-research-2026-01-30.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/component-inventory.md'
  - 'docs/development-guide.md'
  - 'docs/source-tree-analysis.md'
workflowType: 'architecture'
project_name: 'Upwork Research Agent'
user_name: 'Zian'
date: '2026-01-31'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (18 FRs across 6 categories):**

| Category | FRs | Architectural Impact |
|:---------|:----|:---------------------|
| **Job Analysis & Queue** | FR-1 to FR-4 | Input parsing pipeline, RSS feed ingestion, weighted scoring engine |
| **Proposal Generator** | FR-5 to FR-7 | Multi-stage LLM orchestration pipeline (analysis → hook selection → voice matching → generation → safety scan) |
| **Voice Learning Engine** | FR-8 to FR-10, FR-16, FR-17 | Edit tracking, distance calculation, voice weight storage, Golden Set calibration, scored explanations. **Highest-risk subsystem** — quality depends entirely on data model design |
| **Safety & Compliance** | FR-11 to FR-13 | Perplexity analysis, rate limiter, clipboard-only output. Must be enforced at system level, not UI level |
| **Data Management** | FR-14, FR-15 | Offline history, encrypted database export/backup, key management |
| **Dynamic Configuration** | FR-18 | Remote config fetch with schema validation, fallback to bundled defaults, config versioning |

**Non-Functional Requirements (Critical Architecture Drivers):**

| NFR | Target | Architecture Implication |
|:----|:-------|:------------------------|
| Startup time | <2 seconds | Lightweight runtime, lazy loading, minimal boot dependencies |
| RAM (target) | <300MB | Rules out heavy frameworks; requires memory profiling discipline |
| RAM (max idle) | <400MB | Background process optimization, aggressive garbage collection |
| UI response | <100ms | Main-thread isolation, async operations for all I/O |
| AI streaming start | <1.5s | Pre-warmed connections, streaming API integration |
| Full generation | <8s | Prompt optimization, caching, model selection strategy |
| CPU when backgrounded | <5% | Process suspension or throttling when app loses focus |
| Database encryption | AES-256 | Encrypted local database with proper key derivation (Argon2 or equivalent) |
| Query performance | <500ms for 10K proposals | Indexed queries, optimized schema design |
| Zero telemetry default | Explicit opt-in only | No analytics SDK by default, network audit capability, Chromium telemetry disabled |

**Scale & Complexity:**

- Primary domain: Desktop application with LLM integration
- Complexity level: **High** (upgraded from medium-high based on elicitation analysis)
- Estimated architectural components: 10-12 major subsystems
- Data volume: Up to 10,000 proposals with voice analysis metadata
- Users: Single-user local application (no multi-tenancy)

### Central Architectural Challenge

The **multi-stage LLM orchestration pipeline** is the defining technical problem. Each proposal generation involves:

1. **Job Analysis** — parse input, extract entities, identify pain points, score opportunity
2. **Hook Selection** — match job characteristics to hook strategy library
3. **Voice Matching** — load voice profile, calculate tone adjustments for job context
4. **Generation** — construct prompt with all context, stream response
5. **Safety Scan** — perplexity analysis, burstiness check, AI detection risk scoring

Each stage has different latency characteristics, failure modes, cost profiles, and model requirements. The pipeline must handle partial failures gracefully (e.g., safety scan fails but generation succeeded — show result with warning, don't discard).

### High-Impact Assumptions to Validate

These decisions from the PRD and technical research carry the highest architectural leverage and should be explicitly decided rather than inherited:

1. **Platform choice (desktop vs. browser extension vs. web app)** — PRD specifies native desktop, but browser extension achieves Upwork adjacency without cross-platform desktop overhead. This is the single highest-leverage decision.
2. **LLM strategy (single vs. multi-model)** — Technical research proposed GPT-4 + Claude Haiku. Multi-model adds complexity and two failure domains. Single model with tiered prompting may be simpler for MVP.
3. **Voice learning approach** — Edit distance tracking is one strategy. Explicit preferences, curated examples, and direct feedback may be simpler and more effective. Data model design determines voice learning quality.
4. **Data layer** — Choice between IndexedDB and SQLite depends on and follows the platform decision. Not an independent choice.

### Technical Constraints & Dependencies

1. **Platform:** macOS 12+ and Windows 10/11 — cross-platform native desktop required (per PRD; flagged for validation)
2. **Data sovereignty:** All user data stored locally — no cloud PII transmission except transient LLM API calls
3. **API dependency:** LLM providers for generation (external, network-dependent)
4. **Security boundary:** API keys in OS Keychain only, network restricted to allow-listed domains, Chromium telemetry disabled if Electron chosen
5. **Distribution:** Code-signed packages, EV certificate for Windows SmartScreen
6. **Update mechanism:** Auto-update with mandatory critical patches, atomic rollback, post-update health check
7. **No platform API:** Upwork has no freelancer API — input is manual paste or RSS only
8. **Cost ceiling:** LLM token costs per proposal must be bounded — architectural concern, not just operational

### Cross-Cutting Concerns Identified

1. **Security & Privacy (3 distinct domains):**
   - *Credentials at rest:* API keys in OS Keychain, encryption key derived via KDF (not hardcoded)
   - *Data at rest:* AES-256 encrypted database, key derived from machine-specific entropy
   - *Data in transit:* Every LLM API call transmits voice profile context and proposal content. Requires a **prompt privacy layer** that minimizes PII sent to third-party models (send style parameters, not raw writing samples where possible)

2. **LLM Cost Architecture** — Token budgets per proposal, caching layers for repeated analysis patterns, cost ceiling enforcement, prompt compression for long job posts. Multi-stage pipeline amplifies cost if not managed.

3. **State Management** — Proposal lifecycle (draft → reviewed → submitted → response tracked), voice learning progression, generation pipeline state, and remote config state all require atomic persistence surviving crashes, restarts, and failed API calls.

4. **Performance Budgets** — Strict RAM/CPU/latency targets constrain framework choice, background processing, and data layer implementation.

5. **Offline Resilience** — Atomic draft persistence, full offline history access, graceful API failure with retry, cached remote config with bundled defaults fallback.

6. **Voice Learning State** — Spans editor (edit capture), data layer (distance calculations, weight storage), and generation pipeline (prompt construction). Risk of overfitting to recent edits requires decay weighting and Golden Set anchoring.

7. **ToS Compliance** — Manual-only submission, cooldown enforcement, and AI detection scanning are architectural guardrails enforced at system level.

8. **Observability (Local-Only)** — Quality scores, voice match trends, response tracking, and cost tracking require structured event capture without violating zero-telemetry constraints. All analytics computed and stored locally.

### Failure Mode Summary

| Subsystem | Critical Failure | Mitigation Pattern |
|:----------|:----------------|:-------------------|
| LLM Pipeline | API outage / timeout | Circuit breaker, graceful degradation, offline draft editing |
| LLM Pipeline | Low-quality output | Minimum quality gate, auto-retry with adjusted prompt |
| LLM Pipeline | Token limit exceeded | Prompt budgeting layer, context compression |
| Voice Learning | Insufficient data (cold start) | Set expectations in UX, immediate value without voice |
| Voice Learning | Overfitting / style drift | Decay weighting, Golden Set anchor, recalibration |
| Safety Scanner | False positive | Confidence thresholds, user override with reason |
| Safety Scanner | False negative | Multiple heuristics, conservative defaults |
| Encrypted DB | Key loss | Key backup strategy, export reminders, recovery seed |
| Encrypted DB | Migration failure | Atomic migrations with rollback, pre-update backup |
| Remote Config | Malformed payload | JSON schema validation, fallback to last-known-good |
| Remote Config | Server unreachable | Long-TTL cache, bundled defaults |
| Auto-Updater | Corrupt installation | Atomic update with rollback, health check on launch |

## Starter Template Evaluation

### Primary Technology Domain

**Desktop application** — cross-platform (macOS + Windows) with LLM integration, local encrypted storage, and rich UI.

### Platform Decision: Tauri v2

Tauri v2.9.5 selected over Electron and web app alternatives.

**Decisive factors:**

- RAM: 30-40MB baseline vs Electron's 200-400MB (NFR: <300MB target)
- Startup: <500ms vs Electron's 1-2s (NFR: <2s)
- CPU backgrounded: Rust has no runtime overhead vs Node.js event loop (NFR: <5%)
- Security: Independently audited by Radically Open Security, no bundled Chromium telemetry
- Encrypted SQLite: Rust-native SQLCipher path vs fragile Node.js native modules

**Acknowledged risks:**

- WebView divergence across macOS (WebKit) and Windows (Edge WebView2) — mitigate with cross-platform CI testing from day one
- Rust learning curve for solo TypeScript developer — mitigated by template patterns and `tauri-specta` type generation
- Smaller ecosystem than Electron — plugins are younger, community answers fewer

**Strategic fallback:** If desktop distribution proves too costly (code signing, cross-platform testing, auto-update infrastructure), a web app (Next.js + IndexedDB) is a viable pivot that preserves all frontend and LLM pipeline code. Note this as a product decision requiring PRD revision, not an architecture decision.

### Starter Options Evaluated

**Comparative scoring (weighted by PRD/NFR criteria):**

| Starter | Weighted Score | Key Strength | Key Weakness |
|:--------|:--------------|:-------------|:-------------|
| Official `create-tauri-app` | 4.65/10 | Zero inherited opinions | Must build 15+ subsystems from scratch |
| **`dannysmith/tauri-template`** | **7.80/10** | **12+ PRD features pre-built** | **Single maintainer, opinionated** |
| `MrLightful/create-tauri-react` | 4.65/10 | Clean bulletproof-react patterns | No Rust patterns, no infrastructure |

### Selected Starter: `dannysmith/tauri-template`

**Rationale (validated through 5-method adversarial elicitation):**

1. **Eliminates ~15 architectural decisions** that would otherwise require design, implementation, and testing: auto-update, crash recovery, logging, preferences, global shortcuts, state management, type bridge, theme system, notifications, testing infrastructure
2. **Type-safe Rust-TS bridge** via `tauri-specta` — critical for encrypted SQLite (Rust-side) communicating with React UI
3. **State management pre-wired** — three-layer approach (useState → Zustand → TanStack Query) maps to local UI state, app state, and LLM API state
4. **Multi-window with global shortcut** — directly analogous to PRD's "Cmd+Shift+P paste and generate" flow
5. **AI-agent-friendly documentation** — patterns explained for AI comprehension, accelerates Claude-assisted development

**Risks and mitigations (from adversarial analysis):**

| Risk | Severity | Likelihood | Mitigation |
|:-----|:---------|:-----------|:-----------|
| Template abandoned | Medium | Medium | Code is owned after clone; patterns are standard Tauri v2 |
| Inherited opinions don't fit | Medium | Medium | Strip NSPanel multi-window if unneeded; repurpose TanStack Query for LLM state |
| Rust dependency conflict with SQLCipher | High | Medium | **Run compatibility spike before committing** |
| React Compiler edge cases with streaming | Low | Low | Per-component opt-out via `'use no memo'` directive |
| WebView divergence across OS | Medium | High | Cross-platform CI from day one; broadly-supported APIs only |
| `tauri-specta` falls behind Tauri releases | Low | Low | Manual TS type fallback available |

**Pre-commitment validation (required before finalizing):**

- [ ] Spike: Clone template, add `sqlx` + SQLCipher feature flags to `Cargo.toml`, verify clean compilation on macOS
- [ ] Verify: Global shortcut pattern works for "paste and generate" flow
- [ ] Evaluate: Whether NSPanel multi-window adds value or should be stripped

**Initialization:**

```bash
git clone https://github.com/dannysmith/tauri-template.git upwork-research-agent
cd upwork-research-agent
npm install
```

### Architectural Decisions Provided by Starter

**Language & Runtime:** TypeScript (React 19 + Vite 7) frontend, Rust backend (Tauri v2)

**Styling:** Tailwind CSS v4 + shadcn/ui v4 + Lucide React icons

**Build Tooling:** Vite 7 (dev server + bundling), Rust cargo (backend compilation), React Compiler (auto-memoization)

**Testing:** Vitest v4 + Testing Library (frontend), clippy (Rust linting)

**Code Organization:** `src/` for React (components, hooks, stores, services), `src-tauri/src/` for Rust (modular commands)

**State Management:** Three-layer — useState (local), Zustand v5 (global client), TanStack Query v5 (LLM API state — streaming, retries, caching)

**Development Experience:** Hot reload, TypeScript strict mode, ESLint + Prettier, `tauri-specta` type generation

### LLM Integration Decision

**Single provider: Anthropic Claude** via `@anthropic-ai/sdk`

- **Generation model:** Claude Sonnet 4.5 — quality proposal generation with streaming
- **Analysis model:** Claude Haiku 4.5 — fast, cost-effective job analysis and safety scanning
- **Streaming:** Native SSE support for real-time generation display
- **Single vendor** — one SDK, one auth mechanism, one failure domain, simplified cost tracking

### What the Starter Does NOT Provide (Must Build)

1. SQLCipher encrypted database (Rust-side via sqlx or rusqlite)
2. Claude SDK integration and LLM orchestration pipeline
3. Voice learning data model and engine
4. Safety scanning subsystem (perplexity, burstiness, AI detection)
5. Job analysis and scoring pipeline
6. Hook strategy library and selection logic
7. Remote config service client
8. Proposal editor with edit tracking
9. Quality dashboard and analytics (local-only)
10. OS Keychain integration via `tauri-plugin-keyring`
