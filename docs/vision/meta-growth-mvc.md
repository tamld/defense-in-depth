# Meta Growth — Minimum Viable Contract (MVC)

> **Status**: This is the AUTHORITY document for Meta Growth design.
> **Size discipline**: ≤2 pages. No schemas. No CLI. No thresholds. No algorithms.
> Implementation details (those are speculative) live in `meta-growth-design-notes.md` and are NOT authoritative.
> **Evidence policy**: Every clause here is either `[INFER]` (derived from DiD principles + analogy) or `[CODE]` (maps to shipped code). Untagged content here is forbidden. If a future amendment to this MVC contains `[HYPO]` content, it MUST first ship in code and accumulate field data before becoming authoritative.

---

## Tagline

> *Án Lệ is fed into behavior BEFORE the agent acts.* If a lesson cannot be fed, it is diary, not case law.

---

## 1. The 7 Pillars [INFER, derived from STRATEGY.md + DiD principles]

Meta Growth must satisfy ALL seven pillars or it is not Meta Growth.

1. **Deterministic Provenance** — Every Meta Growth claim must reduce to an append-only event log + pure function. No LLM-generated summaries in the audit chain.
2. **Falsifiability** — Every metric must declare its threshold and direction. A claim that cannot be empirically falsified is excluded.
3. **Temporal Locking** — Snapshots are immutable. State at time T is replayable from logs as of T. No retro-compute.
4. **Anti Self-Validation** — AI-generated outcomes have weight zero by default. Trust requires human-confirmed signal. No self-grading loops.
5. **Boundary-of-Claim Discipline** — Every claim states its `n` (sample size), `p` (period), and confidence floor. Claims without bounds are excluded.
6. **Reproducibility on Cold Checkout** — A fresh clone + identical event logs must produce byte-identical metrics. Aggregator depends on no environment.
7. **Closed-Loop Causality** — Meta Growth is enforced by CI gate, not delivered by service. Loop is: events → aggregator → snapshot → hint → action → events. Mất một component = engine sụp.

---

## 2. The 8-Stage Án Lệ Lifecycle

| Stage | Name | Purpose | Status |
|:-:|:--|:--|:-:|
| 1 | Distillation | Mistake → Lesson with `wrongApproach` + `correctApproach` | [CODE] v0.4 |
| 2 | Quality Gate | Reject generic / unspecific lessons | [CODE] partial v0.5.1 (DSPy gate); regex Tier 0 gate not yet shipped |
| 3 | Persistence | Append-only `lessons.jsonl` with idempotent IDs | [CODE] v0.4 |
| 4 | Dedup | Detect equivalent / merged / conflicting lessons | NOT shipped |
| 5 | Injection | Feed Án Lệ into agent context BEFORE action | NOT shipped (this is the largest gap) |
| 6 | Execution | Agent applies recalled lesson to avoid mistake | [CODE] partial — manual `did lesson search` works; not enforced |
| 7 | Verification | Recall + Outcome events; precision tracked | [CODE] v0.7 (RecallEvent + LessonOutcome) |
| 8 | Retirement | Archive stale / superseded lessons | NOT shipped |

**Authority statement**: any Meta Growth feature MUST identify which stage(s) it advances. Features that do not map to a stage are out of scope for Meta Growth.

---

## 3. The 5 Binding Invariants (B1–B5) [INFER, pre-implementation safety invariant]

A `binding` lesson is one that has been signed by a human Tier-A authority. These invariants protect them.

- **B1 — No silent compression**: A binding lesson is NEVER substituted by a compressed summary. Its full text is preserved verbatim across all storage layers.
- **B2 — No automatic archival**: A binding lesson never transitions to archived/cold/compressed except by explicit Tier A action with logged reason.
- **B3 — Full text preservation**: At every storage layer (active, archived, cold), the binding lesson body remains byte-identical to the signed version.
- **B4 — Compromise propagation**: If the signing authority is later revoked, affected binding lessons demote to `contested` (not deleted). The signature record is preserved for forensic audit.
- **B5 — Cluster awareness**: Any deduplication / compression cluster containing a binding member is excluded from automatic compression. Canonical / merge dedup may proceed; substitution may not.

These invariants are HARD. Implementation MUST include a test contract verifying each.

---

## 4. The Anti-Self-Validation Floor [INFER, Pillar 4]

