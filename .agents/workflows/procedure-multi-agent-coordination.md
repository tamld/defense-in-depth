---
id: WORKFLOW-MULTI-AGENT-COORDINATION
status: active
version: 1.0.0
enforcement: advisory
description: Coordination workflow for Jules, CodeRabbit, and human maintainers
---

# Workflow: Multi-Agent Coordination

> **Scope: DiD Internal Operational Strategy**
>
> This workflow documents how defense-in-depth's development team (human +
> operational agents) leverages external AI tools (Jules, CodeRabbit) to
> optimize the development pipeline. NOT a requirement for DiD users.

## Agent Classification

- **Operational Agents** (Human + Main Agent): Core team. Human commands,
  Main Agent (Gemini/Claude) executes. Interactive, real-time, trusted.
- **External Agents** (Jules, CodeRabbit): Third-party tools. Async,
  autonomous within boundaries, constrained by config files.

## Decision Flowchart: Who Should Do This Task?

```mermaid
flowchart TD
    TASK["📋 New Task / Issue"] --> ASSESS{"Assess complexity"}

    ASSESS -->|"Simple, scoped,<br/>well-defined"| JULES_Q{"Modifies<br/>governance files?"}
    ASSESS -->|"Architectural,<br/>multi-system"| MAIN["⚙️ Main Agent<br/>(interactive session)"]
    ASSESS -->|"Strategic,<br/>policy change"| HUMAN["👨‍💼 Human only"]

    JULES_Q -->|"No"| JULES["🤖 Assign to Jules<br/>Label issue: jules"]
    JULES_Q -->|"Yes"| MAIN

    JULES --> JP["Jules creates PR"]
    MAIN --> MP["Agent creates PR"]

    JP --> CR["🔍 CodeRabbit auto-reviews"]
    MP --> CR

    CR -->|"Comments only"| HITL["👨‍💼 Human review"]
    CR -->|"Request Changes"| DECIDE{"Severity?"}

    DECIDE -->|"Simple fix<br/>(typo, style)"| JULES_FIX["🤖 New Jules task<br/>to fix"]
    DECIDE -->|"Design issue<br/>(architecture)"| HUMAN_FIX["👨‍💼 Human decides"]

    JULES_FIX --> JP
    HUMAN_FIX --> MAIN

    HITL -->|"Approve + Merge"| DONE["✅ Merged to main"]
```

## Task Suitability Matrix

| Task Type | Jules | Main Agent | Human |
|---|:---:|:---:|:---:|
| Write new tests | ✅ Best | ✅ OK | ⚠️ Slow |
| Fix bug (clear repro) | ✅ Best | ✅ OK | ⚠️ Slow |
| Add JSDoc/TSDoc | ✅ Best | ✅ OK | ❌ Waste |
| Update docs | ✅ Best | ✅ OK | ⚠️ Slow |
| Simple refactoring | ✅ Best | ✅ OK | ⚠️ Slow |
| New guard (template) | ⚠️ Maybe | ✅ Best | ⚠️ Slow |
| Architectural change | ❌ Avoid | ✅ Best | ✅ Oversight |
| Type system changes | ❌ Avoid | ✅ Best | ✅ Oversight |
| Governance changes | ❌ Avoid | ❌ Avoid | ✅ Only |
| Security patches | ❌ Avoid | ⚠️ Maybe | ✅ Best |
| Breaking changes | ❌ Avoid | ⚠️ Maybe | ✅ Required |

## Jules Task Lifecycle

### Creating a Jules Task

1. **Create GitHub Issue** with clear, specific description:
   - ✅ "Add edge-case tests for `HttpTicketProvider.resolve()` covering timeout and malformed JSON"
   - ❌ "Improve test coverage" (too vague)

2. **Add label `jules`** to the issue

3. **Jules auto-detects** the issue, reads `AGENTS.md`, generates a plan

4. **Review the plan** on [jules.google.com](https://jules.google.com) — approve or revise

5. **Jules executes**, runs tests, creates branch + PR

6. **CodeRabbit reviews** the PR automatically

7. **Human reviews** and merges (if all checks pass)

### Handling CodeRabbit Feedback on Jules PRs

```mermaid
flowchart TD
    CR_FEEDBACK["🔍 CodeRabbit comments<br/>on Jules PR"] --> TYPE{"Feedback type?"}

    TYPE -->|"Style/formatting"| IGNORE["Acknowledge.<br/>⚠️ Low priority."]
    TYPE -->|"Missing test cases"| NEW_TASK["Create new Jules issue:<br/>'Add tests for X'"]
    TYPE -->|"Architectural concern"| ESCALATE["🚨 Escalate to<br/>Main Agent or Human"]
    TYPE -->|"Bug found"| FIX_TASK["Create new Jules issue:<br/>'Fix bug in X'"]

    NEW_TASK --> JULES["🤖 Jules handles"]
    FIX_TASK --> JULES
    ESCALATE --> HUMAN["👨‍💼 Human decides"]
```

## Conflict Resolution

### Branch Conflicts

If Jules and Main Agent create PRs that touch the same files:
1. **Main Agent PR takes priority** (architectural authority)
2. Close the Jules PR
3. Re-create Jules issue to work on top of the merged Main Agent changes

### Review Disagreements

If CodeRabbit and human disagree:
1. **Human always wins** (HITL enforcement)
2. CodeRabbit's feedback is logged but overridable
3. Human documents rationale in PR comment for audit trail

---

## Anti-Patterns

| ❌ Don't | ✅ Do Instead |
|---|---|
| Give Jules vague tasks | Write specific, scoped issue descriptions |
| Let Jules modify governance files | Use `feat/jules-<description>` for non-governance tasks |
| Auto-merge Jules PRs | Always require human review |
| Ignore CodeRabbit feedback | Address or explicitly acknowledge each comment |
| Run multiple Jules tasks on overlapping files | Serialize related tasks |
| Use Jules for exploratory/research work | Use Main Agent interactively |
