# T001 Scout Findings: Outdated Sections

## quickstart.md — Hero Section (lines 63-73)
**Current:**
```
## What's Protected by Default?

| Guard | Status | What it catches |
|:---|:---:|:---|
| Hollow Artifact | ✅ ON | Files with TODO, TBD, PLACEHOLDER |
| SSoT Pollution | ✅ ON | Config/governance files in feature branches |
| Commit Format | ✅ ON | Non-conventional commit messages |
| Branch Naming | ❌ OFF | Enable in config to enforce patterns |
| Phase Gate | ❌ OFF | Enable to require plan files before code |
| Ticket Identity | ❌ OFF | Enable to verify commit TKIDs |
```

**Issues:**
- Only 6 guards shown (now 14)
- No lessons system mentioned
- No hints system mentioned
- No federation mentioned
- No injection mentioned
- No meta-growth mentioned

**Should show all 14 guards with current defaults:**
- Hollow Artifact ✅ ON
- SSoT Pollution ✅ ON
- Root Pollution ✅ ON
- Commit Format ✅ ON
- Branch Naming ❌ OFF
- Phase Gate ❌ OFF
- Ticket Identity ❌ OFF
- HITL Review ❌ OFF
- Federation ❌ OFF
- Secret Detection ❌ OFF
- File Size Limit ❌ OFF
- Dependency Audit ❌ OFF
- No Type Safety Bypass ❌ OFF
- No Swallowed Error ❌ OFF
- No Stub Return ❌ OFF
- No Trivially True Test ❌ OFF
- Self Protection ❌ OFF

## quickstart.md — Next Steps (lines 89-92)
**Current:**
```
- [Writing Custom Guards](./dev-guide/writing-guards.md) — Create your own validators
- [Configuration Reference](./user-guide/configuration.md) — All config options
- [Vision: Meta Architecture](./vision/meta-architecture.md) — Where this project is heading
```

**Missing links to v1.1 features:**
- [Lessons System](./user-guide/lessons.md) — Record, search, deduplicate lessons
- [Progressive Discovery Hints](./user-guide/hints.md) — Earned hints + lesson injection
- [Federation Providers](./dev-guide/federation.md) — Linear/Jira/HTTP/File ticket sync
- [Meta Growth Metrics](./user-guide/metrics.md) — F1 + MetaGrowthSnapshot

## hints.md — Missing Injection Section
**Current sections:** Quick reference, The hint catalog, Output shape, Configuration, Why three layers of restraint

**Missing section needed:**
```
## Lesson Injection (v1.1+)

When a guard fails, relevant lessons from cross-project memory are automatically surfaced:

### In `verify` (inline, compact)
```
❌ Hollow Artifact Detector
   🚫 TODO found in src/auth.ts

💡 Relevant lessons from past failures:
  📚 L-abc123 Recurring TODO pattern (74 occurrences) [defense-in-depth]
     → Replace TODO with proper implementation or ticket reference
```

### In `doctor --hints all` (rich, with scores)
```
🧠 Injected Lessons (from cross-project memory):
  📚 L-abc123 Recurring CONSOLE-LOG pattern (190 occurrences) [aegis]
     → Use structured logger instead of console.log
     Match: wrongApproachPattern: console-log, tag: console-log, category: process (score: 0.87)
```

### How it works
- Matches `guardId` + `wrongApproachPattern` + `tags` + file path
- Scores 0-1: pattern match (0.4) + tag overlap (0.25) + file relation (0.25) + category (0.05) + evidence + confidence + recency
- Top 3 lessons shown
- Evidence-weighted: RUNTIME > INFER > HYPO
```

## meta-growth-roadmap.md — Phase Status Updates Needed

### Appendix A (lines 616-628) — Current:
| Phase | Version | Track | MVC Stage(s) | Pillars | Adoption-relevant? |
|:-:|:-:|:-:|:--|:--|:-:|
| B1 | v1.1.0 | B | 7 | 1, 2, 5, 6 | — |
| B2 | v1.1.1 | B | **5 (largest gap)** | 1, 5, 6, 7 | — |
| B3 | v1.1.2 | B | 4 | 1, 5 | — |
| B4 | v1.1.3 | B | 8 | 3 | — |
| B5 | v1.1.4 | B | 2 | 1, 2, Tier 0 | — |

**Should be (B1-B4 DONE):**
| Phase | Version | Track | MVC Stage(s) | Pillars | Status |
|:-:|:-:|:-:|:--|:--|:-:|
| B1 | v1.1.0 | B | 7 | 1, 2, 5, 6 | ✅ DONE |
| B2 | v1.1.x | B | 4 | 1, 5 | ✅ DONE |
| B3 | v1.1.x | B | **5 (largest gap)** | 1, 5, 6, 7 | ✅ DONE |
| B4 | v1.2.x | B | 3 | 1, 2, 5, 6 | ✅ DONE |
| B5 | v1.2.x | B | 2 | 1, 2, Tier 0 | ⏳ PENDING |

### Phase Descriptions (lines 278-545)
All B1-B4 phase descriptions marked as `[HYPO]` with "NOT shipped" — should be updated to reflect implementation with `[RUNTIME]` evidence.

### Exit Criteria (lines 241-246)
Track B unlock criteria met via self-dogfooding on 5 projects — should be noted.
