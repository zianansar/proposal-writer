# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Upwork Research Agent** — A BMAD framework (v6.0.0-Beta.4) installation for planning and building a desktop application that helps freelancers write high-converting Upwork proposals using AI-assisted analysis and generation.

**What This Repository Is:**
- NOT a traditional codebase (no source code yet)
- A collection of markdown/YAML workflow definitions, AI agent personas, and planning artifacts
- No build system, package manager, or test suite — workflows execute via Claude Code skills

**The Product Being Built:**
A secure, privacy-focused desktop app (Tauri + React + Rust) that:
1. Analyzes Upwork job posts to extract client needs and priorities
2. Scores job matches with weighted criteria (skills, client quality, budget)
3. Generates personalized proposal drafts using AI that learns the user's writing voice
4. Includes safety guardrails (AI detection prevention, rate limiting, manual copy-only)
5. All data encrypted locally (SQLCipher), API keys in OS keychain, zero telemetry by default

**Tech Stack (decided in architecture.md):** Tauri v2 + React 19 + Vite 7 + Rust + SQLCipher + Anthropic Claude API

## Commands

Agent activation (loads persona + presents workflow menu):

- `/bmad-agent-bmm-analyst` — Business Analyst (research & analysis)
- `/bmad-agent-bmm-pm` — Product Manager
- `/bmad-agent-bmm-architect` — System Architect
- `/bmad-agent-bmm-dev` — Developer
- `/bmad-agent-bmm-ux-designer` — UX Designer
- `/bmad-agent-bmm-sm` — Scrum Master
- `/bmad-agent-bmm-quinn` — Quick Flow coordinator

Direct workflow invocation:

- `/bmad-bmm-research` — Domain/market/technical/competitive research
- `/bmad-bmm-create-product-brief` — Define product vision
- `/bmad-bmm-create-prd` — Create/validate/edit PRD
- `/bmad-bmm-create-ux-design` — UX specification
- `/bmad-bmm-create-architecture` — Architecture decisions
- `/bmad-bmm-create-epics-and-stories` — Break PRD into dev tasks
- `/bmad-bmm-check-implementation-readiness` — Validation gate before dev
- `/bmad-bmm-dev-story` — Execute a story
- `/bmad-bmm-code-review` — Adversarial code review
- `/bmad-bmm-quick-dev` / `/bmad-bmm-quick-spec` — Fast-path workflows
- `/bmad-bmm-document-project` — Generate `/docs/` documentation
- `/bmad-brainstorming` — Facilitated ideation session

## Architecture

**`_bmad/core/`** — Framework engine. The workflow processor lives at `_bmad/core/tasks/workflow.xml`.

**`_bmad/bmm/`** — Project-specific module:

- `agents/*.md` — Agent persona definitions (markdown with YAML frontmatter)
- `workflows/` — Organized by phase: `1-analysis/`, `2-plan-workflows/`, `3-solutioning/`, `4-implementation/`
- `config.yaml` — Project config (user name, output paths, language)

**`_bmad/_config/agents/*.customize.yaml`** — Agent customization overrides.

**`_bmad-output/`** — All generated artifacts:

- `planning-artifacts/` — Research reports, product brief, PRD, UX spec, architecture
- `implementation-artifacts/` — Epics, stories, guides, templates
- `brainstorming/` — Session outputs

**`docs/`** — Auto-generated system documentation (created by `document-project` workflow).

### How workflows execute

1. Agent activated via `/bmad-agent-*` → loads persona → shows numbered menu
2. User selects workflow → handler type determines execution:
   - **`exec`**: runs a markdown workflow file directly
   - **`workflow`**: runs a YAML workflow through `workflow.xml` processor (state-tracked via frontmatter)
   - **`data`**: loads a data file as context
3. Output written to `_bmad-output/`
4. Agent stays in character until dismissed with `[DA]` or "dismiss agent"

### Path placeholders

`{project-root}`, `{output_folder}`, `{planning_artifacts}`, `{implementation_artifacts}`, `{user_name}` — resolved from `config.yaml`.

### Workflow state and resumption

