# Upwork Research Agent — Documentation Index

> Generated: 2026-02-19 | Version: 0.1.1 | Scan Level: Deep

## Project Overview

- **Type:** Desktop application (monolith)
- **Tech Stack:** Tauri v2.9.1 + React 19 + TypeScript + Rust
- **Database:** SQLCipher (AES-256 encrypted), 15 tables, 30 migrations
- **Architecture:** Tauri IPC Bridge (~80+ registered commands)
- **Status:** All 14 epics complete (87 stories implemented)

## Quick Reference

| Metric | Value |
|--------|-------|
| Frontend components | 75+ (58 shared + 17 feature + 6 primitives) |
| State management | 3 Zustand stores + 12 React Query hooks + 16 custom hooks |
| IPC commands | ~80+ registered in Rust backend |
| Database tables | 15 (30 SQL migrations) |
| Frontend tests | 1824 (Vitest) |
| Backend tests | 822+ (cargo test) |
| CI/CD workflows | 3 (release, e2e, performance) |

## Generated Documentation

### Core Documents

- [Project Overview](./project-overview.md) — What the app does, key features, security model, project status
- [Architecture](./architecture.md) — System design, tech stack, patterns, security layer, design decisions
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory structure with data flow diagram

### Reference Guides

- [Development Guide](./development-guide.md) — Prerequisites, setup, commands, testing, release process
- [Component Inventory](./component-inventory.md) — Complete UI component catalog (75+ components, hooks, stores)
- [Data Models](./data-models.md) — Database schema, all 15 tables, relationships, migration history

### Deployment & Signing

- [macOS Signing Setup](./macos-signing-setup.md) — Apple Developer certificate provisioning (7 secrets)
- [Windows Code Signing](./windows-code-signing.md) — Authenticode signing options (PFX, Azure, DigiCert)

## Existing Project Documentation

### Planning Artifacts (`_bmad-output/planning-artifacts/`)

- [PRD](../_bmad-output/planning-artifacts/prd.md) — Product requirements (validated, quality 4.5/5)
- [Architecture Decisions](../_bmad-output/planning-artifacts/architecture.md) — Original architecture decisions (steps 1-8)
- [Epics](../_bmad-output/planning-artifacts/epics.md) — Epic breakdown with requirements mapping
- [Epics & Stories](../_bmad-output/planning-artifacts/epics-stories.md) — Complete story breakdown (87 stories)
- [UX Design Specification](../_bmad-output/planning-artifacts/ux-design-specification.md) — UI patterns, design system

### Implementation Artifacts (`_bmad-output/implementation-artifacts/`)

- [Sprint Status](../_bmad-output/implementation-artifacts/sprint-status.yaml) — All 14 epics tracked
- [Quick Start Guide](../_bmad-output/implementation-artifacts/upwork-quick-start-guide.md) — Developer onboarding
- [Proposal Hook Library](../_bmad-output/implementation-artifacts/upwork-proposal-hook-library.md) — Domain knowledge
- [Solution Frameworks](../_bmad-output/implementation-artifacts/upwork-proposal-solution-frameworks.md) — Solution patterns

### App Documentation (`upwork-researcher/`)

- [README](../upwork-researcher/README.md) — App overview and release build requirements
- [CONVENTIONS](../upwork-researcher/CONVENTIONS.md) — Release management and performance baseline conventions
- [CHANGELOG](../upwork-researcher/CHANGELOG.md) — Version history
- [Accessibility Audit](../upwork-researcher/ACCESSIBILITY-AUDIT-REPORT.md) — WCAG 2.1 audit results

## Getting Started

### For Developers

1. Install prerequisites: Node.js 20+, Rust stable, VS Code with Tauri + rust-analyzer extensions
2. Clone repo and run `cd upwork-researcher && npm install`
3. Start dev mode: `npm run tauri dev`
4. Run tests: `npm run test` (frontend) or `cd src-tauri && cargo test --lib` (backend)

See [Development Guide](./development-guide.md) for full setup instructions.

### For AI-Assisted Development

When using BMAD workflows to plan new features:

1. Point the PRD workflow to this index: `docs/index.md`
2. Reference [Architecture](./architecture.md) for system design context
3. Reference [Data Models](./data-models.md) for database schema
4. Reference [Component Inventory](./component-inventory.md) for existing UI patterns

### For Code Review

1. Review [Architecture](./architecture.md) for patterns and decisions
2. Check [Source Tree](./source-tree-analysis.md) for file organization
3. Verify against [Data Models](./data-models.md) for schema changes

---

**Scan Report:** [project-scan-report.json](./project-scan-report.json) — Workflow state and metadata
