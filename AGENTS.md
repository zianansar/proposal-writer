# AGENTS.md - BMAD Framework Coding Guidelines

## Project Type
This is a BMAD v6.0.0-Beta.4 framework installation - NOT a traditional codebase.
No package.json, build system, or test suite. Workflows execute via Claude Code skills.

---

## Build/Lint/Test Commands
**No build/test commands** - Workflows are invoked via `/bmad-*` commands or agent menus.
- Agent activation: `/bmad-agent-*` loads persona and presents workflow menu
- Direct workflow: `/bmad-bmm-*` executes specific workflow
- Help: `/bmad-help` for next-step advice

---

## File Structure Conventions

### Workflow Files (YAML format)
```yaml
name: workflow-name
description: "Single-line description"
author: "BMad"

# Required config reference
config_source: "{project-root}/_bmad/bmm/config.yaml"
user_name: "{config_source}:user_name"
date: system-generated

# Path resolution
installed_path: "{project-root}/_bmad/bmm/workflows/phase/workflow-name"
instructions: "{installed_path}/instructions.md"
template: "{installed_path}/template.md"
validation: "{installed_path}/checklist.md"

# Output
default_output_file: "{output_folder}/filename.md"

standalone: true
```

### XML Task Files (`workflow.xml`)
```xml
<task id="path/to/file" name="Task Name" standalone="true/false">
  <objective>What this task does</objective>
  
  <llm critical="true">
    <mandate>MANDATORY rule</mandate>
  </llm>
  
  <flow>
    <step n="1" title="Step Title">
      <action>Required action</action>
    </step>
  </flow>
</task>
```

### Agent Persona Files
```markdown
---
name: "agent-name"
description: "Short description"
---

You must fully embody this agent's persona...
```

---

## Naming Conventions

### Variable Names
- Template variables: `{variable_name}` (double braces for runtime)
- Config references: `{config_source}:field_name`
- System variables: `{project-root}`, `{output_folder}`, `{installed_path}`, `{user_name}`, `{date}`

### File Names
- Workflows: `kebab-case.yaml` or `workflow.xml`
- Stories: `epic-X-story-Y.story.md` in implementation-artifacts/
- Agents: `{role}.md` or `bmm-{role}.md`

### Keys in YAML
- Snake_case for YAML keys: `config_source`, `installed_path`
- Kebab-case for story keys: `1-1-user-authentication`

---

## XML Tag Conventions

### Structural Tags
- `<step n="X" title="..." goal="...">` - Step with number and goal
- `<substep n="Xa" title="...">` - Nested step
- Attributes: `optional="true"`, `if="condition"`, `for-each="item"`, `repeat="n"`

### Execution Tags
- `<action>` - Required action
- `<check if="condition">...&lt;/check&gt;` - Conditional block
- `<ask>` - Wait for user response
- `<goto step="x">` - Jump to step
- `<invoke-workflow>` - Call another workflow
- `<invoke-task>` - Execute XML task
- `<invoke-protocol name="...">` - Execute reusable protocol

### Output Tags
- `<template-output>` - Save checkpoint (Write first time, Edit subsequent)
- `<critical>` - Cannot be skipped
- `<mandate>` - Mandatory rule

---

## Markdown Style

### Headers
- Level 1: `# ` for document titles
- Level 2: `## ` for major sections
- Level 3: `### ` for subsections

### Critical Directives
Use `<critical>` tags at top of instruction files:
```markdown
<critical>The workflow execution engine is governed by: {project-root}/_bmad/core/tasks/workflow.xml</critical>
<critical>You MUST have already loaded and processed: {workflow-path}</critical>
```

### Comments
- Use markdown blockquotes: `> Note:`
- Inline in code: XML comments `<!-- -->` or YAML `#`

---

## Workflow Execution Rules

1. **Load order**: Always load `workflow.xml` BEFORE processing `workflow.yaml`
2. **Read complete files**: NEVER use offset/limit for workflow-related files
3. **Execute sequentially**: Steps execute in exact numerical order (1, 2, 3...)
4. **Template-output flow**: Generate → Save → Display → Wait for user → Continue
5. **Never skip**: YOU are responsible for executing every step without exception

---

