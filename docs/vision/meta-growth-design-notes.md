# Meta Growth — Design Notes (NON-AUTHORITATIVE)

> **STATUS — NON-AUTHORITATIVE EXPLORATION**
>
> This document is preserved AS-IS as exploratory thinking from an extended AI-drafted, AI-reviewed design session.
>
> **Authority document**: see `meta-growth-mvc.md` (≤2 pages, [INFER]/[CODE] only).
>
> **Why this is NOT authority**:
>
> - **~90% of claims here are `[HYPO]`** by DiD's own evidence framework (`AGENTS.md` Layer 1 #4: *Evidence Over Plausibility*). Schemas, CLI surfaces, threshold numbers, sequencing — all guessed, none field-tested.
> - **Pillar 4 violation at meta-level**: this content was drafted by AI, reviewed by AI, revised by AI. No human-confirmed empirical signal validates any specific number, schema, or algorithm here.
> - **No `n + p` discipline**: Pillar 5 (Boundary-of-Claim Discipline) requires every claim to declare sample size and period. This document has neither for any threshold or metric.
> - **YAGNI**: dedup precedence, federation HMAC schemes, ed25519 quorums, semver-aware scope matching — all designed for hypothetical scenarios with zero corresponding field events.
>
> **How to use this document**:
>
> - As a **reference catalogue** of design ideas considered.
> - As a **starting point** when shipping a specific Meta Growth feature — but the implementation MUST justify any threshold/schema/algorithm with field data, not by citing this document.
> - As a **negative example** of what happens when an AI draft loop runs without human empirical grounding (per the self-audit recorded with the MVC).
>
> **What this document does NOT do**:
>
> - Bind any future PR.
> - Define any threshold that a CI gate may enforce.
> - Substitute for the MVC.
> - Constitute a "constitutional contract".
>
> Citations to this document in PR descriptions MUST be marked: *"per `meta-growth-design-notes.md` (NON-AUTHORITATIVE) — actual implementation justified by [evidence]"*.
>
> ---

## Index

1. **Part I — Original Contract v1** (15 sections; foundational schemas, lifecycle, dedup, aggregator, smelter, CLI, CI gates, tests, thresholds, versioning)
2. **Part II — Amendment v2** (6 sections; authority taxonomy, trust+scope, conflict precedence, forgetting+storage)
3. **Part III — Amendment v3** (9 sections; Tier A lifecycle, signature roadmap, eligibility/ranking/promising state, authorityRank, scope phasing, binding invariants)
4. **Part IV — Amendment v3.1** (6 patches; key rotation semantics, per-tier ceiling, break-glass, HMAC honesty, promisingMin spec, promisingSignals UX block)

---

## Part I — Original Contract v1

# Meta Growth Constitutional Contract — DiD v0.7.1 → v0.9.0

> **Document Type**: Design contract (pre-implementation, plan-first)
> **Authority**: STRATEGY.md Pillar #7 (Meta Layers — types published before impl)
> **Status**: DRAFT — pending maintainer approval
> **Author**: Devin-AI on behalf of `tamld`
> **Date**: 2026-04-27

This document is the **single source of truth** that v0.7.1 → v0.9.0 implementations must reference. Every PR opened against the Meta Growth subsystem MUST link this document and prove which clause it satisfies.

---

## Table of Contents

