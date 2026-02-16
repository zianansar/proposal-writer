---
stepsCompleted: [1, 2, 3]
elicitationEnhanced: true
elicitationRounds: 6
storiesGenerated: 87
totalMethodsApplied: 30
elicitationMethodsRound1:
  - Pre-mortem Analysis
  - Cross-Functional War Room
  - Challenge from Critical Perspective
  - First Principles Analysis
  - Stakeholder Round Table
elicitationMethodsRound2:
  - Self-Consistency Validation
  - Failure Mode Analysis
  - 5 Whys Deep Dive
  - Critique and Refine
  - Architecture Decision Records
elicitationMethodsRound3:
  - Tree of Thoughts
  - Reverse Engineering
  - What If Scenarios
  - User Persona Focus Group
  - Socratic Questioning
elicitationMethodsRound4:
  - Red Team vs Blue Team
  - Comparative Analysis Matrix
  - Thesis Defense Simulation
  - Meta-Prompting Analysis
  - Hindsight Reflection
elicitationMethodsRound5:
  - Code Review Gauntlet
  - Thread of Thought
  - Security Audit Personas
  - Chaos Monkey Scenarios
  - Occam's Razor Application
elicitationMethodsRound6:
  - Shark Tank Pitch
  - Performance Profiler Panel
  - Lessons Learned Extraction
  - Rubber Duck Debugging Evolved
  - Reasoning via Planning
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# Upwork Research Agent - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Upwork Research Agent, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Epic Structure Refinements (Advanced Elicitation Applied)

**Methodology - Round 1:** Five elicitation methods applied to stress-test and refine epic structure:
1. **Pre-mortem Analysis** — Identified failure modes (Epic 1 scope creep, performance as afterthought, vague voice learning)
2. **Cross-Functional War Room** — PM/Architect/Dev perspectives revealed Epic 1 needed splitting, performance must be embedded
3. **Challenge from Critical Perspective** — Devil's advocate challenged Walking Skeleton value, Epic 2 sequencing, voice learning feasibility
4. **First Principles Analysis** — Rebuilt epic sequence from core truth: "paste job → personalized proposal" with safety as trust-builder
5. **Stakeholder Round Table** — Analyst/UX/Architect/Dev/SM aligned on epic sizing consistency and user journey mapping

**Key Changes from Round 1:**
- **Split Epic 1** into "Epic 1: Basic Persistence" (unencrypted, fast) and "Epic 2: Security & Encryption" (adds protection without breaking functionality)
- **Moved Safety to Epic 3** — Trust must be built early, before job scoring. Users won't adopt without AI detection protection.
- **Redistributed Performance** — NFR-1 through NFR-17 embedded as acceptance criteria across Epics 0-6, not a separate "polish" epic
- **Clarified Voice Learning Scope** — Epic 6 is MANUAL calibration (few-shot prompting + explicit signals). v1.1/v1.2 add automation.
- **Added MVP Scoping** — 15 FRs in MVP (Epics 0-6, 8), 3 FRs Post-MVP (Epics 7, 9, 10)
- **Epic Sizing Consistency** — Epic 0 = 3-5 stories, Epic 1 = 8-12 stories, Epic 4 = 10-15 stories (no more 20+ story mega-epics)
- **User Journey Sequencing** — Epic order now follows first-time user path: validate → persist → secure → trust → enhance

**Methodology - Round 2:** Five validation methods applied to ensure epic structure is production-ready:
1. **Self-Consistency Validation** — Compared 3 independent sequencing approaches (Risk-First vs User Journey vs Value Delivery). User Journey won 4/5 criteria.
2. **Failure Mode Analysis** — Systematically identified how each epic could fail, added critical mitigations (migration safety, performance targets, testing strategy)
3. **5 Whys Deep Dive** — Validated root causes for epic splits and sequencing decisions (trust before optimization, strategy before refinement)
4. **Critique and Refine** — Identified 6 improvements: handoff clarity, migration safety, optional Epic 4 split, Epic 8 scope refinement, testing strategy, Post-MVP prioritization
5. **Architecture Decision Records** — Documented 3 critical decisions: SQLite→SQLCipher migration strategy, distributed NFRs vs separate epic, voice learning phasing

**Refinements from Round 2:**
- **Epic 0 → 1 Handoff Documented** — Epic 1 builds ON Epic 0 codebase (not replaces). Core components reused.
- **Epic 2 Migration Safety Protocol** — 6-step migration procedure: backup → atomic transaction → verification → user confirmation → rollback plan → testing
- **Epic 4 Optional Split** — If epic grows beyond 15 stories, can split into 4a (Input & Extraction) and 4b (Scoring & Queue)
- **Epic 8 Scope Breakdown** — Clarified 7 distinct concerns: theme system, keyboard nav, screen reader, pipeline indicators, onboarding, memory optimization, logging
- **Testing Strategy Added** — E2E test suite in Epic 8 covering full user journeys, cross-platform, accessibility, performance validation
- **Post-MVP Prioritization** — Epic 7 (History - high demand) → Epic 9 (Deployment - distribution) → Epic 10 (Dynamic Config - enhancement)

**Methodology - Round 3:** Five final validation methods before story creation:
1. **Tree of Thoughts** — Explored 3 story breakdown approaches (Feature-Based vs User Journey vs Risk-Layered). Selected hybrid: user journey with risk spikes.
2. **Reverse Engineering** — Worked backwards from "MVP shipped to 10 beta users." Identified Epic 4 (Job Intelligence) is optimization, not critical path. Can be deferred if timeline pressure.
3. **What If Scenarios** — Explored 5 contingency scenarios (safety blocks 80%, migration fails, Epic 4 balloons, Golden Set fails, Epic 0 takes 1 week). Added contingency stories.
4. **User Persona Focus Group** — 3 freelancer personas (Sarah/Marcus/Priya) validated priorities: speed > transparency > calibration. Epic 4 needs scoring breakdown UI. Golden Set > gradual learning for low-volume users.
5. **Socratic Questioning** — Questioned all assumptions. Revealed: Epic 0 can be console-based, Epic 2 can encrypt proposals-only, Epic 4/5 can run parallel, Epic 6 edit distance is v1.1 not MVP, Epic 8 is essential not polish.