## Path Placeholders
Resolve to actual paths from config:
- `{project-root}` → `/Users/macbookm2/Desktop/Projects/Upwork Researcher`
- `{output_folder}` → `{project-root}/_bmad-output`
- `{planning_artifacts}` → `{output_folder}/planning-artifacts`
- `{implementation_artifacts}` → `{output_folder}/implementation-artifacts`

---

## Input File Patterns (Smart Loading)
```yaml
input_file_patterns:
  pattern_name:
    description: "What this pattern loads"
    whole: "{output_folder}/*keyword*.md"
    sharded: "{output_folder}/*keyword*/**/*.md"
    load_strategy: "FULL_LOAD" | "SELECTIVE_LOAD" | "INDEX_GUIDED"
```

---

## Story File Format
Story files track progress in frontmatter:
```yaml
---
status: ready-for-dev | in-progress | done
assignedTo: agent-name
tasksCompleted: 0
testsWritten: false
fileList: []
---

As a [role],
I want [capability],
So that [benefit].

**Acceptance Criteria:**
**Given** [precondition]
**When** [action]
**Then** [expected outcome]
```

---

## Application Codebase (`upwork-researcher/`)

The actual Tauri v2 desktop app lives in `upwork-researcher/`. This section covers
build/test commands and code style for the React + Rust codebase.

### Build/Lint/Test Commands

Run from `upwork-researcher/` directory:

```bash
# Development
npm run dev              # Vite dev server (port 1420)
npm run tauri dev        # Tauri app with hot reload

# Build
npm run build            # TypeScript check + Vite build
npm run tauri build      # Distributable Tauri app

# Linting
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run lint:types       # tsc --noEmit
npm run format:check     # Prettier check
npm run format:fix       # Prettier auto-format

# Unit Tests (Vitest)
npm run test                                    # All tests once
npm run test:watch                              # Watch mode
npm run test -- src/hooks/useSettings.test.ts  # Single file
npm run test -- --grep "pattern"               # By name pattern

# E2E Tests (Playwright)
npm run test:e2e         # All E2E tests
npm run test:e2e:ui      # Interactive UI
npm run test:e2e:debug   # Debug mode

# Performance
npm run test:perf        # Run benchmarks

# Rust (from src-tauri/)
cargo fmt                # Format
cargo fmt --check        # Check formatting
cargo clippy             # Lint
cargo test               # All tests
cargo test test_name     # Single test
```

### TypeScript/React Style

**Formatting (Prettier):** 2-space indent, double quotes, trailing commas, semicolons, 100 char width, LF

**Import Order (ESLint):** builtin → external → internal (`@/`) → parent → sibling → CSS (blank lines between groups)

**Types:** Strict mode, avoid `any`, prefix unused params with `_`, use `import type` for type-only imports

**React:** Functional components only, Zustand for state (`src/stores/`), `useCallback` for prop callbacks, no inline `style` props

**Naming:** PascalCase components, `use` prefix hooks, `*.test.ts(x)` co-located tests, UPPER_SNAKE_CASE constants

**Errors:** try/catch around `invoke()`, `console.error` only in dev (`import.meta.env.DEV`)

### Rust Style

**Format:** `cargo fmt` before commit

**Naming:** snake_case functions/variables, PascalCase types, UPPER_SNAKE_CASE constants

**Tauri Commands:** `#[tauri::command]` + register in `invoke_handler!` (pre-commit verifies)

**Errors:** Return `Result<T, String>`, use `?` operator, log with `tracing::error!`/`warn!`

### Commit Messages

Conventional Commits (commitlint enforced):

```
type(scope): subject
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

### Pre-commit Hooks (Husky)

1. lint-staged (ESLint + Prettier on staged files)
2. verify-command-registration.mjs
3. cargo fmt --check
4. cargo clippy
5. commitlint

### Project Structure

```
upwork-researcher/
  src/                  # React frontend
    components/         # UI components
    features/           # Feature modules
    hooks/              # Custom hooks
    stores/             # Zustand stores
    styles/             # CSS tokens
    types/              # TypeScript types
  src-tauri/            # Rust backend
    src/commands/       # Tauri commands
    src/db/             # Database
  tests/e2e/            # Playwright tests
  tests/performance/    # Benchmarks
```

### Path Alias

Use `@/` for src imports: `import { x } from "@/stores/useSettingsStore"`
