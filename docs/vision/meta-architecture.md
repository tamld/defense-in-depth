# Vision: The Meta Architecture

> *"Keeping ideas in your head is just drawing on paper. Shipping ideas as types is an invitation to the world."*

This document describes WHERE defense-in-depth is heading. These aren't promises — they're published designs that invite community feedback and contribution.

---

## The 4 Layers

```
Layer 3: META GROWTH        "Is our growth system improving?"
   ↑                        MetaGrowthSnapshot, Constitutional Smelter
Layer 2: META MEMORY         "Are lessons being recalled? Helpful?"
   ↑                        LessonOutcome, RecallMetric
Layer 1: MEMORY / GROWTH     "What did we learn? How much improved?"
   ↑                        Lesson (Án Lệ), GrowthMetric
Layer 0: GUARDS              "Is this commit clean?"
                             Guard pipeline, CLI (CURRENT)
```

### Layer 0: Guards (v0.1 — SHIPPED)
Mechanical checks that run as Git hooks. Deterministic, pure functions, zero-infrastructure.

**What it proves:** AI-generated code can be validated before it reaches Git history.

### Layer 1: Memory (v0.4 — SHIPPED)
File-based lesson recording (`lessons.jsonl`). Every lesson is an Án Lệ (Case Law) with mandatory `wrongApproach` and `correctApproach`.

**What it proves:** Systems can remember mistakes without databases.

### Layer 2: Meta Memory (v0.7-rc.1 — SHIPPED, MVP)
Tracking whether lessons are actually recalled and helpful. `LessonOutcome` + `RecallMetric` shipped as a Path A MVP in [v0.7.0-rc.1](https://github.com/tamld/defense-in-depth/releases/tag/v0.7.0-rc.1) (PRs [#27](https://github.com/tamld/defense-in-depth/pull/27), [#28](https://github.com/tamld/defense-in-depth/pull/28), [#31](https://github.com/tamld/defense-in-depth/pull/31)) — recall capture, outcome scanner, Progressive Discovery hints. Aggregation, F1 metric, dedup and the full quality gate are deferred to Track B (v1.1.x) per `docs/vision/meta-growth-roadmap.md`.

**What it proves:** A lesson that's never recalled is the same as no lesson at all. Memory systems need quality measurement.

### Layer 3: Meta Growth (v1.1.x — DESIGNED, gated on Track A4 adoption exit)
Measuring whether the growth rate itself is accelerating. `MetaGrowthSnapshot` tracks the second derivative of improvement. Implementation is **gated** behind Track A adoption exit (≥10 external users + ≥100 captured events) per `docs/vision/meta-growth-roadmap.md`.

**What it proves:** The difference between a system that improves and a system that improves at improving.

---

## Meta Prompting

> *"Not instructions for agents. Instructions that teach agents to write instructions."*

| Layer | What exists | Example in defense-in-depth |
|:---|:---|:---|
| **Prompting** | Guard checks code | `hollow-artifact.ts` scans file content |
| **Meta-prompting** | Contract teaches writing guards | `guard-interface.md` defines the Guard API |
| **Meta-meta** | Philosophy explains WHY guards exist | `COGNITIVE_TREE.md` defines cognitive roots |

The feedback loop that makes meta-prompting real:

```
Agent writes guard → Guard runs → Results measured
→ Results feed GrowthMetric → Metric triggers improvement
→ Agent writes BETTER guard (meta-prompt evolved)
```

Without this feedback loop, meta-prompting is just documentation. WITH it, the system teaches itself to teach itself.

---

## Meta Memory: The Recall Problem

A memory system has two failure modes:

| Failure | Symptom | Metric |
|:---|:---|:---|
| **False Recall** | Lesson surfaces but isn't helpful | Low precision |
| **Missed Recall** | Relevant lesson exists but isn't surfaced | Low coverage |

defense-in-depth addresses this with `LessonOutcome`:

```typescript
interface LessonOutcome {
  lessonId: string;
  recalled: boolean;     // Was the lesson recalled?
  helpful: boolean;      // Was the recall helpful?
  triggerScenario: string; // What situation triggered recall?
}
```

From accumulated `LessonOutcome` data, we derive `RecallMetric`:
- **Precision** = helpful recalls / total recalls
- **Coverage Gap** = missed relevant recalls / total relevant situations

**The goal:** A recall system where precision > 0.8 and coverage gap < 0.15.

---

## Meta Growth: The Second Derivative

| Metric | What it measures | Why it matters |
|:---|:---|:---|
| `lessonsCreated` | Volume of learning | Raw growth velocity |
| `lessonsEffective` | Quality of learning | Growth that actually helps |
| `guardFalsePositiveTrend` | Guard accuracy over time | Is the system getting smarter? |
| `timeToGuardHours` | Bug → Guard cycle time | System responsiveness |
| `communityContributions` | External input | Diversity of learning sources |
| `lessonSpecificityScore` | Average lesson detail | Are lessons getting more concrete? |

**The ultimate question:** Is `lessonSpecificityScore` trending UP? If lessons are becoming more specific, the system is genuinely learning. If they're becoming more generic, the system is regressing toward platitudes.

---

## Federation: The Reverse Flow

```
┌─────────────┐                    ┌──────────────────┐
│Internal Core│ ──── Extract ────→ │ defense-in-depth  │
│  (HQ)       │    patterns,       │ (OSS Embassy)    │
│             │    philosophy      │                  │
│             │                    │ Collects:        │
│             │ ←── Federation ─── │ • Field lessons  │
│  Absorbs:   │    FederationPayload│ • Guard stats   │
│  • Lessons  │                    │ • Recall quality │
│  • Guards   │                    │ • Community PRs  │
│  • Patterns │                    │                  │
└─────────────┘                    └──────────────────┘
```

The `FederationPayload` type defines the data contract:
- **Lessons** from OSS usage (anonymized)
- **RecallMetrics** proving memory system quality
- **GuardStats** showing which guards work (and which don't)
- **MetaGrowthSnapshot** tracking overall system health

**Why this matters:** The internal core is built in a controlled environment. defense-in-depth runs in the wild — different OSes, different project types, different agent platforms. The field data is invaluable.

---

## Types Are Published, Implementation Is Gradual

All types for Layers 0-3 exist in `src/core/types.ts` TODAY. They compile. They have JSDoc. They're importable.

Implementation timeline:

| Type | Exists in types.ts | Implemented | Version |
|:---|:---:|:---:|:---:|
| Guard, Finding, Severity | ✅ | ✅ | v0.1 |
| EvidenceLevel | ✅ | ✅ | v0.1 |
| TicketRef | ✅ | ✅ | v0.3 |
| Lesson, GrowthMetric | ✅ | ✅ | v0.4 |
| EvaluationScore, DSPyConfig | ✅ | ✅ | v0.5 |
| FederationGuardConfig | ✅ | ✅ | v0.6 |
| Hint, HintState, HintsConfig | ✅ | ✅ | v0.7-rc.1 |
| LessonOutcome, RecallMetric, RecallEvent, FeedbackEvent, GuardF1Metric | ✅ | ✅ (MVP) | v0.7-rc.1 |
| MetaGrowthSnapshot | ✅ | ❌ | v1.1.x (Track B — gated on Track A4 exit) |
| FederationPayload | ✅ | ❌ | v0.9 (Enterprise / Telemetry Sync) |

**Publishing types before implementation is deliberate.** It communicates vision, invites feedback, and ensures type compatibility is locked before code is written.

---

> *"Being first doesn't mean being best. Publishing your vision means the community can make it better than you could alone."*