**Refinements from Round 3:**
- **Epic 0 Scope Flexibility** — Console output acceptable if streaming UI takes >3 days. Hard time-box at 5 days max.
- **Epic 2 Scope Options** — Full scope: encrypt entire DB. Reduced scope: encrypt proposals only (defer jobs/settings to v1.1).
- **Epic 3 Contingency Stories** — Safety threshold config, override UI, improved humanization suggestions, one-click re-humanization.
- **Epic 4 Transparency Requirements** — Scoring breakdown UI showing weights, "Why Yellow?" explanations per FR-17.
- **Epic 4/5 Parallel Execution** — No hard dependencies between Job Intelligence and Hook Selection. Can run simultaneously.
- **Epic 4 Split Trigger** — If stories exceed 12 (not 15), split immediately into 4a/4b.
- **Epic 5 Quick Calibration Alternative** — 5-question survey instead of Golden Set upload for users without past proposals.
- **Epic 6 MVP Simplification** — Remove FR-9 (edit distance) from MVP, defer to v1.1. Manual voice adjustments only.
- **Epic 8 Renamed** — "Essential UX & Accessibility" (was "UX Polish") — clarifies it's MVP-critical, not optional.
- **Story Breakdown Strategy** — User journey with risk spikes, not pure feature decomposition.

**Methodology - Round 4:** Five adversarial and reflective validation methods:
1. **Red Team vs Blue Team** — Adversarial attack found 6 vulnerabilities: Epic 0 waste, Epic 1→2 data loss risk, Epic 3 false positives, Epic 4 bad advice, Epic 5 privacy fears, Epic 8 too late. Hardened with skip criteria, export JSON, adaptive threshold, feedback loops, privacy UX, dark mode in Epic 1.
2. **Comparative Analysis Matrix** — Scored Epic 6 options (Manual vs Automated vs Hybrid voice learning). Manual won 6.85/10. Scored Epic 4 split options — split upfront won 7.75/10 vs single epic 5.65/10.
3. **Thesis Defense Simulation** — Defended epic structure against Product/Engineering/Business committee. Challenges: hidden needs accuracy, encryption stack risk, timeline optimism. Refinements: add user segmentation, encryption spike, 20% timeline buffer.
4. **Meta-Prompting Analysis** — Analyzed entire epic design methodology. Strength: 20 methods prevented groupthink. Weakness: zero external validation (no user testing, no competitive analysis). Missing cost/benefit and competitive analysis methods.
5. **Hindsight Reflection** — Imagined 6 months post-launch. What went right: Epic 0 worth it, Epic 3 built trust, Epic 4 split essential, manual voice worked. What went wrong: Epic 2 migration 40% fail rate, Epic 3 threshold too sensitive, Epic 5 privacy UX confusing, Epic 8 too late, RSS broke. Wished for: encryption spike, beta test after Epic 3, keyboard nav earlier, RSS fallback.

**Refinements from Round 4:**
- **Epic 0 Skip Criteria** — If 5/5 manual test proposals pass AI detection, skip Epic 0 and start with Epic 1 (saves 2-3 days).
- **Epic 1 Critical Additions** — (1) Dark mode basic CSS (from Hindsight: dev team needs it daily, ensures MVP ships with dark mode), (2) Encryption stack spike (from Thesis Defense: de-risk Epic 2), (3) Export to JSON (from Red Team: manual backup before migration).
- **Epic 2 Default Threshold Adjusted** — Change from 150 to 180 based on Hindsight data (60% flagged at 150).
- **Epic 3 Critical Additions** — (1) Core keyboard shortcuts (Cmd+Enter, Cmd+C, Tab nav) moved from Epic 8 to Epic 3 (from Hindsight: early adopters are power users), (2) Adaptive threshold learning (from Red Team: if user overrides 3+, auto-adjust up).
- **Epic 4 Split NOW** — Don't wait for growth. Split into Epic 4a (Input & Extraction, 6-8 stories, 1 week) + Epic 4b (Scoring & Queue, 8-10 stories, 1.5-2 weeks) UPFRONT (from Comparative Matrix + Hindsight).
- **Epic 4b Contingencies** — (1) RSS fallback to web scraping (from Hindsight: Upwork blocks RSS), (2) Report bad scoring feedback loop (from Red Team).
- **Epic 5 Privacy UX** — Change from "Privacy layer" to "Proposals never leave your device" with visual indicator (from Red Team).
- **Beta Testing Gate** — Mandatory pause after Epic 3 for user validation with 5-10 users, 1 week feedback cycle before Epic 4-6 (from Hindsight + Meta-Prompting).
- **Timeline Realism** — 10-12 weeks (not 8-10), includes 20% buffer for realistic estimation (from Thesis Defense).
- **Missing Validations** — Need external validation: user testing, competitive analysis, cost/benefit per epic (from Meta-Prompting).

