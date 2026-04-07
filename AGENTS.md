# AGENTS.md — Self-Awareness & Interoperability Index

> **SYSTEM DIRECTIVE**: This file is auto-loaded by all AI agents operating in this project.
> It is the ROOT of all governance. Read this FIRST.

---

## Layer 0 — Identity (WHO this project is)

**Project**: defend-in-depth
**Type**: Open Source NPM Package (MIT)
**Purpose**: Git-based governance hooks for AI coding agents
**Parent**: Extracted from [AAOS](https://github.com/tamld/web-login-solo) (Autonomous Agent Operating System)
**Runtime**: TypeScript strict / Node.js ≥18 / CLI-first
**Status**: Active Development (v0.1.0)

### What This Project IS
- A lightweight governance middleware that runs as Git hooks
- A pluggable guard pipeline that validates code before it reaches Git history
- A cross-platform CLI tool (`npx defend-in-depth init/verify/doctor`)
- An extensibility framework via the `Guard` interface

### What This Project is NOT
- NOT a full AAOS deployment (no 14-state lifecycle, no PostgreSQL)
- NOT an AI agent or orchestrator
- NOT a replacement for CI/CD (complementary)
- NOT platform-specific (works with ANY AI agent, IDE, or workflow)

---

## Layer 1 — Immutable Laws

These are non-negotiable. No PR, no contributor, no agent may violate:

1. **TypeScript Strict Only** — No `any`, no `unknown` escape, no `.js` in core
2. **Git-Only Enforcement** — All validation happens through Git hooks. No runtime deps beyond Node
3. **Guards Must Be Pure** — No side effects beyond reading files. No network calls. No state mutation
4. **Evidence Over Plausibility** — Every claim must be verifiable. Tag: `[CODE]`, `[RUNTIME]`, `[INFER]`, `[HYPO]`
5. **Zero Hollow Artifacts** — No TODO/TBD/PLACEHOLDER in committed artifacts
6. **Conventional Commits** — All commits follow `type(scope): description`

---

## Layer 2 — For AI Agents

> [!CAUTION]
> **IF YOU ARE AN AI AGENT**: Do NOT read the full README. It is for humans.
> Load only what your current task requires:

| Mission | Load This |
|---------|-----------|
| Understanding the codebase | `src/core/types.ts` → `src/core/engine.ts` |
| Adding a new guard | `src/guards/hollow-artifact.ts` (reference impl) + `CONTRIBUTING.md` |
| Fixing a bug | `src/core/engine.ts` → relevant guard file |
| Documentation | `README.md` + `CHANGELOG.md` |
| Rules & standards | `.agents/rules/` directory |
| CI/CD | `.github/workflows/ci.yml` |

### Agent Responsibilities
1. **Read `.agents/rules/` before coding** — consistency rules are absolute
2. **Sign your work** — append `Executor: <your-model-name>` to artifacts
3. **Never commit SSoT files** — the `ssotPollution` guard will block you
4. **Test first** — `npm test` must pass before any PR

---

## Layer 3 — Architecture Map

```
defend-in-depth/
├── src/
│   ├── core/               # Mandatory Pillars (engine, types, config)
│   │   ├── types.ts        # Guard interface + future interfaces
│   │   ├── engine.ts       # Pipeline runner (sequential gate execution)
│   │   └── config-loader.ts # YAML config with deep merge defaults
│   ├── guards/             # Template Guards (pluggable validators)
│   │   ├── hollow-artifact.ts
│   │   ├── ssot-pollution.ts
│   │   ├── commit-format.ts
│   │   ├── branch-naming.ts
│   │   ├── phase-gate.ts
│   │   └── index.ts        # Barrel export
│   ├── hooks/              # Git hook generators
│   │   ├── pre-commit.ts
│   │   └── pre-push.ts
│   └── cli/                # CLI commands
│       ├── index.ts        # Entry point + router
│       ├── init.ts         # Install hooks + config
│       ├── verify.ts       # Run guards
│       └── doctor.ts       # Health check
├── templates/              # Shipped templates
├── .agents/rules/          # Immutable consistency rules
├── .github/                # CI + issue/PR templates
├── defend.config.yml       # User config (created by init)
└── tests/                  # Test suite
```

---

## Layer 4 — Growth & Federation

This project follows a **federation model** with AAOS:

```mermaid
flowchart LR
    AAOS["🪐 AAOS (Parent)"] -->|"Push: proven guards,<br/>patterns, rules"| DID["🛡️ defend-in-depth (OSS)"]
    DID -->|"Pull: community-contributed<br/>guards, improvements"| AAOS
    COMMUNITY["👥 Community"] -->|"PR: new guards,<br/>bug fixes, docs"| DID
```

**Contribution = Growth**: Every merged PR makes this project (and AAOS) smarter.
Community-discovered patterns are harvested back into the parent system.