1. [Foundational Principles (recap)](#1-foundational-principles)
2. [Storage Layer — File Schemas](#2-storage-layer)
3. [Type Layer — TypeScript Contracts](#3-type-layer)
4. [Lifecycle Layer — 8 Stages](#4-lifecycle-layer)
5. [Feed Layer — 4 Injection Channels](#5-feed-layer)
6. [Dedup Engine — Algorithm + Policy](#6-dedup-engine)
7. [Aggregator Engine — Pure Functions](#7-aggregator-engine)
8. [Constitutional Smelter — Self-Modification](#8-constitutional-smelter)
9. [CLI Surface — Complete Command Matrix](#9-cli-surface)
10. [CI Gate Contract](#10-ci-gate-contract)
11. [Test Contracts](#11-test-contracts)
12. [Threshold Matrix](#12-threshold-matrix)
13. [Versioning + Migration](#13-versioning)
14. [Open Questions](#14-open-questions)
15. [Phased Sequencing](#15-sequencing)

---

## 1. Foundational Principles

### 1.1 The 7 Pillars (snapshot quality criteria)

| # | Pillar | One-line invariant |
|:-:|:--|:--|
| 1 | Deterministic Provenance | `MetaGrowthSnapshot` is a pure function of input event log + aggregator version |
| 2 | Falsifiability | Every metric has explicit threshold + direction + confidenceFloor |
| 3 | Temporal Locking | Snapshots are immutable; idempotent IDs (Án Lệ #2) |
| 4 | Anti Self-Validation | AI-source events have weight 0 in `lessonsEffective` unless human-confirmed |
| 5 | Boundary-of-Claim Discipline | Every snapshot declares period, eventCount, inputHash, confidenceFloor |
| 6 | Reproducibility on Cold Checkout | Aggregator runs identically on fresh clone with no env state |
| 7 | Closed-Loop Causality | Engine = loop enforced by CI gate, not service |

### 1.2 The 8-Stage Án Lệ Lifecycle (input supply chain)

```
1. DISTILLATION → 2. QUALITY GATE → 3. PERSISTENCE → 4. DEDUP
                                                          ↓
8. RETIREMENT ← 7. VERIFICATION ← 6. EXECUTION ← 5. INJECTION
```

### 1.3 The 4 Feed Channels (Stage 5 expanded)

- **Channel A — Bootstrap**: agent reads top-K lessons at session start
- **Channel B — Pre-action**: agent recalls top-3 relevant lessons before risky action
- **Channel C — On-trigger**: hint engine surfaces hints when state warrants (shipped v0.7)
- **Channel D — Federation**: anonymized lesson sync from federation hub

### 1.4 Tier discipline (STRATEGY.md Pillar #1)

| Tier | Components |
|:--|:--|
| Tier 0 (always available) | All schemas, all aggregators, dedup chiều 1+2, injection Channel A+B Tier-0 path, CI gate |
| Tier 1 (opt-in) | Dedup chiều 3 (DSPy semantic), injection Tier-1 ranking, quality gate scoring |
| Tier 2 (lazy-loaded) | Skill files referencing lessons by query, agent bootstrap docs |

---

## 2. Storage Layer

All append-only JSONL under `.agents/records/`. State files (mutable) under `.agents/state/`. Snapshot files under `.agents/state/snapshots/`.

### 2.1 File inventory

| Path | Type | Stage | Mutability |
|:--|:--:|:-:|:--|
| `.agents/records/lessons.jsonl` | append-only | 1-3 | append-only |
| `.agents/records/lesson-recalls.jsonl` | append-only | 6 | append-only |
| `.agents/records/lesson-outcomes.jsonl` | append-only | 7 | append-only |
| `.agents/records/feedback.jsonl` | append-only | 7 | append-only |
| `.agents/records/meta-growth-snapshots.jsonl` | append-only | 8 (output) | append-only |
| `.agents/records/smelter-proposals.jsonl` | append-only | 8 (loop) | append-only |
| `.agents/state/hints-shown.json` | atomic JSON | 5C | atomic write |
| `.agents/state/dedup-clusters.json` | atomic JSON | 4 | atomic write |
| `.agents/state/injection-digest.md` | atomic markdown | 5A | atomic write |

### 2.2 Lesson event schema (extends existing `Lesson` interface)

Each line in `lessons.jsonl`:

```json
{
  "id": "lesson:sha256:<wrongApproach+correctApproach+tags>",
  "version": 2,
  "createdAt": "2026-04-27T05:30:00Z",
  "updatedAt": "2026-04-27T05:30:00Z",
  "source": "human" | "ai" | "scan-outcome" | "feedback-aggregator",
  "executor": "tamld" | "Devin-AI" | "Gemini-CLI" | "Claude-Code",
  "wrongApproach": "string (≥50 chars, must include concrete code/scenario)",
  "correctApproach": "string (≥50 chars, must include actionable steps)",
  "wrongApproachPattern": "string (regex, optional, used by scan-outcomes)",
  "tags": ["string", "..."],
  "relatedLessons": ["lessonId", "..."],
  "evidenceLevel": "CODE" | "RUNTIME" | "INFER" | "HYPO",
  "qualityScore": 0.0,
  "status": "active" | "archived" | "superseded" | "merged",
  "supersededBy": "lessonId | null",
  "mergedFrom": ["lessonId", "..."],
  "clusterId": "cluster:sha256:<canonical-id>",
  "recallStats": {
    "totalRecalls": 0,
    "helpfulRecalls": 0,
    "lastRecalledAt": "ISO | null"
  }
}
```

**Invariants**:
- `id` is content-addressable; recomputing on identical content yields identical ID (Án Lệ #2).
- `wrongApproach.length ≥ 50` AND `correctApproach.length ≥ 50` enforced at Stage 2 (Tier 0 quality gate).
- `evidenceLevel` defaults to `HYPO` if untagged; `HYPO` lessons are NOT eligible for injection (Channel A/B).
- `recallStats` is **derived** — recomputed on read from event logs, never authoritative on disk.
- `status` lifecycle: `active → superseded | merged | archived`. No reverse transitions.

### 2.3 LessonRecallEvent schema (extends existing)

```json
{
  "id": "recall:sha256:<lessonId+intent+sessionId>",
  "version": 1,
  "recordedAt": "2026-04-27T05:30:00Z",
  "lessonId": "lesson:...",
  "intent": "string (≤200 chars — what the agent was about to do)",
  "channel": "bootstrap" | "pre-action" | "hint" | "federation" | "manual-search",
  "executor": "Devin-AI",
  "ticketId": "TK-xxx | null",
  "matchedBy": "regex" | "tag-overlap" | "dspy-semantic",
  "matchScore": 0.0
}
```

### 2.4 LessonOutcome schema (extends existing)

```json
{
  "id": "outcome:sha256:<lessonId+source+executor>",
  "version": 1,
  "recordedAt": "2026-04-27T05:30:00Z",
  "lessonId": "lesson:...",
  "recalled": true,
  "helpful": true | false | null,
  "triggerScenario": "string",
  "source": "human-cli" | "scan-outcome" | "ai-self-rated",
  "executor": "tamld",
  "ticketId": "TK-xxx | null",
  "note": "string | null",
  "weight": 1.0
}
```

**Invariants**:
- `weight` defaults: `human-cli=1.0`, `scan-outcome=0.5`, `ai-self-rated=0.0`. Hard-coded — Pillar 4 enforcement.
- Outcomes with `weight=0.0` are NOT counted in `lessonsEffective` (Pillar 4).

### 2.5 MetaGrowthSnapshot schema (NEW — extends existing type)

```json
{
  "id": "snapshot:sha256:<period+aggregatorVersion+inputHash>",
  "version": 1,
  "schemaVersion": 1,
  "aggregatorVersion": "1.0.0",
  "createdAt": "2026-04-27T05:30:00Z",
  "period": {
    "start": "2026-03-28T00:00:00Z",
    "end": "2026-04-27T00:00:00Z",
    "windowDays": 30
  },
  "inputs": {
    "lessonsHash": "sha256:...",
    "recallsHash": "sha256:...",
    "outcomesHash": "sha256:...",
    "feedbackHash": "sha256:...",
    "lessonsCount": 47,
    "recallsCount": 152,
    "outcomesCount": 38,
    "feedbackCount": 89
  },
  "metrics": {
    "lessonsCreated": 47,
    "lessonsEffective": 12,
    "lessonSpecificityScore": 0.74,
    "guardFalsePositiveTrend": "improving",
    "timeToGuardHours": 18.5,
    "communityContributions": 3,
    "recallPrecision": 0.81,
    "coverageGap": 0.12,
    "guardF1": {
      "hollowArtifact": 0.92,
      "ssotPollution": 0.78
    }
  },
  "evidence": {
    "lessonsCreated": "CODE",
    "lessonsEffective": "CODE",
    "lessonSpecificityScore": "RUNTIME",
    "guardFalsePositiveTrend": "RUNTIME",
    "timeToGuardHours": "INFER",
    "communityContributions": "CODE",
    "recallPrecision": "CODE",
    "coverageGap": "INFER"
  },
  "confidence": {
    "guardFalsePositiveTrend": {
      "sampleSize": 47,
      "confidenceFloor": 30,
      "sufficient": true
    },
    "lessonSpecificityScore": {
      "sampleSize": 47,
      "confidenceFloor": 30,
      "sufficient": true
    },
    "recallPrecision": {
      "sampleSize": 38,
      "confidenceFloor": 30,
      "sufficient": true
    },
    "coverageGap": {
      "sampleSize": 12,
      "confidenceFloor": 30,
      "sufficient": false
    }
  },
  "thresholds": {
    "guardFalsePositiveTrend": { "direction": "lower-is-better", "warn": 0.10, "block": 0.20 },
    "lessonSpecificityScore": { "direction": "higher-is-better", "warn": 0.50, "block": 0.30 },
    "recallPrecision": { "direction": "higher-is-better", "warn": 0.70, "block": 0.50 }
  },
  "previousSnapshotId": "snapshot:... | null",
  "delta": {
    "lessonSpecificityScore": +0.04,
    "recallPrecision": -0.03
  },
  "insufficientSignal": ["coverageGap"],
  "verdict": "passing" | "warn" | "blocking",
  "evidenceTier": "CODE" | "MIXED" | "DEGRADED"
}
```

**Invariants**:
- `id` recomputed on identical inputs → identical ID. Determinism test must verify (Pillar 6).
- `verdict = blocking` IFF any non-`insufficientSignal` metric crosses its `block` threshold.
- `evidenceTier = CODE` IFF every `evidence.*` is `CODE` or `RUNTIME`. `INFER` anywhere → `MIXED`. `HYPO` → `DEGRADED` (export forbidden).
- Snapshot with `evidenceTier = DEGRADED` cannot be exported via `did metrics export` (Pillar 1+4 gate).
- `delta` computed from `previousSnapshotId` if present; null otherwise.

### 2.6 SmelterProposal schema (NEW — Stage 8 loop)

```json
{
  "id": "proposal:sha256:<patternSignature>",
  "version": 1,
  "createdAt": "2026-04-27T05:30:00Z",
  "triggerSnapshotId": "snapshot:...",
  "patternSignature": "guardFalsePositiveTrend.degrading.guardId=hollowArtifact",
  "consecutiveSnapshots": 3,
  "proposedLesson": {
    "wrongApproach": "string (auto-drafted)",
    "correctApproach": "string (human-authored)",
    "tags": ["meta-growth", "smelter-auto"]
  },
  "status": "open" | "accepted" | "rejected",
  "githubIssueUrl": "string | null",
  "humanResolvedAt": "ISO | null"
}
```

**Invariant**: `correctApproach` is intentionally blank in auto-drafted proposals — Pillar 4 forbids the system from prescribing the fix to itself. Human fills it. Until then, proposal sits in `open` and a hint surfaces (`H-008-smelter-pending`).

### 2.7 DedupCluster state (atomic JSON, Stage 4)

```json
{
  "version": 1,
  "computedAt": "2026-04-27T05:30:00Z",
  "lessonsHash": "sha256:...",
  "clusters": [
    {
      "clusterId": "cluster:sha256:<oldest-lesson-id>",
      "canonicalLessonId": "lesson:...",
      "memberLessonIds": ["lesson:...", "lesson:..."],
      "similarityChannels": {
        "patternEquivalence": true,
        "tagOverlap": 0.83,
        "semanticSimilarity": 0.94
      },
      "policy": "canonical" | "merge" | "conflict",
      "conflictReason": "string | null"
    }
  ]
}
```

---

## 3. Type Layer

All types in `src/core/types.ts`. Adds + modifications below.

### 3.1 Lesson (modify existing)

```typescript
export interface Lesson {
  // ... existing fields ...

  // v0.7.1 additions:
  evidenceLevel: EvidenceLevel;          // default HYPO
  qualityScore: number;                  // 0.0-1.0, set by Stage 2
  status: LessonStatus;                  // default "active"
  supersededBy: string | null;           // lesson id
  mergedFrom: ReadonlyArray<string>;     // lesson ids
  clusterId: string | null;              // dedup cluster id
}

export type LessonStatus = "active" | "archived" | "superseded" | "merged";
```

### 3.2 LessonRecallEvent (extend)

```typescript
export interface LessonRecallEvent {
  // ... existing ...

  // v0.7.1 additions:
  channel: RecallChannel;
  matchedBy: "regex" | "tag-overlap" | "dspy-semantic";
  matchScore: number;
}

export type RecallChannel =
  | "bootstrap"        // Channel A
  | "pre-action"       // Channel B
  | "hint"             // Channel C
  | "federation"       // Channel D
  | "manual-search";
```

### 3.3 LessonOutcome (extend)

```typescript
export interface LessonOutcome {
  // ... existing ...

  // v0.7.1 additions:
  source: OutcomeSource;
  weight: number;          // computed: human-cli=1.0, scan=0.5, ai=0.0
}

export type OutcomeSource = "human-cli" | "scan-outcome" | "ai-self-rated";
```

### 3.4 MetaGrowthSnapshot (replace existing)

```typescript
export interface MetaGrowthSnapshot {
  id: string;
  version: 1;
  schemaVersion: 1;
  aggregatorVersion: string;       // semver
  createdAt: string;
  period: SnapshotPeriod;
  inputs: SnapshotInputs;
  metrics: SnapshotMetrics;
  evidence: Record<keyof SnapshotMetrics, EvidenceLevel>;
  confidence: Record<keyof SnapshotMetrics, ConfidenceMarker>;
  thresholds: Record<keyof SnapshotMetrics, MetricThreshold>;
  previousSnapshotId: string | null;
  delta: Partial<Record<keyof SnapshotMetrics, number>>;
  insufficientSignal: ReadonlyArray<keyof SnapshotMetrics>;
  verdict: "passing" | "warn" | "blocking";
  evidenceTier: "CODE" | "MIXED" | "DEGRADED";
}

export interface SnapshotPeriod {
  start: string;
  end: string;
  windowDays: number;
}

export interface SnapshotInputs {
  lessonsHash: string;
  recallsHash: string;
  outcomesHash: string;
  feedbackHash: string;
  lessonsCount: number;
  recallsCount: number;
  outcomesCount: number;
  feedbackCount: number;
}

export interface SnapshotMetrics {
  lessonsCreated: number;
  lessonsEffective: number;
  lessonSpecificityScore: number;
  guardFalsePositiveTrend: number;       // numeric: % change
  timeToGuardHours: number;
  communityContributions: number;
  recallPrecision: number;
  coverageGap: number;
}

export interface ConfidenceMarker {
  sampleSize: number;
  confidenceFloor: number;
  sufficient: boolean;
}

export interface MetricThreshold {
  direction: "higher-is-better" | "lower-is-better";
  warn: number;
  block: number;
}
```

### 3.5 New types

```typescript
export interface DedupCluster {
  clusterId: string;
  canonicalLessonId: string;
  memberLessonIds: ReadonlyArray<string>;
  similarityChannels: {
    patternEquivalence: boolean;
    tagOverlap: number;
    semanticSimilarity: number | null;
  };
  policy: "canonical" | "merge" | "conflict";
  conflictReason: string | null;
}

export interface InjectionDigest {
  computedAt: string;
  topLessons: ReadonlyArray<{
    lessonId: string;
    rank: number;
    matchScore: number;
  }>;
}

export interface SmelterProposal {
  id: string;
  version: 1;
  createdAt: string;
  triggerSnapshotId: string;
  patternSignature: string;
  consecutiveSnapshots: number;
  proposedLesson: {
    wrongApproach: string;
    correctApproach: string;       // blank, must be human-filled
    tags: ReadonlyArray<string>;
  };
  status: "open" | "accepted" | "rejected";
  githubIssueUrl: string | null;
  humanResolvedAt: string | null;
}
```

---

## 4. Lifecycle Layer

### Stage 1 — Distillation

**Input sources**:
- Manual: `did lesson record` (human)
- Auto: `did lesson scan-outcomes` walks git log, matches `wrongApproachPattern`, opens scaffold
- Auto: `did metrics analyze --propose-lessons` examines feedback events; if guard X has FP rate > 0.3 over 10+ events, scaffold lesson

**Quality requirements before reaching Stage 2**:
- `wrongApproach.length ≥ 50` (Tier 0)
- `correctApproach.length ≥ 50` (Tier 0)
- `tags.length ≥ 1` (Tier 0)
- Optional: `qualityScore ≥ 0.5` via DSPy (Tier 1, opt-in)

### Stage 2 — Quality Gate

**Tier 0 fallback** (always runs):
- length checks
- forbidden phrases regex (no "always test code", "be careful", "remember to..." — Án Lệ generic)
- `wrongApproach` must contain at least one code-fence OR file-path

**Tier 1 enhancement** (opt-in DSPy):
- `qualityScore` derived from semantic specificity
- `score < 0.5` → reject

**Behavior on reject**:
- Stage 1 invocation fails with non-zero exit code
- Lesson NOT persisted to JSONL
- Error message tells user which check failed

### Stage 3 — Persistence

Pure append. Idempotent ID excluding timestamps. If ID already exists in file (re-record), the SECOND record updates `updatedAt` only. Never mutates first record.

### Stage 4 — Dedup

Triggered by:
- Manual: `did lesson dedup --dry-run|--apply`
- Auto: pre-aggregator hook (before each `did metrics meta-growth`)
- Auto: post-record hook (after each `did lesson record`)

See [Section 6](#6-dedup-engine).

### Stage 5 — Injection

See [Section 5](#5-feed-layer).

### Stage 6 — Execution

Implicit. The agent reads the injected lessons and acts. DiD does not enforce "did agent actually use this lesson?" at execution — that's Stage 7's job.

### Stage 7 — Verification

Two paths:
- **Explicit**: `did lesson outcome <id> --helpful|--not-helpful`
- **Implicit**: scan-outcomes detects re-occurrence of `wrongApproachPattern` → outcome with `helpful=false`

Aggregator combines both with weights (Pillar 4).

### Stage 8 — Retirement

Triggered when:
- Lesson has 0 recalls in 90 days AND `qualityScore < 0.7` → status `archived`
- Lesson dedup'd into a canonical → status `superseded`
- Lesson merged with another → status `merged`

Retired lessons stay in JSONL. Search default excludes `status != "active"`. Audit trail intact.

---

## 5. Feed Layer

### Channel A — Bootstrap (NEW)

**Mechanism**: agent reads `.agents/state/injection-digest.md` at session start.

**Generation**:
```
did lesson digest --top 10 --by recall-precision --format=markdown \
  > .agents/state/injection-digest.md
```

**Contract**:
- Digest is read-only artifact.
- Regenerated by pre-commit hook OR explicit CLI invocation.
- Top-K computed by `recallStats.helpfulRecalls / recallStats.totalRecalls`, ties broken by `qualityScore`.
- Lessons with `evidenceLevel = HYPO` excluded.
- Output format = markdown with stable structure (heading + 3-line summary per lesson).

**Agent bootstrap docs reference**:
- `AGENTS.md` adds: *"At session start, read `.agents/state/injection-digest.md` for current top-10 lessons."*
- `GEMINI.md`, `CLAUDE.md`, `.cursorrules` — same line.

### Channel B — Pre-Action (NEW)

**Mechanism**: agent invokes `did lesson recall --intent "..."` before risky action.

**Contract**:
```
did lesson recall \
  --intent "implement guard for X" \
  --tags guard,security \
  --top 3 \
  --format=json
```

**Output**: JSON array of lesson summaries (id, wrongApproach summary, matchScore, channel="pre-action").

**Behavior**:
- Tier 0 path (always): regex on `wrongApproachPattern` + tag overlap (Jaccard)
- Tier 1 path (opt-in DSPy): semantic similarity over `wrongApproach + correctApproach`
- Both paths return same shape; matchedBy field distinguishes.

**Skill integration**: each `.agents/skills/skill-*.md` MUST include a "Pre-Action Recall" section listing query templates relevant to that skill.

### Channel C — On-Trigger (✅ shipped v0.7)

Hint engine. Catalog v2 additions:

| Hint ID | Trigger predicate |
|:--|:--|
| H-005-low-f1 | Any guard with `guardF1 < 0.5` AND `confidenceFloor` met |
| H-006-stale-lessons | ≥ 5 lessons with `status=active` AND zero recalls in 90d |
| H-007-insufficient-signal | Latest snapshot has any metric in `insufficientSignal` |
| H-008-smelter-pending | ≥ 1 SmelterProposal in `open` status |

### Channel D — Federation (v0.9)

**Direction**: Hub → Local (pull). Local → Hub (push) is separate concern.

**Pull contract**:
```
did lesson sync --from-federation \
  --endpoint https://hub.example.com/lessons \
  --tags my-stack \
  --max 50
```

**Anonymization on Hub side** (out of scope for DiD core, but contract specified):
- PII regex scrub on `wrongApproach` / `correctApproach`
- File path normalization (replace user-specific paths with `<user>/<repo>/...`)
- Secret detection (entropy + known pattern list)

**Trust boundary**:
- Pulled lessons land with `evidenceLevel = INFER` regardless of source.
- They cannot be promoted to `CODE` without local verification (re-record by human).
- They are excluded from `lessonsEffective` calculation (Pillar 4 — federation is not local truth).

---

## 6. Dedup Engine

### 6.1 Three similarity channels

Each pair of lessons (A, B) is scored on 3 channels. Combined score determines policy.

#### Channel 1 — Pattern Equivalence (Tier 0, deterministic)

```
patternEquivalent(A, B) =
  normalize(A.wrongApproachPattern) == normalize(B.wrongApproachPattern)

normalize(pattern) =
  1. Strip leading/trailing whitespace
  2. Collapse internal whitespace runs to single space
  3. Sort top-level alternation branches lexicographically
  4. Normalize escape sequences to canonical form
  5. SHA-256 the result
```

Output: boolean.

#### Channel 2 — Tag Overlap (Tier 0, deterministic)

```
tagOverlap(A, B) = |A.tags ∩ B.tags| / |A.tags ∪ B.tags|     // Jaccard
```

Output: float in [0, 1].

#### Channel 3 — Semantic Similarity (Tier 1, DSPy)

```
semanticSimilarity(A, B) =
  cos(embed(A.wrongApproach + " | " + A.correctApproach),
      embed(B.wrongApproach + " | " + B.correctApproach))
```

Output: float in [-1, 1]. Treated as null when DSPy unavailable.

### 6.2 Policy decision matrix

| Channel 1 (pattern) | Channel 2 (tags) | Channel 3 (semantic) | Policy |
|:-:|:-:|:-:|:--|
| true | ≥ 0.75 | ≥ 0.92 (or null) | **canonical** — promote oldest, alias rest |
| true | ≥ 0.75 | < 0.92 (Tier 1 disagrees) | **conflict** — surface for human review |
| true | < 0.75 | any | **merge** — same fault class, different framing — propose merge |
| false | ≥ 0.90 | ≥ 0.95 | **merge** — different patterns, same insight |
| false | ≥ 0.75 | ≥ 0.92 | **conflict** — surface |
| false | < 0.75 | < 0.92 | distinct |

### 6.3 Canonical selection

Within a `canonical` cluster, the canonical lesson is chosen by:
1. Highest `recallStats.helpfulRecalls / recallStats.totalRecalls` (recall precision)
2. Highest `qualityScore` (tiebreak)
3. Earliest `createdAt` (tiebreak)
4. Lexicographically smallest `id` (final tiebreak — fully deterministic)

### 6.4 Merge semantics

Merge creates a NEW lesson:
```
mergedLesson = {
  wrongApproach: bestSpecificity(A.wrongApproach, B.wrongApproach),
  correctApproach: bestSpecificity(A.correctApproach, B.correctApproach),
  wrongApproachPattern: union(A.pattern, B.pattern),  // alternation
  tags: A.tags ∪ B.tags,
  mergedFrom: [A.id, B.id],
  evidenceLevel: min(A.evidence, B.evidence),  // CODE > RUNTIME > INFER > HYPO
  ...
}
```

`bestSpecificity` is decided by Tier 0 length check + Tier 1 quality score if available.

A and B get `status = "merged"`, `supersededBy = mergedLesson.id`.

### 6.5 Conflict semantics

When policy = `conflict`:
- DiD does NOT auto-merge.
- DiD opens a GitHub issue (if `federation.parentEndpoint` configured) with both lesson IDs and reason.
- Hint H-008-smelter-pending fires until human resolves.
- Aggregator excludes conflicted pair from `lessonsEffective`.

### 6.6 Idempotency contract

`did lesson dedup --apply` running twice on identical inputs MUST produce identical `dedup-clusters.json`. Tested via determinism CI gate.

---

## 7. Aggregator Engine

### 7.1 Pure function signatures

```typescript
function aggregateF1(
  events: ReadonlyArray<FeedbackEvent>,
  window: SnapshotPeriod,
  aggregatorVersion: string,
): GuardF1Snapshot;

function aggregateRecall(
  outcomes: ReadonlyArray<LessonOutcome>,
  recalls: ReadonlyArray<LessonRecallEvent>,
  window: SnapshotPeriod,
  aggregatorVersion: string,
): RecallSnapshot;

function aggregateMetaGrowth(
  inputs: {
    lessons: ReadonlyArray<Lesson>,
    recalls: ReadonlyArray<LessonRecallEvent>,
    outcomes: ReadonlyArray<LessonOutcome>,
    feedback: ReadonlyArray<FeedbackEvent>,
  },
  window: SnapshotPeriod,
  aggregatorVersion: string,
  previousSnapshot: MetaGrowthSnapshot | null,
): MetaGrowthSnapshot;
```

### 7.2 Determinism contract

- All aggregators MUST be pure.
- No `Date.now()` inside the function — caller injects `window.start` and `window.end`.
- No `crypto.randomUUID()` — IDs derived from inputs.
- No file I/O, no network.
- Test contract: 100 runs on identical input → 100 byte-identical outputs.

### 7.3 Hash computation

```
inputHash(file) = SHA-256(canonical(file))

canonical(jsonl) =
  1. Read each line, parse as JSON
  2. Filter to events whose timestamp ∈ window
  3. Sort by id (lexicographic)
  4. Re-serialize each event with sorted keys
  5. Join with '\n'
  6. UTF-8 encode
```

Snapshot ID:
```
snapshotId = "snapshot:sha256:" +
  SHA-256(period.start + period.end + aggregatorVersion +
          lessonsHash + recallsHash + outcomesHash + feedbackHash)
```

### 7.4 Specific metric computations

#### `lessonsCreated`
Count of lessons with `createdAt ∈ window` AND `evidenceLevel != "HYPO"` AND `status = "active"`.
**Evidence level**: `CODE`.

#### `lessonsEffective`
Sum over outcomes in window with `helpful=true`, weighted by `outcome.weight` (Pillar 4 enforcement). AI-source outcomes contribute 0.
```
lessonsEffective = Σ outcome.weight where outcome.helpful = true
```
**Evidence level**: `CODE`.

#### `lessonSpecificityScore`
Average of `qualityScore` for lessons in window.
- If qualityScore set by Tier 1 DSPy: evidence = `RUNTIME`
- If qualityScore null (DSPy unavailable): use Tier 0 fallback `length(wrongApproach + correctApproach) / 200`, capped at 1.0; evidence = `INFER`.

#### `guardFalsePositiveTrend`
Numeric: `(currentFP - previousFP) / previousFP` over window.
- `currentFP = count(feedback.label = "FP" in window) / count(feedback in window)`
- Categorical mapping: `< -0.05 = "improving", ±0.05 = "stable", > +0.05 = "degrading"`
**Evidence level**: `RUNTIME`.

#### `timeToGuardHours`
Median time between `feedback.createdAt` (FP/FN) and the first lesson tagged with the same guardId being recorded.
**Evidence level**: `INFER` (heuristic, may misclassify).

#### `communityContributions`
Count of lessons in window where `executor` is not in the trusted list (configurable, defaults to repo committers).
**Evidence level**: `CODE`.

#### `recallPrecision`
```
recallPrecision = Σ outcome.weight where outcome.helpful = true
                / Σ outcome.weight (all outcomes in window)
```
**Evidence level**: `CODE`.

#### `coverageGap`
```
relevantSituations = events where guard fired AND outcome.recalled = false
coverageGap = |relevantSituations| / |all situations where lesson SHOULD have helped|
```
The denominator is hard. Definition:
- `should have helped` = guard fired with severity BLOCK and a lesson with matching tag exists
**Evidence level**: `INFER`.

### 7.5 Confidence floor

Each metric has a `confidenceFloor` (minimum sample size). Defaults:
- `guardFalsePositiveTrend`: 30 events
- `lessonSpecificityScore`: 30 lessons
- `recallPrecision`: 30 outcomes
- `coverageGap`: 30 outcomes
- `lessonsCreated`, `lessonsEffective`, `communityContributions`, `timeToGuardHours`: no floor

If `sampleSize < confidenceFloor` → `confidence.<metric>.sufficient = false` AND metric appears in `insufficientSignal`. These metrics:
- Still computed and emitted in snapshot.
- NOT used by hint engine.
- NOT used by CI gate (no fail).
- NOT exported via federation telemetry.

---

## 8. Constitutional Smelter

### 8.1 Trigger predicates

After each `aggregateMetaGrowth` invocation, run:

```typescript
function detectPatterns(
  current: MetaGrowthSnapshot,
  history: ReadonlyArray<MetaGrowthSnapshot>,
): ReadonlyArray<SmelterProposal>;
```

Patterns to detect (v0 — extensible):

| Pattern | Predicate | Generated proposal |
|:--|:--|:--|
| Trend degradation | `guardFalsePositiveTrend` is `degrading` for 3 consecutive snapshots for the same guardId | "Guard X false positive rate increasing over 3 windows. Investigate." |
| Stale lessons | ≥ 5 lessons with `recallStats.totalRecalls = 0` AND `createdAt > 90d ago` | "5+ stale lessons. Are tags wrong, or are lessons too generic?" |
| Conflict accumulation | ≥ 3 unresolved conflicts in dedup-clusters.json | "Multiple conflict clusters. Review and resolve." |
| Coverage degradation | `coverageGap` increasing for 3 consecutive snapshots | "Recall coverage falling. Lessons may not be matching real scenarios." |

### 8.2 Proposal format

```json
{
  "id": "proposal:sha256:trend-degradation:hollowArtifact:2026-04-27",
  "patternSignature": "guardFalsePositiveTrend.degrading.guardId=hollowArtifact",
  "consecutiveSnapshots": 3,
  "proposedLesson": {
    "wrongApproach": "Guard hollowArtifact reported these N false positives in the last 3 windows: [list]. Likely cause: regex too permissive when X.",
    "correctApproach": "",  // BLANK — Pillar 4
    "tags": ["meta-growth", "smelter-auto", "guard-hollowArtifact"]
  },
  "status": "open",
  "githubIssueUrl": null
}
```

### 8.3 Human-resolves-correctApproach contract

Pillar 4 (Anti Self-Validation) forbids the system from prescribing the fix.

- `correctApproach` ALWAYS blank in auto proposals.
- `did smelter accept <proposal-id> --correct-approach "..."` is the only path to acceptance.
- On accept: a NEW lesson is recorded with the human-supplied `correctApproach`. Proposal links to lesson via `proposal.acceptedLessonId`.
- On reject: `did smelter reject <proposal-id> --reason "..."` records reason for audit.

### 8.4 GitHub integration

If `defense.config.yml` has `federation.parentEndpoint` set:
- New proposal → auto-open GitHub issue.
- Issue body = proposal JSON.
- Resolution syncs back via `did smelter sync`.

If no federation: proposals live in JSONL only. Hint H-008 surfaces.

---

## 9. CLI Surface

### 9.1 Lesson commands (existing + new)

```
did lesson record \
  --wrong-approach <text>  [REQUIRED]
  --correct-approach <text> [REQUIRED]
  --tags <comma-separated>  [REQUIRED]
  --pattern <regex>  [optional, for scan-outcomes]
  --quality-gate  [optional Tier 1, opt-in]
  --evidence CODE|RUNTIME|INFER|HYPO  [optional, default HYPO]

did lesson list \
  [--status active|archived|superseded|merged|all]
  [--tag <tag>]
  [--since <date>]
  [--limit N]

did lesson search \
  --query <text>
  [--top N]
  [--semantic]

did lesson outcome <id>  [SHIPPED v0.7]
  --helpful|--not-helpful
  [--ticket <id>]
  [--note <text>]

did lesson scan-outcomes  [SHIPPED v0.7]
  [--since <ref>]
  [--max N]
  [--dry-run]
  [--dspy]

did lesson recalls list  [SHIPPED v0.7]
  [--lesson <id>]
  [--ticket <id>]
  [--since <date>]
  [--limit N]

did lesson digest \    [NEW v0.8]
  --top N
  --by recall-precision|quality-score
  --format markdown|json

did lesson recall \    [NEW v0.8]
  --intent <text>
  [--tags <comma>]
  [--top N]
  [--format json|markdown]

did lesson dedup \    [NEW v0.8]
  [--dry-run|--apply]
  [--mode canonical|merge|conflict|all]
  [--since <date>]

did lesson retire <id>   [NEW v0.8]
  [--reason <text>]
```

### 9.2 Metrics commands (NEW v0.8)

```
did metrics f1 \
  [--guard <guardId>]
  [--since <date>]
  [--format json|table]

did metrics recall \
  [--since <date>]
  [--format json|table]

did metrics meta-growth \
  --period <isoInterval>  [REQUIRED]
  [--write]  // append to .agents/records/meta-growth-snapshots.jsonl
  [--format json|markdown]

did metrics history \
  [--metric <name>]
  [--last N snapshots]
  [--format json|table]

did metrics export \      [v0.9]
  --format federation-payload
  [--anonymize]
  [--output <path>]
```

### 9.3 Smelter commands (NEW v0.8.4)

```
did smelter list \
  [--status open|accepted|rejected]

did smelter accept <proposal-id> \
  --correct-approach <text>  [REQUIRED]
  [--note <text>]

did smelter reject <proposal-id> \
  --reason <text>

did smelter sync   // sync proposal status with GitHub issue (if configured)
```

### 9.4 CI gate command (NEW v0.8.2)

```
did ci gate \
  --check meta-growth-trend|f1|recall|all
  [--baseline <snapshot-id>]
  [--strict]   // exit 1 on warn (default: exit 0 on warn, 1 on block)
```

---

## 10. CI Gate Contract

### 10.1 Mandatory gates (CI enforces)

| Gate | When | Behavior |
|:--|:--|:--|
| `meta-growth-determinism` | Every PR | Run aggregator on PR's HEAD; verify hash matches a reference run |
| `meta-growth-trend` | Every PR | Run aggregator on HEAD vs baseline; fail if `verdict = blocking` |
| `dedup-idempotency` | Every PR | Run dedup twice on HEAD; verify clusters identical |
| `lesson-quality` | PR that touches lessons.jsonl | Verify all new lessons pass Stage 2 (Tier 0) |

### 10.2 Reference run (baseline)

Each main-branch commit produces a snapshot. The snapshot is written to `.agents/records/meta-growth-snapshots.jsonl` (committed). PR builds compare against the latest main snapshot.

### 10.3 Override path

`did ci gate --override` exists ONLY for emergency hotfixes. Logs override reason to `.agents/records/ci-overrides.jsonl`. Surface via H-009-ci-override-recent.

---

## 11. Test Contracts

### 11.1 Determinism tests

- `meta-growth-determinism.test.js`: 100 runs, expect 100 byte-identical snapshot outputs.
- `dedup-idempotency.test.js`: 2 runs, expect identical `dedup-clusters.json`.
- `digest-stability.test.js`: same input → same `injection-digest.md`.

### 11.2 Boundary tests

- Empty event log → snapshot with all metrics in `insufficientSignal`, `verdict = warn`.
- Event log with single event → metric = computed, but `confidence.sufficient = false`.
- Window crossing event → event included if `start ≤ event.createdAt < end`.

### 11.3 Adversarial tests

- Inject event with `source = "ai-self-rated"` → `lessonsEffective` does not increment.
- Inject duplicate lesson IDs in jsonl → aggregator dedups by ID, picks latest by updatedAt, deterministic.
- Inject malformed JSON line → skipped with warning, aggregator continues (Án Lệ #1: graceful degrade).
- Inject lesson with `evidenceLevel = HYPO` → excluded from injection digest.

### 11.4 Pillar coverage tests

Each pillar has at least one test that fails if the pillar is violated:

| Pillar | Test |
|:--|:--|
| 1 Provenance | hash equality across runs |
| 2 Falsifiability | every metric has threshold record |
| 3 Temporal Lock | no JSONL line is ever modified |
| 4 Anti Self-Validation | AI-source weight 0 enforced |
| 5 Boundary | every snapshot has full inputs metadata |
| 6 Reproducibility | cold-clone test (CI runs in fresh container) |
| 7 Closed-Loop | CI fails on regression (smoke test) |

---

## 12. Threshold Matrix

Defaults — overridable via `defense.config.yml` `metaGrowth.thresholds.*`.

| Metric | Direction | Warn | Block | ConfidenceFloor |
|:--|:--|:--:|:--:|:--:|
| guardFalsePositiveTrend | lower-is-better | +0.05 | +0.10 | 30 |
| lessonSpecificityScore | higher-is-better | 0.50 | 0.30 | 30 |
| recallPrecision | higher-is-better | 0.70 | 0.50 | 30 |
| coverageGap | lower-is-better | 0.20 | 0.40 | 30 |
| lessonsEffective / lessonsCreated | higher-is-better | 0.20 | 0.10 | 30 |

Metrics without thresholds (informational only):
- lessonsCreated
- timeToGuardHours
- communityContributions

---

## 13. Versioning

### 13.1 Three independent version dimensions

- **Schema version** (data file shape) — bump when JSONL/JSON structure changes incompatibly. Each line carries `version: N`.
- **Aggregator version** (computation logic) — bump when ANY metric formula changes. Old snapshots remain interpretable; new snapshots reference new version.
- **Snapshot schema version** (output structure) — bump when `MetaGrowthSnapshot` type changes.

### 13.2 Migration policy

- Schema bumps require migration script in `scripts/migrate-vN-to-vN+1.ts`.
- Migration is one-way (no reverse).
- CI runs migration on every PR; PRs introducing a schema bump must include migration script + test.

### 13.3 Backward compatibility window

Old snapshots remain readable for ≥ 2 minor versions. After that, `did metrics history --include-deprecated` is required.

---

## 14. Open Questions

These need maintainer decision before v0.7.1 starts:

1. **Pillar 4 weight defaults**: should `scan-outcome` be `0.5` or higher? Field bake will tell — propose configurable per-org.
2. **Channel A digest format**: markdown table vs YAML frontmatter? Both feed-friendly. I lean markdown for diffability.
3. **Smelter auto-issue creation**: should DiD ever auto-open GitHub issues, or always require human `did smelter ack`? Prefer human-ack for HITL purity.
4. **Conflict resolution UX**: do we want a TUI for resolving dedup conflicts, or only CLI?
5. **Federation pull anonymization**: where does the anonymizer live — DiD core, or Hub side? STRIDE doc needed.
6. **Confidence floor of 30**: arbitrary choice. Should this be configurable, or a constant tied to power-analysis?
7. **CI gate strictness**: `verdict = blocking` blocks PRs. Is that too aggressive for early v0.8? Maybe `--strict` opt-in for first 3 months.
8. **Aggregator language**: TypeScript like rest of repo, OR pull in a stats library? Lean TypeScript-pure for Tier 0 discipline.

---

## 15. Phased Sequencing

| Phase | Version | Scope | Pillar / Stage gap closed | Effort |
|:-:|:--|:--|:--|:-:|
| 1 | v0.7.0 GA | Tag + bake | none | XS |
| 2 | v0.7.1 | Type + storage layer expansion (Lesson v2, MetaGrowthSnapshot v1, evidence/source/weight fields, doc reconciliation) | Pillars 1, 3, 4, 5 (foundations) | M |
| 3 | v0.8.0 | Stage 4 Dedup engine (3-channel similarity + 3 policies) + Stage 5 Channel A injection digest + Stage 8 Retirement | Stage 4, Stage 5A, Stage 8 | L |
| 4 | v0.8.1 | Aggregator v1 (`did metrics f1` + `did metrics recall` + `did metrics meta-growth`) | Pillars 1, 2, 6 | L |
| 5 | v0.8.2 | CI Gate Enforcement + Determinism test suite | Pillar 7 | M |
| 6 | v0.8.3 | Channel B pre-action recall + skill integration | Stage 5B | M |
| 7 | v0.8.4 | Hint Catalog v2 (H-005..H-008) | Stage 5C extension | S |
| 8 | v0.8.5 | Constitutional Smelter v0 (pattern detection + proposal output) | Stage 8 loop closure | M |
| 9 | v0.9.0 | Telemetry export + Federation hardening (HMAC, schema versioning) + Anonymization spec + Channel D pull | Persona C | L |

**Total**: 1 GA + 6 minor + 1 major. Estimated 3-4 month roadmap if 1 PR per minor, 1-2 weeks per minor.

---

## Done. This is the plan. Either ratify it whole or call out specific clauses.


---

## Part II — Amendment v2

# Meta Growth Constitutional Contract — Amendment v2

> **Document Type**: Amendment to v1 contract (extends, does not replace)
> **Reference**: `meta-growth-contract.md` v1 (15 sections)
> **Scope**: Answers 4 deep questions exposed by maintainer review:
> 1. Án lệ do ai judge?
> 2. Trust calculation beyond proven+evidence; scope-bound evidence handling?
> 3. Contradictory similar lessons — precedence rules?
> 4. Forgetting mechanism + storage scaling (flat file vs DB)?
> **Status**: DRAFT — pending maintainer ratification
> **Author**: Devin-AI on behalf of `tamld`
> **Date**: 2026-04-27

---

## Section 16 — Authority Taxonomy (answers Q1)

### 16.1 Who can do what

Án lệ has **5 distinct roles** in its lifecycle. Each role has different authority. The system enforces this via `Lesson.authority` field + signed events.

| Role | Authority | Who | Can do |
|:--|:--|:--|:--|
| **Recorder** | Lowest (raw input) | Anyone (human or any agent) | Create lesson via `did lesson record` |
| **Validator** | Stage 2 quality gate | Pure function (Tier 0) + DSPy (Tier 1) | Pass/reject lesson on length, specificity, score |
| **Acceptor** | Outcome signal | Per-`source` weighted | Mark `helpful=true|false` via outcome event |
| **Adjudicator** | Conflict resolver | Tier A (human maintainer) ONLY | Resolve `conflict` policy clusters; sign `binding` lessons |
| **Retirer** | Lifecycle gate | CI auto + Tier A override | Move lessons to `archived` / `superseded` / `cold-storage` |

**Critical rule**: roles are not equivalent. Recorder ≠ Adjudicator. An AI agent recording a lesson does NOT mean the lesson is trusted. Trust requires Acceptors over time + (optional) Adjudicator signature.

### 16.2 Authority Tiers (extends `executor` field)

```typescript
export type AuthorityTier =
  | "A"   // Sovereign — repository maintainer (human)
  | "B"   // Trusted Agent — operational AI (Devin, Claude, Gemini, Cursor)
  | "C"   // External Agent — third-party SaaS (Jules, CodeRabbit)
  | "D"   // Federation — pulled from external hub
  | "E";  // Community — anonymous PR contributor
```

Mapping rules (deterministic):
- `executor` matches a `tier-a` allowlist in `defense.config.yml` → Tier A
- `executor` matches `tier-b` allowlist (e.g. `["Devin-AI", "Claude-Code", "Gemini-CLI", "Cursor-AI"]`) → Tier B
- `executor` matches `tier-c` allowlist (`["Jules", "CodeRabbit"]`) → Tier C
- `source = "federation"` → Tier D regardless of executor
- Else → Tier E

### 16.3 Authority effects on weights and trust

| Tier | Outcome weight (in `lessonsEffective`) | Can adjudicate conflict? | Can sign `binding` lesson? | Initial `trustState` |
|:-:|:-:|:-:|:-:|:-:|
| A | 1.0 | ✅ | ✅ | `trusted` |
| B | 0.7 | ❌ | ❌ | `raw` |
| C | 0.3 | ❌ | ❌ | `raw` |
| D | 0.2 | ❌ | ❌ | `raw` (must re-verify locally) |
| E | 0.1 | ❌ | ❌ | `raw` |

These are HARDCODED defaults. Configurable per-org via `defense.config.yml.authority.weights.*` — but `tier=A` weight 1.0 cannot be lowered (Pillar 4 floor).

### 16.4 New `Lesson.authority` field schema

```typescript
export interface Lesson {
  // ... existing fields ...
  authority: {
    recorder: { tier: AuthorityTier, executor: string, recordedAt: string };
    validator: { passed: boolean, gate: "tier0" | "tier1", score: number };
    acceptors: ReadonlyArray<{
      tier: AuthorityTier,
      executor: string,
      verdict: "helpful" | "not-helpful",
      acceptedAt: string,
      weight: number   // computed from tier
    }>;
    adjudicator: {
      tier: "A",   // ALWAYS A
      executor: string,
      verdict: "binding" | "rejected",
      adjudicatedAt: string,
      reason: string,
      signature: string   // SHA-256 of (executor + lessonId + verdict + timestamp), HMAC if Tier-A keyfile available
    } | null;
  };
}
```

`authority.adjudicator` is null until Tier A explicitly signs.
- A signed lesson becomes `trustState: binding` — cannot be overridden by lower-tier conflicting lessons.
- Without adjudication, lessons stay `raw` or `trusted` based on outcome accumulation (see Section 17).

### 16.5 CLI for Tier A operations

```
did lesson sign <lesson-id> \                # only callable by configured Tier A maintainer
  --signature-key <path-to-keyfile>          # ed25519 keyfile, optional
  --reason <text>

did lesson contest <lesson-id> \             # any tier can contest
  --reason <text>                            # surfaces to Tier A queue

did lesson adjudicate <conflict-cluster-id> \  # only Tier A
  --winner <lesson-id>
  --loser <lesson-id>
  --reason <text>
```

`did lesson sign` is gated by `defense.config.yml.authority.tier-a-allowlist` matching the local git config user. If git user not in allowlist → command exits with `EAUTH`.

---

## Section 17 — Trust Calculation & Scope-Bound Evidence (answers Q2)

### 17.1 Trust is a vector, not a scalar

Trust ≠ a single number. Trust is a **6-dimensional vector**:

```typescript
export interface LessonTrust {
  provenance: number;       // 0-1, derived from authority tier
  evidence: number;         // 0-1, derived from EvidenceLevel
  outcome: number;          // 0-1, recall precision
  scope: number;            // 0-1, scope match for current context
  recency: number;          // 0-1, time-decayed since last helpful recall
  convergence: number;      // 0-1, # independent helpful acceptors / threshold
}
```

Computation:
```
provenance = { A: 1.0, B: 0.7, C: 0.3, D: 0.2, E: 0.1 }[lesson.authority.recorder.tier]
evidence   = { CODE: 1.0, RUNTIME: 0.8, INFER: 0.4, HYPO: 0.0 }[lesson.evidenceLevel]
outcome    = recallStats.helpfulRecalls / max(recallStats.totalRecalls, 1)
scope      = 1.0 if context matches lesson.scope, 0.0 if mismatch, 0.5 if partial
recency    = exp(-daysSinceLastHelpful / 60)         // half-life 60 days
convergence = min(1.0, distinctHelpfulAcceptors / 3) // saturate at 3
```

Composite trust (when needed for ranking):
```
compositeTrust = geometric_mean(provenance, evidence, outcome, scope, recency, convergence)
```

Geometric mean — not arithmetic — so any single dimension at 0 collapses the trust to 0. This enforces all-or-nothing on critical dimensions (Pillar 2 falsifiability — failure of any criterion is total).

### 17.2 Trust State machine

```typescript
export type TrustState = "raw" | "trusted" | "binding" | "contested";
```

State transitions (auto, except as noted):

```
raw → trusted        when: outcome ≥ 0.7 AND convergence ≥ 0.67 AND evidence ≥ 0.6
trusted → binding    when: Tier A adjudicator.signs (manual)
* → contested        when: another lesson in same scope contradicts (auto, by dedup)
contested → trusted  when: Tier A adjudicator resolves (manual)
trusted → raw        when: recency < 0.2 OR outcome drops below 0.5 (auto decay)
binding → archived   when: Tier A explicit `did lesson retire --binding` (manual override)
```

Transitions logged to append-only `.agents/records/lesson-state-transitions.jsonl`. Trust state at any historic time = replay of transitions up to that time.

### 17.3 Scope-bound evidence — RAW vs TRUSTED for Meta Growth

> *"Nếu 1 evidence chỉ đúng trong 1 bối cảnh, thì ta xem nó là raw hay trust evidences cho meta growth?"*

**Answer: depends on context-match. If context overlaps with lesson scope → trusted. If not → raw (ignored for that aggregator window).**

#### 17.3.1 New `Lesson.scope` field

```typescript
export interface LessonScope {
  appliesTo: ReadonlyArray<string>;       // tags / stacks / contexts where lesson is valid
  excludes: ReadonlyArray<string>;        // explicit anti-scope
  validFor: { language?: string, framework?: string, version?: string }; // optional structured matcher
  contextDimensions: ReadonlyArray<{
    name: string;       // "stack" | "framework" | "team" | ...
    values: ReadonlyArray<string>;
  }>;
  scopeProof: "tested" | "asserted" | "inferred"; // how scope was determined
}
```

Examples:
```yaml
# Lesson A (narrow scope, well-proven)
scope:
  appliesTo: [postgresql, node-pg-pool]
  excludes: [sqlite, mysql]
  validFor: { framework: postgresql, version: ">=14" }
  contextDimensions: [{ name: stack, values: [postgresql, node] }]
  scopeProof: tested      # determinism test verified

# Lesson B (wide scope, asserted)
scope:
  appliesTo: [database]
  excludes: []
  validFor: {}
  contextDimensions: [{ name: stack, values: [database] }]
  scopeProof: asserted    # author claimed but not tested
```

#### 17.3.2 Context match algorithm

```typescript
function scopeMatch(lesson: Lesson, context: LessonContext): "match" | "partial" | "mismatch" {
  if (any(context.tags) ∈ lesson.scope.excludes) return "mismatch";
  if (all(context.requiredTags) ⊆ lesson.scope.appliesTo) return "match";
  if (any(context.tags) ∩ lesson.scope.appliesTo) return "partial";
  return "mismatch";
}
```

#### 17.3.3 Effect on Meta Growth aggregator

When computing `lessonsEffective` over period P:

```
for each outcome event in P:
  lesson = lessons[outcome.lessonId]
  context = inferContextFromTicket(outcome.ticketId) || outcome.context
  match = scopeMatch(lesson, context)

  if match == "mismatch":
    skip            // lesson out-of-scope → not counted (raw)
  elif match == "partial":
    weight = outcome.weight * 0.5    // partial credit
  else:
    weight = outcome.weight          // full credit (trusted)

  lessonsEffective += weight if outcome.helpful else 0
```

This means a lesson with narrow scope can appear "ineffective" in a Meta Growth window covering many out-of-scope tickets. That's correct — it shouldn't have been recalled in those tickets anyway. The aggregator `coverageGap` metric catches the inverse: cases where lesson SHOULD have helped but didn't fire (Section 7 v1 contract).

#### 17.3.4 Raw vs Trusted classification

| Lesson state | When ingested into `lessonsEffective` | Treatment |
|:--|:--|:--|
| `evidenceLevel = HYPO` | NEVER | Excluded entirely |
| `trustState = raw` AND scope mismatch | Ignored for window | Raw — no signal |
| `trustState = raw` AND scope match | Counted with weight = composite trust | Counted but discounted |
| `trustState = trusted` AND scope match | Counted at full weight | Trusted evidence |
| `trustState = binding` AND scope match | Counted at full weight + cannot be contested | Authoritative |
| `trustState = contested` | Excluded until resolved | Frozen |

Aggregator MUST emit per-snapshot field:
```json
{
  "evidenceProvenance": {
    "binding": 3,         // # lessons contributing as binding
    "trusted": 12,
    "raw": 5,             // appearing but discounted
    "excluded_hypo": 2,   // explicitly excluded
    "excluded_scope": 18, // out-of-scope skips
    "excluded_contested": 1
  }
}
```

This becomes part of `MetaGrowthSnapshot.evidence` block (Pillar 5 — Boundary-of-Claim Discipline).

---

## Section 18 — Conflict Adjudication: Precedence Rules (answers Q3)

### 18.1 The problem

> *"Nếu án lệ giống nhau, nhưng trái nghịch nhau, ta xét trên cái gì để quyết định chọn án lệ nào?"*

Two lessons (A, B) have:
- Same `wrongApproachPattern` (Channel 1 dedup match)
- Same scope (Section 17 match)
- Contradictory `correctApproach`

Today's contract Section 6.5 says "human resolves" — too vague. Real case law has 5 deterministic precedence rules. DiD adopts them.

### 18.2 The 5-rule precedence ladder (applied IN ORDER)

```typescript
function resolveConflict(A: Lesson, B: Lesson): Resolution {
  // Rule 1 — Authority precedence (lex superior)
  if (A.authority > B.authority) return { winner: A, rule: "authority" };
  if (B.authority > A.authority) return { winner: B, rule: "authority" };

  // Rule 2 — Specificity precedence (lex specialis)
  const specA = patternSpecificity(A.wrongApproachPattern);
  const specB = patternSpecificity(B.wrongApproachPattern);
  if (specA > specB) return { winner: A, rule: "specificity" };
  if (specB > specA) return { winner: B, rule: "specificity" };

  // Rule 3 — Outcome precedence (lex praxis)
  const recallA = A.recallStats.helpfulRecalls / max(1, A.recallStats.totalRecalls);
  const recallB = B.recallStats.helpfulRecalls / max(1, B.recallStats.totalRecalls);
  if (recallA - recallB > 0.1) return { winner: A, rule: "outcome" };
  if (recallB - recallA > 0.1) return { winner: B, rule: "outcome" };

  // Rule 4 — Convergence precedence (lex consensus)
  const convA = distinctHelpfulAcceptors(A);
  const convB = distinctHelpfulAcceptors(B);
  if (convA - convB >= 2) return { winner: A, rule: "convergence" };
  if (convB - convA >= 2) return { winner: B, rule: "convergence" };

  // Rule 5 — Recency precedence (lex posterior)
  if (A.updatedAt > B.updatedAt) return { winner: A, rule: "recency" };
  if (B.updatedAt > A.updatedAt) return { winner: B, rule: "recency" };

  // Tie — surface to Tier A
  return { winner: null, rule: "tie", action: "freeze-both-as-contested" };
}
```

### 18.3 Specificity metric (used in Rule 2)

```typescript
function patternSpecificity(pattern: string): number {
  // Specific = more concrete, fewer wildcards
  const wildcards = (pattern.match(/[.*+?{}()|[\]\\^$]/g) || []).length;
  const literals = pattern.replace(/[.*+?{}()|[\]\\^$]/g, "").length;
  return literals / max(1, literals + wildcards);
}
```

A pattern `^foo\.bar$` is more specific than `^.+\.bar`. Higher specificity wins (lex specialis — the more specific norm overrides the more general).

### 18.4 Convergence metric (used in Rule 4)

```typescript
function distinctHelpfulAcceptors(lesson: Lesson): number {
  return new Set(
    lesson.authority.acceptors
      .filter(a => a.verdict === "helpful")
      .map(a => `${a.tier}:${a.executor}`)
  ).size;
}
```

Counts distinct (tier, executor) pairs. Two helpful outcomes by same Devin-AI session count as 1.

### 18.5 Tie behavior — `contested` state

When all 5 rules tie:
- Both lessons → `trustState: contested`
- Neither contributes to aggregator
- Hint H-009-conflict-pending fires
- Tier A `did lesson adjudicate <cluster-id> --winner <id>` resolves
- Resolution writes to `.agents/records/adjudications.jsonl` with reason
- Loser → `status: superseded, supersededBy: winnerId`

### 18.6 Adjudication is auditable

Every adjudication generates:
```json
{
  "id": "adjudication:sha256:...",
  "clusterId": "cluster:...",
  "winnerId": "lesson:...",
  "loserId": "lesson:...",
  "rule": "authority|specificity|outcome|convergence|recency|tier-a-manual",
  "adjudicator": { "tier": "A", "executor": "tamld", "signature": "..." },
  "reason": "string",
  "adjudicatedAt": "ISO"
}
```

Append-only. Reviewable. If adjudicator decision is later regretted, NEW adjudication overrides — old record stays for audit.

---

## Section 19 — Forgetting & Storage Scaling (answers Q4)

### 19.1 The forgetting curve

> *"Nếu án lệ quá mức to lớn, dày đặc, ta có cơ chế 'quên' nào không?"*

DiD adopts an Ebbinghaus-inspired 4-layer forgetting model. **Forgetting ≠ deletion.** Provenance is forever (Pillar 3 Temporal Lock).

```
ACTIVE   → SOFT-RETIRED → HARD-ARCHIVED → COMPRESSED  → COLD-STORAGE
 ✓ search   ⚠ opt-in       ⚠ opt-in       ⚠ summarized   ⚠ index-only
```

#### Layer 1 — Soft retirement (auto, in-tree)

**Trigger predicates** (any one):
- `recallStats.totalRecalls = 0` AND `createdAt > 90d` AND `qualityScore < 0.7`
- Outcome precision drops below 0.3 over rolling 30d window
- Lesson is `superseded` or `merged` by dedup

**Effect**:
- `status = "archived"`
- Default search excludes (Section 9 `did lesson list` defaults `--status active`)
- Still in `lessons.jsonl` (no file move)
- Still recallable via `did lesson list --status archived`

#### Layer 2 — Hard archival (auto, file move)

**Trigger predicates**:
- `status = "archived"` for ≥ 180 days
- AND no `recallStats` updates in that period
- AND no related active lessons referencing it

**Effect**:
- Lesson row appended to `.agents/archive/lessons-{YYYY-MM}.jsonl`
- ID added to `.agents/archive/index.json` (lookup-only)
- ID retained in main `lessons.jsonl` with `status = "cold-archived"` and `archivePath` field
- Excluded from default Stage 5 injection
- Recallable only via `did lesson search --include-archive`

#### Layer 3 — Compression (auto, dedup-driven)

**Trigger predicates**:
- Cluster (Section 6) has ≥ 50 member lessons
- All members have `status ∈ {archived, cold-archived}`

**Effect**:
- Generate `compressedLesson`:
  ```json
  {
    "id": "compressed:cluster:...",
    "type": "compressed",
    "memberLessonIds": ["lesson:...", ...],
    "summary": "auto-generated from cluster canonical + DSPy summary",
    "wrongApproach": "<canonical wrongApproach>",
    "correctApproach": "<canonical correctApproach>",
    "compressedAt": "ISO"
  }
  ```
- Members retained as cold-archive (audit trail)
- Compressed lesson counts as 1 for injection digest

#### Layer 4 — Cold storage with index (manual or scheduled)

**Trigger**:
- Hard-archive jsonl files older than 12 months
- Manual: `did lesson coldstore --before 2025-04-27`

**Effect**:
- Move `.agents/archive/lessons-YYYY-MM.jsonl` → `.agents/cold-storage/lessons-YYYY-MM.jsonl.zst` (zstd compression)
- `.agents/cold-storage/index.json` indexed by lesson ID
- Restore: `did lesson restore <lesson-id>` decompresses single lesson back to active state
- **Forensic recall always possible** — decompress + replay

### 19.2 Storage layer evolution: flat-file → SQLite cache

> *"Hoặc có cơ chế lưu trữ vào db không hay chỉ lưu vào flat file?"*

#### Layer A — Flat file (primary, always source of truth)

`*.jsonl` files are **canonical**. Append-only. Auditable. Diffable in git. Reproducible cold-checkout.

**This is the source of truth at every scale.** Never replaced.

#### Layer B — SQLite cache (derived index, opt-in v0.9+)

When dataset grows beyond ~10K active lessons, scan-time becomes `O(n)`. Solution:

- **Derived index in `.agents/cache/lessons.sqlite`**
- **Built from JSONL via `did lesson rebuild-index`** (deterministic — same JSONL → same SQLite)
- **Used only for read queries** (search, dedup similarity prefetch, recall ranking)
- **Writes still go to JSONL first** — SQLite is regenerated incrementally on each lesson record
- **`.gitignore` excludes** `.agents/cache/*` — never committed
- **Cold checkout regenerates** SQLite from JSONL automatically (Pillar 6 Reproducibility)

```typescript
export interface CacheManifest {
  schemaVersion: 1;
  rebuiltAt: string;
  sourceJsonlHash: string;       // SHA-256 of input lessons.jsonl at rebuild time
  rowCount: number;
  size: { activeLessons: number, archivedLessons: number, compressed: number };
}
```

#### Layer C — Optional federation hub DB (v0.9+, out-of-scope-for-DiD-core)

Federation hubs (Persona C) may use Postgres/MySQL on their server side. DiD core doesn't ship server code. The federation contract (`HttpLessonProvider`) is HTTP-based — hub backend is opaque.

### 19.3 Forgetting policy contract

```typescript
export interface ForgettingPolicy {
  softRetireAfterDaysNoRecall: number;        // default 90
  softRetireQualityThreshold: number;         // default 0.7
  hardArchiveAfterDaysSoft: number;           // default 180
  compressClusterMinSize: number;             // default 50
  coldStoreAfterMonthsArchived: number;       // default 12
  immutableRetention: "forever";              // never deletable
}
```

Defaults are CONSERVATIVE. Configurable via `defense.config.yml.metaGrowth.forgetting.*`. Cannot be set to delete events (Pillar 3).

### 19.4 CLI for forgetting + storage

```
did lesson list \
  [--status active|archived|cold-archived|all]
  [--include-archive]
  [--include-coldstore]

did lesson retire <id> \      # explicit retire (Tier A or higher)
  --reason <text>

did lesson coldstore \         # batch cold-store hard-archived files
  --before <date>
  [--dry-run]

did lesson restore <id> \      # decompress single lesson from cold-storage
  --reason <text>

did lesson rebuild-index \     # regenerate SQLite cache from JSONL (Layer B)

did lesson stats \             # human-readable counts per layer
  [--per-tier]
  [--per-status]
```

### 19.5 Effect on Meta Growth aggregator

| Lesson layer | Counted in `lessonsCreated` (window)? | Counted in `lessonsEffective`? |
|:--|:-:|:-:|
| Active | ✅ if createdAt ∈ window | ✅ |
| Soft-retired | ✅ if createdAt ∈ window | ❌ (excluded — already retired) |
| Hard-archived | ❌ | ❌ |
| Compressed | counted as 1 representative | ❌ unless representative recalled |
| Cold-storage | ❌ | ❌ |

This means: heavy archival doesn't distort `lessonSpecificityScore` (denominator excludes retired lessons). Forgetting maintains aggregator integrity.

---

## Section 20 — Updated Open Questions

After Sections 16-19 land, the v1 contract Section 14 list reduces to:

| Old Q | Resolution |
|:-:|:--|
| 1. AI-source weight | RESOLVED — Section 16.3 hardcoded floor, configurable above floor |
| 2. Digest format | OPEN — still markdown vs YAML |
| 3. Smelter auto-issue | OPEN — recommend opt-in default false |
| 4. TUI conflict resolver | OPEN — propose CLI-only for v0.8, TUI for v1.0 |
| 5. Anonymizer location | OPEN — recommend Hub-side, DiD ships spec only |
| 6. Confidence floor | RESOLVED — Section 7.5 default 30, configurable per-org |
| 7. CI gate strictness | RESOLVED — Section 10 `--strict` opt-in for first 3 months |
| 8. Aggregator language | RESOLVED — TypeScript-pure (Tier 0 discipline) |

**Net new questions from amendment**:

9. **Tier A allowlist source**: git config user.email vs explicit `defense.config.yml.authority.tier-a-allowlist`? Recommend the latter — explicit is safer.
10. **Adjudicator signature mechanism**: ed25519 keyfile (heavy) vs HMAC w/ shared secret vs bare timestamp (no crypto). Recommend HMAC for v0.8, optional ed25519 for v0.9.
11. **Lesson scope coercion on legacy lessons**: existing v0.5+ lessons have no `scope`. Migration: assign `scope.scopeProof = "inferred"` from tags. OK?
12. **Composite trust ranking visibility**: surface in `did lesson list --show-trust` for human review?

---

## Section 21 — Updated Sequencing (replaces v1 Section 15)

| Phase | Version | Scope additions from amendment |
|:-:|:--|:--|
| 2 | v0.7.1 | + `Lesson.authority` field, `LessonScope` field, `LessonTrust` derivation, `TrustState` machine. Migration script for legacy lessons (assign authority by recorder name). |
| 3 | v0.8.0 | + Conflict precedence ladder (Section 18). + Forgetting Layer 1+2 (soft retire + hard archive). |
| 5 | v0.8.2 | + CI gate `meta-growth-trend` reads `evidenceProvenance` block (Section 17.3.4). |
| 6 | v0.8.3 | + `did lesson recall --intent` honors scope match. |
| 8 | v0.8.5 | + Smelter generates `LessonScope` template based on cluster signature. |
| 9 | v0.9.0 | + Forgetting Layer 3+4 (compression + cold storage). + SQLite cache (Layer B). + `did lesson sign` Tier A workflow with HMAC. |

---

## Done. This amendment + v1 contract = complete Meta Growth design contract.

Ratification options:
- **A — Ratify whole** (v1 + amendment) → open meta-issue immediately
- **B — Iterate on specific clauses** → call out section + clause numbers
- **C — Defer for further questions** → ask more, refine before issue


---

## Part III — Amendment v3

# Meta Growth Constitutional Contract — Amendment v3

> **Document Type**: Amendment to v1+v2 contract (extends, does not replace)
> **References**: `meta-growth-contract.md` v1 + `meta-growth-contract-amendment-v2.md`
> **Scope**: Addresses 6 peer-review findings on v2:
> 1. Tier A weight floor + missing key rotation/revocation/multi-sig
> 2. Signature scheme inconsistency across Sections 16.4 / 16.5 / 20
> 3. Geometric mean over-penalizes new lessons (design bug)
> 4. `authority` comparison ambiguity in conflict resolver (Section 18)
> 5. Scope matching not semver-aware (oversimplification)
> 6. Binding lesson compression / archival protection insufficient
> **Status**: DRAFT — pending maintainer ratification
> **Author**: Devin-AI on behalf of `tamld`
> **Date**: 2026-04-27

---

## Severity classification

| # | Issue | Severity | Type |
|:-:|:--|:-:|:--|
| 3 | Geometric mean blackholes new lessons | **DESIGN BUG** | Architectural fix |
| 6 | Binding lessons can be compressed silently | **GOVERNANCE BUG** | Invariant addition |
| 1 | Tier A compromise has no recovery path | HARDENING | Security mechanism |
| 4 | `authority >` operator undefined | SPEC GAP | Explicit function |
| 2 | Signature scheme inconsistent across docs | DOC | Single roadmap |
| 5 | Scope matching not version-aware | PHASING | Phased capability |

---

## Section 22 — Tier A Lifecycle: Rotation, Revocation, Multi-Signature (fixes #1)

### 22.1 The threat model

A single Tier A maintainer holds binding authority. If their signing key is compromised:
- Attacker forges binding lessons → injection digest poisoned → all agents misled.
- Attacker forges retire commands → legitimate lessons archived.
- Compromise discovery time may be days/weeks (lateral movement).

v2 had no recovery path. v3 adds three mechanisms.

### 22.2 Mechanism 1 — Graceful key rotation

```
did config authority rotate-key \
  --new-secret-env DID_HMAC_SECRET_NEW \
  --grace-period-days 7
```

**Behavior**:
- Generate new HMAC secret (or new ed25519 keypair from v0.9).
- Old key remains valid for `--grace-period-days` (default 7).
- New signatures use new key; old signatures still verify against old key.
- `.agents/state/authority-keyring.json` tracks active + rotating keys with `validUntil`.
- After grace period expires, old key invalidated; signatures referencing old key marked `rotated-out` (still readable, not enforceable).

### 22.3 Mechanism 2 — Emergency revocation

```
did config authority revoke <executor> \
  --since <ISO timestamp> \
  --reason <text> \
  --confirm
```

**Behavior**:
- Immediate. No grace period.
- Append revocation record to `.agents/records/authority-revocations.jsonl`.
- All Tier A signatures by `<executor>` with `signedAt > <since>` retroactively marked `compromised`.
- Affected lessons:
  - `trustState: binding` → demote to `contested`
  - Hint H-010-authority-revoked fires until each contested lesson re-adjudicated by another Tier A
  - Aggregator excludes them from `lessonsEffective` until resolved
- Revocation record schema:
  ```json
  {
    "id": "revocation:sha256:...",
    "version": 1,
    "executor": "compromised-maintainer",
    "since": "2026-04-15T00:00:00Z",
    "reason": "string",
    "revokedBy": "string",         // who issued the revoke (must be Tier A != compromised one)
    "revokedAt": "ISO",
    "affectedLessonIds": ["lesson:..."]
  }
  ```

**Hard rule**: revocation cannot be issued by the compromised executor itself. Self-revoke blocked. (`defense.config.yml.authority.tier-a-allowlist` must have ≥ 2 entries to enable revoke; lone maintainer cannot revoke themselves — must use rotation instead.)

### 22.4 Mechanism 3 — Optional multi-signature quorum

```yaml
# defense.config.yml
authority:
  tier-a-allowlist:
    - alice
    - bob
    - carol
  tier-a-quorum: 2          # 0=disabled, 2=requires 2 Tier A signatures
  tier-a-quorum-applies-to:
    - binding                # binding lesson signing requires quorum
    - revoke                 # emergency revoke requires quorum (recommended for lone-maintainer protection)
    # - retire-binding       # retiring binding lessons requires quorum (optional, conservative)
```

**Behavior with quorum=2**:
- `did lesson sign <id>` enters pending state. First Tier A signs → status `pending-quorum`. Second Tier A `did lesson sign-confirm <id>` → status `binding`.
- `.agents/records/quorum-pending.jsonl` tracks pending sigs.
- Pending entries expire after 14 days → return to `trusted` (not promoted to binding).
- Solo Tier A operations work as before when quorum=0 (default for OSS).

### 22.5 Tier A weight floor — clarification

v2 said "Tier A weight 1.0 cannot be lowered." v3 clarifies:

- **Tier A weight floor = 1.0 ONLY for outcomes attached to `binding` lessons** (post-adjudication signal).
- Tier A weight in unsigned outcomes is configurable down to 0.5 (defends against social-engineering "I just signed off, count it as binding").
- `compromised` Tier A signatures: weight = 0 retroactively.

```yaml
# defense.config.yml
authority:
  weights:
    A-unsigned: 0.7   # tier A casual outcome (e.g. quick `did lesson outcome --helpful`)
    A-signed:   1.0   # tier A formal `did lesson sign`-style action (HARDCODED FLOOR)
    A-compromised: 0.0  # HARDCODED — cannot be raised
    B: 0.7
    C: 0.3
    D: 0.2
    E: 0.1
```

---

## Section 23 — Signature Scheme Roadmap (fixes #2)

Single source of truth for signing across versions. Replaces conflicting hints in v2 §16.4, §16.5, §20.

### 23.1 Capability matrix by version

| Version | Algorithm | Required for | Optional for | Storage |
|:--|:--|:--|:--|:--|
| **v0.8** | HMAC-SHA256 (shared secret) | binding lessons | nothing | secret in env var, never on disk |
| **v0.9** | ed25519 keypair | binding lessons (NEW) | revocations, retirements | private key in `.agents/keys/` (gitignored), public key in `defense.config.yml` |
| **v1.0** | ed25519 keypair | binding, revocations, retirements | (nothing — HMAC removed) | same |

**Migration window**: v0.9 supports BOTH HMAC and ed25519 simultaneously (dual-verification). v1.0 drops HMAC. Maintainers running v0.8 → v0.9 should rotate to ed25519 within a release before upgrading to v1.0.

### 23.2 v0.8 — HMAC-SHA256 contract

```typescript
function signHmac(payload: SignPayload, secretKey: string): SignaturePayload {
  const canonical = canonicalize(payload);  // JSON canonical form
  const sig = hmacSha256(canonical, secretKey);
  return {
    algorithm: "HMAC-SHA256",
    keyId: "default",     // for rotation: new keys get keyId=v2, v3, ...
    signedAt: new Date().toISOString(),
    signature: base64(sig),
  };
}
```

**Storage**:
- Secret in env var, default name `DID_HMAC_SECRET`.
- Configurable via `defense.config.yml.authority.hmac-secret-env: MY_VAR_NAME`.
- Rotation produces new env var name; both validated during grace period.
- NEVER persisted to disk in any DiD-shipped file.

### 23.3 v0.9 — ed25519 contract

```typescript
function signEd25519(payload: SignPayload, privateKey: PrivateKey): SignaturePayload {
  const canonical = canonicalize(payload);
  const sig = ed25519.sign(canonical, privateKey);
  return {
    algorithm: "ed25519",
    keyId: deriveKeyId(privateKey),    // SHA-256(publicKey).slice(0, 16)
    signedAt: new Date().toISOString(),
    signature: base64(sig),
  };
}
```

**Storage**:
- Private key in `.agents/keys/<executor>.ed25519.private` (mode 0600, gitignored).
- Public keys in `defense.config.yml.authority.tier-a-public-keys`:
  ```yaml
  authority:
    tier-a-public-keys:
      tamld: "MCowBQYDK2VwAyEA..."          # base64 ed25519 public key
      co-maintainer: "MCowBQYDK2VwAyEA..."
  ```
- `did config authority generate-keypair --executor tamld` creates keyfile + prints public key for config.

### 23.4 v1.0 — ed25519 required for binding

- `did lesson sign` rejects HMAC signatures.
- HMAC-only legacy lessons remain readable but tagged `legacy-signature` — must be re-signed with ed25519 to retain `binding` status.
- Migration script `did migrate v09-to-v10 --re-sign` walks active binding lessons and prompts re-sign.

### 23.5 SignaturePayload schema (uniform v0.8+)

```typescript
export interface SignaturePayload {
  algorithm: "HMAC-SHA256" | "ed25519";
  keyId: string;
  signedAt: string;
  signature: string;        // base64
  signerExecutor: string;
  signerTier: "A";          // hardcoded — only Tier A
}
```

`signature` covers: `(payload.lessonId + payload.verdict + payload.signedAt + payload.signerExecutor)`. Replay-protected by `signedAt`.

---

## Section 24 — Eligibility Gates + Ranking + `promising` State (fixes #3 — DESIGN BUG)

### 24.1 The bug in v2

v2 used geometric mean of 6 trust dimensions. New lessons start with:
- `recency = 1.0` (just created — OK)
- `convergence = 0.0` (no acceptors yet — KILLS the score)
- `outcome = undefined` → defaults to 0 → KILLS

→ Composite trust = 0 for every new lesson → never enters injection digest → never recalled → never gets recency/convergence/outcome → permanent blackhole.

This is a **vòng tử** (death spiral). The lesson with valuable insight that took human effort to record never ranks above noise.

### 24.2 The fix — separate eligibility from ranking

Ranking should be continuous and not collapse on missing dimensions. Eligibility should be binary and deterministic.

#### 24.2.1 Eligibility gates (binary)

A lesson is **eligible** for any feed channel (Stage 5 A/B/C/D) IFF ALL of:

```
✓ evidenceLevel ∈ {CODE, RUNTIME, INFER}    // HYPO excluded
✓ status ∈ {active}                         // archived/superseded/merged/cold-archived excluded
✓ trustState ≠ contested                    // frozen lessons excluded
✓ scopeMatch(lesson, currentContext) ∈ {match, partial}
✓ authority.recorder.tier ≠ revoked
✓ if status requires signature (binding): signature is valid AND not compromised
```

If any gate fails → lesson **ineligible** for this query, regardless of ranking score.

#### 24.2.2 Ranking score (continuous, weighted sum, NO collapse)

For eligible lessons:

```typescript
function rankScore(lesson: Lesson, context: LessonContext): number {
  const provenance = provenanceWeight(lesson.authority.recorder.tier);     // 0.1-1.0
  const evidence   = evidenceWeight(lesson.evidenceLevel);                  // 0.4-1.0
  const outcome    = recallPrecision(lesson) || 0.5;                         // 0.0-1.0, default 0.5 if no data yet
  const recency    = exp(-daysSinceLastHelpful(lesson) / 60) || 1.0;        // 0-1, default 1.0 (no decay yet)
  const convergence = saturate(distinctHelpfulAcceptors(lesson) / 3);       // 0-1, saturate at 3

  const score = 0.30 * provenance
              + 0.30 * outcome
              + 0.20 * convergence
              + 0.15 * recency
              + 0.05 * evidence;

  const scopeMul = scopeMultiplier(scopeMatch(lesson, context));            // 1.0=match, 0.5=partial
  return score * scopeMul;
}
```

**Defaults for missing data** (the key fix):
- `outcome` defaults to **0.5 (neutral)**, not 0 — new lessons get neutral outcome score.
- `recency` defaults to **1.0**, not 0 — new lessons get full recency credit.
- `convergence` correctly starts at 0 — but its weight is only 0.20, not multiplicative, so doesn't blackhole.

This means a brand-new lesson with `provenance=0.7 (Tier B)`, `evidence=0.8 (RUNTIME)`, `outcome=0.5 (default)`, `recency=1.0`, `convergence=0.0`:
```
score = 0.30*0.7 + 0.30*0.5 + 0.20*0.0 + 0.15*1.0 + 0.05*0.8
      = 0.21 + 0.15 + 0 + 0.15 + 0.04
      = 0.55
```
Not zero. Above the typical threshold of 0.4 for `promising` inclusion in injection digest. **Vòng tử broken.**

### 24.3 Updated state machine — adds `promising`

```
raw         → 0 outcomes AND (length < 50 OR no quality gate pass)
promising   → quality gate passed AND (≥1 helpful outcome OR evidence ≥ RUNTIME)
trusted     → ≥3 distinct helpful acceptors AND outcome ≥ 0.7 AND scope tested ("scopeProof: tested")
binding     → Tier A signature (signed, not compromised, not rotated-out)
contested   → conflict cluster unresolved
archived    → soft-retired
cold-archived → hard-archived
```

Transitions (auto except where noted):

```
raw → promising      AUTO when quality gate passes
promising → trusted  AUTO when 3 helpful acceptors AND outcome ≥ 0.7 AND scopeProof = tested
trusted → binding    MANUAL Tier A
* → contested        AUTO (dedup)
contested → trusted  MANUAL Tier A adjudicate
trusted → promising  AUTO if outcome drops below 0.5 over rolling 30d
trusted → raw        AUTO if recency-decayed score < 0.3 AND no recalls in 90d
binding → archived   MANUAL Tier A only
* (other) → archived AUTO per forgetting policy
```

State at any historic time = replay of `lesson-state-transitions.jsonl`. Never deletable.

### 24.4 Effect on injection digest (Channel A) and recall (Channel B)

```
top-K injection candidates =
  filter(allLessons, lesson => isEligible(lesson, context))
    .map(lesson => ({ lesson, score: rankScore(lesson, context) }))
    .filter(({ score }) => score >= 0.40)        // promising threshold
    .sort((a, b) => b.score - a.score)
    .take(K)
```

**Important property**: Adding a `promising` lesson does NOT replace `trusted` lessons unless its score is higher. The threshold + ranking handle this naturally.

### 24.5 Effect on Meta Growth aggregator

`lessonsEffective` only counts outcomes attached to lessons in `trusted` or `binding` state at outcome-time. `promising` outcomes count toward future state transitions, but are excluded from current Meta Growth metric to prevent self-validation loops.

`raw` and `promising` lessons appear in:
- `lessonsCreated` (yes — they were created in the window)
- `lessonsEffective` (NO — only `trusted`/`binding` outcomes count)
- `lessonSpecificityScore` (yes if quality-gate passed)

Snapshot adds new field:
```json
"stateBreakdown": {
  "raw": 5,
  "promising": 12,
  "trusted": 18,
  "binding": 3,
  "contested": 1,
  "archived": 47
}
```

---

## Section 25 — `authorityRank()` Explicit Function (fixes #4)

### 25.1 The bug in v2

v2 §18.2 used `A.authority > B.authority` without defining `>` over the `LessonAuthority` struct. The struct has 4 sub-fields (recorder, validator, acceptors, adjudicator) — no obvious ordering.

### 25.2 The fix — explicit numeric rank

```typescript
function authorityRank(lesson: Lesson): number {
  // Sovereign tier — binding-signed lessons win over everything except other binding
  if (
    lesson.trustState === "binding" &&
    lesson.authority.adjudicator?.verdict === "binding" &&
    !isCompromised(lesson.authority.adjudicator)
  ) {
    return 1000 + acceptorBoost(lesson);
  }

  // Recorder tier — ladder of contributor authority
  const recorderRank = {
    A: 100,
    B: 70,
    C: 30,
    D: 20,
    E: 10,
  }[lesson.authority.recorder.tier];

  // Acceptor boost — capped to prevent recorder-tier inversion
  const boost = acceptorBoost(lesson);
  const cappedBoost = Math.min(50, boost);    // max +50, so a Tier-E lesson can rank up to 60 < Tier-B baseline 70

  return recorderRank + cappedBoost;
}

function acceptorBoost(lesson: Lesson): number {
  return lesson.authority.acceptors
    .filter(a => a.verdict === "helpful" && !isCompromised(a))
    .reduce((sum, a) => sum + ({ A: 10, B: 7, C: 3, D: 2, E: 1 }[a.tier]), 0);
}
```

### 25.3 Properties

- **Determinism**: identical lessons → identical rank.
- **Authority dominance**: a Tier A binding lesson beats any non-binding lesson.
- **Recorder ladder preserved**: Tier B lesson with massive acceptor support cannot exceed Tier A casual lesson (recorder rank 100 + boost ≤ 50 = 150 max for B; A baseline 100 + boost ≤ 50 = 150 max — at boundary, recorder tie-break rules apply).
- **Compromise immunity**: revoked acceptors and revoked adjudicator excluded from rank.

### 25.4 Updated conflict resolver (replaces v2 §18.2 Rule 1)

```typescript
function resolveConflict(A: Lesson, B: Lesson): Resolution {
  const rankA = authorityRank(A);
  const rankB = authorityRank(B);

  // Rule 1 — Authority precedence (lex superior)
  // Sovereign threshold: binding tier dominates non-binding regardless of boost
  if (rankA >= 1000 && rankB < 1000) return { winner: A, rule: "authority-binding" };
  if (rankB >= 1000 && rankA < 1000) return { winner: B, rule: "authority-binding" };

  // Below sovereign: 30+ rank delta is decisive
  if (rankA - rankB >= 30) return { winner: A, rule: "authority" };
  if (rankB - rankA >= 30) return { winner: B, rule: "authority" };

  // Rules 2-5 unchanged from v2: specificity, outcome, convergence, recency
  // ...
}
```

### 25.5 Test contract

`authority-rank-determinism.test.js` MUST verify:
- Identical input → identical rank (run 100 times)
- Tier A binding always > Tier B non-binding (boundary check)
- Compromised acceptor excluded from rank (mutation test)

---

## Section 26 — Scope Matching: Phased Capability (fixes #5)

### 26.1 The bug in v2

v2 §17.3.2 said `all(context.requiredTags) ⊆ lesson.scope.appliesTo` — string subset only. Real scope matching needs:
- Semver version comparison (`>=14.0` matches `15.2`)
- Framework aliases (`pg` ↔ `postgresql` ↔ `postgres`)
- Negative constraints (excludes)

v2 conflated future capability with current spec.

### 26.2 The fix — explicit capability phases

#### Phase 1 — v0.8.0: string-match only

```typescript
function scopeMatchV08(lesson: Lesson, context: LessonContext): "match" | "partial" | "mismatch" {
  // Excludes are checked first (negative constraint)
  if (intersects(context.tags, lesson.scope.excludes)) return "mismatch";

  // String subset on appliesTo
  if (subsetEqual(context.requiredTags, lesson.scope.appliesTo)) return "match";

  // Partial overlap
  if (intersects(context.tags, lesson.scope.appliesTo)) return "partial";

  return "mismatch";
}
```

`validFor.version` field stored in lesson but NOT enforced in v0.8. Surfaces in `did lesson list --show-scope` as informational only.

#### Phase 2 — v0.9.0: semver-aware + framework aliases

```typescript
function scopeMatchV09(lesson: Lesson, context: LessonContext, config: DiDConfig): "match" | "partial" | "mismatch" {
  // Apply framework aliases first (canonical form)
  const canonicalContextTags = applyAliases(context.tags, config.scope.aliases);
  const canonicalLessonAppliesTo = applyAliases(lesson.scope.appliesTo, config.scope.aliases);
  const canonicalLessonExcludes = applyAliases(lesson.scope.excludes, config.scope.aliases);

  if (intersects(canonicalContextTags, canonicalLessonExcludes)) return "mismatch";

  // Version match if both lesson and context declare versions
  if (lesson.scope.validFor.version && context.framework?.version) {
    if (!semverSatisfies(context.framework.version, lesson.scope.validFor.version)) {
      return "mismatch";
    }
  }

  // String + alias subset
  if (subsetEqual(context.requiredTags, canonicalLessonAppliesTo)) return "match";
  if (intersects(canonicalContextTags, canonicalLessonAppliesTo)) return "partial";
  return "mismatch";
}
```

Aliases configured in `defense.config.yml`:
```yaml
scope:
  aliases:
    postgresql: [postgres, pg, psql]
    nodejs: [node, "node.js"]
    typescript: [ts]
```

#### Phase 3 — v1.0.0: full structured matching

- Negative constraints with semver (`!=14.0.0`)
- Tag taxonomy with hierarchical matching (database/sql/postgresql)
- Custom matcher plugins via `defense.config.yml.scope.matchers`

### 26.3 Migration policy

- Lessons created in v0.8 store scope but `scopeProof = "asserted"` by default.
- v0.9 introduces `did lesson scope-test <id>` → runs lesson against actual context, marks `scopeProof = "tested"` on success.
- v1.0 may require `scopeProof = "tested"` for `trusted` state transition (currently optional).

### 26.4 v0.8 caveat surfaces

When `scopeMatchV08` runs and the lesson has populated `validFor.version`, hint **H-011-version-not-enforced** fires informing user: "Lesson X declares semver constraint Y, but v0.8 enforces string match only. Upgrade to v0.9 for semver enforcement."

---

## Section 27 — Binding Lesson Protection (fixes #6 — GOVERNANCE BUG)

### 27.1 The bug in v2

v2 §19.1 Layer 3 (Compression) auto-compresses any cluster ≥ 50 cold members. But cold members can include binding lessons (post-archive). After compression, original text replaced by `compressedLesson.summary` — losing nuance, losing audit trail integrity for binding evidence.

This violates Pillar 3 (Temporal Lock) and Pillar 4 (Anti Self-Validation — binding lesson means human signed it; system shouldn't summarize over their words).

### 27.2 The fix — Binding Invariants

These are HARD invariants enforced at every relevant stage. Test contract verifies each.

#### Invariant B1 — No silent compression

> **Binding lessons are NEVER substituted by `compressedLesson.summary`.**

```typescript
function compressCluster(cluster: DedupCluster, lessons: ReadonlyArray<Lesson>): CompressedLesson | null {
  const members = lessons.filter(l => cluster.memberLessonIds.includes(l.id));
  const hasBinding = members.some(l => l.trustState === "binding");

  if (hasBinding) {
    return null;          // refuse to compress this cluster
  }

  return generateCompressedLesson(cluster, members);
}
```

Hint **H-012-binding-blocks-compression** fires on attempted compress with reason.

#### Invariant B2 — No automatic archival

> **Binding lessons NEVER transition to `archived`, `cold-archived`, or any layer of forgetting except via Tier A explicit `did lesson retire <id> --binding-override --reason`.**

`did lesson retire <id>` rejects binding lessons unless `--binding-override` flag AND caller is Tier A. Log to `.agents/records/binding-retirements.jsonl` with full reason.

#### Invariant B3 — Full text preserved across all storage layers

> **At every storage layer (active, soft-retired, hard-archived, cold-storage), binding lesson FULL text is preserved verbatim. Compression CANNOT touch them.**

In cold-storage `.zst` files, binding lessons are stored uncompressed alongside the zstd-compressed regulars (or in a separate `.binding.jsonl` file at archive root). `did lesson restore <bindingId>` is always O(1) lookup.

#### Invariant B4 — Compromise propagation

> **If a Tier A executor is revoked (Section 22.3), all binding lessons signed by them lose binding status (demoted to `contested`) — but text remains. The retroactive demotion is itself logged as a state transition; the original signature record stays for forensic audit.**

Invariant B4 explicitly preserves audit trail even when binding status is revoked. The signature is marked `compromised`, not erased.

#### Invariant B5 — Compression awareness in clusters

> **A cluster that contains ≥ 1 binding member is marked `cluster.containsBinding = true` and is excluded from automatic compression. The cluster CAN still be queried for canonical/merge dedup, but the compression layer respects the boundary.**

```typescript
export interface DedupCluster {
  // ... existing fields ...
  containsBinding: boolean;       // NEW
  compressionEligible: boolean;   // = !containsBinding && all(memberLessons).status ∈ archived states
}
```

### 27.3 Updated forgetting matrix (replaces v2 §19.5)

| Lesson state | Layer 1 (soft) | Layer 2 (hard) | Layer 3 (compression) | Layer 4 (cold) |
|:--|:-:|:-:|:-:|:-:|
| active | ✓ if criteria met | – | – | – |
| promising | ✓ if criteria met | – | – | – |
| trusted | ✓ if criteria met | ✓ from soft | – | ✓ from hard |
| **binding** | ✗ (Tier A only) | ✗ (Tier A only) | **✗ NEVER** | ✗ (Tier A only, full text preserved) |
| contested | ✗ (frozen) | ✗ | ✗ | ✗ |
| archived | – | ✓ after 180d | ✓ if cluster ≥ 50 cold AND no binding | ✓ after 12mo |
| superseded/merged | ✓ | ✓ | ✓ if no binding in cluster | ✓ |

### 27.4 Test contract additions

`binding-invariants.test.js` MUST verify:
- B1: cluster with binding member → `compressCluster()` returns null
- B2: `did lesson retire <bindingId>` rejects without `--binding-override`
- B3: binding lesson text byte-identical across all storage transitions
- B4: revocation demotes binding → contested, signature record preserved
- B5: `cluster.containsBinding` correctly computed

---

## Section 28 — Updated Open Questions

### Resolved by amendment v3

| Old Q | Resolution |
|:--|:--|
| 9. Tier A allowlist source | Section 22.4 — explicit `tier-a-allowlist` array in config; git user.email used only for matching, not implicit auth |
| 10. Adjudicator signature mechanism | Section 23 — HMAC v0.8, ed25519 v0.9 optional, ed25519 required v1.0 |
| 11. Legacy lesson migration scope | Section 26.3 — `scopeProof = "asserted"` for v0.8 lessons, optional `scope-test` migration to `tested` |
| 12. Composite trust visibility | Section 24 — `did lesson list --show-trust` surfaces `state` + `rankScore` (not raw vector — too dense) |

### New questions from v3

13. **Quorum default for OSS**: should `tier-a-quorum` default to 0 (solo OK) or 1 (require self only)? Recommend **0** for OSS solo maintainer ergonomics; document recommendation to set 2 for enterprise/Persona-C deployments.

14. **Binding-override audit retention**: how long do `binding-retirements.jsonl` entries persist? Recommend **forever** (HITL Pillar 4 — never delete).

15. **Promising threshold tuning**: `score >= 0.40` for digest inclusion is arbitrary. Configurable? Recommend **yes** via `defense.config.yml.metaGrowth.thresholds.promisingMin` with default 0.40.

16. **HMAC secret bootstrap**: how does a user FIRST set their HMAC secret? Recommend `did config authority init` interactive command that:
    - Generates a random secret (32 bytes)
    - Prints once to stdout for user to copy to env / secret manager
    - Stores SHA-256 hash in `.agents/state/authority-keyring.json` for verification (NOT the secret itself)
    - Subsequent `did lesson sign` reads `DID_HMAC_SECRET` env var

---

## Section 29 — Updated Sequencing (replaces v2 §21)

| Phase | Version | Scope additions from v3 |
|:-:|:--|:--|
| 2 | v0.7.1 | + `promising` state in `TrustState`, eligibility gates skeleton (Section 24), `authorityRank()` stub, scope schema with `scopeProof`. |
| 3 | v0.8.0 | + Section 24 ranking with weighted sum (NOT geometric mean), state machine implementation, conflict resolver with `authorityRank()`. + Section 27 Binding Invariants B1-B5. + Section 26 Phase 1 string-match scope. |
| 4 | v0.8.1 | + Aggregator reads `stateBreakdown`, only counts `trusted`/`binding` outcomes for `lessonsEffective`. |
| 5 | v0.8.2 | + CI gate enforces invariants (Section 27 test contract). |
| 7 | v0.8.4 | + Hint H-010-authority-revoked, H-011-version-not-enforced, H-012-binding-blocks-compression. |
| 9 | v0.9.0 | + Section 22 Tier A rotation/revocation/multi-sig CLI. + Section 23 ed25519 capability. + Section 26 Phase 2 semver + aliases. + Forgetting Layer 3-4 (with Binding Invariants B3 enforced). |
| 10 | v1.0.0 | + Section 23 ed25519 required. + Section 26 Phase 3 full structured matching. |

---

## Section 30 — Ratification Summary

After this amendment, the contract has:

- **15 sections** (v1) — foundational schemas, lifecycle, dedup, aggregator, smelter, CLI, CI gates, tests, thresholds, versioning
- **6 sections** (v2 §16-21) — authority taxonomy, trust+scope, conflict precedence, forgetting, open Qs, sequencing
- **9 sections** (v3 §22-30) — Tier A lifecycle hardening, signature roadmap, eligibility gates + ranking + promising state, authorityRank, scope phasing, binding invariants, updated open Qs, updated sequencing, this summary

**Net contract size**: 30 sections, ~75KB of design contract.

### Ratification clauses

A ratifying maintainer commits to:
1. Treating this contract as the single source of truth for v0.7.1 → v1.0.0 implementation work.
2. Every PR opened against the Meta Growth subsystem MUST link this contract and cite which clause(s) it satisfies.
3. Deviations from the contract require either an amendment (preferred) or an explicit `[CONTRACT-DEVIATION]` tag in the PR with rationale.
4. The 4 immutable guarantees:
   - Pillars 1-7 inviolable
   - Tier A weight floor for signed actions = 1.0 (Section 22.5)
   - Binding Invariants B1-B5 (Section 27.2)
   - Provenance is forever (no deletions, only state transitions)

### Ratification options

- **A — Ratify whole** (v1 + v2 + v3) → mở meta-issue trên GitHub với contract đính kèm + sequencing matrix
- **B — Iterate further** → identify specific section + clause to refine
- **C — Defer** → request more questions before ratification

---

## Done. v3 fixes the 6 review findings. Ready for ratification.


---

## Part IV — Amendment v3.1

# Meta Growth Constitutional Contract — Amendment v3.1 (Patch)

> **Document Type**: Targeted patch on v3 (replaces specific clauses, additive elsewhere)
> **References**: `meta-growth-contract.md` v1 + amendments v2 + v3
> **Scope**: Addresses 6 peer-review findings on v3:
> 1. Tier B with full acceptor boost can exceed Tier A casual (math contradiction in v3 §25.3)
> 2. Key rotation "not enforceable" silently demotes legitimate old binding lessons (DATA-INTEGRITY BUG in v3 §22.2)
> 3. Solo maintainer break-glass recovery missing (corner-case in v3 §22.3)
> 4. HMAC non-repudiation limitation undocumented (v3 §23.2)
> 5. `promisingMin` threshold should be config, not open question (v3 §28.15 → spec)
> 6. Snapshot lacks `promisingSignals` UX block (v3 §24.5)
> **Status**: DRAFT — pending maintainer ratification
> **Author**: Devin-AI on behalf of `tamld`
> **Date**: 2026-04-27

---

## Severity classification

| # | Issue | Severity | Action |
|:-:|:--|:-:|:--|
| 2 | Key rotation silently demotes binding lessons | **DATA-INTEGRITY BUG** | Replace v3 §22.2 wholesale |
| 1 | Tier B vs Tier A ceiling contradiction | **DOC CONTRADICTION** | Replace v3 §25.3 |
| 3 | Solo break-glass missing | CORNER-CASE | Add §31 |
| 4 | HMAC non-repudiation limitation | HONESTY | Patch v3 §23.2 |
| 5 | `promisingMin` move to spec | SPEC POLISH | Patch v3 §24.4 + remove from §28 open Qs |
| 6 | `promisingSignals` block missing | UX | Patch v3 §24.5 |

---

## Patch 1 — Replace v3 §22.2 (key rotation semantics)

### Bug

v3 §22.2 said rotated-out keys produce "not enforceable" signatures. This silently demotes ALL binding lessons signed before rotation — violates Pillar 3 (Temporal Lock).

### Fix — separate signing window from verification window

A signing key has TWO independent validity windows:

```typescript
export interface AuthorityKey {
  keyId: string;
  algorithm: "HMAC-SHA256" | "ed25519";
  publicKey: string | null;      // null for HMAC (secret in env)
  validForSigning: {
    from: string;                // ISO timestamp
    until: string | null;        // ISO timestamp, null = unlimited
  };
  validForVerification: {
    from: string;                // ISO timestamp (= validForSigning.from)
    until: string | null;        // null = forever, set only by explicit revoke
  };
  rotatedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}
```

### Behavior

#### Graceful rotation (`did config authority rotate-key`)

Sets `oldKey.validForSigning.until = now + gracePeriod`, leaves `oldKey.validForVerification.until = null` (forever).

```
After rotation grace expires:
  - Old key CANNOT sign new lessons (signing rejected with EAUTH-rotated)
  - Old key STILL verifies pre-rotation signatures (audit trail intact)
  - Binding lessons signed before rotation REMAIN binding
  - New signatures use new key
```

#### Emergency revocation (`did config authority revoke`)

Sets `key.revokedAt = now`, `key.revokedReason = "..."`, AND `key.validForVerification.until = compromisedSince` where `compromisedSince` is the `--since` flag value.

```
After revocation:
  - Key cannot sign (rejected EAUTH-revoked)
  - Signatures with signedAt > compromisedSince INVALIDATED
  - Signatures with signedAt <= compromisedSince REMAIN VALID (pre-compromise)
  - Affected binding lessons (signed after compromise) demoted to contested
  - Pre-compromise binding lessons untouched
```

#### Signature verification algorithm

```typescript
function verifySignature(sig: SignaturePayload, payload: SignedPayload, keyring: AuthorityKeyring): VerifyResult {
  const key = keyring.find(k => k.keyId === sig.keyId);
  if (!key) return { ok: false, reason: "unknown-key" };

  // Check signature falls within key's verification validity window
  const sigTime = parseISO(sig.signedAt);
  if (sigTime < parseISO(key.validForVerification.from)) return { ok: false, reason: "before-key-issued" };
  if (key.validForVerification.until && sigTime > parseISO(key.validForVerification.until)) {
    return { ok: false, reason: "post-revocation" };
  }

  // Verify cryptographically
  if (!cryptoVerify(sig, payload, key)) return { ok: false, reason: "invalid-signature" };

  return { ok: true, key };
}
```

### Test contract addition

`key-lifecycle-rotation.test.js` MUST verify:
- Rotation does NOT invalidate pre-rotation signatures
- Revocation with `--since T` invalidates ONLY signatures with `signedAt > T`
- Pre-T signatures by revoked key remain valid (audit trail)
- Property: rotation → rotation → rotation never demotes any binding lesson signed in between (regression guard)

---

## Patch 2 — Replace v3 §25.3 (authorityRank ceiling)

### Bug

v3 §25.3 claimed "Tier B lesson with massive acceptor support cannot exceed Tier A casual lesson." Math: B ceiling = 70 + 50 = 120 > A baseline 100. Contradiction.

### Fix — Per-tier ceiling

```typescript
const TIER_BASELINE = { A: 100, B: 70, C: 30, D: 20, E: 10 } as const;
const TIER_CEILING  = { A: 999, B: 99, C: 69, D: 49, E: 29 } as const;
//   note: A ceiling 999 (binding gets +1000 elsewhere — sovereign tier)
//   note: each tier's ceiling = next tier's baseline - 1, so hierarchy is preserved

function authorityRank(lesson: Lesson): number {
  // Sovereign tier — binding signed (not compromised)
  if (
    lesson.trustState === "binding" &&
    lesson.authority.adjudicator?.verdict === "binding" &&
    !isCompromised(lesson.authority.adjudicator)
  ) {
    return 1000 + acceptorBoost(lesson);
  }

  const tier = lesson.authority.recorder.tier;
  const baseline = TIER_BASELINE[tier];
  const boost = Math.min(50, acceptorBoost(lesson));   // raw cap (defensive)
  const ceiling = TIER_CEILING[tier];

  return Math.min(baseline + boost, ceiling);
}
```

### Properties (now actually true)

- Tier A non-binding max = 100 + 50 = 150, capped to 999 → 150 effective
- Tier B max = min(70 + 50, 99) = 99
- Tier C max = min(30 + 50, 69) = 69
- Tier D max = min(20 + 50, 49) = 49
- Tier E max = min(10 + 50, 29) = 29

**Hierarchy preserved**: ceilings ensure no lower-tier lesson can exceed an upper-tier baseline, regardless of acceptor support.

### Test contract addition

`authority-rank-ceiling.test.js` MUST verify:
- For all tiers t1, t2 where t1 < t2 (by ladder): max(rank(t1)) < min(rank(t2))
- Tier A binding (1000+) > all other ranks (math: floor of binding 1000 > ceiling of A 999)
- Compromised acceptor excluded from boost calculation

---

## Patch 3 — Add §31 (Solo Maintainer Break-Glass Recovery)

### Problem

v3 §22.3 prevents self-revoke (good — defends against compromised key revoking itself). But for solo OSS maintainer with compromised key, this leaves no recovery path:
- Cannot revoke (would be self-revoke, blocked)
- Cannot rotate (rotation requires the compromised key to sign the rotation event)

System has stuck-state. Need out-of-band recovery.

### Section 31 — Break-Glass Recovery Procedure

DiD recognizes that the **repository owner at the git provider level** (GitHub repo admin, GitLab maintainer, etc.) holds authority *above* DiD's Tier A model. This is the **last-resort sovereign**. DiD cannot enforce against this layer because it operates at the git protocol layer, not within DiD's signing model.

### 31.1 When to use Break-Glass

ONLY when ALL of:
- Tier A keyring is compromised AND
- Lone Tier A maintainer (or quorum unreachable) AND
- Cannot rotate via normal `did config authority rotate-key`

### 31.2 Procedure (manual, OS-level, out-of-band)

```
1. Stop all `did` operations on the repository.

2. As repo owner (filesystem-level access, NOT through `did` CLI):
   a. Generate a new keypair (offline, on a clean machine):
      $ did config authority generate-keypair --executor <name> --output ./recovery.priv
   b. Manually edit `defense.config.yml` to:
      - Add new public key under `authority.tier-a-public-keys`
      - Move compromised key under `authority.tier-a-revoked-keys` with revokedAt + reason
   c. Manually create `.agents/records/authority-revocations.jsonl` entry with:
      "executor": "<compromised-name>",
      "since": "<compromise-detection-timestamp>",
      "reason": "...",
      "revokedBy": "BREAK-GLASS-REPO-OWNER",
      "revokedAt": "<ts>",
      "breakGlass": true

3. Commit changes with conventional commit prefix:
   $ git commit -m "chore(security): [BREAK-GLASS] revoke compromised Tier A key for <executor>"
   The [BREAK-GLASS] tag is REQUIRED — pre-commit hook MUST recognize this prefix.

4. Push to main using git provider auth (NOT DiD signing):
   $ git push origin main

5. On next `did` invocation, the new keyring takes effect:
   - `did config authority audit-recovery` walks all binding lessons
   - For lessons signed by compromised key with signedAt > compromiseSince:
       - demote to `contested`
       - emit hint H-013-binding-broken-by-revocation
   - For lessons signed by compromised key with signedAt <= compromiseSince:
       - remain valid (Patch 1 semantics)
   - Output report: how many binding → contested, list affected ticket IDs.
```

### 31.3 Pre-commit hook recognition

```
[BREAK-GLASS] commits bypass:
  - Tier A signing requirement (because cluster of Tier A keys is in flux)
  - did lesson record validation (recovery may need legacy lesson edits)

[BREAK-GLASS] commits DO NOT bypass:
  - Conventional commit format
  - JSONL append-only invariant (cannot rewrite history)
  - Pillar 3 Temporal Lock (immutable past records)
```

### 31.4 Post-recovery audit

A Break-Glass event MUST trigger:
- GitHub issue auto-created with title `[POST-MORTEM] BREAK-GLASS event YYYY-MM-DD`
- Hint H-014-break-glass-active-review-needed (fires until issue is resolved)
- Required template: timeline, compromise detection method, affected lessons count, root cause

This makes Break-Glass auditable AFTER the fact, even if mid-event safety bypasses Tier A signing.

### 31.5 Limits — what Break-Glass cannot do

- Cannot delete records (Pillar 3 Temporal Lock — append-only forever)
- Cannot modify pre-compromise signatures (they remain valid per Patch 1)
- Cannot upgrade lesson trust states beyond their normal lifecycle
- Cannot bypass conflict adjudication for non-compromised lessons

Break-Glass is for **revocation + key rotation only** — not for general governance override.

---

## Patch 4 — Patch v3 §23.2 (HMAC honesty caveat)

### Insert into v3 §23.2

After the storage paragraph, ADD:

> **LIMITATION (v0.8 HMAC — non-repudiation):**
>
> HMAC-SHA256 with shared secret provides **integrity** (proof that someone with the secret signed) but does NOT provide **non-repudiation** (proof of WHICH executor signed).
>
> If multiple Tier A maintainers share the same HMAC secret, their signatures are cryptographically indistinguishable. The `signerExecutor` field in the SignaturePayload (§23.5) is **self-asserted** — the signer claims their identity, but cryptography does not enforce it.
>
> **Recommendations**:
> - Use HMAC only when you have ≤1 Tier A maintainer (solo OSS).
> - For multi-maintainer setups requiring per-executor identity proof, upgrade to v0.9 ed25519 where each maintainer holds their own private key.
> - Even with HMAC, distinct maintainers SHOULD use distinct secret keys (each as a separate `keyId`) to provide pseudo-identity (still requires trust in `signerExecutor` self-assertion, but at least binds it to a key).
>
> **Audit consequence**: HMAC-signed binding lessons can be challenged in adjudication on grounds of identity uncertainty. ed25519 signatures cannot be challenged similarly. v1.0 makes ed25519 mandatory specifically to resolve this.

### Add to Section 28 (open questions table)

Move former Q15 (`promisingMin`) → resolved (Patch 5 below). Q14 (`binding-retirements` retention) → resolved (forever, per Pillar 3).

---

## Patch 5 — Move v3 §28.15 (`promisingMin`) to spec

### Remove from open questions

Strike v3 §28 entry 15 (`promisingMin`).

### Add to v3 §24.4 (digest computation)

```yaml
# defense.config.yml — Meta Growth thresholds (NEW spec section)
metaGrowth:
  thresholds:
    promisingMin: 0.40              # rankScore floor for inclusion in injection digest
    promotionToTrusted: 0.70        # outcome ratio needed AND ≥3 distinct helpful acceptors
    demotionToContested: null       # auto-demote on conflict only (no score-based demotion)
    coverageGapWarn: 0.30           # warn when guard is recalled but no lesson available
    coverageGapBlock: 0.50          # block CI when ratio exceeds (only with --strict)
```

All thresholds configurable per-repo. Defaults reasonable for first 90 days; tune after field bake.

---

## Patch 6 — Add `promisingSignals` block to MetaGrowthSnapshot

### Patch v3 §24.5 (aggregator effects)

Add after the existing `stateBreakdown` paragraph:

```typescript
export interface MetaGrowthSnapshot {
  // ... existing fields ...

  // Strict metrics (only trusted/binding outcomes counted) — unchanged
  metrics: {
    lessonsCreated: number;
    lessonsEffective: number;
    lessonSpecificityScore: number;
    guardFalsePositiveTrend: number;
    timeToGuardHours: number;
    recallPrecision: number;
    coverageGap: number;
    guardF1: number;
  };

  // NEW — soft signal block (NOT counted toward strict metrics, but visible in dashboards)
  promisingSignals: {
    helpfulOutcomesOnPromising: number;          // # helpful outcomes attached to promising lessons in window
    promotionCandidatesCount: number;             // # promising lessons meeting trusted-transition criteria but not yet promoted
    averagePromisingRankScore: number;            // 0-1, mean rankScore across active promising lessons
    promisingLessonsByContext: Record<string, number>;  // counts by primary tag (top 5)
  };

  // ... existing fields continued ...
}
```

### Rationale

Strict metric (`lessonsEffective`) MUST exclude promising outcomes (Pillar 4 — Anti Self-Validation: only acceptor-confirmed signal counts). But dashboards become "blind" if they show only strict metrics — team sees zero progress while pipeline is full of promising lessons heading toward `trusted`.

`promisingSignals` is the bridge:
- Visible to humans for trend awareness
- NOT input to CI gate (gate uses strict metrics only)
- NOT exported in federation payload v0.9 (privacy: promising lessons may have low confidence, federation hub gets only strict signal)

### CLI surface

```
did metrics meta-growth --period <iso> --include-promising      # default
did metrics meta-growth --period <iso> --strict                 # exclude promisingSignals from output
```

### CI gate behavior

CI gate (`did ci gate`) checks `metrics.*` only. `promisingSignals.*` are informational. Gate stays strict; UX gets visibility.

---

## Section 32 — Updated Open Questions (after v3.1)

Resolved by v3.1:
- Q1 (Tier B ceiling) → Patch 2
- Q2 (key rotation semantics) → Patch 1
- Q3 (solo break-glass) → Patch 3 + new §31
- Q4 (HMAC limitation) → Patch 4
- Q5 (`promisingMin` config) → Patch 5
- Q6 (`promisingSignals`) → Patch 6

Remaining open questions (carried from earlier amendments):
- Q13 — Quorum default for OSS (recommend 0)
- Q14 — Binding-retirements audit retention (resolved: forever)
- Q16 — HMAC bootstrap UX (`did config authority init` interactive, recommended)

Net new questions from v3.1:
- **Q17** — Should `[BREAK-GLASS]` commit prefix be enforced by pre-commit hook, or just by social convention? Recommend pre-commit enforcement to make Break-Glass commits identifiable in audit log retroactively.
- **Q18** — Should `did config authority audit-recovery` (post-Break-Glass) be auto-invoked on first `did` call after detecting `[BREAK-GLASS]` in recent commits, or require manual invocation? Recommend auto-invoke + lock other operations until completion.

---

## Section 33 — Updated Sequencing Patches (apply to v3 §29)

| Phase | Version | v3.1 additions |
|:-:|:--|:--|
| 2 | v0.7.1 | + `AuthorityKey` schema (Patch 1), per-tier ceilings in `authorityRank()` (Patch 2), `promisingSignals` field in MetaGrowthSnapshot (Patch 6) |
| 3 | v0.8.0 | + key lifecycle separation (validForSigning vs validForVerification — Patch 1), `promisingMin` config (Patch 5) |
| 5 | v0.8.2 | + CI gate excludes `promisingSignals` (Patch 6 §3) |
| 9 | v0.9.0 | + Break-Glass procedure (Section 31), audit-recovery CLI, ed25519 with proper non-repudiation (Patch 4) |

---

## Section 34 — Ratification Checklist for v1 + v2 + v3 + v3.1

After this patch, the contract is complete. Maintainer ratifying commits to:

1. ☐ Treats v1 + v2 + v3 + v3.1 as single source of truth for v0.7.1 → v1.0.0 implementation
2. ☐ Every Meta Growth PR cites contract clause(s) it satisfies
3. ☐ Deviations require either amendment or explicit `[CONTRACT-DEVIATION]` PR tag
4. ☐ Pillars 1-7 inviolable
5. ☐ Tier A weight floor for SIGNED actions = 1.0; A-compromised hardcoded = 0.0
6. ☐ Binding Invariants B1-B5 (v3 §27.2)
7. ☐ Key lifecycle: signing window ≠ verification window (v3.1 Patch 1)
8. ☐ Authority hierarchy preserved by per-tier ceilings (v3.1 Patch 2)
9. ☐ Break-Glass procedure documented and enforced by pre-commit hook (v3.1 §31)
10. ☐ HMAC limitation acknowledged (v3.1 Patch 4)
11. ☐ Provenance is forever (no deletions, only state transitions)

### Ratification options

- **A — Ratify whole** (v1 + v2 + v3 + v3.1) → open meta-issue with all 4 documents linked + sequencing matrix
- **B — Iterate further** → identify specific clause to refine
- **C — Defer** → request more questions before ratification

---

## Done. v3.1 closes 6 review findings on v3. Stack ready for ratification.
