# Contributing to defense-in-depth

> Executor: Gemini-CLI

Thank you for your interest in contributing! This project follows strict standards to maintain quality.

## Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/defense-in-depth.git
cd defense-in-depth

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Run tests
npm test
```

## Rules (Non-Negotiable)

Before writing any code, read this first:
- [`.agents/philosophy/COGNITIVE_TREE.md`](.agents/philosophy/COGNITIVE_TREE.md) — Understand our core beliefs and philosophy

Then, review these foundational rules:
- [`.agents/rules/rule-consistency.md`](.agents/rules/rule-consistency.md) — Folder structure, naming, dependencies
- [`.agents/rules/rule-guard-lifecycle.md`](.agents/rules/rule-guard-lifecycle.md) — How to add new guards
- [`.agents/rules/rule-contribution-workflow.md`](.agents/rules/rule-contribution-workflow.md) — PR flow
- [`.agents/rules/rule-coderabbit-integration.md`](.agents/rules/rule-coderabbit-integration.md) — Automated PR Review Integration (Operational)

### The 5 Absolute Standards

1. **TypeScript strict** — No `any`, no exceptions
2. **Conventional commits** — `feat(guards): add new guard`
3. **One guard = one file** — in `src/guards/`
4. **One test per guard** — in `tests/guards/`
5. **Zero external deps** — stdlib + `yaml` only

## Adding a New Guard

1. Create `src/guards/my-guard.ts` implementing the `Guard` interface
2. Add to `src/guards/index.ts` barrel export
3. Add config type in `src/core/types.ts`
4. Create `tests/guards/my-guard.test.ts`
5. Update the guards table in [`docs/user-guide/configuration.md`](docs/user-guide/configuration.md)
6. PR with title: `feat(guards): add my-guard`

### Guard Requirements

- Must be a **pure function** (no side effects beyond reading files)
- Must handle its own errors
- Must run in <100ms for typical workloads
- Must include `fix` suggestions for BLOCK findings

## PR Process

1. Fork → Branch (`feat/my-feature`)
2. Follow conventional commits
3. Ensure `npm test` passes locally
4. Submit PR to `main`
5. CI runs on 3 OS × 3 Node versions
6. Automated Review Gateway (if configured)
7. Maintainer review for breaking changes

## Code of Conduct

Be respectful. Be constructive. Show evidence, not opinions.
