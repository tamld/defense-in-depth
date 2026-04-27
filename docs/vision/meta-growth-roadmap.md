# Meta Growth Roadmap — Adoption-First Sequencing (v0.7.1 → v1.2)

> **Authority**: This roadmap is **partially authoritative**. Phase boundaries, MVC stage mappings, and Track A/B sequencing rule are authority. Specific schemas, CLI surfaces, and threshold values are `[HYPO]` and may be revised AT SHIP TIME based on field data per MVC §6.3.
>
> **Sequencing rule (NEW — Antigravity-informed)**: Track A (Adoption) MUST precede Track B (Meta Growth). Track B does not start until Track A has produced ≥10 distinct external users AND ≥100 captured events across user repos. Without users there is no field data; without field data Meta Growth is `[HYPO]` machinery producing `[HYPO]` outputs.
>
> **Why this sequencing**: An independent strategic review (Antigravity 2026-04-27) flagged a builder-first / user-second pattern: 7 versions in 20 days, 0 external users, 5 guards unchanged since v0.1, npm `latest` still at v0.1.0. Meta Growth's closed-loop requires real agents producing real events; until users exist, Tracks B1-B5 cannot validate any threshold or behavior. Adoption is therefore not optional — it is a hard prerequisite for Track B's evidentiary basis.
>
> **Bake period**: An `-rc.1` release matures to GA when EITHER (a) ≥30 days elapsed AND zero blocking field events, OR (b) explicit Tier A maintainer ratification of accumulated field data.
>
> **Discipline**: Per MVC §6.2, `[HYPO]` does not gate any PR. When a phase ships, the implementation justifies its choices with field evidence — not by citing this roadmap.
>
> **Companion documents**:
> - `meta-growth-mvc.md` — Authority for the 7 Pillars, 8 stages, 5 invariants, Tier mapping.
> - `meta-growth-design-notes.md` — NON-AUTHORITATIVE reference (preserved exploration).

---

## Phase 0 — Current State Baseline

**Version**: `v0.7.0-rc.1` (shipped 2026-04-22, tag pushed 2026-04-27)

**Path A delivered** [CODE]:
- Stage 1 Distillation — `did lesson record/search/list/show` (v0.4)
- Stage 3 Persistence — `.agents/records/lessons.jsonl` append-only (v0.4)
- Stage 7 Verification (partial) — `LessonRecallEvent` + `LessonOutcome` capture (v0.7.0)
- Hint Engine v1 — Progressive Discovery hint surface in doctor/verify (v0.7.0)

**Open MVC stage gaps**:
- Stage 2 — Quality Gate (regex Tier 0 not shipped; DSPy partial v0.5.1)
- Stage 4 — Dedup (NOT shipped)
- Stage 5 — Injection (NOT shipped — **MVC calls this the largest gap**)
- Stage 8 — Retirement (NOT shipped)

**Adoption metrics snapshot (2026-04-27)** [CODE]:
- npm `latest` tag: **v0.1.0** (Apr 7, 2026 — 20 days behind main)
- npm `next` tag: v0.7.0-rc.1
- Weekly downloads: ~0 (no external adoption signal)
- External users (non-tamld): ~0
- Guards shipped: 5 (unchanged since v0.1)
- Open issues: 1
- `.agents/` markdown files: 40
- `docs/` markdown files: 21

**This is the baseline against which all Track B `[HYPO]` claims must be reconciled before promotion.**

---

# Track A — Adoption (Hard Prerequisite)

Track A goal: bring DiD from "engineering-quality v1.0 with adoption-quality v0.0" to "v1.0 stable with ≥10 external users". No Track B phase begins until Track A's exit criteria are met.

## Phase A1 — v0.7.1 GA (Docs Reconciliation)

**Type**: Doc-only. No RC.

**MVC stages advanced**: none.

**Goal**: Make README + STRATEGY + meta-architecture tell the SAME v0.7 story.

### Acceptance criteria

- An agent reading README, STRATEGY.md, and `docs/vision/meta-architecture.md` independently arrives at the same v0.7 mental model.
- Path A landmark (LessonOutcome + RecallMetric + Hint Engine) identified consistently.
- v0.7.1 status section added to STRATEGY.md.

### Effort estimate `[HYPO]`

- 1 PR, ~50-100 LoC doc diff, ~1 day.

