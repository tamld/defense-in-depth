# CLI Reference & Tooling

> **Comprehensive manual for the `defense-in-depth` command-line interface.**

---

## 💻 Command Summary

```bash
npx defense-in-depth <command> [options]
```

| Command | Summary | Primary Use Case |
|:---|:---|:---|
| `init` | Initialize configuration and Git hooks | Repository onboarding |
| `verify` | Execute the guard pipeline against target files | Pre-commit checks & CI validation |
| `doctor` | Diagnose repository and hook health | Setup troubleshooting |
| `feedback` | Ingest human review labels into Án Lệ memory | Feedback loop & F1 calibration |
| `lesson` | Record or query architectural lessons | Knowledge retrieval |
| `eval` | Run semantic evaluation via DSPy | Tier 1 quality testing |
| `growth` | Report precision, recall, and governance metrics | Pipeline observability |
| `hints-emit` | Emit earned progressive discovery hints | Interactive developer feedback |

---

## 1. `init`

Initializes `defense-in-depth` inside the current repository.

```bash
# Standard installation (recommended)
npx defense-in-depth init

# Scaffold the full .agents/ governance kit as well
npx defense-in-depth init --scaffold

# Overwrite existing configuration if already present
npx defense-in-depth init --force
```

---

## 2. `verify`

Executes enabled guards against staged, modified, or all files.

```bash
# Verify currently staged files (used by pre-commit hook)
npx defense-in-depth verify --staged

# Verify all tracked files in the workspace
npx defense-in-depth verify --all

# Verify specific files
npx defense-in-depth verify --files "src/core/engine.ts,src/guards/hollow-artifact.ts"

# Output structured JSON for automated tooling
npx defense-in-depth verify --json
```

---

## 3. `doctor`

Runs a diagnostic suite to verify Node version, configuration syntax, hook executability, and git status.

```bash
npx defense-in-depth doctor

# Inspect progressive discovery hints eligibility
npx defense-in-depth doctor --hints

# Dismiss a specific hint by ID
npx defense-in-depth doctor --hints dismiss H-001-no-dspy
```

---

## 4. `feedback` & `lesson` (Án Lệ Memory Loop)

```bash
# Ingest human review feedback for a guard finding
npx defense-in-depth feedback --finding-id "hollow-artifact-1" --label "TP"

# Query recorded lessons by tag
npx defense-in-depth lesson --tag "security"

# Record a new architectural case law lesson
npx defense-in-depth lesson record --tag "auth" --summary "Always use constant-time comparison for tokens"
```
