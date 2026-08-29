# Getting Started

> **Get up and running with `defense-in-depth` in less than 60 seconds.**

---

## 📋 Prerequisites

- **Node.js**: ≥ 18.0.0
- **Git**: Installed and initialized in your repository (`git init`)
- **Package Managers Supported**: `npm`, `pnpm`, `yarn`, `bun`

---

## ⚡ Quick Installation

Run the interactive initializer inside your existing project:

```bash
npx defense-in-depth init
```

### What `init` Does Automatically:
1. **Creates `defense.config.yml`** in your project root with production-ready defaults.
2. **Installs Git Hooks**:
   - `.git/hooks/pre-commit`: Runs fast deterministic guards on staged files.
   - `.git/hooks/pre-push`: Runs branch and federation checks before pushing.
3. **Enables Essential Guards**:
   - `hollow-artifact` (catches unfilled stub markers and empty templates).
   - `ssot-pollution` (prevents unauthorized modification of governance state).

---

## 🩺 Verifying Health

Run the built-in diagnostic tool to verify that your Git hooks and configuration are functioning correctly:

```bash
npx defense-in-depth doctor
```

### Expected Output:
```
✔ Node.js version >= 18.0.0
✔ defense.config.yml found and valid
✔ pre-commit hook installed and executable
✔ pre-push hook installed and executable

Health Score: 100% — All systems operational.
```

---

## 🔍 Manual Verification

To run all enabled guards against your current staged files at any time:

```bash
npx defense-in-depth verify
```

To scan the entire workspace (all files, staged and unstaged):

```bash
npx defense-in-depth verify --all
```

---

## 🤖 Optional: Scaffolding the AI Agent Governance Kit

If you are developing in an AI-heavy repository (using Cursor, Claude Code, Copilot, or Jules), scaffold the complete `.agents/` governance ecosystem:

```bash
npx defense-in-depth init --scaffold
```

This creates:
- `.agents/AGENTS.md` — The universal AI agent onboarding protocol.
- `.agents/rules/` — Immutable coding and architecture standards.
- `.agents/workflows/` — Standard operating procedures for tasks.
- `.agents/skills/` — Reusable agent capability definitions.

---

## 🚀 Server-Side Enforcement (GitHub Actions)

Local hooks can be bypassed using `git commit --no-verify`. To ensure that governance rules are strictly enforced across your team, add the official GitHub Action:

```yaml
# .github/workflows/defense.yml
name: defense-in-depth
on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: tamld/defense-in-depth/.github/actions/verify@v0.8.0
```
