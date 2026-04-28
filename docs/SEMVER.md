---
id: DOC-SEMVER-POLICY
status: active
version: 1.0.0
audience: library consumers, plugin authors, release managers, agents proposing API edits
---

> **Read this when**: You are upgrading `defense-in-depth`, authoring a custom guard or provider, or preparing a PR that touches a public surface (`src/index.ts`, the `Guard` contract, `defense.config.yml`, the CLI).
> **Skip if**: You only need to configure or use the bundled guards and CLI defaults.
> **Related**: [migration/v0-to-v1.md](migration/v0-to-v1.md) · [CHANGELOG.md](../CHANGELOG.md) · [`src/index.ts`](../src/index.ts) · [`src/core/types.ts`](../src/core/types.ts)

# Semantic Versioning Policy

> **TL;DR** — `defense-in-depth` follows [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) on **four** public surfaces: the library entry point (`src/index.ts`), the Guard / Provider contracts in `src/core/types.ts`, the `defense.config.yml` schema, and the `defense-in-depth` CLI. Anything not listed in §[Public Surface](#1-public-surface) is internal and may change in any release without a version bump.

---

## 1. Public Surface

A change is governed by SemVer **only if** it observably affects one of the surfaces below. Everything else (tests, internal helpers, build tooling, governance docs, hint catalog content, internal JSONL record schemas) is non-API and can move freely.

| Surface | Source of truth | What's covered |
|:---|:---|:---|
| **Library entry point** | [`src/index.ts`](../src/index.ts) | Every value-level export (`DefendEngine`, `Severity`, `EvidenceLevel`, `loadConfig`, `DEFAULT_CONFIG`, every `*Guard`, `allBuiltinGuards`, `createProvider`, `FileTicketProvider`, `HttpTicketProvider`) and every type-only export (`Guard`, `GuardContext`, `GuardResult`, `Finding`, `EngineVerdict`, `DefendConfig`, `TicketRef`, `Lesson`, `EvaluationScore`, `GuardF1Metric`, `DSPyConfig`, `FeedbackEvent`, `TicketStateProvider`, and every per-guard config interface). |
| **Guard / Provider contract** | [`src/core/types.ts`](../src/core/types.ts) | `Guard`, `GuardContext`, `GuardResult`, `Finding`, `Severity`, `EvidenceLevel`, `EngineVerdict`, `TicketStateProvider`. Custom guards/providers implement these — changing their shape changes the world for every consumer. |
| **Configuration schema** | `DefendConfig` in [`src/core/types.ts`](../src/core/types.ts), validated by [`src/core/config-loader.ts`](../src/core/config-loader.ts) | The `defense.config.yml` keys: `version`, `guards.*`, `hints?`, federation provider config. Adding a new optional key is Minor; renaming or removing a key is Major. |
| **CLI surface** | [`src/cli/index.ts`](../src/cli/index.ts) and the binary `npx defense-in-depth …` | Subcommand names, documented flags, exit codes (`0` pass / `1` BLOCK / `2` config error), the contract that `WARN` does not change exit code, and the contract that DSPy/provider failures degrade to WARN, never crash. |

**Out of scope** — these are *not* part of the public surface and may change in any release:

- Anything reachable only via deep paths like `dist/core/dspy-client.js` that is **not** re-exported from `src/index.ts`. If consumers reach into `dist/...`, they're on the internal API and own the breakage.
- Stderr formatting, log levels, ANSI colours, hint copy text, doctor banners.
- The hint catalog (`H-001-no-dspy`, …) — IDs, trigger conditions, and copy may evolve. The hint *engine* contract (env-var opt-out, cooldown semantics, JSON state file shape) is stable.
- Append-only JSONL record schemas under `.agents/records/` (`feedback.jsonl`, `lesson-recalls.jsonl`, `lesson-outcomes.jsonl`, `growth_metrics.jsonl`). They are evidence stores, not an integration contract.
- The `.agents/` scaffold templates emitted by `init --scaffold`. Templates iterate; consumers can re-run scaffold or fork.
- Anything under `templates/`, `tests/`, `scripts/`, `.github/`, `docs/`.

> If you are unsure whether a change you're proposing is covered, ask: "Could a v0.7.x consumer that imports only from `defense-in-depth` (not `defense-in-depth/dist/...`) observe this change without re-running `npm install`?" If yes, it's covered. If no, it isn't.

---

## 2. Major (breaking) — `X.0.0`

A bump to MAJOR means at least one of the following landed:

### 2.1 Library exports

- Removing or renaming any value-level export from `src/index.ts`.
- Removing or renaming any type-only export from `src/index.ts`.
- Narrowing an existing export's type in a way that breaks code that compiled against the prior version (e.g. making a previously optional field required, narrowing a union, tightening a generic constraint).
- Moving a public symbol to a different deep import path so that prior `dist/...` deep imports stop resolving — but only if the symbol was *also* removed from the barrel. Deep-path-only consumers are not on the public surface (see §1).

### 2.2 Guard / Provider contract

- Adding a required member to `Guard`, `GuardContext`, `Finding`, `GuardResult`, `EngineVerdict`, or `TicketStateProvider` without a default — every existing third-party guard or provider must update to compile.
- Renaming or removing a member of any of the contracts above.
- Renaming a `Severity` value or `EvidenceLevel` enum member, or removing one.
- Changing the engine's behavioural contract for guards in a way that breaks pure guards: e.g. removing the "guards never throw" engine-level catch, or changing pipeline semantics from collect-all to fail-fast (the inverse of the current [Fail-Fast Policy](dev-guide/fail-fast-policy.md)).

### 2.3 Configuration schema

- Renaming or removing any `defense.config.yml` key (`guards.hollowArtifact`, `guards.federation`, etc.).
- Bumping the required `version:` field to a value that older configs no longer satisfy. The current required value is `"1"`; bumping it to `"2"` is a Major change.
- Changing a default such that an unchanged config from a prior version produces a *different verdict* on the same input. Adding new patterns to a guard's default list that flag artifacts that previously passed counts here — even though the schema didn't change, the contract did.

### 2.4 CLI surface

- Renaming or removing a documented subcommand (`init`, `verify`, `doctor`, `eval`, `feedback`, `lesson`, `growth`).
- Renaming or removing a documented flag.
- Changing exit codes — the `0 / 1 / 2` contract is part of the CLI surface and is what scripts and CI runners depend on.
- Dropping support for a Node.js version that was previously supported (current floor: Node ≥18 per `engines` in [`package.json`](../package.json) and the test matrix in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

### 2.5 Reasonable carve-outs

A *security* fix that requires a breaking change is still a Major bump — but it is shipped under the deprecation timeline in §[Deprecation Policy](#5-deprecation-policy) only when a non-breaking mitigation is impossible. Otherwise, security fixes are released as Patch or Minor on the affected line(s).

---

## 3. Minor (feature) — `0.X.0`

A bump to MINOR means at least one of the following landed and **no** Major condition applies:

- A new built-in guard. The guard is registered in `guards/index.ts`, surfaced through `allBuiltinGuards`, and re-exported from `src/index.ts`. Existing configs continue to run unchanged because new guards default to `enabled: false` unless the consumer opts in.
- A new optional key in `defense.config.yml` whose default preserves prior verdicts on prior input. Example: the `hints` block added in v0.7-rc.1 is opt-in (default `enabled: true` but earned-trigger only — fresh repos see nothing).
- A new value-level or type-only export added to `src/index.ts`.
- A new optional member added to a public type in `src/core/types.ts` (e.g. an additional optional field on `Lesson` or `TicketRef`).
- A new CLI subcommand or a new flag on an existing subcommand whose absence preserves prior behaviour.
- New `npm` dist-tags (e.g. `next` for release candidates) — adding a tag does not affect anyone on `latest`.

> A new built-in guard turning **on by default** is a Major change, not a Minor one — it can change the verdict for unchanged input. New guards always ship `enabled: false` to stay Minor-safe.

---

## 4. Patch — `0.0.X`

A bump to PATCH means none of the above changed, but at least one of the following did:

- Bug fixes that restore documented behaviour. If a guard was *supposed* to flag a pattern but didn't because of a regex bug, fixing it is Patch — even though some consumer's previously-green commit will now flag. The pre-fix behaviour was a defect, not a contract.
- Performance, internal refactoring, type-level cleanups that don't change emitted JS or `.d.ts` shape (the [PR #56 `Severity` re-export removal](https://github.com/tamld/defense-in-depth/pull/56) is the canonical example — verified zero callers, drops a dead barrel re-export, no Major bump).
- Documentation, examples, README, CHANGELOG.
- Test, CI, build-script, and tooling changes that don't ship in the npm tarball (the package's `files` field in `package.json` lists exactly what ships).
- `dependencies` / `devDependencies` bumps that don't change the public surface. The runtime dependency floor (`yaml ^2.7.1`) is the only thing visible to consumers; a lock-only or devDeps-only bump is Patch.

---

## 5. Deprecation Policy

Anything on the public surface (§1) MUST follow the deprecation lane below before it can be removed in a Major bump:

1. **Mark with `@deprecated` JSDoc** on the export site in `src/index.ts` or `src/core/types.ts`. Include the replacement and the planned removal version. TypeDoc / language-server tooling surfaces this directly to consumers.
2. **Emit `console.warn` on first use** when the deprecated symbol is reached at runtime — for value-level exports and CLI flags that have a runtime path. Once-per-process is enough; do not spam.
3. **Document the deprecation** in `CHANGELOG.md` under a `### Deprecated` header in the release that introduced the marker, and link the replacement.
4. **Wait at least one Minor cycle, AND at least 6 months of wall-clock time, AND across at least one rc/GA cut**, whichever is longest. This window is the consumer's grace period — long enough that anyone on a Tier-A LTS workflow gets at least one upgrade pass.
5. **Remove only in a Major bump.** A Minor or Patch may not delete a deprecated symbol.

A type-only export that has no runtime path can skip step 2; the JSDoc + CHANGELOG + grace window still apply.

> **Why `console.warn`, not `throw`** — The whole project's design contract is "WARN, do not crash". Throwing on a deprecated call would be a breaking change masquerading as a warning. See the [DSPy fail-fast policy](dev-guide/fail-fast-policy.md) for the same shape applied to inference failures.

---

## 6. Pre-release Channels

Two `npm` dist-tags are part of the published surface:

- **`latest`** — only points at a stable GA release (no `-rc`, no `-beta`). This is what `npm install defense-in-depth` (no version pin) installs. Promoting a build to `latest` is a release-engineering act gated on the bake protocol in [`docs/vision/meta-growth-roadmap.md`](vision/meta-growth-roadmap.md).
- **`next`** — release candidates and pre-release builds (`X.Y.Z-rc.N`, `X.Y.Z-beta.N`). Consumers opt in with `npm install defense-in-depth@next`. SemVer applies *within* the rc series: a breaking change between `1.0.0-rc.1` and `1.0.0-rc.2` is allowed because rc.1 is, by contract, not stable. SemVer applies *across* GA boundaries normally.

Tags older than `next` (any historical alpha/canary) are not part of the contract and may be deleted at any time.

---

## 7. What This Policy is Not

- It is not a freeze. The library is still actively developed; types in `src/core/types.ts` were designed up front so the *shape* is stable, but the implementations behind them ship incrementally per the roadmap.
- It is not a substitute for tests. The smoke test added in [PR #56](https://github.com/tamld/defense-in-depth/pull/56) (`tests/public-api.test.js`) is the trip-wire that catches accidental drops from `src/index.ts` — without it, a future PR could remove a barrel export without anyone noticing until a consumer's CI breaks. Per-guard unit tests are the trip-wire for behavioural contract drift.
- It is not opt-in. Every PR that touches the public surface is reviewed against this document, and CodeRabbit is configured (assertive profile, see [`.coderabbit.yaml`](../.coderabbit.yaml)) to flag drift.

---

## 8. Quick Decision Table

| Change | Bump |
|:---|:---|
| Add a new optional field to `Lesson` | Minor |
| Make an optional field on `Lesson` required | Major |
| Add a new built-in guard, `enabled: false` by default | Minor |
| Add a new built-in guard, `enabled: true` by default | Major |
| Add a new value to `Severity` (e.g. `INFO`) | Major (existing exhaustive `switch` blocks break) |
| Rename `EvidenceLevel.RUNTIME` to `EvidenceLevel.OBSERVED` | Major |
| Drop a dead internal re-export with verified zero callers | Patch |
| Tighten a regex in `hollowArtifact`'s default patterns | Major (verdict can change on unchanged input) |
| Loosen the same regex to fix a false-positive | Patch (bug fix; restores documented intent) |
| Add `--json` flag to `verify` | Minor |
| Change `verify` exit code on WARN from `0` to `1` | Major |
| Bump Node floor from 18 to 20 | Major |
| Bump `yaml` peer-tolerated version range | Minor |
| Rename hint `H-001-no-dspy` to `H-001-dspy-suggested` | Patch (hint catalog content is not on the public surface) |
| Rename `defense.config.yml` key `guards.hollowArtifact` to `guards.artifactQuality` | Major |

If your change isn't in the table and you're not sure, default to the higher bump and document the rationale in the PR — it is far cheaper to over-bump than to break a consumer.

---

> Executor: Devin
