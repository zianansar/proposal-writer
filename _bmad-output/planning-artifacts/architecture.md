---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-02'
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
- **Prompt caching:** Enable Anthropic prompt caching (`anthropic-beta: prompt-caching-2024-07-31` header) for system prompts and few-shot examples. Voice profile and hook library are stable across generations — cached portion reduces input token costs by 50-70% for repeated generations.
- **Token budget:** Max 25K input tokens per generation. If context exceeds budget: (1) compress job posting to key entities only, (2) reduce few-shot examples from 3 to 1, (3) trim voice parameters to top-5 weights. Budget enforced in prompt construction module before API call.
- **Cost ceiling:** Configurable daily ($2 default) and monthly cost limits stored in `app_settings`. At 80%, warn user. At 100%, block new generations until next period or user raises ceiling. Daily ceiling catches runaway usage within hours, not at month-end. Enforced in pipeline orchestrator before API call. Estimated cost per proposal shown in dashboard.

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

## Core Architectural Decisions

_Enhanced through 5-method advanced elicitation: Pre-mortem Analysis, Red Team/Blue Team, Architecture Decision Records, First Principles Analysis, and Failure Mode Analysis._

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Encrypted database: rusqlite 0.38 + bundled SQLCipher 4.10
2. Key derivation: Argon2id with mandatory user passphrase
3. Rust ↔ Frontend boundary: hybrid thick/thin command design
4. LLM pipeline: hybrid parallel/sequential orchestration
5. Proposal editor: TipTap 3.x with abstracted diff interface

**Important Decisions (Shape Architecture):**
6. Schema: normalized relational + JSON metadata columns
7. Migrations: refinery 0.9 with rusqlite feature
8. Error handling: typed Rust `Result<T, AppError>` → structured TS errors
9. Streaming: Tauri events → Zustand → TipTap with 50ms token batching
10. Component architecture: feature-sliced by subsystem
11. API key storage: `keyring` crate direct (Rust-native OS Keychain)
12. Security hardening: prompt boundary enforcement, certificate pinning, zero-retention headers

**Deferred Decisions (Post-MVP):**
- CI/CD cross-platform matrix — build locally for MVP, automate for v1.1
- EV code signing — self-signed dev builds for MVP
- Remote config service protocol — hardcode defaults for MVP. **Note: All references to remote config throughout this document describe post-MVP functionality. For MVP, all configuration is local — bundled defaults in Rust `config.rs` and hook strategies seeded in initial migration. No network calls except to Anthropic API.**
- Quality dashboard analytics schema — implement after voice learning works

### Data Architecture

**Database: `rusqlite` 0.38 + `bundled-sqlcipher` feature**
- Version: rusqlite 0.38.0, SQLCipher 4.10.0 (based on SQLite 3.50.4)
- Rationale: Single-user desktop app — async DB access adds complexity without benefit. Bundled SQLCipher compiles statically, no system dependency needed.
- **Why not `tauri-plugin-sql`:** The Tauri SQL plugin doesn't support SQLCipher encryption. It uses `sqlx` internally with a different API surface. For encrypted local SQLite, direct `rusqlite` with `bundled-sqlcipher` is the only viable path. Agents should not suggest switching to the plugin.
- **Fallback if SQLCipher spike fails:** Column-level encryption using `aes-gcm` crate. Encrypt sensitive TEXT columns (proposal content, voice params, edit diffs) individually. Non-sensitive columns (timestamps, scores, outcome status) remain unencrypted for queryability. Degrades security posture slightly (metadata visible) but eliminates the SQLCipher compilation dependency entirely. This is Plan B — only if `bundled-sqlcipher` and `bundled-sqlcipher-vendored-openssl` both fail to compile cross-platform.
- Affects: All data persistence, voice learning storage, proposal history

**Schema: Normalized relational with JSON metadata columns**
- Core entities (proposals, jobs, voice_profiles) use relational columns for queryable fields
- Flexible metadata (hook parameters, voice weights, analysis results) stored as JSON columns
- **Outcome tracking:** `proposals` table includes `outcome_status` enum column (`submitted`, `response_received`, `interview`, `hired`, `no_response`, `rejected`) and `outcome_updated_at` timestamp. Enables dashboard response rate calculations and quality-to-outcome correlation.
- **Prompt version tracking:** `proposals` table includes `prompt_version` column (hash of the prompt template used for generation). Enables quality score comparison across prompt iterations.
- **Extracted aggregatable columns:** `quality_score` (REAL), `token_cost` (REAL), and `outcome_status` (TEXT) are top-level relational columns on `proposals`, NOT buried in JSON. Dashboard aggregates query these columns directly. Full analysis detail remains in `analysis_json` for single-record display.
- **Draft auto-save:** `proposals` table includes `draft_content` column (TEXT). During active generation streaming, persist current token buffer every 2 seconds (lightweight single-row update). On app restart, detect proposals with `draft_content` but no `completed_at` and offer recovery.
- **Soft-delete:** `proposals` table includes `deleted_at` timestamp column. Deleted proposals hidden from UI but retained in DB for 30 days. "Recently deleted" view in settings allows recovery. Hard purge after 30 days or on explicit "empty trash." Voice learning data recomputed on undelete.
- **Voice profile categories:** `voice_profiles` table includes `category` column (TEXT, default "general"). MVP: single default profile. v1.1: multiple profiles selectable per generation based on job niche.
- Rationale: Queryable where it matters (NFR: <500ms for 10K proposals), flexible where schemas evolve (voice learning is experimental)
- Affects: Every subsystem that persists data

**Migrations: `refinery` 0.9 with `rusqlite` feature**
- Embedded SQL migration files compiled into binary
- Versioned, forward-only migrations (no rollback — pre-migration backup instead)
- **Seed data:** Initial migration (`V20260201000000__initial_schema.sql`) bundles default hook strategies. Empty hook table causes generation failure — seeding is not optional.
- Rationale: Proven rusqlite integration, simple for desktop distribution
- Affects: Schema evolution, auto-update process

**Connection Management: `Mutex<Connection>` + read pool**
- Write connection: Single `Mutex<Connection>` for all write operations (single writer, no contention)
- Read pool: 2-3 read-only connections for concurrent reads (pipeline Phase 1 parallel stages: job analysis + voice loading can read simultaneously)
- WAL mode: Enable `PRAGMA journal_mode=WAL;` in DB initialization after encryption key set. Required for concurrent readers.
- WAL checkpoint: `PRAGMA wal_checkpoint(TRUNCATE)` after every 100 writes or on graceful app shutdown. Prevents unbounded WAL file growth and reduces data loss window if WAL file is lost during crash.
- Async pipeline: `spawn_blocking` receives a cloned read connection, never the write mutex. rusqlite `Connection` is `!Send` — never share across threads.

**Caching: SQLite page cache + Zustand in-memory + dashboard cache table**
- SQLite's built-in page cache handles read performance for individual queries
- Active proposal and voice profile loaded into Zustand store for UI responsiveness
- `dashboard_cache` table stores pre-computed aggregates (avg quality score, cost sum, voice trends). Updated incrementally on each new proposal save. Dashboard reads from cache, not from scanning all proposals. Required for performance at 10K proposals.
- Rationale: Per-query caching layer for a single-user app is over-engineering, but dashboard aggregates need pre-computation at scale

### Authentication & Security

**Key Derivation: Argon2id via `argon2` crate 0.5.3 (RustCrypto)**
- **Primary secret: User passphrase** (mandatory, minimum 8 characters, strength meter in UI). Salt is randomly generated at DB creation time and **stored alongside the encrypted DB** (in a `.salt` file or DB header), not derived from machine UUID. Machine UUID may be mixed into initial salt generation as entropy, but the stored salt travels with the DB to enable cross-machine backup portability.
- Passphrase strength enforced in Rust `set_passphrase` command — reject passphrases below minimum length. UI shows strength meter as guidance.
- Parameters: 64MB memory, 3 iterations, 4 parallelism (OWASP recommended minimums)
- Rationale (from Red Team analysis): Machine-entropy-only derivation means any local process can derive the same key. Passphrase is required for real security and enables database portability to new machines.
- **Session key caching:** After successful passphrase entry, hold derived encryption key in memory for the session. Clear on app quit (not window close — tray keeps process alive). Optional "remember for X hours" setting stores derived key temporarily in OS Keychain. Default: always ask (secure default). This is a UX vs security trade-off — configurable in settings.
- Affects: Database encryption, first-launch setup flow, key recovery, machine migration

**API Key Storage: `keyring` crate directly (Rust-native OS Keychain)**
- macOS: Keychain Services. Windows: Credential Manager.
- No Tauri plugin wrapper — community plugins are too young (v0.1.0–v1.4.0)
- Exposed via Tauri commands: `get_api_key`, `set_api_key`, `delete_api_key`
- **Keychain locked recovery:** If OS Keychain is locked (e.g., after macOS sleep), return `AppError` with `code: "KEYCHAIN_LOCKED"`, `recoverable: true`, message: "Please unlock your system keychain to continue." Retry automatically when user unlocks.
- Affects: LLM pipeline authentication, settings UI

**Prompt Privacy Layer: Style parameter extraction**
- Voice profile sent as derived style parameters (formality score, sentence length distribution, vocabulary tier, tone markers) — not raw writing samples
- Job context sent as structured entities (title, skills, budget, pain points) — not raw paste
- Rationale: Minimizes PII in API calls while preserving generation quality
- Affects: Prompt construction, voice learning data model

**Prompt Boundary Enforcement (from Red Team analysis)**
- Job content always placed in `user` role with explicit delimiters
- System prompt never contains user-supplied text — prevents prompt injection via malicious job postings
- Input sanitization layer strips known injection patterns before prompt construction
- Affects: All LLM API calls, prompt construction module

**Anthropic Zero-Retention Headers**
- Enforce `anthropic-no-log: true` header on every API call
- Verify Anthropic API terms compliance for data handling
- Affects: HTTP client configuration, compliance documentation

**Certificate Pinning (Post-MVP)**
- Pin Anthropic API TLS certificate in Rust HTTP client
- Prevents MITM interception even with compromised system trust store or corporate proxy
- **Deferred to post-MVP:** Standard TLS verification is sufficient for a single-user desktop app calling a major API provider. Certificate pinning adds maintenance burden (certificate rotation) and blocks corporate proxy users. Revisit for v1.1 hardening.
- Affects: Rust HTTP client module, certificate update process

**Network Allowlisting: Tauri CSP + Rust-side domain check**
- Tauri `security.csp` restricts frontend `connect-src` to Anthropic API domain only
- Rust-side HTTP client validates outbound request domains before sending
- Dual enforcement: frontend can't bypass, Rust can't be tricked
- Affects: All network calls

### API & Communication Patterns

**Rust ↔ Frontend Boundary: Hybrid thick/thin commands**
- **Thick commands** for security-critical and pipeline operations: encryption, API calls, pipeline orchestration, keychain access, safety scanning. Business logic lives in Rust.
- **Thin passthrough** for UI-preference operations: theme, layout state, non-sensitive reads. Avoids Rust recompile for UI-only changes.
- **Boundary rule**: If the operation touches encryption, network, PII, or any DB write → thick. If it's purely UI state or reading from TanStack Query/Zustand cache → thin. Edge cases: reading a non-sensitive setting from cache = thin; updating a proposal title = thick (it's a DB write through the encrypted layer).
- Type safety via `tauri-specta` — Rust structs auto-generate TypeScript types
- Rationale (from ADR debate): Pure thick kills developer velocity. Pure thin leaks security concerns to frontend. Hybrid with explicit boundary rules gives both safety and speed.
- Affects: Every feature boundary between frontend and backend

**LLM Pipeline: Hybrid parallel/sequential orchestration**

```
Phase 1 (parallel):  Job Analysis ─┐
                                    ├─→ Phase 2 (sequential): Hook Selection → Generation → Safety Scan
                     Voice Loading ─┘
```

- **Phase 1**: Job Analysis and Voice Profile Loading execute in parallel (independent inputs). Saves 1-2s vs fully sequential.
- **Phase 2**: Hook Selection needs job analysis output. Generation needs all context. Safety Scan needs generation output. These are sequential.
- Per-stage: timeout (configurable), 1 retry with backoff, circuit breaker (fail-open with degraded output)
- Streaming: Generation stage streams tokens to frontend via Tauri event system (`app.emit()`)
- Rationale (from ADR debate + Pre-mortem): Fully sequential risks exceeding the 8s NFR. Fully parallel isn't possible due to data dependencies. Hybrid captures free parallelism without added complexity.
- Affects: Core product experience, cost tracking, error UX

**Error Handling: Typed Rust `Result<T, AppError>` → Structured TS errors**
- Rust side: `thiserror` crate for typed error enum (`AppError::LlmTimeout`, `AppError::DbEncryption`, etc.)
- Serialized to frontend as `{ code: string, message: string, recoverable: boolean, context?: object }`
- Frontend shows recoverable errors inline, unrecoverable errors as modal with action
- Affects: Every Tauri command, all UI error states

### Frontend Architecture

**Proposal Editor: TipTap 3.x (ProseMirror-based) with abstracted diff interface**
- Version: TipTap 3.15.x (current stable)
- Chosen for rich editing UX (formatting, sections, inline safety badges, quality score cards within content area) — not solely for voice learning. A textarea cannot render inline pipeline stage indicators or contextual UI within the editing surface.
- Edit tracking via ProseMirror transaction history for voice learning diff analysis
- **Architectural escape hatch (Plan B):** Voice learning consumes generic `EditDiff[]` interface, not TipTap-specific types. If TipTap proves too heavy, swap to: `textarea` + `react-markdown` for preview + `diff-match-patch` library for edit diffs + external sidebar for safety/quality badges. Voice learning code is untouched. Only `features/proposal-editor/` changes.
- Token buffering: 50ms batches to prevent per-token ProseMirror transactions causing editor jank (from Pre-mortem)
- **Session memory management:** Clear TipTap transaction history when starting a new proposal generation. Editor undo history resets per proposal — do not accumulate across session. Prevents memory growth over 50+ proposals.
- **Persistent editor instance:** TipTap editor stays mounted when navigating between proposals. Swap content via `editor.commands.setContent()` — do not unmount/remount. ProseMirror initialization is ~50-100ms; rapid proposal switching would feel sluggish with remounting.
- **Proposal sections:** Pipeline outputs markdown with H2 headings per section (Hook, Body, Qualifications, CTA). TipTap renders as heading nodes with section type stored as a node attribute. Enables section-aware editing and per-section quality scoring.
- **Undo after generation:** Entire generation result inserted as a single TipTap transaction (after buffering complete). Cmd+Z undoes the full generation, restoring pre-generation state. Subsequent manual edits create individual undo steps as normal.
- Affects: Proposal editing, voice learning edit capture, generation streaming