---

## Phase A2 — v0.7.2-rc.1 → v0.7.2 GA (Guard Breadth Bump)

**Type**: Code + RC bake.

**MVC stages advanced**: none (Track A — adoption-driven, not Meta Growth).

**Goal**: Ship 3 new guards that solo-developer Persona A actually wants. Each guard creates a concrete reason to upgrade from v0.1.

### New guards `[HYPO]`

#### G1 — `secret-detection`

Detects common API key / token patterns in staged files using regex:
- AWS access keys (`AKIA[0-9A-Z]{16}`)
- Generic API keys with high entropy
- Private SSH keys (`-----BEGIN ... PRIVATE KEY-----`)
- JWT tokens
- npm tokens (`npm_[A-Za-z0-9]+`)

**Behavior**: BLOCK on detection. Override via `// did:allow secret-detection <reason>` inline comment.

**Tier**: 0 (pure regex, no network).

**Test contract**: positive cases (known-bad strings detected), negative cases (lookalikes not flagged), override cases.

#### G2 — `dependency-audit`

Parses `package.json` + `package-lock.json` and warns when adding dependencies with known critical vulnerabilities (offline check against bundled CVE list, refreshed monthly).

**Behavior**: WARN by default. BLOCK with `severity=critical` config.

**Tier**: 0 (bundled CVE list, no network at hook time).

**Test contract**: warns on adding known-vulnerable package, doesn't warn on safe versions, lockfile-aware.

#### G3 — `file-size-limit`

Blocks staged files exceeding configurable size threshold (default 5MB).

**Behavior**: BLOCK on threshold breach. Override via config or inline comment.

**Tier**: 0 (file system stat only).

**Test contract**: blocks large file, allows small file, respects override.

### Schemas

No new core types. Each guard self-contained in `src/guards/<name>.ts` following existing Guard interface.

### Threshold defaults `[HYPO]`

```yaml
guards:
  secret-detection:
    enabled: true
    severity: blocking
    overridePattern: "did:allow secret-detection"
  dependency-audit:
    enabled: true
    severity: warning
    cveList: "bundled"          # bundled | upstream
  file-size-limit:
    enabled: true
    severity: blocking
    maxBytes: 5242880            # 5 MB
```

### Acceptance criteria

- All 3 guards added to default `defense.config.yml` template (opt-out, not opt-in).
- Documentation in `docs/user-guide/guards/<name>.md` for each.
- Existing guard tests unaffected.
- Aggregate test count grows by ≥30 (10 per guard min).
- `did doctor` discovers and reports all 3 new guards.

### RC criteria

`v0.7.2-rc.1` ships when:
- All 3 guards working with test coverage.
- README updated to reference new guards in feature list.
- CHANGELOG entry written.

### GA criteria

30-day bake. Field criteria:
- No false-positive reports from `tamld/defense-in-depth` self-test.
- At least 1 friend/colleague invited to test, no severe regressions.

### Out of scope

- Complex secret detection (entropy-based ML, custom pattern packs) — defer to v1.1+
- Online CVE refresh (currently bundled list)
- Semgrep / CodeQL integration

### Effort estimate `[HYPO]`

- 1 PR per guard or 1 combined PR, ~600 LoC total, ~2-3 weeks.

---

## Phase A3 — v1.0.0-rc.1 (API Freeze + Migration Guide + npm Latest Promotion)

**Type**: Release engineering. Some doc work. No new features.

**Goal**: Promote npm `latest` from v0.1.0 → v1.0.0-rc.1 so new users get a current version. Stop the "20 days behind" signal.

### Actions

1. **API freeze**: declare `src/core/types.ts` public surface frozen for 90 days minimum (Guard interface, Lesson schema, FederationProvider interface, hook payloads). Internal classes / private utilities NOT frozen.
2. **Migration guide**: write `docs/MIGRATION-v0.1-to-v1.0.md` covering:
   - Config schema additions since v0.1 (federation, memory, hints, lessons)
   - New guards (Phase A2)
   - Deprecated CLI flags (if any)
   - 1-page table format, copy-pasteable upgrade commands.
