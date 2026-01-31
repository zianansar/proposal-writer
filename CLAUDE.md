# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Upwork Research Agent — a BMAD framework (v6.0.0-Beta.4) installation for researching and developing strategies for high-converting Upwork proposals. This is not a traditional codebase; it consists of markdown/YAML workflow definitions, AI agent personas, and generated artifacts. There is no build system, package manager, or test suite.

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

### Workflow state

YAML workflows track progress in document frontmatter (`stepsCompleted`, `lastStep`, etc.). Workflows are resume-safe. Never skip steps.

## Current Project State

### Phase: Planning Complete → Ready for Architecture & Implementation

Completed: brainstorming, domain/technical research, product brief, PRD (validated), UX design specification, implementation readiness report.

Next: architecture decisions → epics/stories → sprint planning → development.

Key artifacts: `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/planning-artifacts/ux-design-specification.md`.
