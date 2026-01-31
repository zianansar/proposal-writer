# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Upwork Research Agent** repository - a BMAD (Build, Manage, Architect, Deploy) framework installation focused on researching and developing strategies for Upwork proposal optimization. The project uses the BMAD system (v6.0.0-Beta.4) to facilitate AI-assisted product development workflows.

### Project Purpose
Research and develop comprehensive strategies for writing high-converting Upwork proposals, with specific focus on improving open rates and response rates for freelance job applications.

## Architecture

### BMAD Framework Structure

The repository is built on the **BMAD modular framework**, which provides persona-driven AI agents and structured workflows for software development:

#### Core Modules
- **`_bmad/core/`** - Core BMAD framework with foundational workflows and agent infrastructure
- **`_bmad/bmm/`** - Build-Manage Module containing specialized agents, workflows, and team configurations
- **`_bmad/_config/`** - Configuration files including agent customizations and manifest

#### Agent System
The framework includes specialized AI agents with distinct personas:
- **analyst** (Mary) - Business analysis, market research, competitive analysis, requirements gathering
- **architect** - Technical architecture and system design decisions
- **pm** - Product management and project coordination
- **dev** - Implementation and coding
- **ux-designer** - User experience and design
- **tech-writer** - Technical documentation
- **sm** - Scrum master/sprint management
- **quinn** - Quick-flow development coordinator

Each agent is defined in `_bmad/bmm/agents/*.md` with YAML frontmatter configuration stored in `_bmad/_config/agents/*.customize.yaml`.

#### Workflow Organization
Workflows are organized by development phase in `_bmad/bmm/workflows/`:
- **`1-analysis/`** - Research, brainstorming, product briefs
- **`2-plan-workflows/`** - Planning and PRD creation
- **`3-solutioning/`** - Architecture and solution design
- **`4-implementation/`** - Story creation, development, code review, retrospectives
- **`qa/`** - Test automation
- **`document-project/`** - Project documentation generation
- **`excalidraw-diagrams/`** - Diagram creation (wireframes, flowcharts, architecture)

### Configuration System

**Primary config**: `_bmad/bmm/config.yaml`
```yaml
project_name: Upwork Research Agent
user_name: Zian
communication_language: English
document_output_language: English
output_folder: "{project-root}/_bmad-output"
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
```

The `{project-root}` placeholder is dynamically resolved to the repository root.

### Output Structure

All generated artifacts are stored in `_bmad-output/`:
- **`planning-artifacts/`** - Research reports, briefs, PRDs, architecture docs
  - `research/` - Domain, market, technical research documents
- **`implementation-artifacts/`** - Epics, stories, implementation guides
- **`brainstorming/`** - Brainstorming session outputs

## Working with BMAD

### Quick Start Command Reference
**Most Common Workflows** (can be invoked directly):
- `/bmad-bmm-research` - Start research (domain, market, technical, competitive)
- `/bmad-bmm-create-product-brief` - Define product vision
- `/bmad-bmm-create-prd` - Create or edit Product Requirements Document
- `/bmad-bmm-create-ux-design` - Design UX specifications
- `/bmad-bmm-create-architecture` - Define architecture decisions
- `/bmad-bmm-create-epics-and-stories` - Break down PRD into development tasks
- `/bmad-bmm-quick-dev` - Fast development workflow
- `/bmad-bmm-document-project` - Generate system documentation

**Agent Activation** (for accessing full workflow menus):
- `/bmad-agent-bmm-analyst` - Business Analyst (Mary) - Research & analysis
- `/bmad-agent-bmm-pm` - Product Manager - Planning & coordination
- `/bmad-agent-bmm-architect` - System Architect - Technical design
- `/bmad-agent-bmm-dev` - Developer - Implementation
- `/bmad-agent-bmm-ux-designer` - UX Designer - Design specifications
- `/bmad-agent-bmm-sm` - Scrum Master - Sprint management
- `/bmad-agent-bmm-quinn` - Quick Flow - Rapid development

### Agent Invocation Pattern
When an agent is activated via `/bmad-agent-*` command:
1. It loads its persona from `_bmad/bmm/agents/*.md`
2. Reads configuration from `_bmad/bmm/config.yaml`
3. Presents a numbered menu of available workflows
4. Waits for user input (number, command code, or fuzzy match)
5. Executes selected workflow and stays in character until dismissed

### Workflow Execution
Workflows use two patterns:

**1. Markdown-based workflows** (`.md` files)
- Self-contained instructions for straightforward processes
- Loaded via `exec="path/to/workflow.md"` in menu items
- Example: Research workflow, brainstorming

**2. YAML-based workflows** (`.yaml` files)
- Multi-step processes with state tracking
- Processed by `_bmad/core/tasks/workflow.xml`
- Frontmatter tracks progress and session variables
- Example: Document project workflow