3. **npm `latest` promotion**: after rc.1 published, run `npm dist-tag add defense-in-depth@1.0.0-rc.1 latest`. Existing v0.1.0 users discover upgrade path.
4. **README rework**: hero section updates to reflect v1.0-era (5+3 = 8 guards, lessons, hints). Currently README still describes v0.1 era.
5. **CHANGELOG**: consolidated v0.1 → v1.0.0-rc.1 release notes (a "what shipped in 6 versions" overview).

### Acceptance criteria

- `npm view defense-in-depth dist-tags` shows `latest: 1.0.0-rc.1`.
- `MIGRATION-v0.1-to-v1.0.md` is ≤2 pages, no untested commands.
- README's first 50 lines accurately describe the project's CURRENT state.
- API freeze announced in CHANGELOG (which symbols are public + frozen).
- Public API symbols documented in `docs/dev-guide/api-surface.md`.

### RC criteria

`v1.0.0-rc.1` ships when ALL of A3 above complete.

### GA criteria — promotion to `v1.0.0` GA

Promote when ALL of:
- 30 days elapsed since rc.1.
- Zero breaking-change regressions reported in `npm` `next` channel.
- Migration guide validated by 1 friend/colleague performing the v0.1 → v1.0 upgrade.

### Effort estimate `[HYPO]`

- 1 PR, ~300 LoC doc + ~50 LoC actual code (release script tweaks), ~1 week.

---

## Phase A4 — v1.0.0 GA + Adoption Push (NON-CODE)

**Type**: Marketing / adoption.

**Duration**: 30 days minimum from v1.0.0 GA tag.

**Goal**: Get 10 distinct external users.

### Activities `[HYPO]`

- Blog post (`tamld.dev` or Medium): "How DiD survives the AI-coding-agent era"
- Hacker News submission: time it for Tuesday/Wednesday morning EST.
- r/programming, r/typescript, r/devops submissions.
- Twitter thread.
- Outreach to 5-10 known maintainers in adjacent communities (husky, lefthook, simple-git-hooks).

### Tracking metrics

Track weekly in `adoption-report-2026-Q?.md`:
- npm weekly download count (delta from baseline)
- GitHub stars (delta)
- Issues from non-tamld accounts
- Discussions / mentions on Twitter / HN / Reddit
- Distinct repo names appearing in `did telemetry` (if telemetry shipped) or in npm dependent listings

### Exit criteria — Track B unlock

Track B (Meta Growth) **DOES NOT START** until ALL of:
1. ≥10 distinct external users (verified via npm download patterns + GitHub interactions + opt-in telemetry).
2. ≥100 captured events (RecallEvent + LessonOutcome) across user repos. This requires opt-in telemetry phase A4.5 (below).
3. Tier A maintainer ratifies an `adoption-report-2026-Q?.md` certifying both metrics.

If exit criteria fail after 90 days:
- Track B is RE-EVALUATED, not just delayed.
- Possible options: pivot to a different value prop, re-design adoption strategy, or formally deprecate Track B.

### Optional Phase A4.5 — Opt-in Telemetry (only if needed for event count)

If users adopt but events are not visible (because lessons live in their private repos), ship a minimal opt-in telemetry flag:

```yaml
telemetry:
  enabled: false           # default off; opt-in
  endpoint: "..."
  level: "anonymized"      # "anonymized" | "full" | "off"
```

Anonymized payload: hashed repo ID, event counts per type, no lesson content. Tier 1 (opt-in, graceful degradation if endpoint unavailable).

### Effort estimate `[HYPO]`

- Phase A4 marketing: ~10-20 hours over 30 days, async.
- Phase A4.5 telemetry (if needed): ~1 PR, ~400 LoC, ~2 weeks.

---

# Track B — Meta Growth (Unlocked Post-Adoption)

**Gating**: Track B does not begin until Track A Phase A4 exit criteria met.

**Numbering**: Phase B1 lives in `v1.1.0-rc.1`, etc. Pre-A4 these were tagged "v0.8.x" in older drafts; they are bumped to v1.1.x because Track A consumes the v0.x → v1.0 transition.

## Phase B1 — v1.1.0-rc.1 → v1.1.0 GA (F1 Aggregator MVP)

**MVC stages advanced**: Stage 7 (Verification — extends from event capture to event aggregation).

**MVC pillars exercised**: 1, 2, 5, 6.

**Prerequisite check**: Track A complete. Field event volume sufficient to compute F1 with `n ≥ confidenceFloor` for at least 1 guard.

