# Changelog

> Executor: Gemini-CLI

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