### Path Resolution
All workflows use consistent path placeholders:
- `{project-root}` - Repository root directory
- `{user_name}` - From config.yaml (currently "Zian")
- `{output_folder}` - Resolved to `_bmad-output/`
- `{planning_artifacts}` - Resolved to `_bmad-output/planning-artifacts/`
- `{implementation_artifacts}` - Resolved to `_bmad-output/implementation-artifacts/`

### Menu Handler System
Agent menus support three handler types:
- **`exec`** - Execute markdown workflow file directly
- **`workflow`** - Execute YAML workflow via workflow.xml processor
- **`data`** - Load data file (JSON/YAML/CSV/XML) as context

## Key Workflows

### Phase 1: Analysis & Discovery
**Research Workflow** (`/bmad-bmm-research`)
- Located in: `_bmad/bmm/workflows/1-analysis/research/`
- Supports domain, market, technical, and competitive research
- Requires web search capability
- Enforces source verification and citation standards
- Outputs to: `{planning_artifacts}/research/`

**Brainstorming** (`/bmad-brainstorming`)
- Located in: `_bmad/core/workflows/brainstorming/`
- Facilitated ideation using structured techniques
- Supports Role Playing, SCAMPER, What If scenarios, and more
- Outputs session reports to: `_bmad-output/brainstorming/`

**Product Brief Creation** (`/bmad-bmm-create-product-brief`)
- Located in: `_bmad/bmm/workflows/1-analysis/create-product-brief/`
- Guided collaborative process to capture product vision
- Steps: Vision → Users → Metrics → Scope
- Outputs product brief documents

### Phase 2: Planning & Specification
**PRD Creation** (`/bmad-bmm-create-prd`)
- Tri-modal: Create new, Validate existing, or Edit PRD
- Comprehensive requirements gathering with intelligent discovery
- Consumes product briefs and research artifacts
- Outputs to: `{planning_artifacts}/prd.md`

**UX Design** (`/bmad-bmm-create-ux-design`)
- Creates comprehensive UX design specifications
- Defines visual design, components, patterns, and interactions
- Works collaboratively with UX Designer persona
- Outputs to: `{planning_artifacts}/ux-design-specification.md`

**Implementation Readiness Check** (`/bmad-bmm-check-implementation-readiness`)
- Adversarial validation of PRD, Architecture, Epics & Stories
- Finds gaps and misalignments before development starts
- Critical gate before Phase 4 implementation

### Phase 3: Solutioning
**Architecture** (`/bmad-bmm-create-architecture`)
- Collaborative architectural decision facilitation
- Produces decision-focused architecture documents
- Optimized for AI agent consistency during implementation
- Outputs to: `{planning_artifacts}/architecture.md`

**Epics & Stories** (`/bmad-bmm-create-epics-and-stories`)
- Transforms PRD + Architecture + UX into implementation-ready stories
- Organizes by user value, includes acceptance criteria
- Creates detailed, actionable development tasks
- Outputs to: `{implementation_artifacts}/epics/` and `stories/`

### Phase 4: Implementation
**Story Development** (`/bmad-bmm-dev-story`)
- Executes individual stories from epic files
- Implements tasks/subtasks, writes tests, validates
- Updates story file with completion status

**Code Review** (`/bmad-bmm-code-review`)
- Adversarial senior developer review
- Finds 3-10 specific issues per review (never accepts "looks good")
- Can auto-fix with user approval

**Sprint Management** (`/bmad-bmm-sprint-planning`, `/bmad-bmm-sprint-status`)
- Generates and manages sprint-status.yaml tracking
- Extracts epics/stories and tracks through development lifecycle

**Quick Flow** (`/bmad-bmm-quick-dev`, `/bmad-bmm-quick-spec`)
- Fast-path workflows for smaller tasks
- Quick-spec: Conversational spec engineering
- Quick-dev: Execute tech-specs OR direct instructions with optional planning

### Utility Workflows
**Document Project** (`/bmad-bmm-document-project`)
- Scans and documents brownfield projects
- Creates comprehensive reference documentation
- Generates all files in `/docs/` directory

**Excalidraw Diagrams** (`/bmad-bmm-create-excalidraw-*`)
- Create wireframes, flowcharts, architecture diagrams, data flows
- Outputs .excalidraw format for editing

## Documentation Structure

The repository maintains two distinct documentation systems:

### `/docs/` - System Documentation
Generated documentation describing the BMAD framework itself:
- **index.md** - Master index of all project documentation
- **project-overview.md** - High-level system description
- **architecture.md** - BMAD framework architecture details
- **source-tree-analysis.md** - Repository structure analysis
- **component-inventory.md** - Available components and workflows
- **development-guide.md** - How to use agents and workflows
- **project-scan-report.json** - Machine-readable project metadata

