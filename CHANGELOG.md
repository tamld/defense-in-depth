# Changelog

> Executor: Gemini-CLI

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.0-rc.1] — Memory Layer + Progressive Discovery (Path A) - 2026-04-27

> First v0.7 release candidate. Closes the three Path A tickets that turn the Tier-2 memory layer from a one-way write surface into a learning loop, and bridges Persona A → Persona B with non-blocking earned-signal hints.

### Added
- **`did feedback` MVP** (#22) — first-class CLI for labelling guard findings as TP/FP/FN/TN. Append-only `.agents/records/feedback.jsonl`, deterministic event ids, query/list/show subcommands. Foundation for F1 measurement of guard precision.
- **LessonOutcome MVP** (#23) — `did lesson outcome <id> --helpful|--not-helpful` records explicit recall outcomes; `did lesson scan-outcomes` walks git diffs and matches `Lesson.wrongApproachPattern` to detect implicit re-occurrences. Append-only `.agents/records/lesson-recalls.jsonl` + `lesson-outcomes.jsonl`. Idempotent ids exclude timestamps (Án Lệ #2). Fire-and-forget recall capture in `searchLessons`. Optional DSPy fuzzy match path emits the silent-degradation WARN per Án Lệ #1.
- **Progressive Discovery UX hints** (#21) — earned-signal hint engine (`src/core/hint-engine.ts`) with 4-rule v1 catalog (`H-001-no-dspy`, `H-002-no-lessons`, `H-003-no-feedback`, `H-004-no-federation`). Atomic JSON state at `.agents/state/hints-shown.json` (temp-file rename writes, corruption-resilient). `did doctor` / `did doctor --hints` / `did doctor --hints dismiss <id>` / `did doctor --hints reset` CLI surface. Hints also fire on a clean `did verify` exit. Three-layer anti-nag: earned trigger, 7-day cooldown, `NO_HINTS=1` / `CI=true` / `hints.enabled: false` user controls.
- **`docs/user-guide/hints.md`** — full reference for the Progressive Discovery surface.
- **24 new test cases** covering hint engine rules, cooldown / dismissal, state corruption resilience, and CLI subprocess wiring (NO_HINTS, CI, reset, dismiss, unknown-id error path).

### Changed
- `searchLessons()` now records a `RecallEvent` per result (fire-and-forget; JSONL write errors never break the search hot path). Optional `ticketId` / `executor` / `captureRecall` toggles for callers.
- `defense.config.yml` minimal template ships with a `hints: { enabled, cooldownDays, channels }` block so users discover the knobs.
- `Lesson` schema gains optional `wrongApproachPattern` (regex string) for outcome-scanner matching.
- `LessonOutcome` schema tightened to align with `FeedbackEvent` (id + source + executor required).
- `DefendConfig` gains optional `hints?: HintsConfig` block.

### Notes for upgraders
- All v0.7-rc.1 surfaces are opt-in. Existing v0.6.0 configs run unchanged.
- The hint engine is **earned-trigger only** — fresh repos see zero hints. CI logs stay clean (`CI=true` short-circuits emission).
- `did feedback` and `did lesson outcome` write append-only JSONL under `.agents/records/`. Add the directory to `.gitignore` if you do not want recall traces in git history.

### Test suite
- **366 green** (up from 322 at v0.6.0): +20 feedback, +13 lesson-outcome, +24 progressive-discovery, +misc.

---

## [Unreleased] — Operational Hardening

> Pre-release pass to close gaps between as-shipped capability and the
> "deterministic governance" pitch. No source-code changes; CI, docs, and
> distribution only.

### Added
- **Server-side Composite Action** (`.github/actions/verify/action.yml`) — runs the same guard pipeline against the PR diff in CI. Gives HITL/governance claims actual teeth, since `git commit --no-verify` cannot bypass it. Documented in README §3 and SECURITY.md.
- **Release workflow** (`.github/workflows/release.yml`) — tag `v*.*.*` triggers build → test → npm publish (with provenance) → GitHub Release. Closes the long-standing gap between local v0.6.0 and the v0.1.0 currently on npm.
- **SECURITY.md threat model** — documents v0.5+ outbound network calls (`hollowArtifact.useDspy`, `HttpTicketProvider`, `federation.parentEndpoint`) and the explicit out-of-scope items (server-side enforcement, third-party guard sandboxing).

### Changed
- **README framing** — added scaffold-vs-turnkey callout and a server-side enforcement section. Toned down the "10x hallucination" tagline to match current as-shipped capability (artifact failure modes), preserving the stronger semantic claim for v0.5+ DSPy follow-ups.
- **CI dogfooding** (`ci.yml`) — removed the `|| true` swallow on `Self-verify`. Step is now an honest CLI smoke test; meaningful diff-based dogfooding is a follow-up that requires a repo-local `defense.config.yml` tuned for self-application.
- **SECURITY.md supported versions** — corrected from `0.1.x` to `0.6.x` to match the current minor line.

### Refactor
- **Shared `src/core/jsonl-store.ts`** (#43, T1) — extracted the duplicated append-only JSONL primitives (id-based dedupe, time-window dedupe, line-by-line reader, malformed-line tolerance) from `feedback.ts` and `lesson-outcome.ts` into a single typed factory. Adds runtime field-by-field validation that replaces the previous `JSON.parse(line) as T` casts (Antigravity finding #4 on PR #32). External signatures of `appendFeedback`, `appendRecall`, `appendOutcome`, `readFeedback`, `readRecalls`, `readOutcomes` are unchanged — purely an implementation detail that is pinned by the contract tests added in #35. Patch-class per `docs/SEMVER.md` §4.

### Added (typed errors — #37, MAJOR)
- **`src/core/errors.ts`** — typed error hierarchy for programmatic handling. `DiDError` is the new base (extends `Error`); subclasses are `ConfigError` (code: `DID_CONFIG_INVALID`), `GuardCrashError` (code: `DID_GUARD_CRASH`, carries `.guardId`), and `ProviderError` (code: `DID_PROVIDER_FAIL`, carries `.providerName`). All subclasses preserve the original error on `.cause`. The `ErrorCodes` constant table exposes the stable string codes so consumers can branch on `err.code === ErrorCodes.CONFIG_INVALID` instead of parsing `.message`.
- **`defense-in-depth/errors`** subpath export — same pattern as `/guards`, `/federation`, `/types` shipped in #62.
- **17 new tests** covering instanceof + `.code` + `.guardId` / `.providerName` / `.configPath` / `.cause` plumbing, plus the `loadConfig` and `DefendEngine` integration paths.

### Changed (typed errors — #37, BREAKING)
- **`loadConfig()` now throws `ConfigError`** when the config file exists but cannot be parsed (YAML syntax error, non-mapping root, read failure). v0.x silently warned and fell back to `DEFAULT_CONFIG`. The zero-config path (no `defense.config.yml` present) is unchanged: `loadConfig()` still returns `DEFAULT_CONFIG`. Pinned by `tests/contract/public-api-contract.test.js` and the new `tests/errors.test.js` integration suite.
- **Engine guard-crash handling** now constructs a typed `GuardCrashError` (with `.guardId` and `.cause`) before recording the BLOCK finding. The legacy `"Guard crashed: …"` finding-message prefix is preserved (pinned by `tests/engine.test.js`), so consumers reading the `Finding.message` are unaffected; consumers who want the typed cause now have a stable contract for it.
- **Ticket-provider warnings** (`FileTicketProvider`, `HttpTicketProvider`) are now constructed via `ProviderError` so the warning text has a stable shape. Providers still NEVER throw — the federation graceful-degradation contract is preserved (pinned by `tests/contract/public-api-contract.test.js`).

### Changed (engine.run options object — #50, BREAKING)
- **`DefendEngine.run()` now accepts a single options object** of type `EngineRunOptions { files: string[]; mode?; commitMessage?; branch?; dryRun? }`. v0.x took positional `(stagedFiles, options?)` — that signature is removed. Library consumers must rewrite call sites; the legacy positional form will not type-check. `mode` and `dryRun` are accepted on the type but **not yet wired** to runtime behaviour — they are reserved slots for future full-scan / patch / dry-run modes (also #50). See `docs/migration/v0-to-v1.md` §6.4 for before/after snippets.
- **`EngineRunOptions` type** is exported from the library barrel (`defense-in-depth`) alongside the existing `EngineVerdict`, `Guard`, `GuardContext`, etc. Plugin authors and embedders should import it instead of inlining the option shape.

### Added (Guard lifecycle — #49, MINOR)
- **Optional `init?(ctx)` and `dispose?()` lifecycle methods** on the `Guard` interface. The engine calls `init()` once per guard before its `check()` runs and `dispose()` once per guard in a `finally` block — so cleanup runs even when `check()` throws or `init()` itself crashes. Crashes from `init()` are recorded as a typed `GuardCrashError` BLOCK finding with prefix `"Guard init crashed: …"`, and the crashed guard's `check()` is **not** invoked. Errors thrown from `dispose()` never propagate to the verdict — they are logged to `console.warn` and swallowed (cleanup must not mask the verdict).
- **Optional `priority?: number`** on the `Guard` interface. Higher number = runs first. Default 0. Ties preserve registration order (stable sort). Use to enforce ordering when one guard's BLOCK should short-circuit another (e.g. a future `secrets` guard at priority 100 should run before an expensive `dependency-audit` guard at priority 50).
- **Optional `supports?(file): boolean`** and **optional `meta?: GuardMeta`** on the `Guard` interface. Reserved for tooling — accepted on the type but not consulted by the engine today. Plugin authors may still expose them for downstream registries / UIs.
- **`GuardMeta` type** exported from the library barrel alongside `Guard`, `GuardContext`, `EngineRunOptions`, etc.
- **17 new lifecycle tests** in `tests/engine-lifecycle.test.js` pinning the contract: init runs before check; init runs once; dispose runs after check; dispose runs even on check throw; dispose runs even on init throw; dispose errors are swallowed (warn only); priority sorts descending; default priority is 0; ties preserve registration order; init crash skips check but still records BLOCK; non-Error init crash gets stringified; disabled-in-config guards do NOT have init / check / dispose called; **`TicketStateProvider.dispose()` errors are also swallowed and warned** (parity with guard dispose; flagged by Devin Review on PR #69).

### Notes for upgraders (Guard lifecycle)
- **All five new fields are optional.** Existing guards (in this repo and in user codebases) continue to satisfy the interface unchanged — the SemVer impact is **MINOR**, not MAJOR.
- The engine's existing crash-recording semantics for `check()` are preserved bit-for-bit. The new behaviour only fires when a guard opts in by defining `init`, `dispose`, or `priority`.
- See `docs/migration/v0-to-v1.md` §6.6 for a worked example of a guard that uses `init` to warm a cache and `dispose` to flush it.

### Migration

No code or config changes are required for users on v0.6.0. The Composite
Action is opt-in. The release workflow only fires on tag pushes, so it has
no effect on the regular PR/main flow.

The typed-error surface is additive for the runtime path of valid configs.
The behavioural break is scoped to **invalid** `defense.config.yml` files —
v0.x users who relied on silent warn-and-fallback should wrap `loadConfig`
in `try/catch` and branch on `err instanceof ConfigError` /
`err.code === "DID_CONFIG_INVALID"`. See
`docs/migration/v0-to-v1.md#error-handling` for before/after snippets.

The `engine.run()` signature change is a **clean break** with no shim. Every
call site needs updating from `engine.run(files, { branch, commitMessage })`
to `engine.run({ files, branch, commitMessage })`. CLI users (`npx
defense-in-depth verify`) are unaffected — the CLI was migrated in the same
PR. See `docs/migration/v0-to-v1.md` §6.4.

---

## [0.6.0] — Federation Governance Guards - 2026-04-15

### Added
- **Federation Guard** (`federationGuard`) — cross-validates child project execution against parent ticket lifecycle phase. Pure guard (zero I/O), all parent state resolved by engine enrichment phase.
- **HttpTicketProvider** — network-aware provider using `globalThis.fetch` with `AbortController` timeout (default: 3000ms). Resolves ticket state from remote REST endpoints for cross-project federation.
- `TicketRef` extended with optional `parentId`, `parentPhase`, `authorized` fields for parent↔child governance.
- `FederationGuardConfig` type in `DefendConfig.guards.federation` — configurable `blockedParentPhases`, severity, provider selection.
- `FileTicketProvider` enhanced to extract `parentId` from TICKET.md YAML frontmatter.
- `DefendEngine.enrichParentTicket()` — second-stage enrichment that resolves parent ticket state before guard pipeline runs.
- 6 engine integration tests covering full pipeline (FE.01-04): enrichment, blocking, graceful degradation on 404/network error/timeout.
- 17 federation guard unit tests including edge cases (case-insensitive phases, empty parentId, dual findings) and worst cases (missing config, concurrent block+deny).

### Design Decisions
- **Zero-infrastructure default**: Federation is opt-in (`enabled: false`). Projects without federation config run exactly as before, zero regression.
- **Guard purity contract**: Federation guard performs ZERO I/O. All resolution happens during engine enrichment phase (Invariant #1).
- **Graceful degradation**: Provider failures produce WARN findings, never crash the pipeline.

### Fixed
- `FileTicketProvider` empty-string `parentId` leak — changed `!= null` check to truthy check (caught by edge case test).
- `HttpTicketProvider` silently dropped `parentId` from JSON responses — added extraction logic (caught by integration test).

---

## [0.5.0] — DSPy Semantic Evaluation (Opt-in) - 2026-04-15

### Added
- DSPy semantic evaluation integrated into `hollow-artifact` guard (opt-in via `useDspy: true`).
- New `eval` CLI subcommand for standalone artifact quality analysis with DSPy.
- `HollowArtifactConfig` extended with `useDspy`, `dspyEndpoint`, `dspyTimeoutMs` fields.
- Graceful degradation: DSPy failures produce warnings, never crash the guard pipeline.

### Design Decisions
- **Zero-infrastructure preserved**: DSPy is disabled by default. All existing deterministic checks unchanged.
- **Enhancement, not replacement**: DSPy augments the existing `hollowArtifact` guard rather than creating a separate evaluation subsystem. Honors the `defense.config.yml` design intent.

---

## [0.4.0] — Memory Layer & Growth Tracking - 2026-04-09

### Added
- Review ecosystem strictness: Deep architectural analysis via Automated Review Gateways (assertive profile) alongside AI Agent validation pipelines.
- Local memory system for lesson recording without external infrastructure (`lessons.jsonl`).
- Growth tracking metrics (`growth_metrics.jsonl`).
- New `lesson` CLI subcommand for recording and searching cases (án lệ).
- New `growth` CLI subcommand for recording metrics.
- Internal `fs` and `crypto` modules utilized for standard zero-dep persistence, matching `src/core/types.ts` specifications for `Lesson` and `GrowthMetric`.

---

## [0.3.0] — Ticket Federation & Providers - 2026-04-08

### Added
- `TicketStateProvider` interface and generic API boundaries for custom external state resolution.
- Built-in `file` Provider for zero-infrastructure governance (parses native `TICKET.md` frontmatter).
- `ticket-identity` guard (v0.3 TKID Lite) — detects cross-ticket contamination in commits (WARN severity)
- Explicit contract surface for `ticketIdentity` guard in `DefendConfig` and `defense.config.yml` (opt-in by default)
- `TicketRef` interface and `TicketIdentityConfig` in `src/core/types.ts` for Federation
- Agent and User documents regarding Custom TicketStateProviders.
- Federation v0.3: `extractTicketRef()` now derives ticket scope purely from branch name (generic, no AAOS lock-in)

### Changed
- `engine.ts`: Removed hardcoded `.worktrees/` path assumption; now uses generic `path.basename()` fallback

---

## [0.2.0] — Ecosystem & Agent Governance Scaffold

### Added
- `.agents/` governance scaffold via `npx defense-in-depth init --scaffold`
  - 18 rules covering consistency, guard lifecycle, context discipline, living documents
  - 5 skills: `skill-bootstrap-agent`, `skill-creator`, `skill-deep-research`, `skill-self-reflection`, `_template`
  - Contracts directory: `guard-interface.md`, `type-export-contract.md`
  - Workflows: task execution, onboarding procedures
  - Philosophy: `COGNITIVE_TREE.md` — cognitive framework for AI agents
- Prebuilt agent configs: `GEMINI.md`, `CLAUDE.md`, `.cursorrules`
- Lazy-load documentation hub in `docs/`:
  - `docs/user-guide/configuration.md` — full config schema reference
  - `docs/user-guide/cli-reference.md` — CLI command reference
  - `docs/dev-guide/writing-guards.md` — guard authoring guide
  - `docs/dev-guide/architecture.md` — architecture deep-dive and alternatives comparison
- `STRATEGY.md` — strategic roadmap and federation design rationale

### Changed
- `README.md` refactored from monolithic (20KB) to Lazy-Load Hub (~7KB)
- `README.vi.md` refactored to match EN structure (~5.6KB)
- Dual-audience documentation: human hub + agent machine gateway

---

## [0.1.0] — Foundation

### Added
- Core engine with pluggable guard pipeline (`src/core/engine.ts`)
- Type-safe guard interface with `Guard`, `GuardResult`, `Finding`, `Severity`, `EvidenceLevel` types
- YAML config loader with deep merge defaults (`src/core/config-loader.ts`)
- 5 built-in guards:
  - `hollow-artifact` — detects files with only `TODO`/`TBD` placeholders (BLOCK)
  - `ssot-pollution` — blocks governance/config files from feature branch commits (BLOCK)
  - `commit-format` — enforces conventional commit messages (WARN)
  - `branch-naming` — validates branch name patterns (WARN, off by default)
  - `phase-gate` — requires plan files before code commits (BLOCK, off by default)
- CLI with 3 commands: `init`, `verify`, `doctor`
- Git hook generators (pre-commit, pre-push)
- `AGENTS.md` root — project self-awareness layer for AI agents
- Immutable consistency rules (`.agents/rules/rule-consistency.md`)
- Cross-platform CI matrix: 3 OS × 4 Node.js versions
- OSS standard files: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- `defense.config.yml` default template