YAML workflows track progress in document frontmatter (`stepsCompleted`, `lastStep`, `elicitationRounds`, etc.):
- Workflows are **resume-safe** — can be interrupted and continued from last completed step
- State is persisted to the workflow output file's YAML frontmatter after each step
- **Never skip steps** — workflows enforce sequential execution
- If a workflow is interrupted, re-run the same command to continue from where it stopped
- Story files (`.story.md`) also use frontmatter to track implementation progress

## Working With Planning Artifacts

**Reading artifacts:** Always read the complete planning artifacts before making architectural decisions or writing code:
- `_bmad-output/planning-artifacts/prd.md` — Functional and non-functional requirements
- `_bmad-output/planning-artifacts/architecture.md` — Tech stack, architecture decisions (completed steps 1-8)
- `_bmad-output/planning-artifacts/epics.md` — Epic breakdown overview with requirements mapping
- `_bmad-output/planning-artifacts/epics-stories.md` — Complete story breakdown (87 stories with full Given/When/Then acceptance criteria)
- `_bmad-output/planning-artifacts/ux-design-specification.md` — UI patterns, component specifications

**Implementation templates:** Pre-generated guides and templates in `_bmad-output/implementation-artifacts/`:
- `upwork-quick-start-guide.md` — Developer onboarding
- `upwork-proposal-hook-library.md` — Domain knowledge for proposal hooks
- `upwork-proposal-solution-frameworks.md` — Solution patterns
- `upwork-complete-proposal-templates.md` — End-to-end examples

**Never guess requirements.** If uncertain about a feature, reference the PRD or ask the user.

## Epic and Story Structure

**Epic Organization:**
- `epics.md` — High-level epic breakdown with methodology notes, requirements mapping, and architecture decisions
- `epics-stories.md` — Complete story breakdown (87 stories across 11 epics) with full acceptance criteria

**Story Format:**
Stories follow user story format with structured acceptance criteria:
```
### Story X.Y: Title

As a [role],
I want [capability],
So that [benefit].

**Acceptance Criteria:**
**Given** [precondition]
**When** [action]
**Then** [expected outcome]
**And** [additional assertions]

**Technical Notes:**
- Implementation guidance
- Architecture requirements (AR-X)
- NFR targets (NFR-X: constraint)
- Cross-references to other stories
```

**Story File Structure** (generated by sprint planning):
- Naming: `epic-X-story-Y.story.md` in `_bmad-output/implementation-artifacts/`
- Contains full story text, tasks/subtasks checklist, acceptance criteria validation checklist
- Frontmatter tracks: `status`, `assignedTo`, `tasksCompleted`, `testsWritten`, `fileList`
- Dev agent updates story file as work progresses (mark tasks complete, add files changed, document decisions)

**Epic Phases:**
- **Epics 0-6, 8**: MVP scope (Walking Skeleton → Security → Safety → Job Intelligence → Proposal Generation → Voice Learning → Polish)
- **Epics 7, 9, 10**: Post-MVP (History, Deployment, Dynamic Config)
- Epic 4 (Job Intelligence) can be deferred if timeline pressure, per architecture decisions

## Current Project State

### Phase: Planning & Architecture Complete → Ready for Sprint Planning

**Completed:**
- Brainstorming, domain/technical research (Upwork proposal strategies, freelancer success patterns, automation tooling)
- Product brief, PRD (validated, quality 4.5/5), UX design specification
- Architecture decisions (complete — Tauri v2 + React 19 + Rust + SQLCipher)
- Epics breakdown with full requirements inventory (18 FRs, 20 NFRs, 23 Architecture Requirements, 8 UX Requirements)
- Implementation readiness validation

**Next:**
1. Sprint planning (`/bmad-bmm-sprint-planning`) to generate sprint-status.yaml
2. Story implementation (`/bmad-bmm-dev-story`)
3. Code review (`/bmad-bmm-code-review`) after each story

**Key artifacts:**
- `_bmad-output/planning-artifacts/prd.md` — Product requirements (validated)
- `_bmad-output/planning-artifacts/architecture.md` — Tech stack decisions (complete)
- `_bmad-output/planning-artifacts/epics.md` — Epic breakdown with requirements coverage
- `_bmad-output/planning-artifacts/ux-design-specification.md` — UX patterns and design system
- `_bmad-output/implementation-artifacts/` — Implementation templates and guides