AI-generated outcomes contribute weight **0** to `lessonsEffective` by default. A maintainer MAY explicitly raise the weight of a named AI executor (e.g. a trusted CI pipeline), but the default remains zero.

Human-confirmed outcomes have floor weight **1.0**. This floor cannot be lowered.

**Implementation requirement**: every outcome event must record `executor` + `tier` or equivalent identity. The aggregator MUST refuse to compute `lessonsEffective` on event logs missing this field.

---

## 5. Tier 0 / 1 / 2 Mapping Rule [INFER, STRATEGY.md Pillar #1]

Every Meta Growth capability MUST be assigned to a Tier:

- **Tier 0 (inviolable, no external deps)**: pure-function aggregators, regex-based checks, JSONL append-only writers, deterministic CLI commands. Meta Growth's CORE must ship at Tier 0.
- **Tier 1 (opt-in intelligence)**: DSPy-based semantic matching, embeddings, fuzzy similarity. MUST gracefully degrade to Tier 0 when unavailable (Án Lệ #1: silent-tier1-degradation). MUST emit WARN, not BLOCK, when degraded.
- **Tier 2 (lazy-loaded markdown)**: skill files, runbooks, hint catalogs. NEVER imported by TypeScript source. Loaded on demand by agents.

A capability proposed without explicit tier assignment is rejected.

---

## 6. Discipline Clauses [INFER]

These four discipline rules govern how the MVC may be amended.

1. **Evidence tagging**: Every clause in this MVC is tagged `[INFER]` or `[CODE]`. Untagged clauses are forbidden. New clauses MUST be tagged at proposal time.
2. **No HYPO authority**: A `[HYPO]` claim does NOT have authority. Speculation may be preserved as design notes for reference (see `meta-growth-design-notes.md`) but cannot be cited to gate a PR.
3. **Field-data promotion**: A `[HYPO]` claim becomes authoritative only after it ships in code AND accumulates real-world events meeting the declared Pillar 5 confidence floor. Until BOTH conditions are met, it remains design notes, not authority. The MVC's `[CODE]` tag therefore means *shipped + field-proven*, not merely *implemented*.
4. **Amendment provenance**: Amendments to this MVC require human Tier A signature. AI-drafted amendments may be PROPOSED but cannot become authority without explicit human ratification on the actual diff.

---

## 7. What This MVC Does NOT Specify

The following are intentionally omitted because they are `[HYPO]` until shipped:

- Specific TypeScript schemas (LessonAuthority, MetaGrowthSnapshot, DedupCluster, etc.)
- Specific CLI surfaces (`did metrics meta-growth`, `did lesson dedup`, `did smelter`, etc.)
- Specific threshold values (`promisingMin`, `confidenceFloor`, `coverageGapWarn`, etc.)
- Specific algorithms (rankScore weights, conflict precedence ladder, scope match function)
- Specific signature scheme (HMAC vs ed25519, key rotation grace period)
- Specific sequencing (v0.7.1 → v1.0.0 phase boundaries)
- Specific federation protocol (HTTP endpoints, anonymization rules)

These will be designed AS NEEDED, ONE AT A TIME, with field data justifying each choice. The exploratory document `meta-growth-design-notes.md` records prior brainstorming on these topics; that document is reference, not authority.

---

## 8. Ratification

A maintainer ratifying this MVC commits to ALL of:

1. Treating Sections 1–6 as authoritative for all Meta Growth work.
2. Citing this document's section number(s) in every Meta Growth PR.
3. Not promoting `[HYPO]` claims to `[CODE]` without code + field data.
4. Reviewing each shipped Meta Growth feature against the 7 Pillars, 5 Invariants, and Tier mapping before merge.

---

## Appendix — Document History

- **v1 of MVC**: this document. Drafted 2026-04-27.
- **Predecessors** (now demoted to `meta-growth-design-notes.md`, NOT authoritative):
  - `meta-growth-contract.md` (v1, 15 sections, ~30KB)
  - `meta-growth-contract-amendment-v2.md` (v2, 6 sections, ~26KB)
  - `meta-growth-contract-amendment-v3.md` (v3, 9 sections, ~28KB)
  - `meta-growth-contract-amendment-v3.1.md` (v3.1, 6 patches, ~18KB)

The predecessors were AI-drafted and AI-reviewed. ~90% of their claims are `[HYPO]`. They are preserved as exploration. Per Discipline Clause #2, none of their claims have authority.