**Streaming UX: Tauri events → Zustand store → TipTap**
- Rust emits token events via `app.emit("generation:token", payload)`
- Frontend listener buffers tokens (50ms window), appends as single TipTap transaction
- "Stop generation" button sends Tauri command to abort the pipeline
- Affects: Generation UX, editor integration

**Component Architecture: Feature-sliced by subsystem**
- Top-level feature folders: `job-queue/`, `proposal-editor/`, `voice-learning/`, `settings/`, `dashboard/`
- Each folder owns its components, hooks, and types
- Shared UI primitives in `shared/ui/` (shadcn/ui components)
- Shared hooks in `shared/hooks/` (e.g., `useTauriCommand`)
- Rationale: Maps 1:1 to PRD feature categories, prevents cross-feature coupling
- Affects: Code organization, story scoping

### Infrastructure & Deployment

**CI/CD: Deferred to post-MVP**
- MVP builds locally via `cargo tauri build` on developer machine
- Cross-platform CI (GitHub Actions) added when approaching v1.0 release

**Code Signing: Deferred to post-MVP**
- Dev builds unsigned. EV certificate procurement before public distribution.

**Logging: `tracing` crate (Rust) + structured JSON logs**
- `tracing` with `tracing-subscriber` for structured, leveled logging
- Logs written to app data directory with daily rotation, 7-day retention
- Log levels: ERROR (always), WARN (always), INFO (default), DEBUG (opt-in)
- Frontend errors forwarded to Rust via Tauri command for unified log stream
- Affects: Debugging, crash recovery, local observability

### Voice Learning Architecture (from First Principles Analysis)

**Dual-Signal Voice Learning Model**

Traditional assumption (edit distance tracking = voice signal) was challenged and rebuilt from first principles:

| Signal | Source | Reliability | When Active |
|:-------|:-------|:-----------|:------------|
| **Explicit** | User rates proposals (1-5), marks Golden Set examples, sets style preferences | High | From day one |
| **Implicit** | Structured edit diffs over many proposals — statistical pattern extraction | Medium (improves with volume) | After 10+ edited proposals |

- **Cold start**: Explicit only. User provides 2-3 sample proposals + rates first generations. Immediate value without implicit data.
- **Maturation**: Implicit analysis begins contributing after statistical threshold (10+ edited proposals). Weighted combination: `voice_profile = 0.7 × explicit + 0.3 × implicit` (weights adjustable).
- **Golden Set anchor**: 3-5 user-curated "this is my voice" proposals. Prevents drift. Recalibration trigger if implicit signal diverges >2σ from Golden Set.
- **Data model**: Voice profile stores derived parameters (not raw samples). Edit history stores structured diffs (operation type + content category), not character-level deltas. Implicit history capped at rolling window of last 100 edited proposals to prevent JSON column bloat.
- **Time decay:** Exponential decay on implicit signal — edits from last 30 days weighted 2x compared to older edits. Prevents voice profile from anchoring to early writing style as user naturally evolves. Golden Set can be updated by user at any time to reflect evolved style.
- Rationale: Raw edit distance on rich text is noise when users rewrite paragraphs wholesale. Explicit signal is reliable from day one; implicit signal requires volume to overcome noise.

**Implementation Phasing (from Algorithm Olympics analysis):**

- **MVP:** Few-shot prompting only — user provides 2-3 sample proposals included directly in LLM prompt as examples. Immediate value, zero learning infrastructure. `voice/` module structure exists but only implements sample storage and prompt injection.
- **v1.1:** Add explicit signal layer (ratings, style preferences). Voice parameters derived from explicit input replace few-shot examples in prompt (reducing token cost). `voice/explicit.rs` becomes active.
- **v1.2:** Add implicit signal layer (edit diff tracking). Full dual-signal model active. `voice/implicit.rs` and `voice/diff.rs` become active.

This phasing does not change the architecture — module structure, `EditDiff[]` interface, and `VoiceParams` struct all remain as designed. It changes the implementation sequence within the voice learning epic.

**Voice learning validation gate:** Before investing in v1.1/v1.2 infrastructure, run an A/B experiment at the end of MVP: generate the same proposal with and without voice samples. Have the user rate which sounds more like them. If few-shot voice matching doesn't measurably improve perceived quality, pivot voice learning strategy (e.g., fine-tuning, different prompting approach) before building more infrastructure. This is a product decision checkpoint, not an architecture checkpoint.

**Minimum viable voice profile:** After 2+ rated proposals (or 2+ uploaded samples), generate a preliminary profile with explicit-only weights. Show confidence indicator in UI: "Voice profile: Early (3 samples) — improves with more ratings." Progress bar toward implicit signal threshold (10+ edited proposals) visible in voice learning page.

### Pipeline Failure Mode Specification (from Failure Mode Analysis)

| Stage | Failure | Response | User Experience |
|:------|:--------|:---------|:---------------|
| Job Analysis | Timeout (>3s) | Return raw text as context | "Analysis unavailable — proceeding with manual context" |
| Job Analysis | Parse error | Fall back to unstructured input | Show raw text, user can annotate |
| Voice Loading | DB read error | Use neutral/default voice | "Using default voice — profile couldn't be loaded" |
| Voice Loading | No profile exists | Proceed without voice | "No voice profile yet — generate and rate to start learning" |
| Hook Selection | No matching hook | Use "general" template | Transparent — show selected hook name |
| Hook Selection | Multiple high-confidence matches | Pick highest, note alternatives | Show selected + "also considered: X, Y" |
| Generation | Timeout (>10s) | Keep partial output in editor, mark as "incomplete" | "Generation interrupted" + retry button (retry appends to or replaces partial — user chooses) |
| Generation | Mid-stream API error (429, 5xx) | Keep all tokens already emitted to editor | "Generation interrupted — partial result kept" + retry button |
| Generation | Empty response | Auto-retry once with simplified prompt | "Retrying with adjusted parameters..." |
| Generation | Token budget exceeded | Compress context, retry | Transparent compression indicator |
| Generation | Quality below threshold | Show with warning | Quality score badge + "Retry" button |
| Safety Scan | Timeout | Show as "unscanned" | "Safety scan unavailable" + manual scan button |
| Safety Scan | High AI detection score | Show score + explanation | User decides — never auto-reject. **Copy-to-clipboard always works regardless of safety score.** Warning is advisory only, never gates copy action. |
| Safety Scan | Service error | Show as "unscanned" | Same as timeout |
| **Multi-stage** | 2+ failures | Degraded mode indicator | Banner: "Limited functionality — some analysis unavailable" |
| **Global** | 3× consecutive 5xx | Circuit breaker opens | "API appears down — pausing generation. Retry in 30s" |

**Circuit Breaker Specification:**
- **MVP:** Simple retry-once pattern per stage (1 retry, 2s backoff). Show error on second failure. Full circuit breaker deferred to post-MVP when real failure data is available.
- **Post-MVP (full circuit breaker):** Per-stage: 3 failures in 5 minutes → open → half-open after 30s → test request → close on success
- When open: use fallback immediately, skip API call
- Global: 3 consecutive 5xx across any stage → pause all generation → notify user → auto-retry at 30s intervals
- **User override:** "Force retry" button bypasses circuit breaker with explicit user consent. Circuit breaker protects against automated retry storms, not deliberate user intent. Override logged in security events.

### Decision Impact Analysis

**MVP Priority Classification:**

| Priority | Components | Rationale |
|:---------|:-----------|:----------|
| MVP-critical | Job parser, LLM pipeline, proposal editor, clipboard copy, basic settings (API key) | Core value loop: paste → generate → edit → copy |
| MVP-important | Encrypted DB, voice learning (few-shot), safety scan, job scoring | Security + differentiation |
| Post-MVP | Dashboard, export/backup, auto-update, remote config, notification system, system tray | Growth features |

**Implementation Sequence:**
0. Walking Skeleton (Spike 0) — paste → generate → stream → copy, no infrastructure
1. Encrypted database setup (rusqlite + SQLCipher + Argon2id key derivation) — everything depends on this
2. Tauri command boundary + error handling patterns — establishes frontend/backend contract
3. API key storage (keyring) — unblocks LLM integration
4. LLM pipeline skeleton (hybrid parallel/sequential, streaming) — core product value
5. TipTap editor integration with streaming + token buffering — primary UI surface
6. Voice learning data model (dual-signal: explicit first, implicit second) — highest-risk subsystem
7. Safety scanning — can be stub/placeholder initially
8. Job queue + scoring — input pipeline
9. Settings + configuration — plumbing
10. Dashboard — last, depends on data from all other subsystems

**Cross-Component Dependencies:**
- Voice learning depends on: editor (edit capture via `EditDiff[]`), database (storage), LLM pipeline (prompt construction)
- Safety scanning depends on: LLM pipeline (analysis model), editor (content to scan)
- Streaming depends on: LLM pipeline (token events), editor (render target), Zustand (state bridge)
- All subsystems depend on: database layer, error handling pattern, Tauri command boundary

**Pre-Commitment Validation (updated):**
- [ ] Spike: Clone template, add `rusqlite` with `bundled-sqlcipher` to `Cargo.toml`, verify clean compilation on macOS **and Windows** (via GitHub Actions CI or Windows VM — do not skip Windows verification). If `bundled-sqlcipher` has OpenSSL conflicts on Windows, evaluate `bundled-sqlcipher-vendored-openssl` feature flag as alternative.
- [ ] Verify: Global shortcut pattern works for "paste and generate" flow
- [ ] Evaluate: Whether NSPanel multi-window adds value or should be stripped
- [ ] Spike: TipTap 3.x — (a) streaming performance: 50ms batched token append at 30 tokens/sec, verify <16ms render per frame (50ms is initial target, adjust based on results); (b) React 19 compatibility: verify mount/unmount/ref behavior; (c) WebView rendering: verify identical rendering on macOS WebKit and Windows Edge WebView2
- [ ] Spike 0 / Walking Skeleton: Paste job text → hardcoded Anthropic API call → stream response to textarea → copy button. No DB, no voice, no safety scan, no encryption. Proves core value loop end-to-end before building infrastructure.

## Implementation Patterns & Consistency Rules

_Enhanced through 5-method advanced elicitation: Code Review Gauntlet, Cross-Functional War Room, Red Team vs Blue Team, Critique and Refine, and Occam's Razor._

### Pattern Categories Defined

**28 conflict points identified** across naming, structure, format, communication, process, and enforcement — where AI agents could make incompatible choices if not explicitly specified.

### Naming Patterns

#### Database Naming (SQLite via rusqlite)

| Element | Convention | Example |
|:--------|:-----------|:--------|
| Tables | `snake_case`, plural | `proposals`, `voice_profiles`, `job_queue_items` |
| Columns | `snake_case` | `created_at`, `quality_score`, `voice_weight` |
| Primary keys | `id` (integer, autoincrement) | `proposals.id` |
| Foreign keys | `{referenced_table_singular}_id` | `proposal_id`, `voice_profile_id` |
| Indexes | `idx_{table}_{columns}` | `idx_proposals_created_at`, `idx_jobs_score` |
| JSON columns | `{name}_json` suffix | `analysis_json`, `voice_params_json` |
| Booleans | `is_` or `has_` prefix | `is_submitted`, `has_voice_match` |
| Timestamps | `{action}_at` suffix, ISO 8601 UTC | `created_at`, `submitted_at` |

**Migration files:** Timestamp-based naming to prevent parallel development collisions:

- Format: `V{YYYYMMDDHHMMSS}__{description}.sql`
- Example: `V20260201143000__initial_schema.sql`, `V20260203091500__add_voice_weights.sql`
- One migration per schema change. Never modify existing migration files.

**SQL Query Organization:**

- One file per entity in `db/queries/`: `proposals.rs`, `voice_profiles.rs`, `jobs.rs`
- Each file exports standalone functions: `get_proposal(conn, id)`, `list_proposals(conn, filter)`
- All queries use prepared statements via rusqlite's `params![]` macro
- No inline SQL strings in command handlers — always call query functions

#### Rust Naming & Conventions

| Element | Convention | Example |
|:--------|:-----------|:--------|
| Modules | `snake_case` | `voice_learning`, `llm_pipeline` |
| Structs | `PascalCase` | `Proposal`, `VoiceProfile`, `PipelineStage` |
| Tauri commands | `snake_case` verb-first | `generate_proposal`, `get_voice_profile`, `set_api_key` |
| Error variants | `PascalCase` descriptive | `AppError::LlmTimeout`, `AppError::DbEncryption` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT`, `TOKEN_BUFFER_MS` |
| Config fields | `snake_case` | `argon2_memory_cost`, `circuit_breaker_threshold` |

**Visibility rules (promotion ladder):**

- Default: **private** — all functions and structs start private
- Promote to `pub(crate)` when another module within the crate needs it
- Promote to `pub` only when it crosses the specta/Tauri command boundary
- Never skip steps. Never `pub(crate)` "just in case."

**Ownership conventions for Tauri commands:**

- Tauri command signatures use owned types: `String`, `Vec<T>`, `Option<T>` (Tauri deserializes into owned values)
- Internal functions borrow: `&str`, `&[T]`, `Option<&T>` where possible
- Clone explicitly when needed — no implicit copies. Comment why if cloning large structures.

**Error handling strictness:**

- `unwrap()`: Forbidden in all production code. Use `?` operator or explicit match.
- `expect()`: Allowed only in application initialization (`main.rs`, plugin setup) with descriptive message: `expect("Failed to initialize database — is the data directory writable?")`
- `?` operator: Preferred. All functions that can fail return `Result<T, AppError>`.

**Async vs sync guidance:**

- Default: Synchronous Tauri commands. rusqlite is sync, most operations are fast.
- Async: Only for network I/O — LLM API calls, remote config fetch.
- Blocking DB from async: Use `tokio::task::spawn_blocking` when a DB call is needed inside an async pipeline stage.

**Import ordering (Rust):**

```rust
// 1. Standard library
use std::collections::HashMap;

// 2. External crates
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

// 3. Crate-internal
use crate::db::models::Proposal;
use crate::pipeline::PipelineStage;
```

#### TypeScript/React Naming & Conventions

| Element | Convention | Example |
|:--------|:-----------|:--------|
| Components | `PascalCase` file and export | `ProposalEditor.tsx`, `JobQueueItem.tsx` |
| Hooks | `camelCase` with `use` prefix | `useGenerateProposal`, `useTauriCommand` |
| Stores (Zustand) | `camelCase` with `use` prefix + `Store` suffix | `useProposalStore`, `useVoiceStore` |
| Types/Interfaces | `PascalCase`, no `I` prefix | `Proposal`, `VoiceProfile`, `AppError` |
| Event handlers | `on` + `PascalCase` action | `onGenerateClick`, `onEditorChange` |
| Constants | `SCREAMING_SNAKE_CASE` | `GENERATION_TIMEOUT_MS` |
| Feature folders | `kebab-case` | `job-queue/`, `proposal-editor/`, `voice-learning/` |
| Utility files | `camelCase` | `formatDate.ts`, `parseJobInput.ts` |

**TypeScript strict compiler options (tsconfig.json):**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

**Import ordering (TypeScript) — enforced via ESLint `import/order`:**

```typescript
// 1. React / framework
import { useState, useEffect } from "react";

