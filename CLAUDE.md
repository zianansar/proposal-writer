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

### Agent Invocation
Agents are invoked via slash commands using the Skill tool:
```
/bmad-agent-bmm-analyst    # Activate Business Analyst
/bmad-agent-bmm-architect  # Activate Architect
/bmad-agent-bmm-dev        # Activate Developer
```

When an agent is activated:
1. It loads its persona from `_bmad/bmm/agents/*.md`
2. Reads configuration from `_bmad/bmm/config.yaml`
3. Presents a numbered menu of available workflows
4. Waits for user input (number, command code, or fuzzy match)

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

### Research Workflow
Located in: `_bmad/bmm/workflows/1-analysis/research/`
- Supports domain, market, technical, and competitive research
- Requires web search capability
- Enforces source verification and citation standards
- Outputs to: `{planning_artifacts}/research/`

### Brainstorming Workflow
Located in: `_bmad/core/workflows/brainstorming/`
- Facilitated ideation using structured techniques
- Supports Role Playing, SCAMPER, What If scenarios, and more
- Outputs session reports to: `_bmad-output/brainstorming/`

### Product Brief Creation
Located in: `_bmad/bmm/workflows/1-analysis/create-product-brief/`
- Guided process to capture product vision
- Steps: Vision → Users → Metrics → Scope
- Outputs product brief documents

## Current Project State

### Completed Work
Based on git history and output artifacts:
1. Initial BMAD installation (2026-01-29)
2. Brainstorming sessions on Upwork proposal strategies
3. Comprehensive domain research on:
   - Upwork proposal writing best practices
   - Freelancer success strategies
   - Technical proposal automation approaches
4. Implementation artifacts created:
   - Complete proposal templates
   - Proposal hook library
   - Solution frameworks
   - Quick start guide

### Research Findings
Key artifacts in `_bmad-output/planning-artifacts/research/`:
- **domain-upwork-proposal-strategies-research-2026-01-29.md** - Core proposal optimization research
- **domain-upwork-freelancer-success-strategies-research-2026-01-30.md** - Broader freelancer strategies
- **technical-proposal-automation-app-research-2026-01-30.md** - Technical implementation research

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

## Notes
- This is a research/planning repository with no traditional codebase (no package.json, requirements.txt, etc.)
- The "code" is primarily workflow definitions, agent configurations, and generated research artifacts
- BMAD system uses XML-based workflow processing engine in `_bmad/core/tasks/workflow.xml`
- Agent menu handlers process three types: `exec`, `workflow`, and `data`
