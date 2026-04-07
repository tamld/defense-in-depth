---
id: RULE-CONTRIBUTION-WORKFLOW
status: active
version: 1.0.0
enforcement: deterministic
---

# RULE: Contribution Workflow

> How code flows from idea to main branch.

## Flow

```mermaid
flowchart TD
    A["Fork + Branch<br/>feat/my-feature"] --> B["Implement<br/>(follow rule-consistency)"]
    B --> C["npm run lint<br/>npm test"]
    C -->|fail| B
    C -->|pass| D["PR to main<br/>(conventional commit title)"]
    D --> E["CI Pipeline<br/>(3 OS × 3 Node)"]
    E -->|fail| B
    E -->|pass| F["CodeRabbit Review"]
    F -->|changes requested| B
    F -->|LGTM| G{"Breaking change?"}
    G -->|Yes| H["Human maintainer review"]
    G -->|No| I["Auto-merge (squash)"]
    H -->|Approved| I
    I --> J["CHANGELOG updated"]
```

## Auto-Merge Criteria

A PR can be auto-merged when ALL of these are true:
1. ✅ CI green (all 9 matrix jobs)
2. ✅ CodeRabbit approves
3. ✅ No breaking changes
4. ✅ Conventional commit title
5. ✅ CHANGELOG updated (if user-facing)

## Breaking Changes

A breaking change is any PR that:
- Changes the `Guard` interface
- Changes the `DefendConfig` schema
- Removes or renames a built-in guard
- Changes CLI command syntax

Breaking changes require:
- Human maintainer review
- Major or minor version bump
- Migration guide in CHANGELOG