// 2. External libraries
import { useQuery } from "@tanstack/react-query";

// 3. Shared modules
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import type { AppError } from "@/shared/types";

// 4. Feature-local
import { ProposalCard } from "./components/ProposalCard";
import type { Proposal } from "./types";
```

**Styling rule: Tailwind utility classes only.**

- No inline `style={}` props (except dynamic values like `style={{ width: calculatedWidth }}`)
- No CSS modules, no styled-components, no separate `.css` files
- Use shadcn/ui component variants for consistent design tokens
- Custom styles via Tailwind `@apply` in `globals.css` only for truly global patterns

**React component composition pattern:**

- Prefer `children` prop for composition: `<Card>{content}</Card>`
- Compound components for complex multi-part UI: `<ProposalEditor.Toolbar />`, `<ProposalEditor.Content />`
- Never render props. Use hooks to share behavior instead.
- Props interfaces: explicit, no spread (`...rest`) except on primitive HTML wrappers

#### Tauri Event Naming

| Element | Convention | Example |
|:--------|:-----------|:--------|
| Event names | `{feature}:{action}`, two levels max, lowercase | `generation:token`, `generation:stage-complete` |
| Payload fields | `camelCase` via `serde(rename_all = "camelCase")` | `{ tokenText, stageId, isPartial }` |

- Two-level namespace only. Never `generation:stage:complete` — use `generation:stage-complete`.
- Hyphenated actions for multi-word: `voice:profile-updated`, `safety:scan-complete`.

### Structure Patterns

#### Project Organization

```text
src/                              # React frontend
  features/
    job-queue/                    # Feature slice
      components/                 # Feature-specific components
      hooks/                      # Feature-specific hooks
      types.ts                    # Feature-specific types
      index.ts                    # Public exports
    proposal-editor/
    voice-learning/
    settings/
    dashboard/
  shared/
    ui/                           # shadcn/ui primitives
    hooks/                        # Cross-feature hooks
    types/                        # Shared types (AppError, TauriResponse)
    lib/                          # Utilities (formatDate, etc.)
    config.ts                     # Frontend constants and defaults
  App.tsx
  main.tsx

src-tauri/src/                    # Rust backend
  commands/                       # Tauri command handlers (one file per feature)
    proposal.rs
    voice.rs
    pipeline.rs
    keychain.rs
    settings.rs
  db/
    mod.rs                        # Connection pool, encryption setup
    migrations/                   # refinery SQL files
    models.rs                     # Rust structs for DB rows
    queries/                      # One file per entity
      proposals.rs
      voice_profiles.rs
      jobs.rs
  pipeline/
    mod.rs                        # Orchestrator
    stages/                       # One file per pipeline stage
    circuit_breaker.rs
  voice/
    mod.rs
    profile.rs
    diff.rs
  safety/
    mod.rs
    scanner.rs
  config.rs                       # Backend defaults, environment config
  lib.rs
  main.rs
```

#### Shared Type Promotion Rule

- Types start in the feature that creates them: `features/job-queue/types.ts`
- When a second feature needs the same type, move it to `shared/types/` and re-export
- Never duplicate types across features — if two features define `JobInput`, that's a bug

#### Command File Boundaries

- Command files map 1:1 to features. `proposal.rs` handles proposal CRUD. `pipeline.rs` handles generation.
- If a command serves two features, it goes in the primary feature's file with `// Cross-feature: also used by {other_feature}` comment.
- When a command file exceeds ~300 lines, split into submodules within a directory: `commands/pipeline/mod.rs`, `commands/pipeline/generate.rs`

#### Test Location & Naming

**Co-located with source:**

- Frontend: `ProposalEditor.test.tsx` next to `ProposalEditor.tsx`
- Rust unit tests: `#[cfg(test)] mod tests` in the same file
- Rust integration tests: `tests/` directory at crate root

**Test naming convention:**

- Rust: `fn test_{function_name}_{scenario}()` — e.g., `test_generate_proposal_with_empty_input()`
- TypeScript: `describe("{ComponentName}")` + `it("should {expected behavior}")` — e.g., `it("should render loading skeleton while generating")`

### Format Patterns

#### Tauri Command Response Format

All Tauri commands return `Result<T, AppError>` from Rust. No wrapper object.

```typescript
// Success — T is the direct payload
const profile: VoiceProfile = await invoke("get_voice_profile");

// Error — caught by useTauriCommand hook
interface AppError {
  code: string;          // "LLM_TIMEOUT", "DB_ENCRYPTION"
  message: string;       // Human-readable
  recoverable: boolean;  // true = inline toast, false = modal
  context?: Record<string, unknown>;
}
```

#### Date/Time Format

- Storage: ISO 8601 UTC strings in SQLite (`2026-02-01T14:30:00Z`)
- Rust: `chrono::DateTime<Utc>` — serialize to ISO 8601 via serde
- TypeScript: ISO string from Rust, format for display with `Intl.DateTimeFormat` (no date library)
- Display: Relative time for <24h ("2 hours ago"), absolute for older (user locale format)

#### JSON Column Format

Typed in Rust via serde. Each JSON column has a corresponding struct:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnalysisResult {
    pain_points: Vec<String>,
    skills_matched: Vec<String>,
    opportunity_score: f32,
}
```

Stored as TEXT in SQLite, deserialized on read. Never store untyped JSON.

### Communication Patterns

#### Tauri Event System

| Event | Payload | Direction |
|:------|:--------|:----------|
| `generation:token` | `{ text: string, stageId: string }` | Rust → Frontend |
| `generation:complete` | `{ proposalId: number, qualityScore: number }` | Rust → Frontend |
| `generation:error` | `{ code: string, message: string, stageId: string }` | Rust → Frontend |
| `generation:stage-progress` | `{ stage: string, status: "running" \| "complete" \| "failed" }` | Rust → Frontend |
| `voice:profile-updated` | `{ profileId: number }` | Rust → Frontend |
| `safety:scan-complete` | `{ score: number, flags: string[], scanned: boolean }` | Rust → Frontend |

Frontend subscribes via `listen()` in feature-specific hooks. Always `unlisten()` on component unmount.

#### Cross-Feature Data Flow Rule

Frontend features never read each other's Zustand stores. Cross-feature data flows through:

1. **Tauri commands** (pull): Proposal editor needs voice score → `invoke("get_voice_match_score", { proposalId })`
2. **Tauri events** (push): Voice profile updated → Rust emits `voice:profile-updated` → any listening feature reacts

This ensures features remain independently testable and deployable as separate stories.

#### Zustand Store Pattern

```typescript
// One store per feature. Immer middleware on all stores.
interface ProposalStore {
  // State
  activeProposal: Proposal | null;
  generationTokens: string;
  isGenerating: boolean;

  // Actions (verb-first)
  startGeneration: (jobInput: string) => void;
  appendToken: (text: string) => void;
  stopGeneration: () => void;
  resetGeneration: () => void;
}

const useProposalStore = create<ProposalStore>()(
  immer((set) => ({
    // implementation
  }))
);

// ALWAYS use selectors — prevents unnecessary re-renders
const activeProposal = useProposalStore((s) => s.activeProposal);
const isGenerating = useProposalStore((s) => s.isGenerating);
// NEVER: const { activeProposal } = useProposalStore();
```

Rules:

- One store per feature folder. No "god store."
- Actions are methods on the store, not external functions.
- Immer middleware on all stores — immutable updates without spread syntax.
- Always use selectors for reads. Never destructure the full store.
- Cross-feature communication via Tauri events only, not store imports.

### Process Patterns

#### Error Handling Hierarchy

1. **Rust command error** → `thiserror` `AppError` enum → serialized to frontend
2. **Frontend catch** → `useTauriCommand` hook catches, maps to `AppError` type
3. **UI rendering:**
   - `recoverable: true` → inline toast notification (auto-dismiss `TOAST_ERROR_MS`)
   - `recoverable: false` → modal dialog with action button and error code
4. **Logging** → All errors logged via Tauri command to Rust `tracing` (unified log stream)

Never silently swallow errors. Never show raw error messages to the user. Every error has a code, a human message, and a recovery path.

#### Loading State Pattern

```typescript
// Request/response operations → TanStack Query
const { data, isLoading, error } = useTauriQuery("get_proposals", params);

// Streaming/event-driven → Zustand store
const isGenerating = useProposalStore((s) => s.isGenerating);
```

- TanStack Query for request/response (automatic loading, error, retry, caching). Configure `gcTime: 30 * 60 * 1000` (30 minutes) — stale query results garbage collected to prevent memory growth during long sessions.
- Zustand for streaming/event-driven (explicit `isGenerating` / `isScanning` flags). Generation tokens cleared when starting new generation.
- Skeleton UI for initial data loads. Spinner only for user-initiated actions. No full-page loaders.

#### UX Feedback Patterns

| Feedback Type | When | Implementation |
|:-------------|:-----|:---------------|
| Skeleton | Initial data load (proposals list, dashboard) | shadcn/ui Skeleton component |
| Inline spinner | User-initiated action (save, manual scan) | Small spinner next to trigger button |
| Pipeline stage indicator | Pre-generation pipeline phases | Named stage labels: "Analyzing job..." → "Selecting approach..." → "Generating..." — visible from moment user clicks Generate, not just when tokens start streaming |
| Streaming indicator | LLM generation in progress (tokens flowing) | Pulsing cursor in TipTap + progress bar showing pipeline stages |
| Toast (success) | Action completed (proposal saved, voice updated) | Auto-dismiss `TOAST_SUCCESS_MS`, bottom-right stack, max 3 visible |
| Toast (warning) | Degraded result (safety scan unavailable) | Auto-dismiss `TOAST_WARNING_MS`, includes action link |
| Inline error | Recoverable error in context | Red text below the relevant UI element |
| Modal error | Unrecoverable error | Centered modal with error code, message, and retry/dismiss buttons |

Toast implementation: shadcn/ui `Sonner` component. Bottom-right position. Stack max 3. Timing constants defined in `shared/config.ts`:

```typescript
export const TOAST_SUCCESS_MS = 3000;
export const TOAST_WARNING_MS = 5000;
export const TOAST_ERROR_MS = 8000; // recoverable errors shown as toast
```

#### Retry Pattern

- Tauri request/response commands: TanStack Query handles retries (1 retry, exponential backoff)
- LLM pipeline: Per-stage retry in Rust (1 retry, 2s backoff). Circuit breaker opens after 3 failures in 5 minutes.
- Never retry non-idempotent operations (proposal submission tracking, voice profile writes with side effects)

#### Accessibility Requirements

- All interactive elements: visible focus ring (Tailwind `focus-visible:ring-2`)
- All images and icons: `aria-label` or `alt` text
- Keyboard navigation: Tab order follows visual order. Escape closes modals/dropdowns.
- Screen reader: All status changes announced via `aria-live="polite"` regions (generation progress, toast notifications)
- Color: Never convey information by color alone. Use icons + color for status indicators.
- Minimum contrast: WCAG AA (4.5:1 for text, 3:1 for large text)
- Editor font size: Respect system font size settings. Editor-specific zoom (Cmd+/Cmd-) independent of window zoom. Minimum font size: 14px. User preference stored in `app_settings`.

### Enforcement Guidelines

#### Tooling-Enforced Rules (CI catches these)

| Rule | Tool | Config |
|:-----|:-----|:-------|
| No `unwrap()` in production Rust | Clippy | `#![deny(clippy::unwrap_used)]` |
| No `console.log/error` in committed code | ESLint | `no-console: "error"` |
| No `any` type | TypeScript | `strict: true` + `no-explicit-any` ESLint rule |
| Import ordering | ESLint | `import/order` with group config |
| No inline styles (except dynamic) | ESLint | `react/forbid-component-props` for `style` |
| Rust formatting | rustfmt | Default config, enforced in CI |
| TS/JS formatting | Prettier | Starter template config |
| Unused variables/imports | Clippy + ESLint | Default strict rules |

**Pre-commit hooks (via `lint-staged` + `husky` frontend, `cargo fmt` + `cargo clippy` backend):**

- On commit: `eslint --fix`, `prettier --write`, `cargo fmt`, `cargo clippy -- -D warnings`, **regenerate specta bindings and fail if `bindings.ts` has uncommitted changes** (prevents stale type bridge)
- On push: Full `vitest run` and `cargo test`

#### Agent Discipline Rules (require code review)

1. Follow naming conventions exactly — no "creative" alternatives
2. Use `tauri-specta` generated types — never manually define types that cross the Rust/TS boundary
3. Put feature code in the correct feature folder — no cross-feature imports except via `shared/`
4. Log all errors through the unified Rust tracing system
5. Use Zustand selectors — never destructure full store
6. Store all timestamps as ISO 8601 UTC — convert to local only for display
7. All new components must meet accessibility requirements above
8. Types start in feature, promote to shared only when second feature needs them
9. Default values defined in Rust `config.rs` only — frontend reads via `get_default_config()` Tauri command, never hardcodes its own defaults
10. CONVENTIONS.md reviewed and updated at end of each epic, not just Story 0

### Pattern Examples

#### Good Examples

```rust
// Tauri command — owned types, pub, verb-first naming
#[tauri::command]
pub async fn generate_proposal(
    app: tauri::AppHandle,
    job_input: String,
    voice_profile_id: Option<i64>,
) -> Result<Proposal, AppError> {
    // ...
}

// Internal function — borrows, pub(crate)
pub(crate) fn calculate_voice_distance(
    profile: &VoiceProfile,
    edit_diffs: &[EditDiff],
) -> Result<f32, AppError> {
    // ...
}
```

```typescript
// Zustand selector — correct
const isGenerating = useProposalStore((s) => s.isGenerating);

// TanStack Query for request/response — correct
const { data: proposals, isLoading } = useTauriQuery("get_proposals", {
  filter: "recent",
});

// Cross-feature data — correct (via Tauri command, not store import)
const { data: voiceScore } = useTauriQuery("get_voice_match_score", {
  proposalId,
});
```

#### Anti-Patterns (explicitly forbidden)

```rust
// WRONG: unwrap in command handler
let proposal = db.get_proposal(id).unwrap();

// WRONG: pub when pub(crate) suffices
pub fn internal_helper() { }

// WRONG: inline SQL in command handler
let rows = conn.execute("SELECT * FROM proposals WHERE id = ?1", params![id]);
```

```typescript
// WRONG: destructuring full store (causes unnecessary re-renders)
const { activeProposal, isGenerating } = useProposalStore();

// WRONG: cross-feature store import
import { useVoiceStore } from "@/features/voice-learning";

// WRONG: any type
const handleResponse = (data: any) => { };

// WRONG: inline style for static styling
<div style={{ padding: "16px", color: "red" }}>

// WRONG: console.log in production
console.log("proposal generated", result);

// WRONG: Rust test using TS naming style
#[test]
fn test_it_should_generate_proposal() { } // Use: test_generate_proposal_success()
```

