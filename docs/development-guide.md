# Usage Guide (Development Guide)

Since this is a BMAD Agentic Project, "Development" refers to executing agent workflows to generate value.

## Prerequisites

1.  **Cursor IDE** or **VS Code** with Claude Code extension.
2.  **LLM Access**: Valid API keys for the underlying models (Claude 3.5 Sonnet recommended).

## Agent Activation

Agents are activated via specific slash commands in the chat interface.

| Role Needed                  | Command                       | Purpose                          |
| :--------------------------- | :---------------------------- | :------------------------------- |
| **I need research/strategy** | `/bmad-agent-bmm-analyst`     | Activate Business Analyst (Mary) |
| **I need to plan/define**    | `/bmad-agent-bmm-pm`          | Activate Product Manager         |
| **I need technical design**  | `/bmad-agent-bmm-architect`   | Activate System Architect        |
| **I need to build code**     | `/bmad-agent-bmm-dev`         | Activate Developer               |
| **I need UX design**         | `/bmad-agent-bmm-ux-designer` | Activate UX Designer             |

## Workflow Execution

1.  **Trigger**: Run an agent command (e.g., `/bmad-agent-bmm-analyst`).
2.  **Menu**: The agent will present a numbered menu of available workflows.
3.  **Selection**: Type the number or command code (e.g., `[RS]` for Research).
4.  **Interaction**: Follow the agent's prompts. The agent will read/write files to `_bmad-output`.

## File Locations

*   **Inputs**: You generally provide input via chat or by referencing existing files.
*   **Outputs**: All work is saved to `_bmad-output/`.
    *   `planning-artifacts/`: Specs, Plans, Research.
    *   `implementation-artifacts/`: Code, Guides, Templates.

## Development Standards

When modifying the system itself (the Agents):
*   **Agent Definitions**: Edit `_bmad/bmm/agents/*.md`.
*   **Configurations**: Edit `_bmad/_config/agents/*.customize.yaml`.
*   **Workflows**: Edit files in `_bmad/bmm/workflows/`.
