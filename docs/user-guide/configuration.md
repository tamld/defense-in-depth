# Configuration Guide

> This guide relies on `defense.config.yml` which is generated in your project root after running `npx defense-in-depth init`.

## Built-in Guards

| Guard | Default | Severity | What It Catches |
|:---|:---:|:---:|:---|
| **Hollow Artifact** | ✅ ON | BLOCK | Files with only `TODO`, `TBD`, empty templates |
| **SSoT Pollution** | ✅ ON | BLOCK | Config/state files modified in feature branches |
| **Commit Format** | ✅ ON | WARN | Non-conventional commit messages |
| **Branch Naming** | ❌ OFF | WARN | Branch names not matching pattern |
| **Phase Gate** | ❌ OFF | BLOCK | Code committed without a plan file |
| **Ticket Identity** | ❌ OFF | WARN | Commit references a conflicting ticket |

### Severity Levels

| Level | Emoji | Effect |
|:---|:---:|:---|
| **PASS** | 🟢 | No issues found |
| **WARN** | ⚠️ | Issues flagged, commit allowed |
| **BLOCK** | 🔴 | Commit rejected, must fix first |

---

## Configuration Schema

The `defense.config.yml` file configures the behavior of the built-in guards.

```yaml
version: "1.0"

guards:
  # Prevents hollow template files
  hollowArtifact:
    enabled: true
    extensions: [".md", ".json", ".yml", ".yaml"]
    minContentLength: 50

  # Protects Single Source of Truth files from casual edits
  ssotPollution:
    enabled: true
    protectedPaths:
      - ".agents/"
      - "records/"

  # Enforces Conventional Commits syntax
  commitFormat:
    enabled: true
    pattern: "^(feat|fix|chore|docs|refactor|test|style|perf|ci)(\\(.+\\))?:\\s.+"

  # Enforces Branch naming rules
  branchNaming:
    enabled: false
    pattern: "^(feat|fix|chore|docs)/[a-z0-9-]+$"

  # Enforces TDD / Execution Plan gates
  phaseGate:
    enabled: false
    planFiles: ["implementation_plan.md", "design_spec.md"]

  # Enforces Ticket Identity (TKID) non-contradiction
  ticketIdentity:
    enabled: false
    tkidPattern: "TK-[0-9A-Z-]+"
    severity: "warn"
```
