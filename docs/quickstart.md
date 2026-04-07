# Quick Start Guide

> From zero to governance in 60 seconds.

---

## Prerequisites

- **Node.js ≥ 18** (any platform: Windows, macOS, Linux)
- **Git** (any project with a `.git` directory)

---

## Install

```bash
# Option 1: Global install
npm install -g defend-in-depth

# Option 2: Project dependency
npm install --save-dev defend-in-depth

# Option 3: Run without installing
npx defend-in-depth init
```

## Initialize

```bash
# Installs Git hooks + creates defend.config.yml
npx defend-in-depth init

# Verify everything is working
npx defend-in-depth doctor
```

**What `init` does:**
1. Creates `defend.config.yml` in your project root
2. Installs `pre-commit` and `pre-push` Git hooks
3. Enables `hollow-artifact` and `ssot-pollution` guards by default

## Test It

```bash
# Create a hollow file
echo "# TODO: Write this later" > test-hollow.md

# Stage it
git add test-hollow.md

# Try to commit — guard will BLOCK
git commit -m "feat: add test file"
# Output:
# 🛡️ defend-in-depth
# ❌ BLOCK: hollow-artifact
#   → test-hollow.md contains placeholder content (TODO)
#   Fix: Replace placeholder with actual content

# Clean up
rm test-hollow.md
```

## What's Protected by Default?

| Guard | Status | What it catches |
|:---|:---:|:---|
| Hollow Artifact | ✅ ON | Files with TODO, TBD, PLACEHOLDER |
| SSoT Pollution | ✅ ON | Config/governance files in feature branches |
| Commit Format | ✅ ON | Non-conventional commit messages |
| Branch Naming | ❌ OFF | Enable in config to enforce patterns |
| Phase Gate | ❌ OFF | Enable to require plan files before code |

## Enable More Guards

Edit `defend.config.yml`:

```yaml
guards:
  branchNaming:
    enabled: true
    pattern: "^(feat|fix|chore|docs)/.*"

  phaseGate:
    enabled: true
    planFile: "plan.md"
```

## Next Steps

- [Writing Custom Guards](./guide-writing-guards.md) — Create your own validators
- [Configuration Reference](./configuration.md) — All config options
- [Vision: Meta Architecture](./vision/meta-architecture.md) — Where this project is heading
