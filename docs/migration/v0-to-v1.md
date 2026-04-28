---
id: DOC-MIGRATION-V0-TO-V1
status: active
version: 1.0.0
audience: existing v0.1.0 → v0.7-rc.1 consumers, anyone on `npm install defense-in-depth` without a version pin
---

> **Read this when**: You installed `defense-in-depth` before `v1.0.0` (most likely v0.1.0, since that is the current `npm latest`) and want to upgrade to v1.0.
> **Skip if**: You are on a fresh install — `npm install defense-in-depth` after the v1.0.0 GA cut already gives you the new surface; no migration needed.
> **Related**: [SEMVER.md](../SEMVER.md) · [CHANGELOG.md](../../CHANGELOG.md) · [user-guide/configuration.md](../user-guide/configuration.md) · [user-guide/cli-reference.md](../user-guide/cli-reference.md)

# Migration Guide — v0.x → v1.0

> **TL;DR** — v1.0 is a stabilisation release, not a redesign. If your `defense.config.yml` declares `version: "1"` and you only consume the public surface (no `dist/...` deep imports), upgrading from any v0.x line is a one-line bump in `package.json`. Everything below is the long-form audit you should run if you are on **v0.1.0** specifically — the npm `latest` build that is roughly 20 days behind the development branch and missing every feature shipped in v0.2 → v0.7.

---

## 1. What v1.0 Is

v1.0 freezes the public surface that has been incrementally landing since v0.2:

