# System Architecture

> Generated: 2026-02-19 | Upwork Research Agent v0.1.1 | Scan Level: Deep

## Executive Summary

The **Upwork Research Agent** is a privacy-focused desktop application that helps freelancers write high-converting Upwork proposals using AI-assisted analysis and generation. Built with **Tauri v2 + React 19 + Rust**, it runs entirely on the user's machine with encrypted local storage, zero telemetry, and manual-copy-only safety guardrails.

The application follows a **Tauri IPC Bridge** architecture: a React 19 frontend (WebView) communicates with a Rust backend through ~80+ registered invoke commands. All data is encrypted locally using SQLCipher (AES-256), API keys are stored in the OS keychain, and AI detection prevention is built into the proposal generation pipeline.

## Architecture Pattern

**Desktop Hybrid: WebView Frontend + Native Backend (Tauri IPC Bridge)**

```
┌─────────────────────────────────────────────────┐
│  WebView (React 19 + TypeScript)                │
│  ┌─────────┐  ┌─────────┐  ┌────────────────┐  │
│  │ UI Layer│  │ State   │  │ Event          │  │
│  │ 75+     │  │ Mgmt    │  │ Listeners      │  │
│  │ comps   │  │ Zustand │  │ (Tauri events) │  │
│  │         │  │ RQuery  │  │                │  │
│  └────┬────┘  └────┬────┘  └───────┬────────┘  │
│       └─────────────┴───────────────┘           │
│                     │                            │
│              invoke() / listen()                 │
├─────────────────────┼────────────────────────────┤
│  Tauri IPC Bridge   │  (~80+ commands)           │
├─────────────────────┼────────────────────────────┤
│  Rust Backend       │                            │
│  ┌──────────────────┴──────────────────────┐    │
│  │  Command Layer → Business Logic         │    │
│  │  → Database (SQLCipher) + External APIs │    │
│  └─────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| UI Framework | React | 19.1.0 | Component-based UI |
| Build Tool | Vite | 7.0.4 | Fast bundler with HMR |
| Language | TypeScript | 5.8.3 | Type safety |
| State (global) | Zustand | 5.0.11 | 3 stores: generation, settings, onboarding |
| State (server) | TanStack React Query | 5.90.20 | 12 hooks with caching + optimistic updates |
| Rich Text Editor | TipTap | 3.19.0 | Proposal editing with formatting |
| Charts | Recharts | 3.7.0 | Analytics dashboard visualizations |
| Routing | react-router-dom | 7.13.0 | View routing |
| Icons | lucide-react | 0.563.0 | Icon library |
| Date utilities | date-fns | 4.1.0 | Date formatting |
| Sanitization | DOMPurify | 3.3.1 | HTML sanitization |
| Virtualization | react-window | 2.2.6 | Large list rendering |

### Backend (Rust)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| App Framework | Tauri | 2.9.1 | Desktop app framework |
| Database | rusqlite (SQLCipher) | Platform-conditional | Encrypted local storage |
| Migrations | Refinery | 0.8 | SQL migration runner |
| HTTP Client | reqwest | 0.12 | API calls (streaming) |
| Async Runtime | tokio | 1 | Async I/O |
| Encryption | argon2 + aes-gcm | 0.5 / 0.10 | Key derivation + AES-256-GCM |
| Keychain | keyring | 3 | OS credential storage |
| Memory Safety | zeroize | 1.8 | Secure memory zeroing |
| Integrity | hmac + sha2 | 0.12 / 0.10 | HMAC-SHA256 for remote config |
| Logging | tracing + tracing-appender | 0.1 / 0.2 | Structured logging with file rotation |
| RSS | rss + scraper | 2.0 / 0.19 | Feed parsing + web scraping fallback |
| PDF | pdf-extract | 0.7 | PDF text extraction |
| Compression | flate2 + tar | 1.0 / 0.4 | Archive export/import |
| Input Safety | unicode-normalization | 0.1 | Unicode normalization |

### Testing & Quality

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Unit Tests (FE) | Vitest | 4.0.18 | 1824 tests, jsdom env |
| Component Tests | Testing Library | 16.3.2 | React component testing |
| E2E Tests | Playwright | 1.58.2 | Cross-platform E2E |
| A11y Tests | axe-core | 4.11.1 | WCAG 2.1 compliance |
| Unit Tests (BE) | cargo test | built-in | 822+ Rust tests |
| Linting (FE) | ESLint 9 | 9.39.2 | Flat config, strict TypeScript |
| Formatting | Prettier | 3.8.1 | Code formatting |
| Commit Lint | commitlint | 20.4.1 | Conventional commits |
| Git Hooks | Husky | 9.1.7 | Pre-commit, commit-msg |

## Core Components

### 1. Frontend Application (`src/`)

**Entry Point:** `App.tsx` (1796 lines) — manages view routing, app lifecycle, encryption flow, and health checks.

**View Architecture:** Tab-based navigation (Generate, History, Analytics, Settings) managed via state in `App.tsx`. No client-side router — views are conditionally rendered.

**Component Organization:**
- `src/components/` — 58 shared components (badges, modals, forms, editors)
- `src/components/ui/` — 6 Radix-inspired primitives (button, card, label, progress, radio-group, skeleton)
- `src/features/` — 4 domain feature modules (proposal-history, job-queue, voice-learning, scoring-feedback)

**State Management (Hybrid Architecture):**

| Layer | Technology | Stores/Hooks | Purpose |
|-------|-----------|-------------|---------|
| Global persistent | Zustand | 3 stores | Generation lifecycle, settings (DB-backed), onboarding |
| Server/cached | React Query | 12 hooks | Proposals, jobs, analytics with auto-caching (30s stale, 30m gc) |
| Domain logic | Custom hooks | 16 hooks | Tauri event listeners, safety analysis, auto-save, updates |
| Accessibility | React Context | 1 provider | LiveAnnouncerProvider for screen reader announcements |

### 2. Rust Backend (`src-tauri/src/`)

**Entry Point:** `lib.rs` (3000+ lines) — Tauri app builder, IPC handler registration, managed state setup.

**Command Organization** (`src/commands/`):

| Module | Commands | Domain |
|--------|----------|--------|
| `proposals.rs` | Generate, save, get, delete, revisions | Proposal CRUD |
| `export.rs` | Export archive | Data export |
| `import.rs` | Import archive | Data import |
| `hooks.rs` | Get strategies, sync remote | Hook strategies |
| `job_queue.rs` | Get queue, import RSS, analyze | Job intelligence |
| `scoring_feedback.rs` | Submit feedback | Score reporting |
| `system.rs` | Health check, settings, config | System management |
| `voice.rs` | Calibrate, get profile | Voice learning |
| `test_data.rs` | Seed test data | Development |

**Business Logic Modules:**

| Module | Purpose |
|--------|---------|
| `analysis.rs` | Job post analysis (AI extraction of needs, skills, budget) |
| `claude.rs` | Anthropic Claude API client (streaming responses) |
| `humanization.rs` | AI detection evasion engine (perplexity analysis, forbidden words) |
| `scoring.rs` | Weighted job scoring algorithm (skills match, client quality, budget) |
| `ab_testing.rs` | A/B weight-based hook strategy selection |
| `remote_config.rs` | Remote config fetching with HMAC-SHA256 verification |
| `sanitization.rs` | Unicode normalization + input validation |
| `network.rs` | CSP enforcement + network request filtering |

### 3. Database Layer (`src-tauri/src/db/`)

**15 tables** across 30 migrations (V1-V30):

| Domain | Tables | Key Relationships |
|--------|--------|-------------------|
| **Proposals** | `proposals`, `proposal_revisions` | revisions → proposals (CASCADE) |
| **Jobs** | `job_posts`, `job_skills`, `job_scores` | skills/scores → job_posts (CASCADE) |
| **User** | `user_skills` | Standalone (case-insensitive unique) |
| **Voice** | `voice_profiles`, `golden_set_proposals` | One profile per user |
| **Strategies** | `hook_strategies`, `remote_config` | 5 seed strategies + remote sync |
| **Safety** | `safety_overrides`, `encryption_metadata` | overrides → proposals (CASCADE) |
| **Config** | `settings`, `rss_imports` | Key-value with auto-update trigger |
| **Feedback** | `scoring_feedback` | feedback → job_posts (CASCADE) |

**Database Configuration:**
- SQLCipher AES-256 encryption with Argon2id key derivation
- WAL (Write-Ahead Logging) for concurrent read/write
- Foreign keys enforced (`PRAGMA foreign_keys=ON`)
- Denormalized scoring columns in `job_posts` for query performance

### 4. Security Layer

| Component | Implementation | Purpose |
|-----------|---------------|---------|
| **Encryption at rest** | SQLCipher (AES-256) | Database encryption |
| **Key derivation** | Argon2id | Passphrase → encryption key |
| **Credential storage** | OS Keychain (keyring) | API key storage |
| **Memory safety** | zeroize crate | Zero sensitive memory on drop |
| **Recovery** | AES-GCM encrypted recovery key | Database access recovery |
| **Network security** | CSP headers in tauri.conf.json | Only allows api.anthropic.com + raw.githubusercontent.com |
| **Input sanitization** | unicode-normalization | Prevent injection via Unicode tricks |
| **Log redaction** | Custom redaction layer | Strip PII/secrets from logs |
| **Remote config integrity** | HMAC-SHA256 | Verify remote config authenticity |
| **AI safety** | Perplexity analysis | Prevent AI-detectable proposals |

### 5. CI/CD Pipeline

| Workflow | Trigger | Platforms | Purpose |
|----------|---------|-----------|---------|
| `release.yml` | Version tag (`v*`) | macOS ARM64+Intel, Windows x64 | Build + sign + release |
| `e2e.yml` | PR to main/develop | macOS, Windows | E2E tests + command verification |
| `performance.yml` | PR to main | macOS, Windows | Performance benchmarks |

**Code Signing:**
- macOS: Apple Developer certificate + notarization (7 secrets)
- Windows: Authenticode via PFX + RFC 3161 timestamping
- Graceful degradation for unsigned PR builds

**Auto-Updater:**
- Tauri plugin-updater with signed `latest.json`
- Critical update flag forces mandatory install
- Endpoint: GitHub Releases

## Key Design Decisions

### 1. Tauri v2 over Electron
- **Why:** ~10x smaller bundle, native Rust performance, better security (no Node.js in backend)
- **Trade-off:** Smaller ecosystem, platform-specific WebView behavior

### 2. SQLCipher over Plain SQLite
- **Why:** All proposal data encrypted at rest (privacy requirement)
- **Trade-off:** Platform-conditional compilation, passphrase unlock on each launch

### 3. Zustand + React Query (Hybrid State)
- **Why:** Zustand for synchronous app state, React Query for async server state with auto-caching
- **Trade-off:** Two state management paradigms to learn

### 4. Manual Copy Only (No Direct Submission)
- **Why:** Safety guardrail — user reviews AI-generated proposal before copying to Upwork
- **Trade-off:** Extra friction, but prevents automated detection and maintains control

### 5. Perplexity-Based AI Detection
- **Why:** Pre-flight analysis prevents submitting AI-detectable proposals
- **Trade-off:** May false-positive on naturally formal writing; escalating humanization (3 attempts)

### 6. Event-Driven Streaming
- **Why:** Claude API streaming responses shown in real-time via Tauri events
- **Trade-off:** Complex event listener lifecycle management

## Cross-Cutting Concerns

### Accessibility (WCAG 2.1)
- ARIA tablist navigation pattern
- Skip-to-content link
- Roving tabindex for lists (`useArrowKeyNavigation`)
- Modal focus trapping (`useFocusTrap`)
- Live region announcements (`LiveAnnouncerProvider`)
- axe-core automated a11y testing

### Performance
- Virtual scrolling for long lists (react-window)
- React Query caching (30s stale, 30m GC)
- Denormalized scores in job_posts (avoid JOINs)
- Optimistic mutations (outcome updates)
- Performance benchmark suite with 10% regression tolerance

### Error Handling
- Retry with exponential backoff (proposal editor auto-save)
- Escalating humanization (3 attempts before disable)
- Draft recovery for interrupted generation sessions
- Database backup before migration

## Related Documentation

- [Source Tree Analysis](./source-tree-analysis.md) — Complete directory structure
- [Development Guide](./development-guide.md) — Setup, commands, testing
- [Component Inventory](./component-inventory.md) — UI component catalog
- [Data Models](./data-models.md) — Database schema details
- [Project Overview](./project-overview.md) — High-level project summary
- [macOS Signing Setup](./macos-signing-setup.md) — Apple certificate provisioning
- [Windows Code Signing](./windows-code-signing.md) — Windows EV signing options
