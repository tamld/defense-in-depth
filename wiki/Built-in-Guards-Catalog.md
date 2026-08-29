# Built-in Guards Catalog

> **Authoritative reference for all 9 built-in deterministic guards in `defense-in-depth`.**

---

## 📋 Guard Overview Matrix

| Guard ID | Default | Severity | Hook Trigger | Primary Anti-Pattern Prevented |
|:---|:---:|:---:|:---:|:---|
| [`hollow-artifact`](#1-hollow-artifact-guard) | ✅ ON | `BLOCK` | `pre-commit` | Unfilled `TODO`/`TBD`/`PLACEHOLDER` tokens and empty file scaffolding |
| [`ssot-pollution`](#2-ssot-pollution-guard) | ✅ ON | `BLOCK` | `pre-commit` | Committing edits to protected governance files (`.agents/**`, `backlog.yml`) |
| [`root-pollution`](#3-root-pollution-guard) | ✅ ON | `BLOCK` | `pre-commit` | Adding unauthorized files/folders directly in the project root directory |
| [`commit-format`](#4-commit-format-guard) | ✅ ON | `WARN` | `commit-msg` | Non-conventional commit messages (`feat(...)`, `fix(...)`, `docs(...)`) |
| [`branch-naming`](#5-branch-naming-guard) | ❌ OFF | `WARN` | `pre-push` | Branch names failing pattern checks (`feat/*`, `fix/*`, `chore/*`) |
| [`ticket-identity`](#6-ticket-identity-guard-tkid-lite) | ❌ OFF | `WARN` | `pre-commit` | Conflicting or missing ticket IDs in commit metadata |
| [`phase-gate`](#7-phase-gate-guard) | ❌ OFF | `BLOCK` | `pre-commit` | Committing feature code without an approved `implementation_plan.md` |
| [`hitl-review`](#8-hitl-review-guard) | ❌ OFF | `BLOCK` | `pre-commit` | Modifying protected business files without human reviewer sign-off |
| [`federation`](#9-federation-guard) | ❌ OFF | `BLOCK` | `pre-commit` | Inconsistent ticket states across parent-child federated repositories |

---

### 1. Hollow Artifact Guard

- **Guard ID**: `hollow-artifact`
- **Hook**: `pre-commit`
- **Default Severity**: `BLOCK`
- **Config Key**: `guards.hollowArtifact`

#### Purpose
AI coding agents frequently scaffold markdown files or implementation templates filled with placeholder markers (e.g., `// TODO: implement later`, `<!-- TBD -->`, `[PLACEHOLDER]`). This guard blocks any staged artifact containing these tokens.

#### Configuration Example
```yaml
guards:
  hollowArtifact:
    enabled: true
    minContentLength: 50
    bannedTokens:
      - "TODO"
      - "TBD"
      - "PLACEHOLDER"
      - "FIXME"
    useDspy: false # Set to true to enable optional DSPy semantic analysis
```

---

### 2. SSoT Pollution Guard

- **Guard ID**: `ssot-pollution`
- **Hook**: `pre-commit`
- **Default Severity**: `BLOCK`
- **Config Key**: `guards.ssotPollution`

#### Purpose
Prevents feature branches from modifying Single Source of Truth (SSoT) governance files. Only dedicated governance branches are permitted to edit files under `.agents/` or system state stores.

#### Configuration Example
```yaml
guards:
  ssotPollution:
    enabled: true
    protectedPaths:
      - ".agents/rules/**"
      - ".agents/contracts/**"
      - "backlog.yml"
```

---

### 3. Root Pollution Guard

- **Guard ID**: `root-pollution`
- **Hook**: `pre-commit`
- **Default Severity**: `BLOCK`
- **Config Key**: `guards.rootPollution`

#### Purpose
Prevents agents from scattering temporary scripts (`test.js`, `temp.py`, `debug.log`) at the project root directory.

#### Allowed Defaults
- Standard dotfiles (`.gitignore`, `.npmrc`, `.editorconfig`)
- Standard config files (`package.json`, `tsconfig.json`, `defense.config.yml`)
- Standard documentation (`README.md`, `LICENSE`, `SECURITY.md`, `AGENTS.md`)

---

### 4. Commit Format Guard

- **Guard ID**: `commit-format`
- **Hook**: `commit-msg`
- **Default Severity**: `WARN`
- **Config Key**: `guards.commitFormat`

#### Purpose
Validates that commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) specification (`type(scope): description`).

---

### 5. Branch Naming Guard

- **Guard ID**: `branch-naming`
- **Hook**: `pre-push`
- **Default Severity**: `WARN`
- **Config Key**: `guards.branchNaming`

#### Purpose
Ensures that local branches follow organizational naming conventions before pushing to remotes (e.g. `feat/ticket-123`, `fix/login-bug`).

---

### 6. Ticket Identity Guard (TKID Lite)

- **Guard ID**: `ticket-identity`
- **Hook**: `pre-commit`
- **Default Severity**: `WARN`
- **Config Key**: `guards.ticketIdentity`

#### Purpose
Extracts ticket IDs (e.g. `TK-1234` or `#42`) from branch names or commit messages and validates them against local state or remote ticket providers.

---

### 7. Phase Gate Guard

- **Guard ID**: `phase-gate`
- **Hook**: `pre-commit`
- **Default Severity**: `BLOCK`
- **Config Key**: `guards.phaseGate`

#### Purpose
Enforces the "Plan before Code" discipline. Committing code changes in `src/` requires an accompanying `implementation_plan.md` or active plan ticket.

---

### 8. HITL Review Guard

- **Guard ID**: `hitl-review`
- **Hook**: `pre-commit`
- **Default Severity**: `BLOCK`
- **Config Key**: `guards.hitlReview`

#### Purpose
Protects critical production files (e.g., payment logic, database migrations) by requiring a verified human signature marker before commits are permitted.

---

### 9. Federation Guard

- **Guard ID**: `federation`
- **Hook**: `pre-commit`
- **Default Severity**: `BLOCK`
- **Config Key**: `guards.federation`

#### Purpose
Validates ticket state synchronization across multi-repo hierarchies using File or HTTP providers.