| Surface | Frozen by v1.0 | Where to read it |
|:---|:---|:---|
| Library entry point | Every value- and type-level export from [`src/index.ts`](../../src/index.ts) | [SEMVER §1](../SEMVER.md#1-public-surface) |
| Guard / Provider contract | `Guard`, `GuardContext`, `GuardResult`, `Finding`, `Severity`, `EvidenceLevel`, `EngineVerdict`, `TicketStateProvider` | [`src/core/types.ts`](../../src/core/types.ts) · [`.agents/contracts/guard-interface.md`](../../.agents/contracts/guard-interface.md) |
| Configuration schema | `DefendConfig` (the `defense.config.yml` shape), required `version: "1"` field | [user-guide/configuration.md](../user-guide/configuration.md) |
| CLI surface | `init`, `verify`, `doctor`, `eval`, `feedback`, `lesson`, `growth` subcommands · exit codes `0/1/2` · WARN ≠ exit non-zero | [user-guide/cli-reference.md](../user-guide/cli-reference.md) |

After v1.0 GA, every change on these surfaces follows the bump rules in [SEMVER.md](../SEMVER.md).

> **What v1.0 is NOT**: a new feature batch. The features were shipped in v0.2 through v0.7-rc.1; v1.0 is the act of saying "these are stable, you can depend on them". See the [release lifecycle umbrella](https://github.com/tamld/defense-in-depth/issues/42).

---

## 2. Breaking Changes in v1.0

The v1.0 lane intentionally locks the public surface for the long haul, so it picks up two genuine breaking changes on top of the additive v0.7-rc.1 base:

1. **`Severity` is no longer re-exported from `src/core/engine.ts`.** It is exported from `src/index.ts` (the barrel) and from `src/core/types.ts` (the SSoT). If you have an import like `import { Severity } from "defense-in-depth/dist/core/engine.js"`, switch it to `import { Severity } from "defense-in-depth"`. See [PR #56](https://github.com/tamld/defense-in-depth/pull/56) for the zero-caller audit and rationale.
2. **`defense.config.yml` requires `version: "1"`.** The field has been required since v0.1; v1.0 keeps it as `"1"`. If you are migrating from an *internal-fork pre-v0.1 build* that had no `version:` field, add `version: "1"` at the top of the file. Public v0.1.0 already requires this, so npm-installed consumers are not affected.
3. **`loadConfig()` now throws `ConfigError` on invalid configs.** v0.x silently warned and returned `DEFAULT_CONFIG`. v1.0 surfaces the failure as a typed exception so library consumers stop running with a config they did not intend. The zero-config path (no `defense.config.yml` present) is unchanged. See [§ Error handling](#error-handling) for before/after snippets.

Apart from item (3), if your install is anywhere between v0.1.0 and v0.7-rc.1 v1.0 itself adds nothing else breaking. The reason this guide is long is that **v0.1.0 → v1.0 spans every feature shipped in v0.2 → v0.7-rc.1**, and you should know what landed before you upgrade.

---

## 3. What You Get When You Upgrade From v0.1.0

The npm `latest` tag has pointed at v0.1.0 since 2026-04-07. The development branch has shipped six minor lines since then. Here is what becomes available in your `node_modules` the moment you upgrade.

### 3.1 v0.2 — `.agents/` ecosystem scaffold

- `npx defense-in-depth init --scaffold` creates the `.agents/` governance ecosystem alongside the hooks: rules, workflows, skills, contracts, philosophy.
- The base `init` (no flag) is unchanged from v0.1: it installs hooks and writes `defense.config.yml`. Scaffold is opt-in.

### 3.2 v0.3 — File-based ticket federation

- New `ticketIdentity` guard (default WARN severity, opt-in via `guards.ticketIdentity.enabled: true`). Detects cross-ticket contamination in commits using a configurable TKID regex.
- New `TicketRef` type and `TicketStateProvider` interface in `src/core/types.ts`.
- New `FileTicketProvider` — reads `TICKET.md` YAML frontmatter; zero infrastructure required.
- `extractTicketRef()` derives ticket scope generically from branch / commit / dirname; no AAOS lock-in.

### 3.3 v0.4 — Memory layer

- `lessons.jsonl` — local case-law store; no external infrastructure.
- New `did lesson` CLI subcommand — record and search past lessons (`wrongApproach` + `correctApproach` schema).
- New `did growth` CLI subcommand — record `GrowthMetric` observations to `growth_metrics.jsonl`.
- New `Lesson` and `GrowthMetric` types exported from `src/core/types.ts`.

### 3.4 v0.5 — Optional DSPy semantic layer

- `hollowArtifact` guard gains an `useDspy` opt-in (default `false`). When on, the guard's three-layer chain (regex → length heuristic → DSPy) augments deterministic checks with semantic scoring. **DSPy never BLOCKs**; it only raises WARN. Failures degrade silently per the [Fail-Fast Policy](../dev-guide/fail-fast-policy.md).
- New `did eval` standalone CLI subcommand for artifact quality analysis with DSPy.
- New `EvaluationScore` and `DSPyConfig` types.
- See [user-guide/configuration.md](../user-guide/configuration.md) and [dev-guide/dspy-providers.md](../dev-guide/dspy-providers.md) for endpoint setup (Ollama, Groq, NVIDIA NIM, OpenRouter, Gemini Flash all documented).

### 3.5 v0.6 — Federation guards

- New `federationGuard` — pure cross-validation of child execution against parent ticket lifecycle phase. Zero I/O in the guard itself; parent state resolved by the engine's enrichment phase.
- New `HttpTicketProvider` — `globalThis.fetch` with `AbortController` timeout; non-fatal on failure.
- New `FederationGuardConfig` config block; default `enabled: false`.
- `TicketRef` extended with `parentId`, `parentPhase`, `authorized`. The fields are optional, so existing `TicketRef` consumers compile unchanged.

### 3.6 v0.6.x — Operational hardening

- Server-side composite action (`.github/actions/verify/action.yml`) — runs the same guard pipeline against the PR diff in CI. Closes the bypass via `git commit --no-verify`. See [README §3](../../README.md) for the recommended GitHub Actions wiring.
- Release workflow — tag `v*.*.*` triggers build → test → npm publish (with provenance) → GitHub Release. v0.1.0 ↔ development gap that this guide exists to close was a direct consequence of the absence of this workflow before v0.6.
- `SECURITY.md` — explicit threat model for v0.5+ outbound network calls (`hollowArtifact.useDspy`, `HttpTicketProvider`, `federation.parentEndpoint`).

### 3.7 v0.7-rc.1 — Memory loop + Progressive Discovery

- **`did feedback`** — first-class CLI for labelling guard findings as TP/FP/FN/TN. Append-only `.agents/records/feedback.jsonl`; deterministic event ids. Foundation for the F1 measurement that is gated behind Track A4 exit per [`docs/vision/meta-growth-roadmap.md`](../vision/meta-growth-roadmap.md).
- **`did lesson outcome`** + **`did lesson scan-outcomes`** — record explicit recall outcomes; walk git diffs for implicit re-occurrences via `Lesson.wrongApproachPattern` regex matches.
- **`did doctor --hints`** + earned-trigger hint engine — non-blocking discovery surface for v0.4+ features. Three-layer anti-nag (earned trigger, 7-day cooldown, `NO_HINTS=1` / `CI=true` / `hints.enabled: false`). Fresh repos see zero hints.
- New optional `hints` block in `defense.config.yml`. The minimal config template emitted by `init` ships this block so users discover the knobs.
- New types: `Hint`, `HintState`, `LessonOutcome`, `RecallEvent`, `RecallMetric`, `FeedbackEvent`, `GuardF1Metric`.

### 3.8 v0.7 → v1.0

- Two missing built-in guards (`rootPollutionGuard`, `hitlReviewGuard`) and a long list of public types are added to the `src/index.ts` barrel ([PR #56](https://github.com/tamld/defense-in-depth/pull/56), closes [#33](https://github.com/tamld/defense-in-depth/issues/33)). v0.1.0 consumers had to reach into deep `dist/...` paths for these; v1.0 lifts them into the canonical entry point.
- Dead `Severity` re-export from `src/core/engine.ts` is dropped (same PR; verified zero callers).
- This document and [SEMVER.md](../SEMVER.md) ship as the stability contract for the v1.0 surface.

---

## 4. Configuration Migration

Every config file declares its own version. The current contract:

```yaml
version: "1"
guards:
  hollowArtifact:
    enabled: true
  ssotPollution:
    enabled: true
  # … other guards default to disabled
```

The `version: "1"` field has been required since v0.1.0. If you have a config without it (only possible if you forked from a pre-v0.1 internal build), add it.

### 4.1 New config blocks available since v0.1.0

If your config was hand-written against the v0.1 schema, the following blocks are *available* but optional. None of them is required to keep your existing setup working.

| Block | Since | Default if absent | What you get by enabling |
|:---|:---|:---|:---|
| `guards.rootPollution` | v0.1 | disabled | Blocks files in repo root that aren't on the allow-list. |
| `guards.commitFormat` | v0.1 | disabled | Conventional Commits enforcement. |
| `guards.branchNaming` | v0.1 | disabled | Regex-validated branch names. |
| `guards.phaseGate` | v0.1 | disabled | Forces a planning artifact (e.g. `PLAN.md`) before source commits. |
| `guards.hitlReview` | v0.1 | disabled | Blocks direct commits on protected branches; forces PR workflow. |
| `guards.ticketIdentity` | v0.3 | disabled | Cross-ticket contamination detection (WARN by default). |
| `guards.hollowArtifact.useDspy` | v0.5 | `false` | Tier-3 semantic evaluation (opt-in). |
| `guards.federation` | v0.6 | disabled | Parent↔child ticket lifecycle governance. |
| `hints` | v0.7-rc.1 | implicit defaults | Earned-trigger discovery hints in `did doctor` / `did verify` output. |

Run `npx defense-in-depth init` in a *temporary* directory to see the latest config template; copy the blocks you want.

### 4.2 No-op upgrade path

If your `defense.config.yml` only declares the v0.1 guards (`hollowArtifact`, `ssotPollution`) with `enabled: true` and nothing else, **the file works unchanged on v1.0**. You inherit every new guard with `enabled: false` defaults. No verdict on existing input changes.

---

## 5. CLI Migration

Your existing v0.1.0 CLI invocations all keep working:

```bash
npx defense-in-depth init
npx defense-in-depth verify
npx defense-in-depth doctor
```

The exit code contract is unchanged: `0` on pass, `1` on BLOCK, `2` on config error. WARN does not change exit code.

New subcommands available since v0.1:

| Command | Since | Purpose |
|:---|:---|:---|
| `npx defense-in-depth eval <files...>` | v0.5 | Standalone DSPy artifact quality scoring. |
| `npx defense-in-depth feedback ...` | v0.7-rc.1 | TP/FP/FN/TN labelling for guard findings. |
| `npx defense-in-depth lesson ...` | v0.4 (record/search), v0.7-rc.1 (outcome / scan-outcomes) | Local case-law store. |
| `npx defense-in-depth growth ...` | v0.4 | Growth metric capture. |
| `npx defense-in-depth doctor --hints` | v0.7-rc.1 | Inspect / dismiss / reset earned discovery hints. |

See [user-guide/cli-reference.md](../user-guide/cli-reference.md) for the full surface and flag inventory.

---

## 6. Programmatic API Migration

If you embed `defense-in-depth` as a library:

### 6.1 Imports — prefer the barrel, drop deep paths

```ts
// ✓ Recommended (works on every version since the symbol was added)
import {
  DefendEngine,
  loadConfig,
  Severity,
  EvidenceLevel,
  rootPollutionGuard,
  hitlReviewGuard,
  federationGuard,
  allBuiltinGuards,
} from "defense-in-depth";

// ✓ Type imports likewise come from the barrel
import type {
  Guard,
  GuardContext,
  GuardResult,
  Finding,
  EngineVerdict,
  DefendConfig,
  TicketRef,
  Lesson,
  EvaluationScore,
  GuardF1Metric,
  DSPyConfig,
  FeedbackEvent,
  TicketStateProvider,
} from "defense-in-depth";

// ✗ Avoid (deep paths into compiled output)
import { Severity } from "defense-in-depth/dist/core/engine.js";
```

The deep-path import on the last line worked in v0.1 → v0.7-rc.0 by accident — `engine.ts` carried a tail re-export of `Severity` that turned out to have zero internal callers. v1.0 drops it (see [PR #56](https://github.com/tamld/defense-in-depth/pull/56)). Switch to the barrel.

### 6.2 Custom guard authors

The `Guard` interface has been stable since v0.1. The `GuardContext.semanticEvals` field landed in v0.5 as **optional**, so existing v0.1 guards still compile. If you want to read precomputed DSPy scores from the engine's enrichment phase, add an `if (ctx.semanticEvals?.dspy) { … }` check — the field is opt-in and may be undefined.

### 6.3 Custom provider authors

`TicketStateProvider` has been stable since v0.3. v0.6 adds optional `parentId`, `parentPhase`, `authorized` fields to `TicketRef`; if your provider can resolve a parent, populate them. Otherwise, return what you have — the federation guard tolerates partial state.

### 6.4 Error handling — typed errors (v1.0, BREAKING) <a id="error-handling"></a>

v1.0 introduces a typed error hierarchy so library consumers can branch on a stable `.code` instead of parsing `.message`. The hierarchy is:

```
DiDError                         (base — extends Error; .code: string)
├── ConfigError                  (code: "DID_CONFIG_INVALID"; .configPath?)
├── GuardCrashError              (code: "DID_GUARD_CRASH";   .guardId)
└── ProviderError                (code: "DID_PROVIDER_FAIL"; .providerName)
```

All four classes are exported from the barrel and from a new `defense-in-depth/errors` subpath:

```typescript
import {
  DiDError,
  ConfigError,
  GuardCrashError,
  ProviderError,
  ErrorCodes,        // { CONFIG_INVALID, GUARD_CRASH, PROVIDER_FAIL }
} from "defense-in-depth";
// or, equivalently:
import { ConfigError } from "defense-in-depth/errors";
```

Every subclass preserves the underlying error on `.cause` so telemetry consumers can keep the original stack trace.

#### `loadConfig()` — was warn-and-default, is now throw

This is the only behavioural break in the typed-error change set.

**Before (v0.x):**

```typescript
import { loadConfig } from "defense-in-depth";
const cfg = loadConfig(projectRoot); // bad YAML → console.warn, returns DEFAULT_CONFIG
```

**After (v1.0):**

```typescript
import { loadConfig, ConfigError } from "defense-in-depth";
try {
  const cfg = loadConfig(projectRoot);
} catch (err) {
  if (err instanceof ConfigError) {
    // err.code === "DID_CONFIG_INVALID"
    // err.configPath, err.cause, err.message all available
    process.stderr.write(`Bad config at ${err.configPath}: ${err.message}\n`);
    process.exit(1);
  }
  throw err;
}
```

The zero-config path is unchanged: if `defense.config.yml` (or any of the other accepted file names) is missing, `loadConfig()` still returns `DEFAULT_CONFIG` without throwing.

#### Engine guard crashes — typed cause, same finding shape

The engine still records a BLOCK finding with the legacy `"Guard crashed: …"` message prefix when a guard's `check()` throws — that contract is pinned by `tests/engine.test.js`. v1.0 additionally constructs a typed `GuardCrashError` (with `.guardId` and `.cause`) inside the engine, so consumers wiring telemetry around the pipeline can rely on a stable typed surface for the cause. No call-site changes are required for users reading `verdict.results[*].findings[*].message`.

#### Ticket providers — same warn-and-degrade contract

`FileTicketProvider` and `HttpTicketProvider` still NEVER throw to the caller (this is the federation graceful-degradation contract pinned by `tests/contract/public-api-contract.test.js`). v1.0 wraps their failure messages in a `ProviderError` instance for shape stability, but the public observable is identical: provider returns `undefined`, engine warns to stderr, pipeline continues.

### 6.5 `engine.run()` — positional → options object (v1.0, BREAKING)

v1.0 retires the positional `(stagedFiles, options?)` signature in favour of a single options object. This frees the API from the staged-only model baked into v0.x and reserves named slots for future execution modes (`mode: "staged" | "full" | "patch"`, `dryRun: boolean`).

The new shape is exported from the barrel as `EngineRunOptions`:

```typescript
import type { EngineRunOptions } from "defense-in-depth";

interface EngineRunOptions {
  files: string[];
  mode?: "staged" | "full" | "patch"; // reserved — not yet wired
  commitMessage?: string;
  branch?: string;
  dryRun?: boolean;                    // reserved — not yet wired
}
```

**Before (v0.x):**

```typescript
const verdict = await engine.run(stagedFiles, {
  branch: "feat/TK-123",
  commitMessage: "feat: add foo",
});
```

**After (v1.0):**

```typescript
const verdict = await engine.run({
  files: stagedFiles,
  branch: "feat/TK-123",
  commitMessage: "feat: add foo",
});
```

This is a clean break — no shim. The legacy positional form will fail TypeScript compilation against the v1.0 typings. CLI consumers (`npx defense-in-depth verify`) are unaffected; the CLI was migrated in the same PR (#50).

The `mode` and `dryRun` fields are accepted on the type but currently have **no runtime effect**. They are reserved for follow-up work that adds full-tree scans and side-effect-free dry runs (also tracked under #50). Setting them today is forward-compatible — readers will start consuming them in a later release without breaking your call site.

### 6.6 Guard lifecycle — optional `init` / `dispose` / `priority` (v1.0, MINOR)

v1.0 extends the `Guard` interface with five optional fields so guards can do per-run setup, cleanup, and ordering without leaking those concerns into `check()`. **All five fields are optional** — existing guards (in this repo and in user codebases) continue to compile unchanged. The SemVer impact is **MINOR**, not MAJOR.

```typescript
import type { Guard, GuardMeta } from "defense-in-depth";

interface Guard {
  // ─── Existing (since v0.1) ───
  readonly id: string;
  readonly name: string;
  readonly description: string;
  check(ctx: GuardContext): Promise<GuardResult>;

  // ─── New optional fields (v1.0 — issue #49) ───

  /** Runs once before THIS guard's `check()`. Per-guard, not pipeline-wide.
   *  Crashes record a BLOCK and skip check. */
  init?(ctx: GuardContext): Promise<void>;

  /** Runs once after the pipeline (in finally). Errors are warned and swallowed. */
  dispose?(): Promise<void>;

  /** Higher number = runs first. Default 0. Stable on ties. */
  readonly priority?: number;

  /** Reserved — per-file filtering hint, not yet wired. */
  supports?(file: string): boolean;

  /** Free-form metadata for tooling. */
  readonly meta?: GuardMeta;
}
```

#### Example — opt in to `init` / `dispose` for a per-run cache

```typescript
import type { Guard, GuardContext, GuardResult } from "defense-in-depth";
import { Severity } from "defense-in-depth";

let cache: Map<string, string> | undefined;

export const myGuard: Guard = {
  id: "my-guard",
  name: "My Guard",
  description: "Scans staged files for the FORBIDDEN_TOKEN.",
  priority: 100, // run before lower-priority guards

  async init(_ctx: GuardContext) {
    // Warm a per-run cache. Only called once per `engine.run()`.
    cache = new Map();
  },

  async check(ctx: GuardContext): Promise<GuardResult> {
    const findings = [];
    for (const file of ctx.stagedFiles) {
      const cached = cache?.get(file);
      // … use the cache …
    }
    return { guardId: this.id, passed: findings.length === 0, findings, durationMs: 0 };
  },

  async dispose() {
    // Always runs — even if init() or check() threw.
    cache?.clear();
    cache = undefined;
  },

  meta: {
    version: "1.0.0",
    author: "your-team",
    homepage: "https://example.com/my-guard",
  },
};
```

#### Crash semantics

| Phase | Throws | Engine behaviour |
|---|---|---|
| `init()` | Yes | Records `GuardCrashError` BLOCK finding with prefix `"Guard init crashed: …"`. **Skips `check()`** for that guard. `dispose()` still runs. Pipeline continues. |
| `check()` | Yes | Records `GuardCrashError` BLOCK finding with prefix `"Guard crashed: …"` (unchanged from v0.x). `dispose()` still runs. Pipeline continues. |
| `dispose()` | Yes | Logs a `console.warn` line (`⚠ Guard 'X' dispose failed: …`). **Verdict is unaffected.** Pipeline continues. |

#### Priority semantics

Higher number runs first. Default 0. Ties preserve registration order (stable sort).

```typescript
new DefendEngine(root, config)
  .use(myGuardA) // no priority → 0
  .use(myGuardB) // priority: 100 → runs first
  .use(myGuardC) // priority: 50  → runs second
```

The engine sorts once per `run()` so `init()` and `check()` see the same order. `supports?(file)` and `meta` are reserved — accepted on the type but not consulted by the engine today. Setting them is forward-compatible.

---

## 7. Recommended Upgrade Steps

The path that minimises surprises:

1. **Pin to your current version first** so you can roll back. `npm install defense-in-depth@0.1.0 --save-exact`. Commit `package.json` + `package-lock.json`. This is your safety net.
2. **Read the [CHANGELOG](../../CHANGELOG.md) entries between your version and v1.0.** It is the canonical list of what landed. This guide is an interpretation; the CHANGELOG is the source.
3. **Bump.** `npm install defense-in-depth@^1.0.0`. The `^` floor is fine — every subsequent v1.x is non-breaking by [SEMVER.md](../SEMVER.md).
4. **Re-run `npx defense-in-depth doctor`.** It prints any config drift, missing hooks, and (since v0.7-rc.1) any earned discovery hints. Fix what it reports. The doctor is idempotent.
5. **Run your test suite or `npx defense-in-depth verify --files <staged>` against a representative commit.** Confirm no verdict changed unexpectedly. v1.0 is contract-stable, so this is paranoia, not necessity — but paranoia is cheap.
6. **Optional: enable the new guards.** Add `guards.rootPollution.enabled: true`, `guards.hitlReview.enabled: true`, `guards.federation.enabled: true`, `guards.hollowArtifact.useDspy: true` selectively. Each is independent; enable in the order that gives you the most value first.
7. **Optional: enable the server-side action.** If you maintain a CI pipeline, wire in `.github/actions/verify` per [README §3](../../README.md). Client-side hooks are bypassable via `git commit --no-verify`; the server-side action is the only thing that gives HITL claims real teeth.

---

## 8. Rollback Plan

If v1.0 breaks something for you, the rollback is one command:

```bash
npm install defense-in-depth@0.7 --save-exact
```

`v0.7-rc.1` is the last pre-v1.0 build. It is functionally a superset of every prior public release except for the [PR #56](https://github.com/tamld/defense-in-depth/pull/56) deep-path `Severity` re-export, which is the one thing v1.0 removes that v0.7 keeps. If your code depends on that exact deep import path, pinning to `0.7` is the workaround until you can update the import.

If you find a real v0.x → v1.0 break that this guide didn't predict, please open an issue with the diff that surprised you. The [SEMVER policy](../SEMVER.md) is the contract; a real break is a contract violation that should be tracked.

---

> Executor: Devin