### Additional Pattern Rules (from Elicitation Round 2)

_Findings from Failure Mode Analysis, Pre-mortem, Chaos Monkey, Stakeholder Round Table, and First Principles Analysis._

#### JSON Column Usage Criteria

Use JSON columns (`_json` suffix) only when:

- The data has variable-length or variable-structure fields (e.g., analysis results vary by model version)
- The data evolves independently of the table schema (e.g., voice parameters change as the algorithm improves)
- The data is read/written atomically as a unit, never queried by individual fields

Use relational columns when:

- The structure is fixed and known at design time
- Individual fields need to be queried, filtered, or indexed
- The data has relationships to other tables

#### Visibility Promotion Ladder (Rust)

Correct progression — start minimal, promote only when needed:

1. **Private** (default) — function/struct used only within its own module
2. **`pub(crate)`** — another module within the crate needs it
3. **`pub`** — crosses the specta/Tauri command boundary to frontend

Never skip steps. Never `pub(crate)` "just in case."

#### Shared Type Migration Procedure

When a type needs to move from a feature to `shared/types/`:

1. Move the type definition to `shared/types/{entity}.ts`
2. Update all imports across ALL features in the same PR
3. The original feature's `index.ts` does NOT re-export — clean break
4. This is always an atomic single-PR operation, never split across stories

#### Cross-Feature Data Clarification

The "always via Rust" rule applies to **runtime state** — data that changes during app execution:

- Proposal data, voice profiles, generation status, pipeline state → via Tauri commands/events

These can be shared directly via `shared/`:

- Constants, configuration defaults, type definitions, utility functions, UI primitives

#### TanStack Query vs Zustand: Cache of Record Rule

- **TanStack Query** is the cache of record for all request/response data from Tauri commands
- **Zustand** is the cache of record for streaming/event-driven state only
- Never duplicate the same data in both. If a Tauri command returns proposal data, TanStack Query owns it. If generation tokens stream in via events, Zustand owns them.
- When a command triggers a side-effect event: the command result lives in TanStack Query, the event updates Zustand. They hold different data about the same operation, not duplicates.
- **Cache invalidation after generation:** When generation completes and proposal is saved to DB (transition from Zustand streaming state to persisted data), explicitly invalidate relevant TanStack Query cache keys: `queryClient.invalidateQueries({ queryKey: ['proposals'] })`. Without this, proposals list shows stale data until next refetch.

#### Timestamp Type Enforcement

- Rust DB models: Always `String` for timestamp columns, validated as ISO 8601 on read/write via helper function
- Never `i64` for timestamps — prevents accidental Unix epoch storage
- Helper: `fn validate_iso_timestamp(s: &str) -> Result<DateTime<Utc>, AppError>`

#### Command File Headers

Every `commands/*.rs` file begins with a responsibility comment:

```rust
//! Proposal CRUD commands.
//! Handles: create, read, update, delete proposals.
//! Does NOT handle: generation pipeline (see pipeline.rs), voice analysis (see voice.rs).
```

Agents read this header before adding commands to determine correct placement.

#### Migration File Immutability

- CI check: Hash all existing migration files. Fail build if any hash changes.
- Implementation: Simple script in pre-commit that compares `sha256sum` of `db/migrations/*.sql` against committed `.migration-hashes` file.
- New migrations append to the hash file. Existing lines never change.

#### Lint Configuration as Story 0

- Lint rules, pre-commit hooks, CI pipeline, and Clippy configuration are implemented in the very first development story
- No feature code merges until lint configuration is committed and CI runs green
- This is a blocking prerequisite for all other stories

#### Cross-Platform Testing Requirement

Every story with UI changes must be tested on both macOS and Windows before marking complete. If solo developer lacks Windows hardware, use a cloud Windows VM (e.g., Azure Dev Box, GitHub Codespaces with Windows runner) for manual testing. This is not optional — WebView divergence between WebKit (macOS) and Edge WebView2 (Windows) is a known high-likelihood risk.

#### Developer Story Workflow Checklist

When an agent picks up a story, it follows this sequence:

1. Read story acceptance criteria
2. Load `CONVENTIONS.md` cheat sheet (created during Epic 0)
3. Check if feature folder has an existing reference implementation — if yes, load it as context
4. Create feature branch: `feat/{story-id}-{short-description}`
5. Implement in correct feature folder, co-locate tests
6. Run `cargo clippy -- -D warnings` and `eslint --fix`
7. Run `cargo test` and `vitest run`
8. Verify all acceptance criteria met
9. Push and create PR

#### Reference Implementation Strategy

- The first story implemented in each feature folder becomes the **reference implementation**
- It is explicitly marked in the story file as `reference: true`
- Future agents implementing stories in that feature load the reference implementation file(s) as context before writing code
- Reference implementations demonstrate all patterns: naming, file structure, test co-location, store usage, error handling, Tauri command structure
- This is the single highest-leverage consistency mechanism — agents follow concrete examples more reliably than prose rules

#### Test Infrastructure Patterns

**Test data factories:**

- Shared test fixtures live in `src-tauri/tests/fixtures/` (Rust) and `src/test-utils/` (TypeScript)
- Factory functions create default valid entities: `create_test_proposal()`, `createTestJob()`
- Override specific fields via parameters: `create_test_proposal(ProposalOverrides { quality_score: Some(0.3), ..Default::default() })`

**Mocking Tauri commands in frontend tests:**

```typescript
// src/test-utils/mockTauri.ts
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// In test file
import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);
mockInvoke.mockResolvedValue(testProposal);
```

**Encrypted test database:**

- Rust integration tests use an in-memory SQLCipher database with test passphrase
- Helper: `fn create_test_db() -> Connection` — creates encrypted in-memory DB with migrations applied
- Never use production encryption keys in tests

**Unit vs integration test boundary:**

- Unit test: Tests a single function with mocked dependencies. Lives co-located.
- Integration test: Tests a Tauri command end-to-end (command → DB → response). Lives in `tests/` directory.
- Rule: If it needs a database connection, it's an integration test.

#### Pattern Extension Process

When an agent encounters a scenario not covered by existing patterns:

1. Identify the gap (e.g., "no pattern for background polling")
2. Propose a pattern following the style of existing patterns (convention, example, anti-pattern)
3. Document the proposed pattern in the PR description
4. Pattern is reviewed by architect before merging
5. Accepted patterns are added to `CONVENTIONS.md` and architecture doc

#### Irreducible Review-Only Gaps

These consistency concerns cannot be enforced by tooling and require code review discipline:

- Correct feature folder placement for new files
- One Zustand store per feature (no duplicates)
- Command file boundary adherence
- Appropriate use of JSON vs relational columns
- Reference implementation patterns followed in new stories

These are explicitly called out so reviewers know what to check.

### Additional Pattern Rules (from Elicitation Round 3)

_Findings from Self-Consistency Validation, Comparative Analysis Matrix, Mentor and Apprentice, Graph of Thoughts, and Debate Club Showdown._

#### Pattern Authority Hierarchy

When patterns conflict or an agent is unsure, follow this precedence:

1. **Reference implementation** (concrete code in the feature folder) — highest authority
2. **CONVENTIONS.md** cheat sheet — working rules for daily development
3. **Architecture decision document** (this file) — full rationale and edge cases

Agents should load the reference implementation first. Consult CONVENTIONS.md for rules. Fall back to this document only for edge cases and rationale.

#### Serde Serialization Rule

All Rust structs that cross the specta/Tauri boundary to frontend use:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
```

No exceptions. This ensures JSON field names are `camelCase` in TypeScript without manual mapping. Applies to: command return types, command parameter types, event payloads, error structs.

#### Error Code Format

Error codes use `SCREAMING_SNAKE_CASE`:

- `LLM_TIMEOUT`, `DB_ENCRYPTION`, `VOICE_PROFILE_NOT_FOUND`, `SAFETY_SCAN_FAILED`
- Never kebab-case (`llm-timeout`) or camelCase (`llmTimeout`) for error codes
- Error codes are constants in Rust: `const LLM_TIMEOUT: &str = "LLM_TIMEOUT";`

#### Tauri Command Input Validation

- **Validate in the Rust command handler** — this is the single enforcement point
- Frontend validation is optional UX sugar only (e.g., disabling a button when input is empty)
- Never trust frontend validation as the sole check
- Validation errors return `AppError` with `recoverable: true` and a user-friendly message

```rust
#[tauri::command]
pub fn generate_proposal(job_input: String) -> Result<Proposal, AppError> {
    if job_input.trim().is_empty() {
        return Err(AppError::validation("JOB_INPUT_EMPTY", "Please paste a job posting first."));
    }
    // ...
}
```

#### Startup Error vs App Error

Two distinct error paths:

- **`StartupError`** — occurs before React mounts (DB encryption failure, corrupt config, missing dependencies). Displayed via native Tauri dialog (`tauri::api::dialog::message`). App may not be able to render UI.
- **`AppError`** — occurs during normal operation. Handled by the React error hierarchy (toast/modal).

**Startup flow (subsequent launches):** decrypt DB → **quick integrity check** (`PRAGMA quick_check` — fast B-tree check, not full page scan. Full `PRAGMA integrity_check` only on explicit user request via settings or after crash recovery detection) → **version compatibility check** (compare running app version against stored version in `app_settings` — if stored > running, show StartupError: "This database was created by a newer version. Please update the app.") → WAL checkpoint if pending → run migrations → load config → mount React. Any failure before React mount uses `StartupError`.

**Startup flow (first launch):** No DB file exists → show first-launch setup: (1) create passphrase (with strength meter), (2) enter Anthropic API key. Voice samples optional — app is functional without them. Create DB → derive key → set encryption → run initial migration (includes seed data) → load config → mount React. Skip integrity/version checks on first launch.

#### Sub-Store Pattern

Large features may split into sub-stores within their feature folder:

```text
features/proposal-editor/
  stores/
    useGenerationStore.ts    # Streaming tokens, isGenerating
    useEditorStore.ts        # TipTap content, cursor position
    useProposalMetaStore.ts  # Title, status, timestamps
```

Rules:

- Sub-stores within the same feature CAN import and read each other
- Sub-stores of different features CANNOT — cross-feature rule still applies
- All sub-stores exported from the feature's `index.ts`
- Prefer one store per feature. Split only when the store exceeds ~15 state fields or has clearly independent concerns

#### Feature index.ts Export Rules

Each feature's `index.ts` exports only its public API:

```typescript
// features/proposal-editor/index.ts

// Public — used by router and other features
export { ProposalEditorPage } from "./components/ProposalEditorPage";
export { useProposalStore } from "./stores/useProposalStore";
export type { Proposal, ProposalDraft } from "./types";

// NOT exported — internal to this feature
// ProposalCard, ProposalToolbar, useEditorKeyboard, etc.
```

If another feature needs an internal component (e.g., `ProposalCard` for dashboard), that's a signal it should move to `shared/ui/`.

#### Typed Event Name Registry

Event names are defined as typed constants — never raw strings in application code:

**Rust (source of truth):**

```rust
// src-tauri/src/events.rs
pub mod events {
    pub const GENERATION_TOKEN: &str = "generation:token";
    pub const GENERATION_COMPLETE: &str = "generation:complete";
    pub const GENERATION_ERROR: &str = "generation:error";
    pub const GENERATION_STAGE_PROGRESS: &str = "generation:stage-progress";
    pub const VOICE_PROFILE_UPDATED: &str = "voice:profile-updated";
    pub const SAFETY_SCAN_COMPLETE: &str = "safety:scan-complete";
}
```

**TypeScript (mirror):**

```typescript
// src/shared/events.ts
export const EVENTS = {
  GENERATION_TOKEN: "generation:token",
  GENERATION_COMPLETE: "generation:complete",
  GENERATION_ERROR: "generation:error",
  GENERATION_STAGE_PROGRESS: "generation:stage-progress",
  VOICE_PROFILE_UPDATED: "voice:profile-updated",
  SAFETY_SCAN_COMPLETE: "safety:scan-complete",
} as const;
```

All `app.emit()` calls use constants from `events.rs`. All `listen()` calls use constants from `events.ts`. Raw event name strings in application code are forbidden — only the registry files define them.

#### HttpClient Abstraction

All external HTTP calls (LLM API, remote config) go through a single abstraction:

```rust
// src-tauri/src/http_client.rs
pub(crate) trait HttpClient: Send + Sync {
    async fn post_json(&self, url: &str, body: &impl Serialize) -> Result<Response, AppError>;
    async fn post_streaming(&self, url: &str, body: &impl Serialize) -> Result<StreamResponse, AppError>;
}

pub(crate) struct AnthropicClient { /* reqwest::Client internally */ }
impl HttpClient for AnthropicClient { /* ... */ }

// In tests: use `mockito` crate for HTTP mocking (no separate MockHttpClient needed)
// mockito provides a local HTTP server with configurable responses
```

Benefits:

- Pipeline stages accept `&dyn HttpClient` — testable without real API calls
- Certificate pinning configured once in `AnthropicClient::new()`
- Zero-retention header (`anthropic-no-log: true`) applied in one place
- Circuit breaker wraps the client, not individual stages

#### Prompt Template Pattern

LLM prompt templates are stored as structured Rust constants, not inline strings or external files:

```rust
// src-tauri/src/pipeline/prompts/mod.rs
pub(crate) mod prompts {
    pub(crate) const JOB_ANALYSIS_SYSTEM: &str = r#"You are a job posting analyst..."#;
    pub(crate) const GENERATION_SYSTEM: &str = r#"You are a proposal writer..."#;
    pub(crate) const SAFETY_SCAN_SYSTEM: &str = r#"You are an AI detection analyst..."#;
}
```

Rules:

- System prompts are constants — compiled into binary, versionable via git
- User prompts are constructed at runtime from structured data (never string concatenation of raw user input)
- Each pipeline stage has its own prompt module file: `prompts/job_analysis.rs`, `prompts/generation.rs`
- Prompt construction functions return `Vec<Message>` (Anthropic SDK type), not raw strings

#### Voice ↔ Pipeline Interface Boundary

Voice learning and the pipeline are separate modules with an explicit interface:

```rust
// Voice module exports (consumed by pipeline):
pub(crate) fn get_voice_params(conn: &Connection, profile_id: i64) -> Result<VoiceParams, AppError>;
pub(crate) struct VoiceParams {
    pub formality_score: f32,
    pub avg_sentence_length: f32,
    pub vocabulary_tier: VocabularyTier,
    pub tone_markers: Vec<String>,
    pub structural_patterns: Vec<String>,
}