These files document HOW the system works and are automatically generated by the `document-project` workflow.

### `/_bmad-output/` - Generated Artifacts
Work products created BY the system:
- **planning-artifacts/** - Research, briefs, PRDs, architecture decisions, UX specifications
- **implementation-artifacts/** - Code, templates, guides, epics, stories
- **brainstorming/** - Ideation session outputs

These files represent the VALUE created by using the BMAD workflows.

## Current Project State

### Project Phase: Planning Complete → Ready for Implementation
The Upwork Research Agent has completed comprehensive discovery and planning:

1. **Analysis & Research** (Phase 1 - Complete)
   - Brainstorming sessions on proposal optimization strategies
   - Domain research: Upwork proposal best practices
   - Domain research: Freelancer success strategies
   - Technical research: Proposal automation approaches

2. **Product Definition** (Phase 2 - Complete)
   - Product Brief: Full vision, users, metrics, scope definition
   - PRD: Comprehensive requirements document (desktop app focus)
   - UX Design Specification: Complete UI/UX design system
   - Implementation Readiness Report: Validated and ready

3. **Next Steps** (Phase 3 & 4 - Ready to Start)
   - Architecture decisions (use `/bmad-agent-bmm-architect`)
   - Epic and story creation (use `/bmad-bmm-create-epics-and-stories`)
   - Sprint planning and development

### Key Artifacts Reference
- **Product Brief**: `_bmad-output/planning-artifacts/product-brief-Upwork Research Agent-2026-01-30.md`
- **PRD**: `_bmad-output/planning-artifacts/prd.md`
- **UX Design**: `_bmad-output/planning-artifacts/ux-design-specification.md`
- **Research Reports**: `_bmad-output/planning-artifacts/research/`
- **Implementation Templates**: `_bmad-output/implementation-artifacts/`

## Important Conventions

### Agent Persona Adherence
When an agent is activated via `/bmad-agent-*` command:
- Stay in character until dismissed with [DA] or "dismiss agent"
- Use the agent's communication style from persona definition
- Display the menu and wait for user selection
- Don't break character or execute workflows automatically

### Document Standards
Research and planning documents must include:
- YAML frontmatter for workflow state tracking
- Source citations with URLs (for research)
- Comprehensive coverage (no arbitrary length limits)
- Professional structure with TOC and executive summary

### Workflow State Management
YAML workflows track state in document frontmatter:
```yaml
stepsCompleted: [1, 2, 3]
lastStep: 3
workflowType: 'research'
# ... other session variables
```

Never skip steps or proceed without completing previous steps.

## File Patterns to Recognize

- `*.customize.yaml` - Agent customization files (don't modify without user request)
- `*-session-*.md` - Brainstorming session outputs (dated)
- `*-research-*.md` - Research reports (typed and dated)
- `workflow.md` - Markdown-based workflow definitions
- `workflow.yaml` - YAML-based multi-step workflows
- `config.yaml` - Module or core configuration files

## Common Development Paths

### Starting a New Product/Feature
1. `/bmad-brainstorming` - Generate ideas and explore possibilities
2. `/bmad-bmm-research` - Conduct domain/market/technical research
3. `/bmad-bmm-create-product-brief` - Define vision, users, metrics, scope
4. `/bmad-bmm-create-prd` - Create comprehensive requirements
5. `/bmad-bmm-create-ux-design` - Design user experience (if UI exists)
6. `/bmad-bmm-create-architecture` - Make technical architecture decisions
7. `/bmad-bmm-check-implementation-readiness` - Validate before development
8. `/bmad-bmm-create-epics-and-stories` - Break down into implementation tasks
9. `/bmad-bmm-sprint-planning` - Set up sprint tracking
10. `/bmad-bmm-dev-story` - Execute individual stories

### Adding to Existing Product
1. `/bmad-bmm-quick-spec` - Create focused tech spec (conversational)
2. `/bmad-bmm-quick-dev` - Implement directly or from tech spec
3. `/bmad-bmm-code-review` - Review changes

### Documenting Existing Project
1. `/bmad-bmm-document-project` - Scan and generate `/docs/` documentation

## Notes
- This is a research/planning repository with no traditional codebase (no package.json, requirements.txt, etc.)
- The "code" is primarily workflow definitions, agent configurations, and generated research artifacts
- BMAD system uses XML-based workflow processing engine in `_bmad/core/tasks/workflow.xml`
- Agent menu handlers process three types: `exec`, `workflow`, and `data`
- All workflows are idempotent and resume-safe (check frontmatter for state tracking)
- BMAD version: 6.0.0-Beta.4 (installed 2026-01-29)
