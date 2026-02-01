---
stepsCompleted: []
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# Upwork Research Agent - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Upwork Research Agent, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: User can paste a Raw Job Post URL or text content into the application
FR-2: System extracts "Client Name", "Key Skills", and "Hidden Needs" (2-3 implied client priorities beyond explicitly stated requirements)
FR-3: User can import a batch of jobs via RSS Feed URL
FR-4: System flags jobs using weighted scoring: Green (≥75% match AND ≥80 client score), Yellow (50-74% match OR 60-79% client score), Red (<50% match OR <60% client score OR 0-hire client)
FR-5: User can select a "Hook Strategy" (e.g., Social Proof, Contrarian, Immediate Value)
FR-6: System generates a 3-paragraph draft: Hook, "The Bridge" (Skills), and Call to Action
FR-7: System injects natural imperfections at rate of 1-2 per 100 words to generate human-like text patterns
FR-8: User can edit the generated draft in a rich-text editor
FR-9: System calculates "Edit Distance" between Draft vs Final
FR-10: System updates "Voice Weights" when user makes same edit type in 5+ consecutive proposals
FR-11: System runs "Pre-Flight Scan" for AI detection risk before allowing "Copy" — blocks if perplexity score >150 (configurable), displays warning with flagged sentences and humanization suggestions
FR-12: System enforces "Cool Down" (max 1 generation per 2 mins) [Phase 2 UI — backend enforcement in MVP]
FR-13: User must manually click "Copy to Clipboard" (No Auto-Apply)
FR-14: User can view "Past Proposals" history offline [Phase 2]
FR-15: User can export/backup their Local Database [Phase 2]
FR-16: Golden Set Calibration — User can upload 3-5 past successful proposals to instantly update voice profile via prompt injection within 30 seconds
FR-17: Rationalized Scoring Display — System displays confidence score (0-10) with human-readable explanation
FR-18: Dynamic Hook Configuration — System allows remote configuration updates for hook strategies without app update [Post-MVP — MVP uses bundled defaults]

### NonFunctional Requirements

NFR-1: Startup Time < 2 seconds from click to "Ready to Paste"
NFR-2: RAM Target < 300MB (max idle < 400MB)
NFR-3: CPU < 5% when app is backgrounded
NFR-4: UI Response < 100ms
NFR-5: AI Streaming Start < 1.5s
NFR-6: Full Generation < 8s
NFR-7: Data Encryption — Local database encrypted via AES-256 (SQLCipher)
NFR-8: Zero Telemetry Default — No usage data sent without explicit opt-in
NFR-9: Network Strictness — Block ALL outgoing traffic except allow-listed domains (Anthropic API)
NFR-10: Credential Storage — API Keys stored in OS System Keychain (Mac/Windows)
NFR-11: Draft Recovery — Atomic Persistence, state saved on every generation chunk, 100% draft restore on crash
NFR-12: Connectivity Handling — Full offline read access to history; graceful failure with retry on API errors
NFR-13: Safe Updates — Atomic updates with rollback capability
NFR-14: Platform Support — macOS 12+, Windows 10/11
NFR-15: Code Signing — EV Certificate for Windows (post-MVP)
NFR-16: Auto-Update — Mandatory for critical safety fixes
NFR-17: Query Performance — < 500ms for voice analysis queries on datasets up to 10K proposals
NFR-18: Security Isolation — Strict process isolation
NFR-19: Data Integrity — All modifications atomic and recoverable on crash
NFR-20: Accessibility — WCAG AA compliance, keyboard navigation, screen reader support

### Additional Requirements

**From Architecture:**
- AR-1: Starter template: `dannysmith/tauri-template` (Tauri v2 + React 19 + Vite 7 + Rust)
- AR-2: Encrypted database: rusqlite 0.38 + bundled SQLCipher 4.10
- AR-3: Key derivation: Argon2id with mandatory user passphrase (min 8 chars, strength meter)
- AR-4: LLM provider: Anthropic Claude — Sonnet 4.5 (generation), Haiku 4.5 (analysis/safety)
- AR-5: Prompt caching enabled for system prompts and few-shot examples (50-70% input token savings)
- AR-6: Token budget: Max 25K input tokens per generation with compression fallback
- AR-7: Cost ceiling: Configurable daily ($2 default) and monthly limits with 80% warning
- AR-8: Pipeline: Hybrid parallel/sequential orchestration (job analysis + voice loading parallel, then sequential hook → generation → safety)
- AR-9: Editor: TipTap 3.x (ProseMirror-based) with abstracted diff interface for voice learning
- AR-10: Streaming: Tauri events → Zustand → TipTap with 50ms token batching
- AR-11: Feature-sliced component architecture (job-queue/, proposal-editor/, voice-learning/, settings/, dashboard/)
- AR-12: Prompt privacy layer — send derived style parameters, not raw writing samples
- AR-13: Prompt boundary enforcement — XML delimiters, sanitization, no user text in system prompts
- AR-14: Network allowlisting — Tauri CSP + Rust-side domain check (dual enforcement)
- AR-15: Error handling: typed Rust `Result<T, AppError>` → structured TS errors with recoverable flag
- AR-16: State management: three-layer (useState → Zustand → TanStack Query)
- AR-17: API key storage via `keyring` crate (Rust-native OS Keychain)
- AR-18: Schema migrations via `refinery` 0.9 with seed data for default hook strategies
- AR-19: Logging via `tracing` crate with daily rotation, 7-day retention
- AR-20: Walking Skeleton (Spike 0): paste → generate → stream → copy, no infrastructure
- AR-21: Pre-commit hooks: ESLint, Prettier, cargo fmt, cargo clippy, specta binding check
- AR-22: Voice learning phasing: MVP = few-shot prompting only; v1.1 = explicit signals; v1.2 = implicit signals
- AR-23: Circuit breaker: MVP = simple retry-once per stage; post-MVP = full circuit breaker

**From UX Design:**
- UX-1: Dark mode by default (optimized for late-night work)
- UX-2: One-glance quality indicators (Green/Yellow/Red) with progressive disclosure
- UX-3: Keyboard shortcuts for power users (Cmd+Enter generate, Cmd+C copy)
- UX-4: Pipeline stage indicators visible during generation ("Analyzing job..." → "Selecting approach..." → "Generating...")
- UX-5: Milestone celebrations for voice learning progress
- UX-6: Response tracking: "Did this proposal get a response? Yes/No/Pending"
- UX-7: Expectation management in onboarding: "Takes 3-5 uses to learn your voice"
- UX-8: Progressive trust building through transparent quality metrics

### FR Coverage Map

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
