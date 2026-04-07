---
id: RULE-CONSISTENCY
status: active
version: 1.0.0
enforcement: deterministic
---

# RULE: Project Consistency Standards

> **Immutable. No exceptions. No PRs bypass these rules.**

## 1. Language & Type System

| Rule | Standard | Violation = |
|------|----------|------------|
| Source language | TypeScript `.ts` only | PR rejected |
| Strict mode | `strict: true` in tsconfig | Build fails |
| No `any` | Use proper generics or `unknown` with narrowing | PR rejected |
| Module system | ESM (`"type": "module"`) | Build fails |
| Node target | `ES2022` minimum | Build fails |

## 2. Folder Structure

```
src/
├── core/       # Engine, types, config-loader ONLY
├── guards/     # One file per guard + index.ts barrel
├── hooks/      # One file per git hook type
├── cli/        # CLI commands (one file per command)
└── index.ts    # Public API surface (re-exports only)
```

| Rule | Why |
|------|-----|
| One guard = one file | Isolation, testability, review-ability |
| Guards barrel via `index.ts` | Single import path for consumers |
| No nested subdirectories deeper than 2 levels | Flat hierarchy = discoverable |
| `core/` never imports from `guards/`, `cli/`, or `hooks/` | Dependency flows outward only |

## 3. Naming Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Files | `kebab-case.ts` | `hollow-artifact.ts` |
| Exported guards | `camelCase` + `Guard` suffix | `hollowArtifactGuard` |
| Interfaces | `PascalCase` | `GuardResult`, `DefendConfig` |
| Enums | `PascalCase` enum, `UPPER_CASE` values | `Severity.BLOCK` |
| Config keys | `camelCase` | `hollowArtifact`, `minContentLength` |
| CLI commands | `kebab-case` | `defend-in-depth verify` |
| Branches | `type/description` | `feat/add-new-guard` |
| Commits | Conventional commits | `feat(guards): add secret-detection` |

## 4. Guard Authoring Rules

Every guard MUST:

1. Implement the `Guard` interface from `core/types.ts`
2. Export a `const` (not a class) named `{name}Guard`
3. Be **pure**: no side effects beyond reading files
4. Handle its own errors (never throw uncaught)
5. Return findings with appropriate `Severity` (PASS/WARN/BLOCK)
6. Include `fix` suggestions in BLOCK findings
7. Be registered in `guards/index.ts` barrel

Every guard MUST NOT:

1. ❌ Make network requests
2. ❌ Write to the filesystem
3. ❌ Import from other guards (guards are independent)
4. ❌ Depend on external packages (stdlib + yaml only)
5. ❌ Use `process.exit()` (engine handles exit codes)

## 5. Configuration Rules

| Rule | Standard |
|------|----------|
| Config format | YAML only (`defend.config.yml`) |
| Config schema | Defined in `core/types.ts` |
| Defaults | Every config option has a sensible default |
| Deep merge | User values override defaults, missing values use defaults |
| Agent-facing docs | YAML frontmatter + Markdown body |

## 6. Testing Rules

| Rule | Standard |
|------|----------|
| Framework | Node.js built-in test runner (`node --test`) |
| One test file per guard | `tests/guards/hollow-artifact.test.ts` |
| Naming | `*.test.ts` |
| No mocks of filesystem | Use real temp directories |
| Assertions | `node:assert/strict` |

## 7. Documentation Rules

| File | Audience | Format |
|------|----------|--------|
| `README.md` | Humans (developers, architects) | Markdown with mermaid |
| `AGENTS.md` | AI agents (Claude, Cursor, etc.) | Structured routing table |
| `.agents/rules/*.md` | Both | YAML frontmatter + MD body |
| `CONTRIBUTING.md` | New contributors | Step-by-step guide |
| `CHANGELOG.md` | Release consumers | Keep a Changelog format |
| Code comments | Developers | JSDoc on exports only |

## 8. Dependency Rules

| Rule | Why |
|------|-----|
| Maximum 3 production dependencies | Minimal attack surface |
| Currently allowed: `yaml` | YAML config parsing |
| No `lodash`, no `chalk`, no `commander` | stdlib equivalents exist |
| Dev deps: `typescript`, `@types/node` only | Minimal build chain |

## Executable Logic

```javascript
WARN_IF_MATCHES: /require\(|\.js['"]|any\b|lodash|chalk|commander|process\.exit/i
```