### Schemas `[HYPO]`

```typescript
export interface F1Snapshot {
  schemaVersion: "1";
  computedAt: string;
  windowStart: string;
  windowEnd: string;
  inputHash: string;                    // SHA-256 of canonical event log slice
  perGuard: Record<GuardId, {
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    precision: number;
    recall: number;
    f1: number;
    sampleSize: number;
  }>;
  excludedDueToConfidenceFloor: GuardId[];
  confidenceFloor: number;
}
```

**Storage**: `.agents/records/meta-growth-snapshots.jsonl`.

### CLI additions `[HYPO]`

```bash
did metrics f1 [--guard <id>] [--since <date>] [--window 30d] [--format json|text]
did metrics f1 verify <snapshot-id>
```

### Threshold defaults `[HYPO]`

```yaml
metaGrowth:
  thresholds:
    confidenceFloor: 30
    bakeWindowDays: 30
```

Will be revised at GA based on observed event volume from Track A users.

### Acceptance criteria

- Pure function: `aggregateF1(events: FeedbackEvent[], window: Period): F1Snapshot`.
- Determinism: 100 runs same hash (Pillar 6).
- Refuses compute on `n < confidenceFloor`; explanation, not silent zero.
- Reproducible from event log alone.
- CI gate does NOT consume F1 yet (observation phase).

### Effort estimate `[HYPO]`

- 1 PR, ~600-900 LoC, ~2-3 weeks.

---

## Phase B2 — v1.1.1-rc.1 → v1.1.1 GA (Stage 5 Injection — Channel A Bootstrap)

**MVC stages advanced**: Stage 5 (the LARGEST GAP).

**MVC pillars exercised**: 1, 5, 6, 7.

**Goal**: At session start, produce a digest the agent CAN consume BEFORE acting. First closure of the Meta Growth loop.

### Schemas `[HYPO]`

```typescript
export interface SessionStartDigest {
  schemaVersion: "1";
  computedAt: string;
  context: {
    branch: string;
    headCommit: string;
    workingDirectory: string;
    contextHints: string[];
  };
  lessons: Array<{
    lessonId: string;
    title: string;
    wrongApproach: string;
    correctApproach: string;
    relevance: number;
    matchReason: string;
  }>;
  digestHash: string;
  truncatedAt: number;
}
```

### CLI additions `[HYPO]`

```bash
did session start [--context-hint X] [--limit N] [--format markdown|json]
did session digest [--show-hash]
did session digest verify <hash>
```

### Threshold defaults `[HYPO]`

```yaml
metaGrowth:
  thresholds:
    bootstrapDigestMaxLessons: 10
    bootstrapDigestRelevanceMin: 0.30
```

### Ranking algorithm `[HYPO]` — Tier 0

```
relevance(lesson, context) =
  0.5 * tag_overlap_ratio(lesson.tags, context.contextHints)
  + 0.3 * path_match(lesson.appliesTo, context.workingDirectory)
  + 0.2 * recency_factor(lesson.lastUsedAt)
```

### Acceptance criteria

- `did session start` produces digest in <500ms on 1000-lesson repo.
- Byte-identical given identical input.
- Markdown rendered by default.
- FULL `wrongApproach + correctApproach` text (Pillar 4 invariant).
- Loop closure test: synthetic agent + digest + banned action → outcome event captured.

### Effort estimate `[HYPO]`

- 1 PR, ~800-1200 LoC, ~3-4 weeks.

---

## Phase B3 — v1.1.2-rc.1 → v1.1.2 GA (Stage 4 Dedup Tier 0)

**MVC stages advanced**: Stage 4.

**MVC pillars exercised**: 1, 5.

**Goal**: Tier 0 dedup (pattern equivalence + tag overlap), no Tier 1.

### Schemas `[HYPO]`

```typescript
export interface DedupCluster {
  clusterId: string;
  members: string[];
  canonicalLessonId: string;
  dedupChannel: "pattern-equivalence" | "tag-overlap";
  similarity: number;
  containsBinding: boolean;
  policy: "merged" | "canonical" | "conflict";
  detectedAt: string;
}
```

### Threshold defaults `[HYPO]`

```yaml
metaGrowth:
  thresholds:
    tagOverlapMin: 0.70
    patternEquivalenceMin: 0.85
```

### CLI additions `[HYPO]`