// Pipeline module exports (consumed by voice via events):
// Pipeline emits `generation:complete` event with { proposalId, qualityScore }
// Voice module listens and updates learning data — no direct function call from pipeline → voice
```

- Pipeline calls `voice::get_voice_params()` — unidirectional dependency
- Voice learns from pipeline results via Tauri events — no circular dependency
- If voice module needs generation data, it listens to events and queries the DB — never imports pipeline internals

#### Test Fixtures Import Specta Types

Frontend test fixtures must import types from specta-generated bindings, not define their own:

```typescript
// CORRECT: import specta-generated type
import type { Proposal } from "@/shared/types"; // generated by tauri-specta
const testProposal: Proposal = { id: 1, title: "Test", /* ... */ };

// WRONG: manually defined test type that might drift from Rust struct
interface TestProposal { id: number; name: string; /* wrong field name! */ }
```

This ensures test data matches the actual Rust struct shapes. When a Rust struct changes, specta regenerates types, and tests that use wrong shapes fail at compile time.

#### Accessibility: shadcn/ui Coverage

shadcn/ui already provides:

- Focus ring styles on all interactive components (Button, Input, Select, etc.)
- ARIA attributes on Dialog, DropdownMenu, Popover, Tooltip
- Keyboard navigation on all menu/dropdown components
- Screen reader labels on Checkbox, RadioGroup, Switch

Agents must manually add:

- `aria-label` on icon-only buttons (e.g., close button with just an X icon)
- `aria-live="polite"` on dynamic status regions (generation progress, toast container)
- `role="status"` on loading indicators
- Tab order management when opening/closing panels
- Skip-to-content link on main layout

#### Updated Irreducible Review-Only Gaps

These consistency concerns cannot be enforced by tooling and require code review discipline:

- Correct feature folder placement for new files
- Zustand store count per feature (one primary, sub-stores only when justified)
- Command file boundary adherence (check header comments)
- Appropriate use of JSON vs relational columns
- Reference implementation patterns followed in new stories
- Raw event name strings (should use registry constants)
- Prompt template structure (system prompts as constants, user prompts via builders)

### Additional Pattern Rules (from Elicitation Round 4)

_Findings from What If Scenarios, Security Audit Personas, Socratic Questioning, Algorithm Olympics, and Comparative Analysis (vs production Tauri apps)._

#### Prompt Template Content/Format Separation

Prompt templates separate reusable **content** from provider-specific **format**:

```rust
// Content (reusable across providers):
pub(crate) const JOB_ANALYSIS_INSTRUCTIONS: &str = "Analyze this job posting...";
pub(crate) const GENERATION_INSTRUCTIONS: &str = "Write a proposal that...";

// Format (Anthropic-specific):
pub(crate) fn format_for_anthropic(
    system: &str,
    user_context: &str,
) -> Vec<anthropic::Message> {
    // Constructs Anthropic SDK message array
}
```

If a second provider is added later, only new `format_for_*` functions are needed. Content constants are reused. Don't over-build a provider abstraction now — just keep the seam visible.

#### Prompt Injection Delimiter Specification

Job content in LLM prompts is wrapped with XML-style delimiters:

```
<job_context>
{sanitized job content here}
</job_context>
```

**Sanitization rule:** Before wrapping: (1) Normalize Unicode to ASCII equivalents (strip fullwidth characters, homoglyphs, and other encoding bypass attempts), then (2) strip any instances of `<job_context>`, `</job_context>`, `<system>`, `</system>`, and similar XML-style tags from user input. This prevents delimiter escape attacks including Unicode homoglyph bypasses.

System instructions never contain user-supplied text. Job content is always in the `user` role message, never interpolated into system prompts.

#### Job Input Source Abstraction

Pipeline consumes `ParsedJob` regardless of how the job was obtained:

```rust
pub(crate) trait JobInputSource {
    fn parse(&self, raw_input: &str) -> Result<ParsedJob, AppError>;
}

pub(crate) struct ManualPaste;
pub(crate) struct RssFeedItem;

impl JobInputSource for ManualPaste { /* ... */ }
impl JobInputSource for RssFeedItem { /* ... */ }

pub(crate) struct ParsedJob {
    pub title: String,
    pub description: String,
    pub skills: Vec<String>,
    pub budget: Option<BudgetRange>,
    pub client_info: Option<ClientInfo>,
    pub source: JobSource, // Manual, RSS
}
```

If RSS breaks or a new source is added (browser extension scrape, API), only a new `JobInputSource` implementation is needed. Pipeline is untouched.

#### Passphrase Rotation Mechanism

User can change their DB encryption passphrase:

1. Verify old passphrase (attempt decrypt)
2. Create backup of current DB file
3. Decrypt with old key
4. Derive new key from new passphrase + machine salt
5. Re-encrypt with new key
6. Verify new key works (test decrypt)
7. Delete backup only on success. Restore backup on any failure.

This is an atomic operation. Rust-side only. Exposed as a single Tauri command: `change_passphrase(old: String, new: String) -> Result<(), AppError>`.

#### Clipboard Plain-Text-Only Rule

When copying proposals to clipboard for Upwork submission:

- Output is plain text only — no HTML, no structured metadata, no hidden fields
- Strip all internal identifiers, voice profile data, quality scores before clipboard write
- Use `tauri-plugin-clipboard-manager` for clipboard access
- Never include data in clipboard that wouldn't be visible if pasted into a plain text editor

#### Command Rate Limiting

Expensive Tauri commands (LLM calls, DB writes, export operations) are rate-limited Rust-side:

- `rate_limiter.rs` enforces **business-rule rate limits only** — pipeline generation cooldown (FR-12), export frequency caps
- UI-level debounce (preventing double-click duplicates) is a **frontend responsibility** via `useDebounce` hook — not Rust-side
- Read-only commands have no rate limit
- Exact thresholds are tuning parameters — set during implementation, not architecture
- Rate limit violations return `AppError` with `code: "RATE_LIMITED"`, `recoverable: true`

#### Security Event Audit Log

Separate from debug logging. Stored in `security_events` table (never purged by log rotation):

| Event | Data Logged |
|:------|:-----------|
| API key changed | timestamp, success/fail |
| Passphrase change attempt | timestamp, success/fail (never log the passphrase) |
| Database export | timestamp, export path, integrity verification result |
| Failed decryption attempt | timestamp, error type |
| App startup | timestamp, version, integrity check result |

Queryable for user transparency: "Show me all security events" in settings.

#### Network Audit Document

To support the zero-telemetry claim, document every outbound network call:

| Destination | Purpose | Data Sent | When |
|:-----------|:--------|:----------|:-----|
| `api.anthropic.com` | LLM generation and analysis | Prompt with style parameters + job context | User-initiated generation |
| `api.anthropic.com` | Safety scanning | Generated proposal text | After generation |
| (future) Remote config endpoint | Config updates | App version, config version | On app launch, periodic |

No other outbound calls. No analytics, no crash reporting, no telemetry. Verifiable by network inspection. This list is maintained in the architecture doc and updated when new network calls are added.

#### Data Retention Policy

- Default: Keep all data forever (local storage, user owns their data)
- User controls: Delete individual proposals, bulk delete by date range, "delete all data" (wipes DB, re-initializes)
- "Delete all data" creates a fresh encrypted DB with new key derivation — no residual data
- Export before delete: always prompt user to export before bulk delete operations
- No automatic data purging — user decides what to keep

#### Timestamp Type Correction

**Corrected from earlier:** Rust models use `chrono::DateTime<Utc>` (not `String`) for type safety:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Proposal {
    pub id: i64,
    pub title: String,
    pub created_at: DateTime<Utc>,  // NOT String
    pub submitted_at: Option<DateTime<Utc>>,
}
```

- SQLite stores as TEXT (ISO 8601) — `chrono` handles serialization via `serde`
- TypeScript receives ISO string from JSON — format for display with `Intl.DateTimeFormat`
- The earlier `validate_iso_timestamp` helper is unnecessary — `chrono`'s serde integration handles validation on deserialization

#### Zustand Store Optionality

Not every feature requires a Zustand store. **Authoritative rule:** Each feature has zero or more Zustand stores based on the criteria below. TanStack Query alone is a valid and preferred choice for pure CRUD features. Decision criteria:

| Feature Has... | Use |
|:--------------|:----|
| Only request/response data (CRUD) | TanStack Query alone — no Zustand store |
| Streaming/event-driven state | Zustand store required |
| Complex local UI state (multi-step forms, editor state) | Zustand store required |
| Optimistic updates | Zustand store required |

Examples:

- `settings/` — TanStack Query only (read/write settings via Tauri commands)
- `job-queue/` — TanStack Query only (fetch jobs, update scores)
- `proposal-editor/` — Zustand required (streaming tokens, editor state)
- `voice-learning/` — TanStack Query for profile data, Zustand for active calibration session
- `dashboard/` — TanStack Query only (read-only analytics queries)

#### Test File Splitting

For large test files, split into co-located files:

- `Component.test.tsx` — integration tests (render + user interaction + Tauri mock)
- `Component.unit.test.tsx` — pure logic tests (utility functions, state calculations)

Both files live next to the source. Split only when test file exceeds ~300 lines. Don't split preemptively.

#### Voice Learning EditDiff — Architectural Decision

**Chosen approach:** Sentence-level diff with heuristic category tagging.

- Diffs operate on sentences (not characters — too noisy) using `unicode-segmentation` + patience diff algorithm
- Each diff is tagged with a proposal section category (Hook, PainPoint, Qualification, CTA, Body) via position-based heuristics
- Stored per-proposal as JSON. Aggregated across 10+ proposals to extract voice patterns.
- Detailed struct definitions, categorization heuristics, and algorithm implementation are story-level specifications — not architecture decisions

#### System Tray Pattern

Use `tauri-plugin-positioner` for tray-anchored windows:

- Tray icon shows app status: idle (default icon), generating (animated icon), error (warning icon)
- Left-click: Toggle quick-generate panel (lightweight window anchored to tray)
- Right-click: Context menu — Open main window, Preferences, Quit
- Tray icon persists when main window is closed (app runs in background)
- Global hotkey (Cmd+Shift+P) opens quick-generate panel regardless of tray interaction

#### Native OS Notification Pattern

Use `tauri-plugin-notification`. Fire notifications only when app is backgrounded:

| Event | Notification |
|:------|:------------|
| Generation complete | "Proposal ready for [Job Title]" — click opens editor |
| Safety scan: high AI detection risk | "High AI detection risk on [Job Title]" — click opens safety details |
| Export complete | "Database exported to [path]" |
| Critical update available | "Update required — [version]" |

Never fire notifications when app is in foreground (use in-app toasts instead). User can disable notification categories in settings.

#### File Dialog Pattern

Use `tauri-plugin-dialog` for system file dialogs:

| Operation | Dialog Type | Filters |
|:----------|:-----------|:--------|
| Export encrypted backup | Save dialog | `.db` extension + `.salt` file |
| Import writing samples (v1.1) | Open dialog (multi-select) | `.txt`, `.md`, `.docx` |
| Export proposals (bulk) | Save dialog | `.json`, `.csv` |

Never use custom file picker UI — always native OS dialog for security and familiarity.

**Export passphrase warning:** When exporting encrypted backup, show clear message: "This backup is encrypted with your current passphrase. You'll need this passphrase to restore it." Store optional passphrase hint (user-provided) in export metadata. On import, if decryption fails: "Wrong passphrase. This backup was created on [date]. Try the passphrase you were using at that time."

#### Window Management Rules

| View | Window Type | Rationale |
|:-----|:-----------|:----------|
| Main app (queue, editor, dashboard, settings) | Primary window with routes | Single window, tab/route navigation |
| Quick-generate panel | Separate lightweight window (NSPanel on macOS) | Minimal UI, tray-anchored, independent of main window state |
| Settings | Route in main window | Not frequent enough to warrant separate window |
| About / Update | Modal dialog in main window | Transient information |

Rules:

- Maximum 2 windows: main + quick-generate panel
- Both windows share the same Rust backend state
- Zustand stores are per-window (each window mounts its own React tree). Cross-window state sync via Tauri events through Rust.
- Quick-generate panel is the only feature that exists outside the main window

#### Tauri Version Pinning

Pin exact Tauri version in `Cargo.toml`:

```toml
[dependencies]
tauri = "=2.9.5"  # Exact version pin — do not upgrade mid-sprint
```

Tauri version upgrades are a dedicated story, never a drive-by change. Evaluate Tauri v3 as a post-MVP epic.

#### Explicit Non-Goals

These are architecturally out of scope and should never be designed for:

- Multi-user / cloud sync — this is a single-user local application
- Mobile platform — desktop only (macOS + Windows)
- Browser extension — separate product, separate architecture
- Plugin system / third-party extensions — not needed for single-user tool
- Offline LLM inference — API-only for MVP (local models are a future product decision, not architecture decision)

### Missing Patterns Identified (from Elicitation Round 5)

_These gaps were discovered through hindsight analysis — patterns that would have prevented real implementation problems._

#### Tauri Plugin Installation Pattern

When adding a new Tauri plugin:

1. Add Rust crate to `Cargo.toml` with exact version pin
2. Register plugin in `main.rs` builder chain
3. Add permissions to `capabilities/*.json`
4. Add TypeScript API package to `package.json` (if plugin has JS API)
5. Document in a comment block in `main.rs` which feature uses the plugin and why

Plugins used by this project:

| Plugin | Purpose | Feature |
|:-------|:--------|:--------|
| `tauri-plugin-clipboard-manager` | Copy proposals to clipboard | Proposal editor |
| `tauri-plugin-notification` | OS notifications when backgrounded | Pipeline, export |
| `tauri-plugin-dialog` | File save/open dialogs | Backup, import |
| `tauri-plugin-positioner` | Tray-anchored window positioning | Quick-generate panel |
| `tauri-plugin-global-shortcut` | Cmd+Shift+P hotkey | Quick-generate |
| `tauri-plugin-updater` | Auto-update mechanism | App lifecycle |

#### Dev vs Production Configuration

Environment-specific values managed via Tauri's build-time configuration:

```rust
// src-tauri/src/config.rs
pub(crate) struct AppConfig {
    pub api_base_url: String,
    pub log_level: tracing::Level,
    pub enable_devtools: bool,
}

impl AppConfig {
    pub fn load() -> Self {
        if cfg!(debug_assertions) {
            // Dev defaults
            Self {
                api_base_url: "https://api.anthropic.com".into(),
                log_level: tracing::Level::DEBUG,
                enable_devtools: true,
            }
        } else {
            // Production defaults
            Self {
                api_base_url: "https://api.anthropic.com".into(),
                log_level: tracing::Level::INFO,
                enable_devtools: false,
            }
        }
    }
}
```

- API base URL is the same for dev/prod (Anthropic has one endpoint), but the pattern supports future divergence
- Log level defaults to DEBUG in dev, INFO in prod
- DevTools enabled in dev only
- No `.env` files — configuration is compiled into the binary based on build profile

#### React Error Boundary Placement

