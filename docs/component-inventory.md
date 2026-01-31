# Component Inventory

This project defines **Agents** and **Workflows** as its primary components.

## Agents (`_bmad/bmm/agents/`)

These act as the "Microservices" of the agentic architecture, each with a specialized role.

| Agent           | Role                | File             | Description                                                    |
| :-------------- | :------------------ | :--------------- | :------------------------------------------------------------- |
| **analyst**     | Business Analysis   | `analyst.md`     | Strategic research, market analysis, requirements elicitation. |
| **architect**   | System Architecture | `architect.md`   | Technical design, system patterns, decision records.           |
| **dev**         | Implementation      | `dev.md`         | Story implementation, coding, debugging.                       |
| **pm**          | Product Management  | `pm.md`          | Project planning, roadmap, prioritization.                     |
| **ux-designer** | UX Design           | `ux-designer.md` | User experience planning, wireframing.                         |
| **tech-writer** | Documentation       | `tech-writer/`   | Technical documentation and user guides.                       |
| **sm**          | Scrum Master        | `sm.md`          | Process management, sprint tracking.                           |
| **quinn**       | Coordination        | `quinn.md`       | Quick-flow coordinator and facilitator.                        |

## Workflows (`_bmad/bmm/workflows/`)

These act as the "Business Logic" of the system.

### Analysis & Research
*   **Research**: `1-analysis/research/` - Comprehensive deep-dive research.
*   **Brainstorming**: `core/workflows/brainstorming/` - Ideation sessions.
*   **Product Brief**: `1-analysis/create-product-brief/` - Vision definition.

### Planning & Design
*   **PRD Creation**: `2-plan-workflows/create-prd/`
*   **Architecture**: `3-solutioning/create-architecture/`
*   **UX Design**: `3-solutioning/create-ux-design/`

### Implementation
*   **Story Creation**: `4-implementation/create-story/`
*   **Development**: `4-implementation/dev-story/`
*   **Code Review**: `4-implementation/code-review/`

### Operations
*   **Sprint Planning**: `4-implementation/sprint-planning/`
*   **Documentation**: `document-project/` (Self-reference)
