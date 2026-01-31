# System Architecture

## Executive Summary

The **Upwork Research Agent** is a specialized installation of the **BMAD (Build, Manage, Architect, Deploy)** framework (v6.0.0-Beta.4). It is designed as an agentic system to facilitate research, strategy development, and proposal automation for Upwork freelancing. Unlike traditional software architectures, this system operates through **Interactive Agent Personas** and **Structured Workflows**.

## Architecture Pattern

**Agentic Workflow System**

The system follows a modular agentic architecture where functionality is encapsulated in:
1.  **Agents**: Specialized personas (Analyst, Dev, Architect) with defined roles and directives.
2.  **Workflows**: Structured sequences of tasks (XML/YAML/Markdown) that guide agents through complex processes.
3.  **Artifacts**: Persistent outputs (Markdown) that serve as the system's memory and deliverables.

## Core Components

### 1. The Workflow Engine
*   **Location**: `_bmad/core/tasks/workflow.xml`
*   **Role**: The "Operating System" of the project. It parses workflow definitions, manages state, handles user interaction, and enforces process integrity.
*   **Key Tech**: XML Parsing, LLM Instruction following.

### 2. Specialized Agents (`_bmad/bmm/agents/`)
Each agent is a rigorous prompt configuration defining a persona and capabilities:
*   **Analyst (Mary)**: Business analysis and research (Active in this project).
*   **PM**: Product management and planning.
*   **Dev**: Code implementation (Less active in research phase).
*   **Architect**: System design.
*   **Quinn**: Rapid iteration coordinator.

### 3. Workflow Definitions (`_bmad/bmm/workflows/`)
*   **Research**: `1-analysis/research/`
*   **Brainstorming**: `core/workflows/brainstorming/`
*   **Documentation**: `document-project/` (This workflow)

## Data Architecture

The system uses a **Document-Oriented Knowledge Base**:

| Data Type         | Storage Location        | Description                          |
| :---------------- | :---------------------- | :----------------------------------- |
| **Configuration** | `_bmad/bmm/config.yaml` | User preferences and paths.          |
| **State**         | `*.json`, Frontmatter   | Workflow progress tracking.          |
| **Knowledge**     | `docs/`                 | Project reference (like this file).  |
| **Outputs**       | `_bmad-output/`         | Research reports, templates, guides. |

## Source Organization

See [Source Tree Analysis](./source-tree-analysis.md) for a detailed directory breakdown.

## Design Decisions

*   **Modular "Code"**: The "codebase" is composed of configuration and logic text (Workflows) rather than compiled binaries, allowing for rapid iteration of the *process* itself.
*   **Human-in-the-Loop**: All workflows are designed for collaborative execution with the User (`Zian`).