Error boundaries prevent a single component crash from taking down the entire app:

```text
<AppErrorBoundary>              ← Catches unrecoverable errors, shows "app crashed" recovery UI
  <Layout>
    <FeatureErrorBoundary>      ← Per-feature, catches errors within one feature
      <ProposalEditorPage />
    </FeatureErrorBoundary>
    <FeatureErrorBoundary>
      <JobQueuePage />
    </FeatureErrorBoundary>
  </Layout>
</AppErrorBoundary>
```

- `AppErrorBoundary`: Top-level. Shows "Something went wrong" with "Reload" button. Logs to Rust tracing.
- `FeatureErrorBoundary`: Per-feature. Shows "This section encountered an error" with "Retry" button. Other features remain functional.
- Never wrap individual components in error boundaries — too granular, creates confusing UX.

### Document Consolidation Notes

_Meta-findings from 5 rounds of advanced elicitation on this section._

#### Current State Assessment

This Implementation Patterns section was built through 5 rounds of collaborative elicitation. It contains high-value architectural patterns alongside implementation details that belong at the story level. Before development begins:

#### Required Pre-Development Actions

1. **Create `CONVENTIONS.md`** — Extract the core rules (naming, structure, error handling, enforcement, store patterns) into a single-page cheat sheet. This becomes the primary working document agents load on every story. Created during Story 0 alongside lint configuration.

2. **Consolidate scattered patterns** — The 4 "Additional Pattern Rules" subsections should be merged into the main categorical sections (Naming, Structure, Format, Communication, Process, Enforcement). Remove "from Elicitation Round N" framing. One rule, one location.

3. **Extract implementation details to stories** — The following are story-level specs, not architecture. Move to relevant epic/story files when created:
   - EditDiff algorithm details (sentence splitting, heuristic rules, exact struct fields)
   - Prompt injection delimiter format (exact XML tags)
   - Rate limit threshold values
   - Security audit log table schema
   - HttpClient trait implementation details
   - Passphrase rotation step-by-step procedure

4. **Mark reference implementations** — The first story in each feature folder must be flagged as `reference: true`. This is the highest-leverage consistency mechanism — more effective than any written pattern.

#### Architecture Document Freeze

After Story 0 creates CONVENTIONS.md, this architecture document is **frozen**. No further additions. New patterns discovered during development go to CONVENTIONS.md only via the pattern extension process (propose in PR → architect review → add to CONVENTIONS.md). This document is the reference of record for decisions and rationale; CONVENTIONS.md is the working reference for daily implementation.

#### CONVENTIONS.md Must Include (Story 0 requirement)

In addition to extracted naming/structure/process rules, CONVENTIONS.md must include:
- State management decision flowchart (useState vs Zustand vs TanStack Query — when to use which)
- Thick/thin command boundary examples including edge cases
- Zustand store criteria table (when to create, when not to)
- Failure simulation testing patterns for integration tests (mock locked keychain, inject 429 mid-stream, simulate circuit breaker via test HTTP client)
- Each rule appears ONCE — if this architecture document states the same rule in multiple sections, use the LATEST version only. Do not carry forward superseded specifications.

#### What NOT to Add

Further elicitation rounds on this architecture document would produce diminishing returns. The patterns are comprehensive for a project of this scope. Gaps that emerge during development go to CONVENTIONS.md.

#### Eliminated Patterns

The following were removed during consolidation as over-specified or premature:

- Feature directory README files (command headers + folder names sufficient; READMEs go stale)
- CSS animation exception rule (Tailwind v4 handles all cases; use pattern extension if truly needed)
- Exact rate limit thresholds (tuning parameters, not architecture)
- Detailed ProposalSection heuristic categorization (implementation detail, not architecture)

## Project Structure & Boundaries

_Enhanced through 5-method elicitation: Red Team, Pre-mortem, Comparative Analysis, War Room, Critique and Refine._

### Complete Project Directory Structure

```text
upwork-research-agent/
├── .github/
│   └── workflows/
│       └── ci.yml                              # Future: cross-platform build matrix
├── .husky/
│   ├── pre-commit                              # eslint --fix, prettier, cargo fmt, cargo clippy
│   └── pre-push                                # vitest run, cargo test
├── .vscode/
│   └── settings.json                           # Shared editor config
├── public/                                     # Static assets (app images, icons)
├── src/                                        # ── FRONTEND (React 19 + TypeScript) ──
│   ├── main.tsx                                # React entry point
│   ├── App.tsx                                 # Root component, QueryClient, AppErrorBoundary
│   ├── router.tsx                              # Route definitions (see Routes section)
│   ├── globals.css                             # Tailwind base + global styles
│   ├── features/
│   │   ├── job-queue/
│   │   │   ├── components/
│   │   │   │   ├── JobQueuePage.tsx
│   │   │   │   ├── JobQueuePage.test.tsx
│   │   │   │   ├── JobCard.tsx
│   │   │   │   ├── JobCard.test.tsx
│   │   │   │   ├── JobScoreBadge.tsx
│   │   │   │   └── RssImportDialog.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useJobQueue.ts              # TanStack Query wrappers
│   │   │   ├── types.ts
│   │   │   └── index.ts                        # Exports: JobQueuePage, types
│   │   ├── proposal-editor/
│   │   │   ├── components/
│   │   │   │   ├── ProposalEditorPage.tsx
│   │   │   │   ├── ProposalEditorPage.test.tsx
│   │   │   │   ├── EditorToolbar.tsx
│   │   │   │   ├── GenerationProgress.tsx
│   │   │   │   ├── SafetyScanBadge.tsx
│   │   │   │   ├── QualityScoreCard.tsx
│   │   │   │   └── HookSelector.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useEditor.ts                # TipTap setup + config
│   │   │   │   ├── useGenerationStream.ts      # Listens to generation:token events
│   │   │   │   └── useProposalCommands.ts      # TanStack Query wrappers
│   │   │   ├── stores/
│   │   │   │   ├── useGenerationStore.ts       # Streaming tokens, isGenerating
│   │   │   │   └── useEditorStore.ts           # TipTap content state
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── voice-learning/
│   │   │   ├── components/
│   │   │   │   ├── VoiceLearningPage.tsx
│   │   │   │   ├── VoiceLearningPage.test.tsx
│   │   │   │   ├── VoiceProfileCard.tsx
│   │   │   │   ├── GoldenSetManager.tsx
│   │   │   │   └── VoiceMatchChart.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useVoiceProfile.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── DashboardPage.test.tsx
│   │   │   │   ├── QualityOverview.tsx
│   │   │   │   ├── CostTracker.tsx
│   │   │   │   ├── VoiceTrendChart.tsx
│   │   │   │   └── RecentProposals.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useDashboardData.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── settings/
│   │       ├── components/
│   │       │   ├── SettingsPage.tsx
│   │       │   ├── SettingsPage.test.tsx
│   │       │   ├── ApiKeySection.tsx
│   │       │   ├── PassphraseSection.tsx
│   │       │   ├── ExportSection.tsx
│   │       │   ├── SecurityEventsLog.tsx        # Post-MVP
│   │       │   └── AboutSection.tsx
│   │       ├── hooks/
│   │       │   └── useSettings.ts
│   │       ├── types.ts
│   │       └── index.ts
│   ├── shared/
│   │   ├── ui/                                 # shadcn/ui components (generated)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── sonner.tsx
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── AppErrorBoundary.tsx
│   │   │   ├── FeatureErrorBoundary.tsx
│   │   │   └── LoadingSkeleton.tsx
│   │   ├── hooks/                              # Tauri integration hooks ONLY
│   │   │   ├── useTauriCommand.ts
│   │   │   ├── useTauriQuery.ts
│   │   │   ├── useAppEvent.ts
│   │   │   └── useNativeNotification.ts
│   │   ├── lib/
│   │   │   ├── formatDate.ts
│   │   │   ├── formatCost.ts
│   │   │   └── hooks/                          # General React utility hooks
│   │   │       ├── useDebounce.ts
│   │   │       └── useKeyboardShortcut.ts
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   ├── proposals.ts                    # Shared proposal types (grouped by domain)
│   │   │   ├── voice.ts                        # Shared voice types
│   │   │   ├── pipeline.ts                     # Shared pipeline types
│   │   │   ├── errors.ts                       # AppError interface
│   │   │   └── generated/                      # tauri-specta output (DO NOT EDIT)
│   │   │       └── bindings.ts
│   │   ├── events.ts                           # Typed event name registry (TS mirror)
│   │   └── config.ts                           # Frontend constants
│   ├── test-utils/
│   │   ├── mockTauri.ts
│   │   ├── factories.ts                        # Uses specta-generated types
│   │   └── renderWithProviders.tsx
│   └── quick-generate/                         # Separate window entry point
│       ├── main.tsx
│       ├── QuickGenerateApp.tsx
│       ├── providers.tsx                       # Window-specific QueryClient + stores
│       └── components/
│           ├── QuickInput.tsx
│           └── QuickResult.tsx
├── src-tauri/                                  # ── BACKEND (Rust + Tauri v2) ──
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── build.rs                                # Tauri build script (required)
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   ├── src/
│   │   ├── main.rs                             # Tauri builder, plugin registration
│   │   ├── lib.rs                              # Crate root, module declarations
│   │   ├── config.rs                           # AppConfig (dev/prod via cfg!)
│   │   ├── errors.rs                           # AppError + StartupError (thiserror)
│   │   ├── events.rs                           # Event name constants (source of truth)
│   │   ├── rate_limiter.rs                     # Generic command debounce
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── proposal.rs                     # Proposal CRUD (<100 lines, thin wrapper)
│   │   │   ├── job.rs                          # Job queue + scoring
│   │   │   ├── pipeline.rs                     # generate_proposal, stop_generation (thin)
│   │   │   ├── voice.rs                        # Voice profile CRUD, golden set
│   │   │   ├── keychain.rs                     # API key get/set/delete
│   │   │   ├── safety.rs                       # Manual scan trigger
│   │   │   ├── settings.rs                     # Preferences, passphrase change
│   │   │   ├── export.rs                       # DB backup, proposal export
│   │   │   └── dashboard.rs                    # Analytics queries
│   │   ├── db/
│   │   │   ├── mod.rs                          # SQLCipher connection, encryption init
│   │   │   ├── models/
│   │   │   │   ├── mod.rs                      # Re-exports all model structs
│   │   │   │   ├── proposal.rs
│   │   │   │   ├── job.rs
│   │   │   │   ├── voice_profile.rs
│   │   │   │   ├── hook_strategy.rs
│   │   │   │   ├── security_event.rs               # Post-MVP — skip during MVP epics
│   │   │   │   └── app_setting.rs
│   │   │   ├── migrations/
│   │   │   │   ├── V20260201000000__initial_schema.sql
│   │   │   │   └── ...
│   │   │   ├── .migration-hashes
│   │   │   └── queries/
│   │   │       ├── mod.rs
│   │   │       ├── proposals.rs
│   │   │       ├── jobs.rs
│   │   │       ├── voice_profiles.rs
│   │   │       ├── hook_strategies.rs
│   │   │       ├── security_events.rs           # Post-MVP
│   │   │       └── dashboard.rs                # Cross-entity analytics aggregation
│   │   ├── pipeline/
│   │   │   ├── mod.rs                          # Orchestrator (cooldown + parallel/sequential)
│   │   │   ├── stages/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── job_analysis.rs
│   │   │   │   ├── voice_loading.rs
│   │   │   │   ├── hook_selection.rs
│   │   │   │   ├── generation.rs
│   │   │   │   └── safety_scan.rs
│   │   │   ├── circuit_breaker.rs
│   │   │   └── prompts/
│   │   │       ├── mod.rs
│   │   │       ├── shared.rs                   # Common fragments (output format, safety disclaimers, voice injection template)
│   │   │       ├── job_analysis.rs
│   │   │       ├── generation.rs
│   │   │       └── safety.rs
│   │   ├── voice/
│   │   │   ├── mod.rs
│   │   │   ├── profile.rs
│   │   │   ├── diff.rs
│   │   │   ├── explicit.rs
│   │   │   └── implicit.rs
│   │   ├── safety/
│   │   │   ├── mod.rs
│   │   │   └── scanner.rs
│   │   ├── job/
│   │   │   ├── mod.rs
│   │   │   ├── parser.rs                       # JobInputSource trait + ManualPaste
│   │   │   ├── rss.rs                          # RssFeed impl (XML parsing, validation)
│   │   │   └── scorer.rs
│   │   ├── http_client/
│   │   │   ├── mod.rs                          # HttpClient trait
│   │   │   └── anthropic.rs                    # Zero-retention header (cert pinning post-MVP). Tests use `mockito` crate — no mock.rs needed.
│   │   └── hooks/
│   │       ├── mod.rs
│   │       └── library.rs                      # Hook strategy logic, loads from DB
│   └── tests/
│       ├── fixtures/
│       │   ├── mod.rs
│       │   ├── proposals.rs
│       │   ├── jobs.rs
│       │   └── voice_profiles.rs
│       ├── integration/
│       │   ├── pipeline_test.rs
│       │   ├── db_test.rs
│       │   ├── commands_test.rs
│       │   └── journeys/                       # Cross-module user journey tests
│       │       └── generate_and_learn_test.rs   # Paste → generate → edit → voice update
│       └── helpers/
│           └── test_db.rs
├── package.json
├── package-lock.json
├── tsconfig.json                               # Strict mode + noUncheckedIndexedAccess
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── eslint.config.js                            # Flat config with all enforcement rules
├── prettier.config.js
├── components.json                             # shadcn/ui config
├── CONVENTIONS.md                              # Created in Story 0
├── .gitignore
└── LICENSE
```

**Note:** No `.env` files. All configuration is compile-time via `cfg!(debug_assertions)` in Rust's `config.rs`. No environment variables needed for a desktop app.

### Frontend Routes

```typescript
// src/router.tsx
const routes = [
  { path: "/",           element: <JobQueuePage /> },
  { path: "/editor/:id", element: <ProposalEditorPage /> },
  { path: "/voice",      element: <VoiceLearningPage /> },
  { path: "/dashboard",  element: <DashboardPage /> },
  { path: "/settings",   element: <SettingsPage /> },
];
```

Main window uses `react-router` (or TanStack Router if template includes it). Quick-generate window has no router — single view.

### Architectural Boundaries

#### Rust ↔ Frontend Boundary

