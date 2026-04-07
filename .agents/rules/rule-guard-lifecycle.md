---
id: RULE-GUARD-LIFECYCLE
status: active
version: 1.0.0
enforcement: deterministic
---

# RULE: Guard Lifecycle

> How guards are proposed, implemented, reviewed, and shipped.

## Decision Flowchart

```mermaid
flowchart TD
    A["🆕 Guard idea"] --> B{"Does it prevent<br/>a real AI agent failure?"}
    B -->|"No"| C["Reject — not in scope"]
    B -->|"Yes"| D{"Pure function?<br/>No side effects?"}
    D -->|"No"| E["Redesign as pure"]
    D -->|"Yes"| F["Implement in<br/>src/guards/{name}.ts"]
    F --> G["Add to guards/index.ts"]
    G --> H["Write test in<br/>tests/guards/{name}.test.ts"]
    H --> I["Add config type<br/>in core/types.ts"]
    I --> J["Update README<br/>guards table"]
    J --> K["PR with<br/>conventional commit"]
```

## Guard Maturity Levels

| Level | Criteria | Config default |
|-------|----------|---------------|
| **Experimental** | New, limited real-world testing | `enabled: false` |
| **Stable** | Proven in ≥3 projects, low false-positive rate | `enabled: true` |
| **Core** | Fundamental to defend-in-depth identity | `enabled: true`, not removable |

## Evidence Requirements for New Guards

1. **Problem statement**: What AI agent behavior does this prevent?
2. **Real-world example**: Show a git diff where this guard would have caught the issue
3. **False positive analysis**: What legitimate code might this incorrectly flag?
4. **Performance impact**: Guard must complete in <100ms for typical workloads