**Methodology - Round 6:** Five final business viability and technical feasibility methods:
1. **Shark Tank Pitch** — Adversarial investor panel challenged timeline realism (87 stories in 10-12 weeks = unrealistic with 2 devs), Epic 4b deferral (breaks FR-4 promise), Epic 8 sequencing (onboarding should be Epic 1, not Epic 8), scope growth (added 11 stories Round 5, only deferred 1). Exposed underestimated story sizing (E2E tests = 24-32 hours, not 8-16).
2. **Performance Profiler Panel** — Database/Frontend/DevOps experts found performance bottlenecks: Story 1.4 loads full generated_text for 100 proposals (needs index + query optimization), Story 2.3 migration method unclear (ATTACH DATABASE needed), Story 0.3 streaming causes 20 re-renders/sec (needs token batching), Story 5.4 voice analysis has no performance target, Story 4b.7 RSS import blocks UI for 100 seconds (needs background processing).
3. **Lessons Learned Extraction** — Retrospective identified what worked (Epic 1/2 split, distributed NFRs, Round 4 Hindsight predictions, Round 5 Security Audit), what didn't (Epic 0 might be throwaway work, Epic 4 split still confusing, Epic 8 onboarding too late, no cost/benefit analysis), what surprised (11 security stories added, accessibility is 15-20% of MVP effort), lessons learned (onboarding/logging/tests are infrastructure not polish, beta gate after Epic 3 is critical, Epic 4a alone is weak).
4. **Rubber Duck Debugging Evolved** — Simple/Detailed/Technical/Aha ducks found implementation gaps: Story 2.3 atomic transaction unclear (SQLite can't span databases), Story 2.7 password forgotten = permanent data loss (needs stronger warning), Story 4a.9 truncation might cut mid-sentence (preserve boundaries), Story 4a.9 XML escaping not specified, Story 5.8 parallel loading not clear in AC.
5. **Reasoning via Planning** — Reverse-engineered optimal path to MVP, identified three launch tiers: (1) Minimal MVP (Epic 0-1-2-3-5 + basic Epic 8, 6-7 weeks), (2) Full MVP (add Epic 4 + Epic 6, 10-11 weeks), (3) Polished MVP (add full Epic 8, 12-14 weeks). Clarified Epic 4 is optional for Minimal but REQUIRED for Full MVP to fulfill FR-4 promise.

**Refinements from Round 6:**
- **Timeline Adjusted** — 12-14 weeks for Polished MVP (not 10-12), accounting for 10-story scope growth from Round 5 and realistic story sizing.
- **Three Launch Tiers** — (1) Minimal MVP: 6-7 weeks (Epic 0-1-2-3-5 + onboarding/logging), (2) Full MVP: 10-11 weeks (add Epic 4 + Epic 6), (3) Polished MVP: 12-14 weeks (add full accessibility + E2E tests). Strategic flexibility based on market pressure.
- **Epic 4 Decision** — Epic 4a+4b MUST ship together OR cut Epic 4 entirely from MVP. Deferring Epic 4b breaks FR-4 promise and undermines user trust. If shipping Full MVP, Epic 4 is non-negotiable.
- **Epic 8 Critical Resequencing** — Move Story 8.5 (Onboarding Flow) to Epic 1 as Story 1.15. Move Story 8.8 (Logging Infrastructure) to Epic 1 as Story 1.16. Cannot ship beta test without first-launch experience.
- **Story Sizing Realism** — 8-hour stories (schema, basic UI), 16-hour stories (migration, scoring, voice analysis), 24-32 hour stories (E2E tests, accessibility audit, encryption spike). Story 8.9 E2E test suite revised to 24-32 hours.
- **Performance Targets Added** — Story 1.4 (query optimization: exclude generated_text, index on created_at), Story 5.4 (calibration <2s), Story 4b.7 (background processing for RSS import), Story 4b.9 (index on overall_score).
- **Implementation Clarifications** — Story 2.3 (ATTACH DATABASE method for atomic migration), Story 2.1 (stronger password warning: data permanently unrecoverable), Story 4a.9 (truncate at sentence boundaries + XML escaping), Story 5.8 (parallel loading clarified).
- **Parallel Execution Strategy** — After Epic 3 + beta testing, run Epic 4/5/6 in parallel with 3-person team for 2-2.5 weeks.

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

**MVP Functional Requirements:**
- **FR-1** (Job paste/URL input) → Epic 0 (basic), Epic 1 (persistent) [MVP]
- **FR-2** (Extract client name, skills, hidden needs) → Epic 4a [MVP]
- **FR-3** (RSS feed batch import) → Epic 4b [MVP — can defer to post-MVP]
- **FR-4** (Weighted scoring with Green/Yellow/Red flags) → Epic 4b [MVP — can defer to post-MVP]
- **FR-5** (Hook strategy selection) → Epic 5 [MVP]
- **FR-6** (3-paragraph generation: Hook, Bridge, CTA) → Epic 0 (basic), Epic 1 (persistent) [MVP]
- **FR-7** (Natural imperfections injection) → Epic 3 [MVP]
- **FR-8** (Rich text editor) → Epic 6 [MVP]
- **FR-10** (Voice weight updates — manual only in MVP) → Epic 6 [MVP]
- **FR-11** (Pre-flight AI detection scan) → Epic 3 [MVP]
- **FR-12** (Cooldown/rate limiting) → Epic 3 [MVP]
- **FR-13** (Manual copy to clipboard) → Epic 0, Epic 1 [MVP]
- **FR-16** (Golden Set calibration) → Epic 5 [MVP]
- **FR-17** (Rationalized scoring display) → Epic 4b [MVP — can defer to post-MVP]

**v1.1 Functional Requirements (deferred from MVP):**
- **FR-9** (Edit distance calculation) → v1.1 [Enables automated voice learning]

**Post-MVP Functional Requirements:**
- **FR-14** (Past proposals history) → Epic 7 [POST-MVP]
- **FR-15** (Database export/backup) → Epic 7 [POST-MVP]
- **FR-18** (Dynamic hook configuration) → Epic 10 [POST-MVP]

**All 18 Functional Requirements Mapped ✅**
**MVP: 14 FRs | v1.1: 1 FR | Post-MVP: 3 FRs**

## Sprint Planning Recommendations

**Based on 6 rounds of Advanced Elicitation (30 methods applied), here are critical insights for sprint planning:**

### **Timeline & Sizing**
- **Polished MVP Timeline:** 12-14 weeks for 9 epics (Epic 0-3, 4a, 4b, 5-6, 8) — realistic estimate accounting for Round 5 scope growth and Round 6 sizing analysis
- **Full MVP Timeline:** 10-11 weeks (Epic 0-6, basic Epic 8 infrastructure only)
- **Minimal MVP Timeline:** 6-7 weeks (Epic 0-3, 5, basic onboarding + logging)
- **Story Count:** 87 stories total (increased from 78 after Round 5 security hardening)
- **Team Size:** Minimum 2 developers for sequential path, 3 developers enables parallel Epic 4/5/6 execution (saves 2-3 weeks)
- **Story Sizing:** 8-hour stories (schema, basic UI), 16-hour stories (migration, scoring), 24-32 hour stories (E2E tests, accessibility audit)
- **Beta Testing Gate:** Mandatory pause after Epic 3 for user validation (5-10 users, 1 week feedback) before Epic 4-6

### **Three Launch Tiers (Strategic Decision Framework)**

**From Round 6 Reasoning via Planning:** Three distinct MVP scopes offer strategic flexibility based on market pressure and timeline constraints:

**1. Minimal MVP (6-7 weeks) — Core Value Proof**
- **Epics:** 0, 1, 2, 3, 5, 8 (Stories 8.5 Onboarding + 8.8 Logging only)
- **Value Delivered:** Paste job → generate personalized proposal → safety check → copy to clipboard (with encryption)
- **What's Missing:** No job intelligence (Epic 4), no rich editor (Epic 6), no full accessibility (Epic 8 complete)
- **Use Case:** Rapid market validation, MVP in 6-7 weeks, beta test with early adopters
- **Risk:** Doesn't fulfill FR-4 (job scoring) promise from PRD — may disappoint users expecting full feature set

**2. Full MVP (10-11 weeks) — PRD Promise Fulfillment**
- **Epics:** 0, 1, 2, 3, 4 (4a+4b merged), 5, 6, 8 (basic infrastructure only)
- **Value Delivered:** All core features from PRD including job intelligence (FR-4 weighted scoring), rich editor for refinement
- **What's Missing:** Full accessibility (screen reader, WCAG AA audit), comprehensive E2E test suite
- **Use Case:** Production launch with all promised features, meets user expectations from PRD
- **Parallel Execution:** After Epic 3 + beta testing, run Epic 4/5/6 in parallel with 3-person team (2-2.5 weeks for all three)
- **Recommendation:** This is the MINIMUM for production launch without breaking trust (from Round 6 Shark Tank)

**3. Polished MVP (12-14 weeks) — Production-Ready with Quality**
- **Epics:** All 9 MVP epics complete (0-3, 4a, 4b, 5, 6, 8 full)
- **Value Delivered:** Full PRD features + accessibility compliance (WCAG AA) + comprehensive testing + logging infrastructure
- **What's Missing:** Nothing for MVP scope (Post-MVP features in Epic 7, 9, 10)
- **Use Case:** Professional production launch, ready for broad distribution, enterprise-friendly
- **Recommendation:** Required if targeting accessibility-conscious users or enterprise adoption

**Decision Criteria:**
- Choose **Minimal** if: Timeline pressure (ship in <8 weeks), testing concept only, small beta group (<20 users)
- Choose **Full** if: Need to fulfill PRD promises, launching to early adopters (100+ users), have 10-11 weeks
- Choose **Polished** if: Targeting broad market, need accessibility compliance, have 12-14 weeks, want comprehensive test coverage

**CRITICAL NOTE (from Round 6 Shark Tank):** If choosing Full or Polished MVP, Epic 4a+4b MUST ship together. Deferring Epic 4b breaks FR-4 promise and undermines user trust. If timeline doesn't allow Epic 4, ship Minimal MVP instead and defer job intelligence to v1.1.

### **Epic Sequencing (Critical Path)**
1. **Epic 0** (2-3 days) — Validate concept **[Can skip if manual tests pass]**
2. **Epic 1** (1.5 weeks) — Add persistence + dark mode + encryption spike
3. **Epic 2** (3-5 days) — Add full encryption **[MUST immediately follow Epic 1]**
4. **Epic 3** (5-6 days) — Build trust with safety + core keyboard shortcuts
5. **BETA TESTING GATE** — Pause for user validation (5-10 beta users, 1 week feedback cycle)
6. **Epic 4a + Epic 5 in parallel** (1 week each) — Job extraction + Hook selection **[NO hard dependencies]**
7. **Epic 4b** (1.5-2 weeks) — Job scoring + queue **[Can defer to post-MVP if timeline pressure]**
8. **Epic 6** (4-5 days) — Editor for refinement
9. **Epic 8** (1-1.5 weeks) — Essential UX (theme system, full accessibility, onboarding)
10. **Post-MVP:** Epic 7 → Epic 9 → Epic 10

### **Critical Decision Points**
- **Pre-Epic 0:** If 5/5 manual test proposals pass AI detection, skip Epic 0 entirely and start with Epic 1
- **Epic 0:** If >3 days, accept console-based spike (no streaming UI)
- **Epic 1:** Must include: dark mode basic CSS, encryption stack spike, export to JSON
- **Epic 2:** If timeline pressure, encrypt proposals-only (defer jobs/settings to v1.1)
- **Epic 3:** Must include core keyboard shortcuts (Cmd+Enter, Cmd+C, Tab nav) — don't defer to Epic 8
- **After Epic 3:** MANDATORY beta testing gate — 5-10 users, 1 week feedback before Epic 4-6
- **Epic 4:** Split into 4a (Input & Extraction) + 4b (Scoring & Queue) UPFRONT — don't wait for it to grow
- **Epic 4b:** Can be deferred to post-MVP if timeline pressure (Epic 4a delivers extraction value)
- **Epic 5:** Privacy UX must say "Local-only extraction" not "Privacy layer"
- **Epic 6:** FR-9 (edit distance) deferred to v1.1 — manual voice only in MVP

### **Contingency Stories (Add to Epics)**
- **Epic 1:** Export to JSON (manual backup before Epic 2), Encryption stack spike (validate rusqlite + SQLCipher + keyring on Windows/macOS), Dark mode basic CSS
- **Epic 2:** Migration failure recovery and rollback
- **Epic 3:** Safety threshold configuration, override UI, re-humanization button, "Learn from overrides" adaptive threshold, Core keyboard shortcuts (Cmd+Enter, Cmd+C, Tab nav)
- **Epic 4a:** Scoring breakdown UI with "Why this color?" explanations
- **Epic 4b:** RSS fallback to web scraping (Upwork blocks RSS frequently), "Report bad scoring" feedback loop
- **Epic 5:** Quick Calibration alternative (5-question survey), "Proposals never leave device" privacy UX indicator

### **Key Performance Targets (Non-Negotiable)**
- **NFR-1:** Startup <2s (Epic 1 AC)
- **NFR-6:** Generation <8s (Epic 0 AC) — Sarah persona will abandon if slower
- **NFR-17:** Query performance <500ms (Epic 4 AC)

### **User Persona Priorities (from Focus Group)**
- **Sarah (Experienced):** Speed > Everything. Must not slow down workflow.
- **Marcus (New):** Transparency in scoring. Needs to trust "Why Yellow?"
- **Priya (Part-Time):** Golden Set > Gradual learning. One-time setup > volume-dependent features.

### **Story Breakdown Strategy**
- **Approach:** User journey with risk spikes (not feature-based)
- **Example Epic 4:** Start with spike (validate Claude Haiku), then user journey stories ("I can see why this job matched")
- **Each story:** Delivers user value, includes unit tests (AR-21 pre-commit hooks)

### **MVP vs v1.1 vs Post-MVP Clarity**
- **MVP (14 FRs):** Core loop + safety + personalization + essential UX
- **v1.1 (1 FR):** FR-9 edit distance → enables automated voice learning
- **Post-MVP (3 FRs):** History/backup, deployment, dynamic config

### **Risks & Mitigations**
1. **Epic 3 safety blocks 80% of proposals** → Configurable threshold, override button, improved suggestions
2. **Epic 2 migration fails on Windows** → Backup before migration, automated rollback, cross-platform testing
3. **Epic 4 balloons to 15-20 stories** → Split at 12 stories into 4a/4b
4. **Golden Set doesn't improve output** → Quick Calibration alternative, before/after preview

## Epic List

**MVP Epics** (Required for initial release)

### Epic 0: Walking Skeleton (Proof of Concept) [MVP - SPIKE]

**User Outcome:** User can paste a job, generate a basic proposal, and copy it — end-to-end proof the core loop works

**FRs covered:** FR-1 (basic paste), FR-6 (basic generation), FR-13 (copy only)
**ARs covered:** AR-1 (starter template), AR-4 (Claude API basic), AR-20 (Walking Skeleton spike)
**Performance Targets:** NFR-5 (streaming start <1.5s), NFR-6 (generation <8s)

**Implementation Notes:** Build using production stack (Tauri template, real Claude API) but with NO persistence layer. This validates the generation pipeline (job analysis → hook selection → streaming) without infrastructure investment. Code should be production-quality to enable Epic 1 to build on it, not replace it.

**Scope Flexibility:** Primary goal is validating generation quality and performance. UI can be minimal (console output acceptable if streaming UI takes >3 days). Focus: prove Claude Sonnet 4.5 generates proposals that pass AI detection AND sound good.

**Epic 0 → Epic 1 Handoff:** Epic 1 builds ON this codebase, not replaces it. Core components (job parsing, Claude API integration, streaming engine) remain unchanged. Epic 1 adds persistence layer only.

**Estimated Size:** 3-5 stories, 2-3 days (hard time-box at 5 days max)

---

### Epic 1: Basic Data Persistence [MVP]

**User Outcome:** User's proposals are saved locally and survive app restarts; can paste API key and it persists; app has dark mode for late-night work

**FRs covered:** FR-1 (full), FR-6 (full), FR-13 (persistent)
**ARs covered:** AR-2 (rusqlite basic), AR-18 (basic migrations)
**NFRs covered:** NFR-1 (startup <2s), NFR-19 (data integrity)
**UX covered:** UX-1 (dark mode basic — full theme system in Epic 8)
**Performance Targets:** NFR-1 (startup <2s), NFR-4 (UI response <100ms)

**Implementation Notes:** Builds on Epic 0 codebase. Add SQLite database (initially UNENCRYPTED for speed) to persist proposals, jobs, and basic settings. API key stored in plaintext config file (will be secured in Epic 2). Database schema with basic migrations via refinery 0.9. Seed data for default hook strategies. Focus: make persistence work fast and reliably. Epic 0 components (job parsing, Claude API, streaming) remain unchanged.

**Critical Additions from Round 4 Elicitation:**
1. **Dark Mode Basic CSS** — Simple dark theme (no theme system yet). Prevents developer eye strain during 10-week development cycle and ensures MVP ships with dark mode (from Hindsight Reflection).
2. **Encryption Stack Spike** — Validate rusqlite + SQLCipher + keyring integration on Windows 10/11 and macOS. De-risks Epic 2 migration (from Thesis Defense + Hindsight).
3. **Export to JSON** — Manual backup capability before Epic 2 migration. Safety net for users (from Red Team).

**Epic 1 → Epic 2 Critical Path:** Epic 2 MUST immediately follow Epic 1 in sprint planning. Users never see the unencrypted version in production—both epics ship together in initial release.

**Round 6 Critical Additions:** (1) Story 1.15: Onboarding Flow (moved from Epic 8 — first-launch wizard required for beta testing), (2) Story 1.16: Logging Infrastructure (moved from Epic 8 — essential for debugging production issues). Cannot ship beta test without these.

**Estimated Size:** 12-16 stories, 1.5-2 weeks (increased from 10-14 due to Round 6 resequencing)

---

### Epic 2: Security & Encryption [MVP]

**User Outcome:** User's data and API credentials are encrypted; passphrase protects all sensitive information

**FRs covered:** None directly (secures all existing features)
**ARs covered:** AR-2 (SQLCipher upgrade), AR-3 (Argon2id passphrase), AR-17 (keyring for API key)
**NFRs covered:** NFR-7 (AES-256 encryption), NFR-10 (OS keychain), NFR-18 (process isolation)

**Implementation Notes:** Migrate database from plain SQLite to SQLCipher. Add passphrase entry on first launch with strength meter (min 8 chars). Move API key from config file to OS keychain via `keyring` crate. This epic takes Epic 1's working persistence and secures it without breaking functionality.

**Scope Options (for timeline pressure):**
- **Full Scope:** Encrypt entire database (proposals + jobs + settings)
- **Reduced Scope:** Encrypt `proposals` table only (user-created content), defer `jobs`/`settings` encryption to v1.1
- **Rationale:** Proposals contain user's writing and strategy (sensitive). Jobs are public Upwork data (less sensitive).

**Migration Safety Protocol (CRITICAL):**
1. **Pre-migration backup:** Export all proposals/jobs to JSON before migration begins
2. **Atomic transaction:** SQLite → SQLCipher migration in single transaction with rollback capability
3. **Data verification:** Verify row counts match before/after migration
4. **User confirmation:** Show migration summary, require explicit user confirmation before deleting unencrypted DB
5. **Rollback plan:** If migration fails, restore from backup and alert user
6. **Testing:** Test migration on datasets of 0, 1, 100, 1000+ proposals on Windows 10/11 all versions

**Contingency Story:** "Migration failure recovery and rollback" — auto-restore from backup if migration fails >30 seconds or errors

**Estimated Size:** 6-8 stories, 3-5 days

---

### Epic 3: Safety & Compliance Controls [MVP]

**User Outcome:** User can ensure proposals pass AI detection checks, follow safety guardrails, and navigate app efficiently with keyboard

**FRs covered:** FR-7 (humanization), FR-11 (pre-flight scan), FR-12 (rate limiting)
**ARs covered:** AR-13 (prompt boundary enforcement), AR-23 (circuit breaker)
**UX covered:** UX-3 (core keyboard shortcuts — full nav in Epic 8)

**Implementation Notes:** Pre-flight scan runs before copy, blocks if perplexity >180 (adjusted from 150 based on Hindsight data), displays flagged sentences with humanization suggestions. Natural imperfections injected at 1-2 per 100 words. Rate limiter enforces max 1 generation per 2 minutes. This builds TRUST early — users won't adopt without safety.

**Critical Sequencing:** Must come BEFORE job scoring (Epic 4a/4b) because users need to trust generated proposals before caring about job quality. Also includes BETA TESTING GATE after this epic — pause for user validation.

**Safety UX Requirements (from User Persona Focus Group):**
- **Configurable threshold:** Default 180 (adjusted from 150), adjustable 140-220 in settings
- **Override capability:** "Use at your own risk" button for edge cases (with warning dialog)
- **Actionable suggestions:** Show specific edit examples, not just "add more variety"
- **Re-humanization button:** "Regenerate with more humanization" that auto-injects imperfections
- **Adaptive learning:** If user overrides 3+ times successfully, auto-adjust their threshold up (from Red Team)

**Core Keyboard Shortcuts (from Hindsight Reflection):**
- **Cmd/Ctrl + Enter:** Generate proposal
- **Cmd/Ctrl + C:** Copy to clipboard (when ready)
- **Tab/Shift+Tab:** Navigate UI elements
- **Rationale:** Early adopters are keyboard power users. Deferring to Epic 8 caused complaints in future timeline. Ship core shortcuts early, full keyboard nav (accessibility) in Epic 8.

**Contingency Stories:**
1. "Safety threshold configuration and override UI"
2. "Humanization suggestion improvements" (show before/after examples)
3. "One-click re-humanization regeneration"
4. "Learn from overrides" adaptive threshold adjustment
5. "Core keyboard shortcuts" (Cmd+Enter, Cmd+C, Tab nav)

**Estimated Size:** 7-9 stories, 5-6 days (increased from 5-7 due to keyboard shortcuts + adaptive threshold)

---

### Epic 4a: Job Input & Extraction [MVP]

**User Outcome:** User can paste a job post and see intelligent analysis: client name, key skills, and hidden needs (2-3 implied priorities)

**FRs covered:** FR-2 (extraction: client name, skills, hidden needs)
**ARs covered:** AR-4 (Claude Haiku for fast analysis), AR-5 (prompt caching for analysis prompts)
**Performance Targets:** Analysis <3s per job

**Implementation Notes:** First half of job intelligence — focuses on EXTRACTION, not scoring. User pastes job URL or text, system uses Claude Haiku to extract: (1) Client name, (2) Key skills required, (3) Hidden needs (2-3 implied priorities beyond stated requirements). Example: Job says "need fast turnaround" → Hidden need: "Client is stressed/urgent."

**Why Split from Epic 4b:** Epic 4a delivers standalone value (understand job better) without complex scoring algorithm. Can ship in 1 week. Epic 4b (scoring/queue) takes 1.5-2 weeks due to algorithm complexity. Split prevents Epic 4 from blocking for 3+ weeks.

**Critical Dependency Note:** Epic 4a has NO hard dependencies on Epic 5. These epics CAN run in parallel with 2-person team.

**Estimated Size:** 6-8 stories, 1 week

---

### Epic 4b: Job Scoring & Pipeline Management [MVP]

**User Outcome:** User can batch-import jobs via RSS, see match scores with color-coded flags, and build a prioritized queue

**FRs covered:** FR-3 (RSS batch import), FR-4 (weighted scoring with Green/Yellow/Red flags), FR-17 (confidence scores with explanations)
**ARs covered:** AR-5 (prompt caching), AR-4 (Claude Haiku for scoring)
**UX covered:** UX-2 (Green/Yellow/Red indicators)
**Performance Targets:** NFR-17 (query performance <500ms for queue), Scoring <2s per job

**Implementation Notes:** Second half of job intelligence — builds on Epic 4a extraction to add SCORING. Weighted scoring algorithm: (1) Skills match % (user profile vs job requirements), (2) Client quality score (hire rate, payment history, budget), (3) Budget alignment (user rate vs job budget). Green (≥75% match AND ≥80 client score), Yellow (50-74% OR 60-79% client), Red (<50% OR <60% OR 0-hire client). RSS batch import for pipeline building.

**Transparency Requirements (from User Persona Focus Group - Marcus):**
- **Scoring breakdown UI:** Show individual weights (skills match 80%, client quality 75%, budget 90%)
- **Explain color coding:** "Why is this Yellow?" → "75% skills match (good) BUT client has 60% hire rate (medium risk)"
- **Confidence indicators:** FR-17 rationalized scoring with human-readable explanations
- **Report bad scoring:** Feedback loop for users to flag incorrect scores (from Red Team)

**Deferral Option:** Can be moved to post-MVP if timeline pressure. Epic 4a (extraction) delivers value without scoring. Users can manually evaluate jobs with extraction insights.

**Contingency Stories:**
1. "Scoring breakdown UI with weights"
2. "Report bad scoring" feedback loop
3. "RSS fallback to web scraping" (Upwork blocks RSS frequently per Hindsight)

**Estimated Size:** 8-10 stories, 1.5-2 weeks

---

### Epic 5: Strategic Hook Selection & Voice Calibration [MVP]

**User Outcome:** User can select hook strategies (Social Proof, Contrarian, Immediate Value) and instantly calibrate AI to their writing voice using 3-5 past successful proposals

**FRs covered:** FR-5 (hook strategy selection), FR-16 (Golden Set calibration)
**ARs covered:** AR-5 (prompt caching), AR-12 (privacy layer — send style params, not raw samples), AR-8 (pipeline: parallel voice loading)

**Implementation Notes:** User takes control of generation approach. Bundled hook strategies with examples. Golden Set: user uploads 3-5 past proposals, system extracts style parameters (tone, structure, vocabulary patterns) via privacy layer, updates voice profile via prompt injection within 30 seconds. No raw writing samples sent to API.

**Golden Set Value Emphasis (from User Persona Focus Group - Priya):**
- **Primary value proposition:** One-time setup calibration (more valuable than gradual learning for low-volume users)
- **Make it optional:** Default voice works without Golden Set (don't force upload on first use)
- **Privacy assurance:** Extraction happens locally, only style params sent to API (never full proposal text)
- **Before/after preview:** Show sample generation with default voice vs calibrated voice

**Alternative Calibration Path:**
- **Quick Calibration story:** Answer 5 questions instead of uploading proposals:
  1. Tone: Formal / Professional / Casual / Friendly?
  2. Length: Brief / Moderate / Detailed?
  3. Technical depth: Simple / Technical / Expert?
  4. Structure: Bullet points / Paragraphs / Mixed?
  5. Call-to-action: Direct / Consultative / Question-based?
- **Use case:** For users uncomfortable uploading past work or without 3-5 strong examples

**Parallel Execution:** Epic 5 has no hard dependencies on Epic 4. Can run simultaneously with 2-person team.

**Estimated Size:** 6-8 stories, 4-6 days

---

### Epic 6: Rich Editor & Manual Voice Refinement [MVP]

**User Outcome:** User can refine proposals in a rich-text editor with basic formatting and manual voice parameter adjustments

**FRs covered:** FR-8 (rich editor), FR-9 (edit distance - **deferred to v1.1**), FR-10 (voice weight updates — manual only in MVP)
**ARs covered:** AR-9 (TipTap 3.x), AR-22 (voice learning MVP phase: few-shot prompting only, NO automated signals)
**UX covered:** UX-5 (milestone celebrations - simplified), UX-7 (expectation management: "Refine via Golden Set")

**Implementation Notes:** TipTap 3.x editor with basic formatting (bold, italic, bullets, paragraphs). User can manually adjust voice parameters in settings (tone slider, length preference, structure preference). NO automated edit distance calculation or pattern detection in MVP — that's v1.1 and v1.2.

**MVP Scope Simplification (from Socratic Questioning):**
- **FR-9 (edit distance) deferred to v1.1** — Data collection for future learning, not used in MVP
- **FR-10 (voice updates) manual only** — User adjusts sliders/settings, not automatic pattern detection
- **Rationale:** AR-22 explicitly phases voice learning (MVP = few-shot, v1.1 = explicit signals, v1.2 = implicit). Edit distance is v1.1 foundation.

**v1.1 Upgrade Path:** Add edit distance tracking to enable pattern detection ("user always removes adjectives" → suggest voice update)

**Critical Distinction:** This is a REFINEMENT TOOL, not a learning system in MVP. Learning comes in v1.1+.

**Estimated Size:** 6-8 stories, 4-5 days (reduced from 8-10 by removing edit distance)

---

**POST-MVP EPICS** (Phase 2+)

**Post-MVP Priority Order:** Epic 7 (History - high user demand) → Epic 9 (Deployment - needed for distribution) → Epic 10 (Dynamic Config - future enhancement)

### Epic 7: Proposal History & Data Portability [POST-MVP - PRIORITY 1]

**User Outcome:** User can review past proposals offline, track response rates, and export/backup their entire database

**FRs covered:** FR-14 (history view), FR-15 (export/backup)
**UX covered:** UX-6 (response tracking: Yes/No/Pending)

**Implementation Notes:** Full offline read access to proposal history with search/filter (by job, date, response status). Response tracking helps identify successful patterns ("12 of 15 Social Proof hooks got responses"). Database export to encrypted archive for backup/migration. Analytics dashboard showing: response rate by hook type, average edit distance over time, most successful job types.

**Why Priority 1:** Users frequently request "show me what worked before" — this enables pattern recognition and builds confidence in the tool.

**Estimated Size:** 6-8 stories, 4-5 days

---

### Epic 8: Essential UX & Accessibility [MVP - CRITICAL]

**User Outcome:** App is usable, accessible, and delightful for all users including keyboard-only and screen reader users

**NFRs covered:** NFR-2 (RAM <300MB target), NFR-3 (CPU <5% background), NFR-20 (WCAG AA compliance)
**ARs covered:** AR-10 (streaming optimization), AR-16 (state management), AR-19 (logging)
**UX covered:** UX-1 (dark mode default), UX-3 (keyboard shortcuts: Cmd+Enter, Cmd+C), UX-4 (pipeline stage indicators), UX-7 (onboarding: expectation management)

**Implementation Notes:** Performance targets (NFR-1, NFR-4, NFR-5, NFR-6, NFR-17) are distributed as acceptance criteria across Epics 0-6. This epic focuses on polish and accessibility.

**Scope Breakdown:**
1. **Theme System** — Dark mode (default) with proper WCAG AA contrast ratios, theme toggle for light mode
2. **Keyboard Navigation** — Full keyboard accessibility, shortcuts (Cmd+Enter generate, Cmd+C copy), tab order, focus indicators
3. **Screen Reader Support** — ARIA labels, semantic HTML, screen reader testing on macOS VoiceOver and NVDA
4. **Pipeline Indicators** — Real-time generation stage display ("Analyzing job..." → "Selecting approach..." → "Generating...")
5. **Onboarding Flow** — First-launch tutorial, voice learning expectations ("Takes 3-5 uses to learn your voice"), API key setup
6. **Memory Optimization** — Lazy loading, query result caching, proposal list virtualization for <300MB RAM target
7. **Logging Infrastructure** — Rust `tracing` crate with daily rotation, 7-day retention, log level configuration

**Testing Strategy:**
- Unit tests included in each epic's stories (per AR-21 pre-commit hooks)
- **Epic 8 adds comprehensive E2E test suite:** Full user journeys (paste job → generate → edit → copy), cross-platform testing (macOS/Windows), accessibility testing (keyboard-only, screen reader), performance validation (startup time, generation speed, memory usage)

**Estimated Size:** 10-12 stories, 1-1.5 weeks

---

### Epic 9: Platform Deployment & Distribution [POST-MVP - PRIORITY 2]

**User Outcome:** Users can install the app on macOS/Windows via professional signed installers and receive automatic security updates without manual intervention.

**NFRs covered:** NFR-13 (safe updates with rollback), NFR-14 (macOS 12+, Windows 10/11), NFR-15 (EV code signing), NFR-16 (auto-update for critical fixes)
**ARs covered:** AR-21 (pre-commit hooks: ESLint, Prettier, cargo fmt, clippy, specta binding check)

**Stories (9):**
- 9.1: ESLint, Prettier & Pre-commit Hooks (AR-21)
- 9.2: CI/CD Release Build Pipeline (NFR-14)
- 9.3: Semantic Versioning & Release Automation
- 9.4: macOS Code Signing & Notarization (NFR-15)
- 9.5: Windows Code Signing & SmartScreen Compliance (NFR-15)
- 9.6: Auto-Updater Plugin Integration (NFR-16)
- 9.7: Auto-Update Notification UI (NFR-16)
- 9.8: Mandatory Safety Update Enforcement (NFR-16)
- 9.9: Post-Update Health Check & Rollback (NFR-13)

**Dependency flow:** 9.1 → 9.2 → 9.3 → 9.4/9.5 (parallel) → 9.6 → 9.7 → 9.8 → 9.9

**Implementation Notes:** Tauri bundling for macOS (DMG) and Windows (MSI). Atomic updates with rollback capability. Auto-updater for critical security fixes (mandatory). Pre-commit hooks prevent broken builds. Code signing (EV cert for Windows SmartScreen per NFR-15, Apple notarization for macOS). Distribution via GitHub Releases download initially, App Store/Microsoft Store consideration for v2.0.

**Why Priority 2:** Required for broad distribution beyond development team. Auto-update infrastructure critical for security patches.

**Key risks:** Windows EV cert procurement (1-2 week lead time), macOS notarization (Apple Developer account), SmartScreen reputation building

**Size:** 9 stories

---

### Epic 10: Advanced Configuration & Extensibility [POST-MVP - PRIORITY 3]

**User Outcome:** User benefits from remotely-updated hook strategies without manual app updates

**FRs covered:** FR-18 (dynamic hook configuration)
**ARs covered:** AR-14 (network allowlisting for config endpoint)

**Implementation Notes:** Remote config fetch with schema validation, fallback to bundled defaults. Allows hook strategy evolution (new strategies, improved examples) without app updates. Network allowlisting ensures only trusted config sources (Anthropic CDN or self-hosted). Config versioning for compatibility. A/B testing capability for hook strategy effectiveness.

**Why Priority 3:** Nice-to-have enhancement. MVP ships with bundled hook strategies that work well. Dynamic config enables iteration without app updates but isn't critical for initial launch.

**Estimated Size:** 4-6 stories, 3-4 days