```text
┌─────────────────────────────────────────────────────┐
│  FRONTEND (React)                                   │
│                                                     │
│  features/ ──→ shared/hooks/useTauriCommand ──────┐ │
│  features/ ──→ shared/hooks/useAppEvent ─────────┐│ │
│                                                  ││ │
└──────────────────────────────────────────────────┼┼─┘
                        Tauri invoke() / listen()  ││
┌──────────────────────────────────────────────────┼┼─┐
│  BACKEND (Rust)                                  ││ │
│                                                  ↓↓ │
│  commands/*.rs ◄──────── tauri-specta types ─────── │
│       │ (thin: <100 lines each)                     │
│       ├──→ db/queries/*.rs ──→ SQLCipher DB         │
│       ├──→ pipeline/mod.rs ──→ http_client/ ──→ API │
│       ├──→ voice/*.rs                               │
│       └──→ events.rs ──→ app.emit() ──→ Frontend    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Command file rule:** Command files are thin wrappers (<100 lines). They validate input, call a service function, return result. Business logic lives in service modules (`pipeline/`, `voice/`, `job/`, `safety/`).

#### Data Boundaries

```text
┌──────────────────────────────────────────────┐
│            SQLCipher Database                 │
│                                              │
│  proposals ──────── edit_diffs_json           │
│  jobs ──────────── analysis_json              │
│  voice_profiles ── voice_params_json          │
│  hook_strategies                              │
│  security_events                              │
│  app_settings                                 │
│                                              │
│  Accessed ONLY via db/queries/*.rs            │
│  Models defined in db/models/*.rs             │
│  Never direct SQL from commands/              │
└──────────────────────────────────────────────┘
```

#### Pipeline Internal Boundaries

```text
Phase 1 (parallel):
  job/parser.rs ──→ stages/job_analysis.rs ──┐
                                             ├──→ pipeline/mod.rs (orchestrator)
  voice/profile.rs ──→ stages/voice_loading ─┘           │
                                                         │ (cooldown check here,
Phase 2 (sequential):                                    │  NOT in rate_limiter.rs)
  stages/hook_selection.rs ◄── hooks/library.rs          │
         │                                               │
         ↓                                               │
  stages/generation.rs ──→ http_client/anthropic.rs      │
         │ (app.emit streaming tokens)                   │
         ↓                                               │
  stages/safety_scan.rs                                  │
         │                                               │
         ↓                                               │
  commands/pipeline.rs ◄─────────────────────────────────┘
  (thin: returns Result<Proposal, AppError>)
```

**Cooldown vs rate limiting distinction:**
- `rate_limiter.rs` — generic command debounce (prevents UI bugs from rapid duplicate calls)
- `pipeline/mod.rs` — generation cooldown business rule (FR-12: max 1 generation per 2 mins)

#### Voice Learning Boundaries

```text
  EXPLICIT SIGNAL                      IMPLICIT SIGNAL
  ┌──────────────┐                    ┌──────────────────┐
  │ User rates    │                    │ TipTap edits     │
  │ proposals     │                    │     │            │
  │ Golden Set    │                    │     ↓            │
  │ uploads       │                    │ voice/diff.rs    │
  └───────┼───────┘                    └─────┼────────────┘
          ↓                                  ↓
  voice/explicit.rs                   voice/implicit.rs
          └──────────┬───────────────────────┘
                     ↓
              voice/profile.rs (VoiceParams)
                     │
                     ↓ (consumed by pipeline — unidirectional)
          pipeline/stages/generation.rs
                     │
                     ↓ (events flow back for learning — no direct import)
          generation:complete event ──→ voice module listens
```

### Requirements to Structure Mapping

| FR Category | Frontend Feature | Rust Modules | DB Tables |
|:-----------|:----------------|:-------------|:----------|
| **Job Analysis (FR-1–4)** | `features/job-queue/` | `job/parser.rs`, `job/rss.rs`, `job/scorer.rs`, `commands/job.rs`, `pipeline/stages/job_analysis.rs` | `jobs` |
| **Proposal Generator (FR-5–7)** | `features/proposal-editor/` | `commands/pipeline.rs`, `pipeline/*`, `hooks/library.rs` | `proposals`, `hook_strategies` |
| **Voice Learning (FR-8–10, 16, 17)** | `features/voice-learning/` | `voice/*`, `commands/voice.rs` | `voice_profiles`, `proposals.edit_diffs_json` |
| **Safety (FR-11–13)** | `features/proposal-editor/` (SafetyScanBadge) | `safety/*`, `commands/safety.rs`, `pipeline/mod.rs` (cooldown) | (inline on proposals) |
| **Data Management (FR-14–15)** | `features/settings/`, `features/dashboard/` | `commands/export.rs`, `commands/dashboard.rs`, `db/queries/dashboard.rs` | All tables |
| **Dynamic Config (FR-18)** | `features/settings/` | `config.rs`, `hooks/library.rs` | `hook_strategies`, `app_settings` |

### Reverse Mapping: Module → FRs Impacted

_For triage: if a module breaks, these features are affected._

| Rust Module | FRs Impacted | Severity |
|:-----------|:------------|:---------|
| `db/mod.rs` (encryption) | ALL | Critical — app won't start |
| `pipeline/mod.rs` | FR-5, FR-6, FR-7, FR-11, FR-12 | Critical — core loop broken |
| `http_client/anthropic.rs` | FR-2, FR-5, FR-6, FR-7, FR-11 | Critical — no LLM access |
| `voice/profile.rs` | FR-8, FR-9, FR-10, FR-16, FR-17 | High — voice learning broken |
| `job/parser.rs` | FR-1, FR-2, FR-3 | High — no job input |
| `job/scorer.rs` | FR-4 | Medium — scoring broken, generation still works. Post-MVP: add client-fit scoring using historical outcome data. |
| `safety/scanner.rs` | FR-11 | Medium — no safety scan, generation still works |
| `hooks/library.rs` | FR-5, FR-18 | Medium — falls back to default hook. Post-MVP: effectiveness weighting from outcome tracking data. |
| `commands/keychain.rs` | ALL LLM features | High — no API key access |
| `rate_limiter.rs` | None directly | Low — UX debounce only |

### Cross-Cutting Concern Mapping

| Concern | Files |
|:--------|:------|
| **Error handling** | `errors.rs`, `shared/components/AppErrorBoundary.tsx`, `FeatureErrorBoundary.tsx`, `shared/hooks/useTauriCommand.ts` |
| **Event system** | `events.rs` (Rust), `shared/events.ts` (TS), `shared/hooks/useAppEvent.ts` |
| **Security** | `commands/keychain.rs`, `db/mod.rs`, `http_client/anthropic.rs`, `rate_limiter.rs`, `db/queries/security_events.rs` |
| **Logging** | `main.rs` (tracing init), all Rust modules (`tracing` macros) |
| **Testing** | `src/test-utils/`, `src-tauri/tests/`, co-located `*.test.tsx` |
| **Type bridge** | `shared/types/generated/bindings.ts` (specta output, DO NOT EDIT) |

### External Integration Points

| Integration | Rust Module | Protocol | Auth |
|:-----------|:-----------|:---------|:-----|
| Anthropic API | `http_client/anthropic.rs` | HTTPS + SSE | API key (Keychain) |
| OS Keychain | `commands/keychain.rs` | Native OS API | System credential store |
| File system | `commands/export.rs` + `tauri-plugin-dialog` | Native dialog | User-granted |
| Clipboard | `commands/proposal.rs` + `tauri-plugin-clipboard-manager` | Native API | App permission |
| OS Notifications | `main.rs` + `tauri-plugin-notification` | Native API | User permission |
| System tray | `main.rs` + Tauri tray API | Native API | — |

### Story 0: Template Restructure Checklist

The `dannysmith/tauri-template` ships with flat `src/components/`, `src/hooks/`, `src/stores/` directories. Story 0 restructures into the feature-sliced architecture:

1. Create `src/features/` directory with all 5 feature folders
2. Move template components into `shared/ui/` or appropriate feature
3. Move template hooks into `shared/hooks/`
4. Move template stores into appropriate feature
5. Create `src/router.tsx` with route definitions
6. Configure specta output path → `src/shared/types/generated/bindings.ts`
7. Set up lint rules, pre-commit hooks, Clippy config
8. Create `CONVENTIONS.md` cheat sheet
9. Verify: `cargo tauri dev` runs, hot reload works, all template features intact

This is a blocking prerequisite for all feature stories.

### Development Workflow

**Dev server:** `cargo tauri dev` — Vite (hot reload) + Rust (recompile on save)

**Build:** `cargo tauri build` — `.dmg` (macOS), `.msi` (Windows)

**Type generation:** `cargo test` triggers specta → `src/shared/types/generated/bindings.ts`

**Test flow:**
- `vitest run` — frontend (mocked Tauri)
- `cargo test` — Rust unit + integration (in-memory SQLCipher)
- `tests/integration/journeys/` — cross-module user journey tests
- Pre-push hook runs both

## Architecture Validation Results

_Validated through 5-method advanced elicitation: Pre-mortem Analysis, Red Team vs Blue Team, Self-Consistency Validation, First Principles Analysis, and What If Scenarios._

### Coherence Validation

**Decision Compatibility:** All technology choices verified compatible. Tauri v2.9.5 + rusqlite bundled-sqlcipher (both Rust-native), React 19 + TipTap 3.x (ProseMirror-based), Zustand v5 + TanStack Query v5 (clear ownership rules), tauri-specta + serde camelCase (auto-generated types match serialization), Argon2id + SQLCipher (key derivation feeds directly into PRAGMA key), chrono::DateTime<Utc> + SQLite TEXT (serde handles serialization). No contradictions found.

**Pattern Consistency:** Naming conventions consistent across all 4 domains (Rust snake_case, TypeScript camelCase/PascalCase, DB snake_case, events feature:action). Serde `rename_all = "camelCase"` bridges the Rust/TS gap. Error codes (SCREAMING_SNAKE_CASE) consistent with constant naming in both languages.

**Structure Alignment:** Feature-sliced frontend maps 1:1 to PRD feature categories. Rust module structure maps 1:1 to pipeline stages and domain areas. Command files are thin wrappers delegating to service modules. Cross-feature communication exclusively via Tauri events/commands.

### Requirements Coverage Validation

**Functional Requirements (18 FRs):** All covered.

| FR Category | Architectural Support | Status |
|:-----------|:---------------------|:-------|
| FR-1 to FR-4 (Job Analysis & Queue) | `job/parser.rs`, `job/rss.rs`, `job/scorer.rs`, `pipeline/stages/job_analysis.rs`, `features/job-queue/` | Covered |
| FR-5 to FR-7 (Proposal Generator) | `pipeline/*`, `hooks/library.rs`, `features/proposal-editor/`, TipTap + streaming | Covered |
| FR-8 to FR-10, FR-16, FR-17 (Voice Learning) | `voice/*`, dual-signal model, `EditDiff[]` interface, Golden Set | Covered |
| FR-11 to FR-13 (Safety & Compliance) | `safety/scanner.rs`, pipeline cooldown, clipboard plain-text-only | Covered |
| FR-14, FR-15 (Data Management) | `commands/export.rs`, encrypted backup, `features/settings/` | Covered |
| FR-18 (Dynamic Config) | Deferred to post-MVP (hardcode defaults) — explicit deferral | Covered |

**Non-Functional Requirements:** All 10 NFRs architecturally supported. Tauri's lightweight runtime addresses RAM (<300MB target vs 30-40MB baseline), startup (<2s vs <500ms baseline), and CPU (<5% backgrounded). Hybrid parallel/sequential pipeline addresses 8s generation target. SQLCipher 4.10 provides AES-256 encryption. Indexed SQLite schema supports <500ms queries at 10K proposals. Zero telemetry enforced via CSP allowlisting and network audit documentation.

### Implementation Readiness Validation

**Decision Completeness:** All critical decisions have specific version numbers. 28 conflict points resolved with good/bad examples. Enforcement split between tooling and code review is explicit. Reference implementation strategy provides highest-leverage consistency mechanism.

**Structure Completeness:** Complete directory tree with ~90 files specified, each with purpose annotation. Frontend routes defined. Rust module boundaries defined. Test locations and naming conventions defined.

**Pattern Completeness:** All potential conflict areas covered — naming (4 domains), structure (feature-sliced + command boundaries + type promotion), communication (event registry + store rules + cross-feature data flow), process (error hierarchy + loading states + retry + accessibility).

### Gap Analysis Results

**Critical Gaps Found and Resolved:**

1. **Windows compilation verification** — SQLCipher spike only validated on macOS. Added requirement for GitHub Actions CI or Windows VM verification, plus `bundled-sqlcipher-vendored-openssl` as fallback feature flag.
2. **Passphrase strength enforcement** — No minimum passphrase requirements. Added 8-character minimum enforced in Rust `set_passphrase` command with UI strength meter.
3. **Superseded rules in document** — Timestamp type (String vs chrono::DateTime), Zustand store requirement (always one vs zero-or-more), and validate_iso_timestamp helper all had superseded versions coexisting. Clarified authoritative versions inline. CONVENTIONS.md must use only final authoritative rules.

**Important Gaps Found and Resolved:**

4. **TipTap memory growth** — ProseMirror transaction history accumulates unboundedly across proposals in a session. Added rule: clear transaction history when starting new generation.
5. **Circuit breaker lacks user override** — User unable to bypass during critical deadlines. Added "Force retry" button that bypasses circuit breaker with explicit consent, logged in security events.
6. **Prompt injection Unicode bypass** — Sanitization only stripped ASCII XML tags. Added Unicode normalization step before tag stripping to prevent homoglyph attacks.
7. **Certificate pinning over-engineered for MVP** — Standard TLS sufficient for single-user desktop app calling major API. Demoted to post-MVP hardening.
8. **Rate limiter scope ambiguous** — Clarified: `rate_limiter.rs` handles business-rule rate limits only. UI debounce is frontend responsibility via `useDebounce` hook.
9. **Zustand store rule evolution** — Clarified authoritative rule: each feature has zero or more stores per criteria table. TanStack Query alone is valid and preferred for pure CRUD features.

**Nice-to-Have Gaps (documented, not blocking):**

10. **Voice learning engagement** — No mechanism to motivate continued user ratings. Architecture should support visible feedback metrics ("voice match improved from 62% to 78%") — story-level specification.
11. **Clipboard auto-clear** — Proposal text persists in clipboard after copy. Optional auto-clear after configurable timeout (default 60s) — post-MVP.
12. **Security audit log** — Valuable for user transparency but not MVP-critical. Core security (encryption, keychain) takes priority. Implement in later epic.
13. **Router choice** — "react-router or TanStack Router" not finalized. Resolved during Story 0 based on template contents.
14. **Auto-updater endpoint** — Plugin listed but server/signing strategy unspecified. Explicitly deferred alongside other post-MVP items.

### Validation Issues Addressed

All 3 self-consistency contradictions resolved:

| Contradiction | Earlier Rule | Later Rule (Authoritative) | Resolution |
|:-------------|:-----------|:--------------------------|:-----------|
| Timestamp type | `String` for timestamp columns | `chrono::DateTime<Utc>` | Superseded inline. CONVENTIONS.md uses chrono only. |
| Zustand store count | "One store per feature" | "Zero or more per criteria table" | Clarified inline with authoritative rule statement. |
| validate_iso_timestamp helper | Custom helper function | "Unnecessary — chrono serde handles validation" | Eliminated. Not included in CONVENTIONS.md. |

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped
- [x] Failure modes specified per subsystem

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed
- [x] Security architecture comprehensive (prompt privacy, zero-retention, audit log, passphrase strength)

**Implementation Patterns**

- [x] Naming conventions established (4 domains)
- [x] Structure patterns defined (feature-sliced, command boundaries)
- [x] Communication patterns specified (events, stores, cross-feature rules)
- [x] Process patterns documented (error handling, loading, retry, accessibility)
- [x] Enforcement split between tooling and review
- [x] Superseded rules resolved — single authoritative version per rule

**Project Structure**

- [x] Complete directory structure defined (~90 files)
- [x] Component boundaries established
- [x] Integration points mapped (6 external integrations)
- [x] Requirements to structure mapping complete (forward and reverse)

**Validation**

- [x] 5-method adversarial elicitation completed
- [x] All contradictions identified and resolved
- [x] Inline fixes applied to document
- [x] Gap analysis complete with priority levels

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**

- Decisions are versioned and specific — no ambiguity for implementing agents
- 28 conflict points explicitly resolved with good/bad examples
- Reference implementation strategy prevents pattern drift across stories
- Dual enforcement (tooling + review) with explicit review-only gap list
- Failure modes specified for every pipeline stage with graceful degradation
- Security architecture comprehensive including prompt privacy, passphrase strength, and Unicode-aware sanitization
- All self-consistency contradictions from 5 rounds of elicitation identified and resolved
- Fallback paths validated for every critical technology choice (SQLCipher, TipTap, template, provider)

**Areas for Future Enhancement:**

- Certificate pinning when approaching public distribution
- Router choice finalized during Story 0
- Auto-updater endpoint and signing strategy for v1.0
- Remote config protocol when FR-18 moves from deferred to active
- CI/CD cross-platform matrix when approaching v1.0
- Voice learning engagement mechanisms (story-level spec)
- Clipboard auto-clear (post-MVP UX enhancement)

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Load reference implementation before writing new code in a feature
- Consult CONVENTIONS.md (created in Story 0) as primary working reference
- Fall back to this architecture document for edge cases and rationale
- When encountering superseded rules, the later version is always authoritative

**First Implementation Priority:**

1. Clone `dannysmith/tauri-template` and run pre-commitment spikes (SQLCipher on macOS + Windows, global shortcut, TipTap streaming)
2. Story 0: Restructure into feature-sliced architecture, configure linting, create CONVENTIONS.md
3. Epic 1: Encrypted database setup (rusqlite + SQLCipher + Argon2id key derivation with passphrase strength enforcement)

### Validation Round 2: Advanced Elicitation Findings

_5 additional methods applied: Chaos Monkey Scenarios, User Persona Focus Group, Algorithm Olympics, Comparative Analysis Matrix, Socratic Questioning._

**Critical fixes applied inline:**

1. **DB startup integrity check** — Added `PRAGMA integrity_check` and version compatibility check to startup flow. Prevents corruption and downgrade scenarios.
2. **Specta sync enforcement** — Pre-commit hook now regenerates bindings and fails on uncommitted changes. Prevents stale type bridge causing runtime errors.
3. **Partial generation recovery** — Mid-stream API failures keep all tokens already emitted. Marked as "incomplete" with retry option. Never silently discard shown content.
4. **Version compatibility check** — App version stored in `app_settings`. Downgrade blocked with StartupError.

**Important fixes applied inline:**

5. **Session passphrase caching** — Derived key held in memory for session duration. Optional "remember for X hours" via OS Keychain. Secure default: always ask.
6. **Voice learning phasing** — MVP uses few-shot prompting only (2-3 sample proposals in prompt). Explicit signal in v1.1. Implicit signal (edit diffs) in v1.2. Architecture unchanged, implementation sequence updated.
7. **Pre-generation stage visibility** — Named stage indicators required during all pipeline phases before token streaming begins. User sees activity from moment they click Generate.
8. **Safety scan advisory-only** — Copy-to-clipboard never gated by safety score. Warning is prominent but advisory.
9. **Keychain locked recovery** — Specific `KEYCHAIN_LOCKED` error code with user-friendly message and automatic retry after unlock.
10. **TipTap rationale documented** — Chosen for rich editing UX (inline badges, contextual UI), not solely voice learning.
11. **Token batching as spike target** — 50ms is initial estimate, adjust based on TipTap streaming spike results.
12. **tauri-plugin-sql exclusion** — Documented why direct rusqlite chosen (plugin doesn't support SQLCipher).

**Comparative analysis insights (vs Spacedrive, AppFlowy):**

- Architecture is more thoroughly specified than comparable production Tauri apps (28 conflict points, reference implementations, pattern authority hierarchy)
- Auto-generated type bridge via tauri-specta is a genuine differentiator — most production apps use manual types
- No production Tauri app of comparable scale uses SQLCipher — reinforces importance of compilation spike
- Linux support omitted intentionally — correct for MVP target audience (Upwork freelancers on macOS/Windows)

**Socratic questioning conclusions (no changes needed):**

- Pipeline orchestrator correctly in Rust (security: prompt privacy layer must not be bypassable by frontend)
- TipTap justified over textarea (rich editing UX, not just voice learning — now documented)
- tauri-plugin-sql correctly excluded (no SQLCipher support — now documented)
- Event name manual mirror is only option (specta doesn't generate event types — noted for future migration)

### Validation Round 3: Advanced Elicitation Findings

_5 additional methods applied: Failure Mode Analysis, Time Traveler Council, Expert Panel Review, Reverse Engineering, Shark Tank Pitch._

**Critical fixes applied inline:**

1. **Salt portability fix** — Argon2id salt now randomly generated and stored alongside DB (`.salt` file), not derived from machine UUID. Fixes contradiction where architecture claimed backup portability but used machine-specific salt.
2. **Connection management specified** — `Mutex<Connection>` for writes, 2-3 read-only connections for concurrent reads. WAL mode enabled. `spawn_blocking` receives cloned read connection. rusqlite `Connection` is `!Send` — never shared across threads.
3. **Hook library seed data** — Default hooks bundled in initial migration. Empty hook table causes generation failure.

**Important fixes applied inline:**

4. **Walking Skeleton (Spike 0)** — Paste → generate → stream → copy with no infrastructure. Proves core value loop before building DB/encryption. Added to pre-commitment spikes.
5. **Token budget** — Max 25K input per generation with 3-tier compression strategy. Enforced in prompt construction.
6. **Prompt caching** — Anthropic prompt caching enabled for system prompts and few-shot examples. 50-70% input cost reduction.
7. **Cost ceiling** — Configurable monthly limit with 80% warning and 100% block. Stored in `app_settings`, enforced in pipeline.
8. **Dashboard cache table** — Pre-computed aggregates updated incrementally. Required for 10K proposal performance.
9. **Outcome tracking** — `outcome_status` enum + `outcome_updated_at` added to proposals schema. Enables response rate analysis.
10. **Prompt version tracking** — Hash stored per proposal for quality comparison across prompt iterations.
11. **TanStack Query cache invalidation** — Explicit invalidation after generation saves to DB. Prevents stale proposals list.
12. **Voice learning time decay** — Exponential decay on implicit signal. Recent edits (30 days) weighted 2x. Rolling window capped at 100 proposals.
13. **MVP priority classification** — Components classified as MVP-critical / MVP-important / post-MVP.
14. **Default values single source** — Rust `config.rs` is sole authority. Frontend reads via Tauri command, never hardcodes defaults. Added to agent discipline rules.
15. **Export integrity** — Write to temp file, atomic rename, verify backup by test-decrypt before confirming success. Salt file exported alongside DB.
16. **MVP voice input simplified** — Plain text paste for samples. File import dialog deferred to v1.1.
17. **TipTap spike expanded** — Now includes React 19 compatibility and WebView rendering parity tests.
18. **Cross-platform testing requirement** — Every UI story tested on both macOS and Windows. Cloud VM if no hardware.
19. **CONVENTIONS.md freshness rule** — Review at end of each epic, not just Story 0. Added to agent discipline.
20. **Implementation sequence updated** — Walking Skeleton as step 0 before encrypted DB setup.

**Expert panel insights:**

- *Rust systems (Elena):* Connection management and WAL mode critical for parallel pipeline stages — now specified.
- *React performance (Marcus):* Cache invalidation gap between Zustand streaming and TanStack Query persistence — now patched.
- *LLM prompt (Sarah):* Token budget and prompt caching are significant cost optimizations — now in architecture.

**Reverse engineering insights (at 100th proposal):**

- DB size at 10K proposals: ~100MB — well within SQLite/SQLCipher comfort zone.
- Dashboard aggregates need pre-computation at scale — dashboard_cache table added.
- Voice profile must track style evolution, not anchor to early writing — time decay added.
- Cost at 10K proposals without caching: ~$800. With prompt caching: ~$300. Significant enough to justify ceiling controls.

**Shark Tank insights:**

- Solo developer building 8+ subsystems — walking skeleton de-risks by proving value first.
- WebView divergence is highest-likelihood risk — cross-platform testing now mandatory per story.
- Prompt caching is the single highest-impact cost optimization — now in architecture.

### Validation Round 4: Advanced Elicitation Findings

_5 additional methods applied: Good Cop Bad Cop, Feynman Technique, Hindsight Reflection, Performance Profiler Panel, 5 Whys Deep Dive._

**Critical fixes applied inline:**

1. **Startup integrity → `quick_check`** — Full `PRAGMA integrity_check` too slow for large encrypted DBs (2-5s at 100MB). Replaced with `PRAGMA quick_check` for startup. Full check only on user request or crash recovery.
2. **Aggregatable columns extracted from JSON** — `quality_score`, `token_cost`, `outcome_status` promoted to relational columns on proposals table. Dashboard queries these directly instead of deserializing 10K JSON blobs.
3. **Auto-save during generation** — `draft_content` column persists token buffer every 2s. Unsaved drafts detected and offered for recovery on restart.

**Important fixes applied inline:**

4. **SQLCipher fallback named** — Column-level `aes-gcm` encryption as Plan B if bundled-sqlcipher fails cross-platform.
5. **TipTap fallback named** — `textarea` + `react-markdown` + `diff-match-patch` as Plan B. Voice learning code untouched.
6. **Voice learning validation gate** — A/B test at end of MVP before investing in v1.1/v1.2 infrastructure.
7. **First-launch flow specified** — Separate startup path: create DB → passphrase → API key → seed → done. Skip integrity/version checks.
8. **Proposal sections as TipTap H2 nodes** — Section type stored as node attribute. Pipeline outputs markdown with H2 sections.
9. **Undo after generation** — Full generation is single TipTap transaction. Cmd+Z undoes entire generation.
10. **WAL checkpoint strategy** — Auto-checkpoint after 100 writes or graceful shutdown.
11. **TanStack Query gcTime** — 30-minute garbage collection for stale query results.
12. **Persistent TipTap instance** — Swap content via `setContent()`, don't remount on route changes.
13. **Circuit breaker simplified for MVP** — Simple retry-once pattern. Full circuit breaker deferred to post-MVP.
14. **Architecture doc freeze** — No further additions after Story 0. New patterns go to CONVENTIONS.md only.
15. **Thick/thin edge cases documented** — DB writes always thick. Cached non-sensitive reads can be thin.
16. **CONVENTIONS.md expanded scope** — Must include state management flowchart, thick/thin examples, Zustand criteria table, and failure simulation testing patterns.

**Key insights by method:**

- _Good Cop/Bad Cop:_ Document is comprehensive but approaching length limits. Freeze after Story 0. Voice learning has 4 strategies scattered across sections — authoritative phasing now consolidated.
- _Feynman Technique:_ 3-layer state management is hardest concept for implementing agents. Decision flowchart needed in CONVENTIONS.md.
- _Hindsight Reflection:_ Full circuit breaker and event name registry were over-specified for MVP. First-launch onboarding and proposal section structure were under-specified.
- _Performance Profiler:_ `quick_check` vs `integrity_check` saves 2-5s startup. WAL checkpoint prevents data loss. Persistent TipTap saves 50-100ms per proposal switch. gcTime prevents memory growth.
- _5 Whys:_ Named concrete fallbacks for both highest-risk dependencies (SQLCipher → aes-gcm, TipTap → textarea+markdown). Voice learning needs a validation gate before scaling investment.

### Validation Round 5: Final Elicitation Findings

_5 final methods applied: Occam's Razor, Customer Support Theater, Improv Yes-And, Lessons Learned Extraction, Cross-Functional War Room._

**Simplifications applied (Occam's Razor):**

1. Security events fully deferred from MVP — marked as post-MVP in directory structure, model, query, and UI component.
2. Remote config consolidated — single clear note that all remote config references are post-MVP. MVP is local-only.
3. MockHttpClient removed — `mockito` crate used for HTTP mocking in tests. HttpClient trait kept as seam.
4. CONVENTIONS.md deduplication rule — each rule appears once, latest version only.

**UX gaps addressed (Customer Support Theater):**

5. Export passphrase warning and optional hint stored in export metadata.
6. Soft-delete for proposals — `deleted_at` column, 30-day retention, recovery view.
7. Daily cost ceiling ($2 default) alongside monthly ceiling.
8. Voice profile categories column — single profile MVP, multi-profile v1.1.
9. Editor font size — system settings respected, Cmd+/- zoom, min 14px, stored in settings.

**Post-MVP creative directions noted:**

10. Job-client fit scoring using historical outcome data (in job/scorer.rs).
11. Hook effectiveness weighting from outcome tracking (in hooks/library.rs).

**Architecture Process Learnings (from Lessons Learned Extraction):**

1. _Name your fallbacks before you need them._ Every critical dependency should have an explicit Plan B during architecture creation.
2. _Architecture documents grow — plan for the freeze._ Living docs need a freeze point. CONVENTIONS.md absorbs ongoing evolution.
3. _Test your security model's portability claims._ Security assumptions should be validated against their stated properties.
4. _MVP-critical vs MVP-important is not obvious._ Walking skeleton concept should be standard for projects with >5 subsystems.
5. _Over-specification is a real cost._ Explicit MVP/post-MVP classification prevents agents from building deferred features.
6. _Agents follow code, not prose._ Reference implementation is the highest-leverage consistency mechanism.

**Cross-Functional War Room Conclusion:**

Architecture is complete after 5 rounds of adversarial elicitation. Diminishing returns reached. Next steps: (1) Ship walking skeleton to validate core premise, (2) Create epics and stories, (3) Build. UX findings from elicitation should be extracted to `ux-design-specification.md` during epic/story creation.

### Architecture Status: COMPLETE

This document has been validated through 5 rounds of advanced elicitation (25 methods total) producing ~85 findings. All critical gaps addressed. All high-risk decisions have named fallbacks. MVP priority classification established. Architecture document frozen — future patterns go to CONVENTIONS.md only.
