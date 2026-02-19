# Project Overview

> Generated: 2026-02-19 | Upwork Research Agent v0.1.1

## What Is This?

**Upwork Research Agent** is a secure, privacy-focused desktop application that helps freelancers write high-converting Upwork proposals using AI-assisted analysis and generation. It runs entirely on the user's machine — no cloud storage, no telemetry, no data leaving the device unless explicitly sent to the Claude API.

## What It Does

1. **Analyzes Upwork job posts** — Extracts client needs, hidden requirements, budget alignment, and skill match
2. **Scores job matches** — Weighted scoring algorithm (skills, client quality, budget) with color-coded flags
3. **Generates personalized proposals** — AI-powered drafts using the user's calibrated writing voice
4. **Prevents AI detection** — Built-in perplexity analysis with escalating humanization (3 levels)
5. **Tracks proposal outcomes** — History, analytics, and strategy effectiveness reporting
6. **Manages proposal revisions** — Rich text editing with auto-save and version history

## Technical Summary

| Attribute | Details |
|-----------|---------|
| **Type** | Desktop application (monolith) |
| **Frontend** | React 19 + TypeScript + Vite 7 |
| **Backend** | Rust + Tauri v2.9.1 |
| **Database** | SQLCipher (AES-256 encrypted SQLite), 15 tables |
| **AI Provider** | Anthropic Claude API (streaming) |
| **Architecture** | Tauri IPC Bridge (~80+ commands) |
| **State Management** | Zustand (3 stores) + React Query (12 hooks) + 16 custom hooks |
| **UI Components** | 75+ React components across 4 feature modules |
| **Tests** | 1824 frontend (Vitest) + 822 backend (cargo test) + Playwright E2E |
| **Version** | 0.1.1 |
| **Repository** | Monolith with BMAD planning framework |

## Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| Job Analysis | AI extraction of needs, skills, budget from job posts | Complete |
| Job Scoring | Weighted match scoring with color flags (green/yellow/red) | Complete |
| RSS Import | Batch import from Upwork RSS feeds with web scraping fallback | Complete |
| Proposal Generation | Streaming AI generation with hook strategies | Complete |
| Voice Learning | Writing style calibration (golden set + quick calibration) | Complete |
| AI Safety | Perplexity analysis + forbidden words + escalating humanization | Complete |
| Rich Text Editor | TipTap editor with formatting, auto-save, and revision history | Complete |
| Proposal History | Infinite-scroll list with search, filters, and outcome tracking | Complete |
| Analytics Dashboard | Charts and tables for strategy effectiveness and weekly activity | Complete |
| Database Encryption | SQLCipher + Argon2id key derivation + recovery key | Complete |
| Auto-Updates | Signed updates with critical flag for mandatory install | Complete |
| Remote Config | Dynamic hook strategy updates with HMAC verification | Complete |
| A/B Testing | Weight-based strategy selection with outcome tracking | Complete |
| Accessibility | WCAG 2.1 compliance (skip links, focus traps, screen reader support) | Complete |

## Security Model

- **Zero telemetry** — No usage data collected
- **Local-only storage** — All data encrypted with SQLCipher (AES-256)
- **OS keychain** — API keys stored in system credential manager
- **Manual copy only** — No direct Upwork submission; user reviews and copies manually
- **CSP enforced** — Only allows connections to api.anthropic.com and raw.githubusercontent.com
- **Log redaction** — PII and secrets stripped from all log output
- **Signed updates** — Update integrity verified via Tauri signing keys

## Project Status

**All 14 epics complete** (87 stories implemented):
- Epics 0-1: Walking Skeleton + Core Features
- Epic 2: Database Encryption + Security
- Epic 3: AI Safety + Detection Prevention
- Epics 4a-4b: Job Intelligence + RSS Import
- Epic 5: Voice Learning + Calibration
- Epic 6: Rich Text Editing + Revisions
- Epic 7: Proposal History + Analytics
- Epic 8: Accessibility + Performance
- Epic 9: Auto-Updates + Code Signing
- Epic 10: Remote Config + A/B Testing

## Documentation Navigation

| Document | Purpose |
|----------|---------|
| [Architecture](./architecture.md) | System design, tech stack, patterns, decisions |
| [Source Tree](./source-tree-analysis.md) | Annotated directory structure |
| [Development Guide](./development-guide.md) | Setup, commands, testing, release process |
| [Component Inventory](./component-inventory.md) | UI component catalog |
| [Data Models](./data-models.md) | Database schema, tables, relationships |
| [macOS Signing](./macos-signing-setup.md) | Apple certificate provisioning |
| [Windows Signing](./windows-code-signing.md) | Windows code signing options |