```bash
did lesson dedup scan [--channel pattern|tag|all]
did lesson dedup show <clusterId>
did lesson dedup adopt <clusterId> [--policy merged|canonical]
```

### Acceptance criteria

- Deterministic clustering.
- B5 invariant: `containsBinding=true` excluded from auto-merge.
- Pattern equivalence detects synonymous wrongApproach.
- Tag overlap correctly clusters semantically related lessons.

### Effort estimate `[HYPO]`

- 1 PR, ~700 LoC, ~2-3 weeks.

---

## Phase B4 — v1.1.3-rc.1 → v1.1.3 GA (Stage 8 Forgetting Layer 1+2)

**MVC stages advanced**: Stage 8.

**MVC pillars exercised**: 3 (Temporal Locking).

### Schema additions `[HYPO]`

```typescript
interface Lesson {
  // existing
  status: "active" | "archived" | "promoted-to-binding";
  archivedAt?: string;
  archiveReason?: "stale" | "superseded" | "tier-a-explicit";
}
```

### Threshold defaults `[HYPO]`

```yaml
metaGrowth:
  thresholds:
    softRetireDays: 90
    softRetireQualityFloor: 0.7
    hardArchiveAgeDays: 180
```

### CLI additions `[HYPO]`

```bash
did lesson retire <lessonId> [--reason ...]
did lesson restore <lessonId>
did lesson forget run [--dry-run]
did lesson forget plan [--since <date>]
```

### Acceptance criteria

- NEVER deletes records (Pillar 3).
- B2 invariant: binding lessons NEVER auto-retire.
- B3 invariant: archived lesson byte-identical to active form.
- Restore preserves all metadata.
- Sweep is idempotent.

### Effort estimate `[HYPO]`

- 1 PR, ~500 LoC, ~2 weeks.

---

## Phase B5 — v1.1.4-rc.1 → v1.1.4 GA (Stage 2 Quality Gate Tier 0 Regex)

**MVC stages advanced**: Stage 2 (Tier 0 fallback).

**MVC pillars exercised**: 1, 2, Tier 0 mapping.

### Threshold defaults `[HYPO]`

```yaml
metaGrowth:
  thresholds:
    minLessonFieldChars: 50
    # Placeholder token list reuses the hollow-artifact guard's default
    # patterns: see src/guards/hollow-artifact.ts (DEFAULT_HOLLOW_PATTERNS).
    placeholderTokens: <inherit-from-hollow-artifact-guard>
```

### Acceptance criteria

- Tier 0 gate runs without DSPy / Python / network.
- Determinism.
- Án Lệ #1 fulfilled: DSPy down → Tier 0 runs, output payload includes `gateUsed: "tier0-regex"`.

### Effort estimate `[HYPO]`

- 1 PR, ~400 LoC, ~1.5 weeks.

---

## Phase B6 — v1.2.0 (Sketch Only)

**Type**: Outline only. Not detailed because B1-B5 haven't shipped yet.

### Likely scope `[HYPO]`

- Aggregator suite expansion (recall precision, coverage gap, time-to-guard, lesson specificity, FP trend).
- Federation read-only pull (HTTP provider extended for lessons.jsonl).
- Layer 3 forgetting (cluster compression).
- Tier 1 quality gate hardening (DSPy + Tier 0 dual-gate).
- CI gate consumes meta-growth metrics.

### Why outline only

Per MVC §6.3, detailed `[HYPO]` for v1.2 is forbidden when B1-B5 field data is the prerequisite.

### Estimated timeline `[HYPO]`

If Track A completes by 2026-Q3 and B1-B5 ships at ~1 minor every 6-8 weeks → v1.2.0 viable around **2027-Q2 to Q3**.

---

## Cross-Phase Discipline

### RC bake protocol

```
1. Implementation in PR (signed-off, CI green)
2. Merge to main
3. Tag <version>-rc.1
4. Bake period (≥30 days OR Tier A acceptance)
5. Tag <version> GA
```

If field events during bake reveal a defect, increment to `-rc.2` and reset bake clock. NEVER promote rc.N to GA with known unresolved field defects.

### Field evidence collection

Every Track B phase MUST produce `meta-growth-bake-report-<version>.md` BEFORE GA promotion:
- Sample size (n) per relevant metric
- Period (p) of observation
- Specific events justifying (or failing to justify) `[HYPO]` thresholds
- Recommended adjustments

