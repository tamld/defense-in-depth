---
id: WORKFLOW-TASK-EXECUTION
status: active
version: 1.0.0
enforcement: advisory
description: Simplified task execution workflow for defend-in-depth contributors
---

# Workflow: Task Execution

> Lite version of AAOS `procedure-task-execution`. Adapted for OSS contributors.

## Decision Flowchart

```mermaid
flowchart TD
    A["📋 Pick issue from backlog"] --> B["🔀 Fork + Branch<br/>feat/issue-description"]
    B --> C{"Guard or feature?"}
    
    C -->|"New Guard"| D["Read guard-interface.md<br/>+ hollow-artifact.ts (reference)"]
    C -->|"Bug fix"| E["Reproduce bug locally<br/>+ identify root cause"]
    C -->|"Feature"| F["Draft plan in<br/>PR description"]
    
    D --> G["Implement"]
    E --> G
    F --> G
    
    G --> H["Write / update tests"]
    H --> I["npm test<br/>npm run build"]
    I -->|fail| G
    I -->|pass| J["Self-verify:<br/>npx defend-in-depth verify"]
    J --> K["Commit with<br/>conventional format"]
    K --> L["Push + Create PR"]
    L --> M["CI pipeline<br/>(3 OS × 3 Node)"]
    M -->|fail| G
    M -->|pass| N["CodeRabbit review"]
    N --> O["Address feedback<br/>or merge"]
```

## Phases

### 1. Understand
- Read the issue description
- Check if related guards/code exist
- Load relevant `.agents/` rules

### 2. Plan (for non-trivial changes)
- Describe approach in PR description
- Identify blast radius (what other files are affected?)
- For new guards: document the AI behavior being prevented

### 3. Execute
- Follow `rule-consistency.md` strictly
- One logical change per commit
- Use conventional commit format

### 4. Verify
- Run `npm test` locally
- Run `npx defend-in-depth verify` on your own code (dogfooding)
- Ensure no `any` types, no external deps

### 5. Submit
- PR title = conventional commit format
- Fill out the PR template checklist
- Wait for CI + CodeRabbit

## When to Ask for Help
- Architecture changes → open Discussion first
- Breaking changes → label PR as `breaking`
- Unsure about approach → draft PR early for feedback
