# DSPy Decision Record — Tier 3 Optional Enrichment Only

**Status**: ACCEPTED (2026-09-17)
**Deciders**: tamld (Tier A maintainer)
**Context**: Issue #135 follow-up — review DSPy role in defense-in-depth

---

## Decision

**DSPy is tier 3 optional enrichment only. It is never a gating dependency.**

The quality gate operates in four tiers. Only Tier 0 is mandatory and blocking.

| Tier | Technology | Role | Mandatory | Fallback |
|------|------------|------|-----------|----------|
| 0 | Pure regex (`hollowArtifactGuard`) | Blocking gate | ✅ YES | N/A |
| 1 | Local embeddings (MiniLM, ~90MB, CPU <50ms) | Recall improvement | ❌ NO | Tier 0 |
| 2 | LLM-as-judge (Ollama/vLLM local) | Reason + score | ❌ NO | Tier 1 |
| 3 | DSPy (external endpoint) | Semantic scoring | ❌ NO | Tier 2 |

---

## Rationale

### 1. Lesson Injection (L2) Already Provides Evidence-Grounded Hints

The core value of defense-in-depth is **learning from past failures**. The injection system:

- Matches current findings to `wrongApproachPattern` in `lessons.jsonl`
- Surfaces `correctApproach` from proven fixes
- Weights by evidence level: `RUNTIME` > `INFER` > `HYPO`
- Is deterministic, offline, and privacy-safe

This already solves the "what should I do differently?" question better than a semantic score.

### 2. Semantic Scoring Is Additive, Not Substitutive

A semantic score (0.0–1.0) answers "how hollow is this?" but:
- Does not explain **why** (no reason without LLM-as-judge)
- Cannot suggest **what to do** (that's lesson injection's job)
- Adds latency, network dependency, non-determinism
- False precision: 0.62 vs 0.58 is noise, not signal

### 3. Tiered Architecture Ensures Determinism at Core

```
┌─────────────────────────────────────────────────────────┐
│  L1: Regex (TODO, FIXME, console.log...)                │  ← BLOCKING
├─────────────────────────────────────────────────────────┤
│  L2: Lesson Injection (patterns from past failures)      │  ← ACTIONABLE HINT
├─────────────────────────────────────────────────────────┤
│  L3: Embeddings / LLM-judge / DSPy (optional enrichment) │  ← RECALL BOOST
└─────────────────────────────────────────────────────────┘
```

Each tier strictly adds recall/precision on top of the previous. Failure at tier N never degrades tier N-1 behavior.

### 4. Current Metric Shows L1+L2 Is Sufficient

```bash
did metrics f1 --guard hollowArtifact --period 30d
```

Result: 58 TP, 0 FP, 0 FN → F1 = 1.000 (self-dogfooding data)

If F1 drops below 0.85 in field data, **then** invest in Tier 1 (local embeddings). Not before.

---

## Implementation Contract

### `hollowArtifactGuard` Config

```yaml
guards:
  hollowArtifact:
    enabled: true
    useDspy: false          # default OFF — opt-in only
    minContentLength: 50
    # Optional: future tiers
    # useEmbeddings: false
    # useLlmJudge: false
```

### Fallback Behavior (Already Tested)

When `useDspy: true` but DSPy returns `null` (unavailable, timeout, error):
1. Stderr warning: `⚠  DSPy unavailable: semantic evaluation skipped. Results reflect L1+L2 only.`
2. Verdict computed from L1+L2 only
3. Exit code based on L1+L2 findings only
4. **No silent degradation** — banner is explicit

Test coverage: `tests/core-feedback-edge.test.js` lines 120-135, `tests/hollow-artifact.test.js` lines 90-120.

---

## What This Means for Roadmap

- **Phase B5 (Stage 2 Quality Gate)** ships **Tier 0 regex only** as mandatory
- Tier 1 (local embeddings) is a separate, optional PR — only if field F1 < 0.85
- Tier 2/3 are research items, not roadmap commitments
- DSPy code in `dspy-client.ts` remains for opt-in users, but is not on critical path

---

## Anti-Patterns Avoided

| Anti-pattern | Avoided By |
|--------------|------------|
| "Semantic gate is smarter than regex" | Tier 0 is the gate; tiers 1-3 only rank lessons |
| "DSPy down = guard down" | Graceful degradation banner + L1+L2 verdict |
| "Need GPU for quality" | Tier 0 runs on any CI runner, zero deps |
| "Score 0.62 means pass" | No score-based pass/fail — only regex BLOCK/WARN |

---

## Related

- `src/guards/hollow-artifact.ts` — guard implementation with tiered fallback
- `src/core/injection.ts` — lesson injection (L2 core value)
- `tests/core-feedback-edge.test.js` — fallback behavior tests
- `docs/vision/meta-growth-roadmap.md` — Phase B5 updated with this decision