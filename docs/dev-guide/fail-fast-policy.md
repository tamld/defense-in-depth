---
id: DOC-FAIL-FAST-POLICY
status: active
version: 1.0.0
audience: developers, contributors, agents writing new guards
---

# Fail-Fast Policy

> **TL;DR** — `defense-in-depth` is **NOT fail-fast at the pipeline level.** It is fail-fast at the *guard* level. The engine runs **every** registered guard, collects every finding, and returns one consolidated verdict. A single BLOCK anywhere yields `passed: false`. This is by design: users get the full picture in one run instead of fix-rerun-fix-rerun.
>
> This document is the contract. Anyone touching `src/core/engine.ts` or writing a new guard MUST read it.

---

## 1. Vocabulary

| Term | Meaning in this codebase |
|:--|:--|
| **Pipeline** | The sequence of guards registered on a `DefendEngine` instance |
| **Guard** | A pure function with shape `Guard.check(ctx) → Promise<GuardResult>` |
| **Finding** | One assertion produced by a guard, carrying a `Severity` |
| **Severity** | `BLOCK` (exits 1), `WARN` (advisory, does not fail), `INFO` |
| **Verdict** | The aggregated `EngineVerdict` returned by `engine.run(...)` |
| **Enricher** | A pre-pipeline I/O step (ticket provider, parent ticket, DSPy semantic evals) |
| **Fail-fast** | Stop at the first failure |
| **Collect-all** | Run everything, report everything |

---

## 2. Three policies, three different decisions

The engine makes three independent fail-fast decisions. Each is documented here so it's never ambiguous.

### 2.1 Pipeline — **collect-all** (NOT fail-fast)

```ts
// src/core/engine.ts:117-142
for (const guard of this.guards) {
  if (guardCfg !== undefined && !guardCfg.enabled) continue;
  try {
    const result = await guard.check(ctx);
    results.push(result);
  } catch (err) {
    // Guard crashed → push synthetic BLOCK finding, continue.
    results.push({ /* "Guard crashed: ..." */ });
  }
}
```

**Decision:** every enabled guard runs, even after a previous guard blocks. Why:

1. **One-shot UX.** The CLI is invoked from a Git hook; the user wants every problem listed at once so they can fix them in a single edit pass.
2. **Cross-guard independence.** Guards are designed to be pure and orthogonal — `hollowArtifact` finding a TODO does not invalidate `commitFormat`'s opinion about the commit message.
3. **Easier debugging.** A "tests pass everything except X" output is more actionable than "tests stopped at X; we don't know about the rest."

**Consequence:** the pipeline is `O(N)` in the number of registered guards, regardless of when the first BLOCK appears. This is a deliberate trade-off — guards are fast (<100 ms each) and the 9 built-in guards complete in single-digit milliseconds total.

> If you ever need fail-fast semantics for a specific deployment (e.g. a server-side gate where every saved millisecond matters), wrap the engine in your own loop and `break` on the first `!result.passed`. **Do not** modify the engine to support a `failFast: true` flag — that would split the contract.

### 2.2 Within a guard — **fail-fast per file** (where applicable)

Pattern-based guards (`hollowArtifact`, `ssotPollution`, `commitFormat`, `branchNaming`) short-circuit on the **first** match per artifact:

```ts
// src/guards/hollow-artifact.ts:101-112
for (const pattern of patterns) {
  if (pattern.test(content)) {
    findings.push({ severity: BLOCK, ... });
    break;             // <-- one finding per file is enough
  }
}
```

This is fail-fast because the second pattern would just produce a duplicate "this file is hollow" finding. One finding per offending artifact keeps output legible.

**Contract for new guards:** if your guard checks N independent rules on each file, and ANY violation makes the file BLOCKed, emit ONE finding per file and stop scanning that file. Continue to the next file.

### 2.3 Enrichers — **degrade gracefully** (definitely NOT fail-fast)

Enrichers (`enrichTicketRef`, `enrichParentTicket`, `enrichSemanticEvals`) run BEFORE the guard pipeline and may make I/O calls. Their policy is the strictest: **failure NEVER stops the pipeline.** Instead:

| Enricher | Failure mode | Effect on guard pipeline |
|:--|:--|:--|
| `enrichTicketRef` | provider rejects, times out (`Promise.race` with `providerConfig.timeout` default 5000 ms), or throws | `console.warn`, fall back to the basic `TicketRef` extracted from branch/commit/dirname |
| `enrichParentTicket` | parent provider rejects, times out (default 3000 ms), or returns malformed data | `console.warn`, leave `ticket.parentPhase` and `ticket.authorized` undefined; downstream `federationGuard` degrades to "no federation context" |
| `enrichSemanticEvals` (DSPy) | network failure, malformed JSON, schema mismatch, score out of range | per-file null entry in `ctx.semanticEvals.dspy[file]`; `hollowArtifactGuard` skips that file's semantic check |

**Why not fail-fast on enrichers?** Enrichers are *opt-in optional intelligence*. A federation provider returning 503 should never prevent `commitFormat` from running. Network outages, malformed responses, or DSPy being offline must NOT degrade local-only guards.

