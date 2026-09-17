# defense-in-depth Quickstart

> **TL;DR** Install hooks, get 14 guards by default, optionally enable lessons/hints/federation/injection/meta-growth.

```bash
npx defense-in-depth init        # install hooks + create config
git commit -m "feat: add auth"   # hooks run on commit
```

---

## What's Protected by Default?

| Guard | Status | What it catches |
|:---|:---:|:---|
| Hollow Artifact | ✅ ON | Files with TODO, TBD, PLACEHOLDER |
| SSoT Pollution | ✅ ON | Config/governance files in feature branches |
| Root Pollution | ✅ ON | Non-config files at repo root |
| Commit Format | ✅ ON | Non-conventional commit messages |
| Branch Naming | ❌ OFF | Enable in config to enforce patterns |
| Phase Gate | ❌ OFF | Enable to require plan files before code |
| Ticket Identity | ❌ OFF | Enable to verify commit TKIDs |
| HITL Review | ❌ OFF | Enable human-in-the-loop review gate |
| Federation | ❌ OFF | Enable ticket sync (Linear/Jira/HTTP/File) |
| Secret Detection | ❌ OFF | Detect secrets in staged files |
| File Size Limit | ❌ OFF | Enforce max file size |
| Dependency Audit | ❌ OFF | Scan deps for vulnerabilities |
| No Type Safety Bypass | ✅ ON | Block `as any`, `@ts-ignore`, `as any` |
| No Swallowed Error | ❌ OFF | Block empty catch blocks |
| No Stub Return | ❌ OFF | Block stub/mock returns in production |
| No Trivially True Test | ❌ OFF | Block tests that always pass |
| Self Protection | ✅ ON | Guard defense-in-depth's own config |

> **Total: 14 guards, 4 ON by default** (Hollow Artifact, SSoT Pollution, Root Pollution, Commit Format, No Type Safety Bypass, Self Protection)

---

## Next: Unlock Tier 1 Features

| Feature | Command | What it unlocks |
|:---|:---|:---|
| **Lessons System** | Built-in | Record, search, deduplicate cross-project lessons |
| **Progressive Discovery Hints** | Built-in | Earned hints + lesson injection on guard failure |
| **Federation Providers** | Config | Linear, Jira, HTTP, File ticket sync |
| **Meta Growth Metrics** | `metrics f1` / `metrics meta-growth` | F1 scores + system acceleration tracking |

---

## 5-Minute Feature Tour

### 1. Lessons System (cross-project memory)
```bash
# Record a lesson from a fix
npx defense-in-depth lesson record \
  --title "Recurring CONSOLE-LOG pattern" \
  --wrong-approach "Used console.log for debugging" \
  --correct-approach "Use structured logger (pino/winston)" \
  --tags console-log,debugging \
  --category process

# Search lessons
npx defense-in-depth lesson search --tags console-log

# Deduplicate lessons
npx defense-in-depth lesson dedup --threshold 0.8 --format table
```

### 2. Progressive Discovery Hints + Lesson Injection
```bash
# Health check with all hints
npx defense-in-depth doctor --hints all

# Verify with inline lesson injection
npx defense-in-depth verify --files src/auth.ts

# Example injection output:
# ❌ Hollow Artifact Detector
#    🚫 TODO found in src/auth.ts
# 💡 Relevant lessons from past failures:
#    📚 L-abc123 Recurring TODO pattern (74 occurrences)
#       → Replace TODO with proper implementation or ticket reference
```

### 3. Federation (ticket sync)
```yaml
# defense.config.yml
federation:
  enabled: true
  provider: linear
  linear:
    apiKey: ${LINEAR_API_KEY}
    teamId: "team-xyz"
```

### 4. Meta Growth Metrics
```bash
# F1 scores from guard feedback
npx defense-in-depth metrics f1 --format table --period 30d

# System acceleration snapshot
npx defense-in-depth metrics meta-growth --period 90d --format json
```

---

## Next Steps

- [CLI Reference](./user-guide/cli-reference.md) — All 11 commands with examples
- [Configuration Reference](./user-guide/configuration.md) — All config options
- [Writing Custom Guards](./dev-guide/writing-guards.md) — Create your own validators
- [Lessons System](./user-guide/lessons.md) — Record, search, deduplicate lessons
- [Progressive Discovery Hints](./user-guide/hints.md) — Earned hints + lesson injection
- [Federation Providers](./dev-guide/federation.md) — Linear/Jira/HTTP/File ticket sync
- [Meta Growth Metrics](./user-guide/metrics.md) — F1 + MetaGrowthSnapshot
- [Vision: Meta Architecture](./vision/meta-architecture.md) — Where this project is heading

---

## Philosophy

**Defense in depth** = multiple overlapping guards, not one perfect guard.
- Guards catch different failure modes
- Lessons prevent recurring mistakes across projects
- Hints surface features when you've earned them
- Federation links local commits to external tickets
- Meta-growth measures if the system is actually improving

All local. All privacy-first. No cloud required.
