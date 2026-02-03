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