**Consequence for guards:** every guard MUST handle `ticket?.phase === undefined`, `ticket?.parentPhase === undefined`, and `ctx.semanticEvals?.dspy?.[file] == null` without throwing.

---

## 3. Verdict math

After every guard has run (or crashed), the verdict is computed:

```ts
// src/core/engine.ts:148-163
const failedGuards = results.filter(r => !r.passed).length;
const warnedGuards = results.filter(
  r => r.passed && r.findings.some(f => f.severity === WARN),
).length;

return {
  passed: failedGuards === 0,
  totalGuards: results.length,
  passedGuards: results.length - failedGuards,
  failedGuards,
  warnedGuards,
  results,
  durationMs,
};
```

**Invariants** (pinned by `tests/engine.test.js` "Verdict aggregation" suite):

1. `passed === true` ⟺ no guard returned `passed: false` AND no guard crashed (a crash is converted into `passed: false` in §2.1).
2. `failedGuards + passedGuards === totalGuards` (no double-counting).
3. `warnedGuards` does **NOT** count guards that ALSO failed (BLOCK trumps WARN — a guard with both findings is counted once, in `failedGuards`).
4. `totalGuards === results.length` (disabled guards are NOT in `results` — they are never run).
5. The CLI maps `verdict.passed === false` to `process.exit(1)`. This is the single integration point with Git hooks. Do not invert it.

---

## 4. Guard contract — implications for new guards

When you write a new guard, this policy imposes obligations:

### 4.1 MUST be pure

Layer 1 of `AGENTS.md` is non-negotiable: **no side effects beyond reading files; no network calls; no state mutation.** Any I/O belongs in an enricher. The engine's enricher slot exists precisely so guards stay pure → guards stay testable in-process without subprocess gymnastics.

### 4.2 MUST handle missing context

Because enrichers degrade gracefully, your guard MUST NOT assume `ctx.ticket`, `ctx.ticket.parentPhase`, or `ctx.semanticEvals` are populated. Guard against `undefined` explicitly:

```ts
async check(ctx): Promise<GuardResult> {
  const dspy = ctx.semanticEvals?.dspy?.[relPath];
  if (!dspy) return passResult();   // degrade gracefully
  if (dspy.score < 0.5) return warnResult(dspy.feedback);
  return passResult();
}
```

### 4.3 MUST emit ≤1 BLOCK finding per artifact

For pattern-style guards. Multiple findings per artifact are OK only when they materially help the user (e.g. one finding per non-allow-listed root file).

### 4.4 MUST NOT throw to short-circuit

If your guard wants to stop checking the *current* artifact, return early or `break`. Do NOT throw — the engine will catch it and synthesize a generic "Guard crashed: …" BLOCK finding, which is much less useful than a properly tagged finding from your guard.

The `try/catch` exists for genuine bugs (a guard hitting an unexpected runtime exception), not as a control-flow primitive.

### 4.5 SHOULD complete in <100 ms for typical workloads

Per `.github/PULL_REQUEST_TEMPLATE.md` checklist for new guards. The pipeline is `O(N)` and we want sub-second pre-commit hooks.

---

## 5. When *would* fail-fast be appropriate?

There are three scenarios where it's tempting but **wrong**:

| Temptation | Why we resist |
|:--|:--|
| "BLOCK in `commitFormat` makes everything else moot — skip the rest." | The user might have *both* a bad commit message *and* a hollow artifact. Skipping the second forces a fix-rerun cycle. |
| "If the ticket provider is unreachable, fail the whole pipeline — better safe than sorry." | A federation outage shouldn't prevent the local hollow-artifact check from running. We log a warning and degrade. Users with a paranoid policy can wire a parent-side gate at PR time. |
| "Inside a guard, after the first BLOCK, return immediately." | We do this *per file*. Across files, we keep going so the user sees all offenders. |

There is exactly one place where fail-fast is appropriate: **inside a single artifact, after a single BLOCK pattern matches** (§2.2). That is the only fail-fast in the codebase, and it is intentional.

---

## 6. Pinning and regression tests

The policy is enforced by tests, not by convention:

| Behavior | Test file |
|:--|:--|
| Pipeline runs every guard even after BLOCK | `tests/engine.test.js` — "guard crash handler" suite |
| Crashed guard becomes synthetic BLOCK | `tests/engine.test.js` — "Guard crashed:" assertions |
| Disabled guard is skipped (not in results) | `tests/engine.test.js` — "ticketIdentity disabled" |
| Provider failure does not propagate to verdict | `tests/engine.test.js` — "provider network failure" |
| Pattern guards short-circuit per file | `tests/hollow-artifact-adversarial.test.js` — "first match wins" |
| `warnedGuards` does not double-count BLOCKed guards | `tests/engine.test.js` — "warnedGuards does NOT count" |
| CLI exits 1 ⟺ `verdict.passed === false` | `tests/cli-ground-truth.test.js` — exit-code matrix |

Any PR that changes engine semantics will fail at least one of these. If you intentionally want to change the policy, update this document AND the affected tests in the same PR — and expect maintainer pushback.

---

## 7. Changelog

| Version | Change |
|:--|:--|
| 1.0.0 | Initial policy, extracted from engine code as of v0.6.0-rc.1. |

Executor: Devin