### Threshold revision authority

`[HYPO]` thresholds may be revised at GA promotion ONLY by:
- Tier A maintainer signing off bake report.
- New defaults committed in same PR as GA tag.

`[HYPO]` thresholds must NEVER silently inherit. Each phase's bake either confirms or revises.

### Roadmap amendment

This roadmap is amendable as field data accumulates. Per MVC §6.4, amendments require Tier A signature. AI-drafted revisions may be PROPOSED but cannot become authority without explicit human ratification on the actual diff.

### Track B abort condition

If after 90 days of Track A push, exit criteria (≥10 users, ≥100 events) are NOT met:
- Track B is RE-EVALUATED, not just delayed.
- Tier A maintainer decides: pivot value prop / re-strategize adoption / formally deprecate Track B.

This abort condition is a hard part of the roadmap. Building Track B against zero adoption signal is the trap this roadmap exists to prevent.

---

## Appendix A — Phase ↔ MVC Stage + Track Cross-Reference

| Phase | Version | Track | MVC Stage(s) | Pillars | Adoption-relevant? |
|:-:|:-:|:-:|:--|:--|:-:|
| 0 | v0.7.0 (shipped) | Baseline | 1, 3, 7 (partial) | 1, 7 | — |
| A1 | v0.7.1 | A | none (doc) | — | ✓ |
| A2 | v0.7.2 | A | none (Persona A guards) | — | ✓✓✓ |
| A3 | v1.0.0-rc.1 | A | none (release eng) | — | ✓✓✓ |
| A4 | v1.0.0 GA + push | A | none (marketing) | — | ✓✓✓ (decisive) |
| B1 | v1.1.0 | B | 7 | 1, 2, 5, 6 | — |
| B2 | v1.1.1 | B | **5 (largest gap)** | 1, 5, 6, 7 | — |
| B3 | v1.1.2 | B | 4 | 1, 5 | — |
| B4 | v1.1.3 | B | 8 | 3 | — |
| B5 | v1.1.4 | B | 2 | 1, 2, Tier 0 | — |
| B6 | v1.2.0 (sketch) | B | deferred (B1–B5 field data required) | deferred | — |

---

## Appendix B — Why Track A Comes First (Antigravity Critique Summary)

Independent strategic review (Antigravity, 2026-04-27) flagged:

1. **Feature velocity ∞× adoption velocity**: 7 versions in 20 days, 0 external users.
2. **5 guards unchanged since v0.1**: 100% recent effort on meta-system, not on user-visible value.
3. **npm `latest = 0.1.0` (Apr 7)**: new users get a 20-day-stale version. Signal: "not production-ready".
4. **`.agents/` 1.9× `docs/`**: project documents itself for AI agents better than for humans.
5. **Persona A (~80% of target users) ignored**: solo devs need new guards (secret-detection, dependency-audit, etc.); they got LessonOutcome and Federation instead.

Antigravity's verdict: *"Beautiful cathedral, zero parishioners. Building PhD thesis on educational assessment before having students."*

DiD's own MVC and self-audit framework confirm Antigravity's strategic point: Meta Growth's evidentiary basis (events, outcomes, recall metrics) requires real users producing real events. Without Track A, Track B is `[HYPO]` machinery producing `[HYPO]` outputs in perpetuity. **Track A is therefore not optional — it is a prerequisite for Track B to satisfy Pillar 5 (Boundary-of-Claim Discipline).**

This roadmap's adoption-first sequencing is DiD applying its own discipline to itself.

---

## Appendix C — What This Roadmap Is NOT

- NOT a contract that locks future PRs to specific schemas.
- NOT a substitute for the MVC.
- NOT field-validated; thresholds and effort estimates are `[HYPO]`.
- NOT a federation roadmap (federation is mostly v1.2+).
- NOT prescriptive about TypeScript file organization, internal class names, or unit test structure.

---

## Document History

- v1 — Drafted 2026-04-27, ratified by `tamld` for use as **planning aid + phase-boundary authority**.
- v1.1 — Same date. Restructured with Track A / Track B sequencing in response to Antigravity strategic critique. Track B unlock criteria added.
- Predecessors (NON-AUTHORITATIVE, see `meta-growth-design-notes.md`).
