# T001 Scout Findings: Stale Claims in Docs

## cli-reference.md
**Current:** Only 4 commands listed (init, verify, doctor)
**Missing commands (implemented):**
- `metrics f1` — F1 aggregation with --period, --format, --guard
- `metrics meta-growth` — Meta growth snapshot with --period, --format
- `lesson dedup` — Deduplication with --threshold, --format, --dry-run, --auto-merge
- `audit` — Read-only pattern extraction (v1.0)
- `feedback` — TP/FP/FN/TN recording (v0.7)
- `growth` — Growth metrics (v0.4)
- `eval` — DSPy semantic evaluation (v0.5, opt-in)

**Status:** ❌ Major gap — only 4/11 commands documented

## quickstart.md
**Current claims (v0.1 era):**
- "5 guards" (now 14)
- "Hollow Artifact, SSoT Pollution, Commit Format" enabled by default
- No mention of: lessons, hints, federation, injection, dedup, meta-growth

**Missing v1.1 features:**
- 14 guards (9 new: secretDetection, fileSizeLimit, dependencyAudit, noTypeSafetyBypass, noSwallowedError, noStubReturn, noTriviallyTrueTest, selfProtection, phaseGate, ticketIdentity, hitlReview, federation)
- Lessons system (record, search, outcome, scan-outcomes, recalls, dedup)
- Progressive Discovery hints (H-001 to H-004)
- Federation providers (Linear, Jira, HTTP, File)
- Injection (lessons surface on guard failure)
- Meta-growth metrics (f1, meta-growth)
- Audit command

**Status:** ❌ Major gap — describes v0.1, not v1.1

## hints.md
**Current:** Documents H-001 to H-004 (dspy, lessons, feedback, federation)
**Missing:** No mention of **lesson injection** in:
- `verify` command output (inline lessons on guard failure)
- `doctor --hints all` (rich lesson injection with scores)

**Status:** ❌ Gap — injection feature undocumented

## meta-growth-roadmap.md
**Current claims (B1-B5 as [HYPO] NOT shipped):**
- B1 F1 Aggregator: "NOT shipped" → **DONE** (v1.1.0-rc.1)
- B2 Dedup: "NOT shipped — largest gap" → **DONE** (v1.1.x)
- B3 Injection: "NOT shipped — largest gap" → **DONE** (v1.1.x)
- B4 MetaGrowthSnapshot: "NOT shipped" → **DONE** (v1.2.x)
- B5 Quality Gate: "NOT shipped" → **PENDING** (v1.1.x)

**Status:** ❌ Major gap — all 4 phases marked as [HYPO] NOT shipped but actually implemented

## Summary
| Doc File | Gap Severity | Missing Commands/Features |
|----------|--------------|---------------------------|
| cli-reference.md | Critical | 7 commands |
| quickstart.md | Critical | Entire v1.1 feature set |
| hints.md | Medium | Injection (B3) |
| meta-growth-roadmap.md | Critical | B1-B4 status wrong |
