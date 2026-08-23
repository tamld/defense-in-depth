# PRD — Coverage Gate 95% Initiative

> **Status**: PROPOSED — awaiting sponsor sign-off (see §7)
> **Owner**: Sisyphus (OhMyOpenCode) · **Sponsor**: tamld · **Date**: 2026-08-23
> **Evidence base**: `npm run coverage` measured post-growth-fix (uncommitted) + per-file gap audit
> **Executor**: Sisyphus (OhMyOpenCode)

---

## 1. Problem Statement

`defense-in-depth` sells **mechanism over prompting** — yet its own quality gate is currently red on `main`: GitHub Actions coverage job failed (2026-08-22), line coverage 89.94% < 90% threshold. A governance middleware that cannot enforce its own gate undermines the core thesis and blocks the v1.0 GA credibility story (Track A4 → npm `latest` promotion).

The growth-CLI test (uncommitted, validated locally) restored the gate: **91.38% line / 81.37% branch / 93.28% funcs**. The remaining gap is concentrated in the v0.4–v0.7 memory/CLI layer — exactly the newest, least battle-tested code.

## 2. Goal

Raise the coverage gate from `{line:90, branch:80, funcs:90}` to **`{95, 95, 95}`** by adding real behavioral tests only.

**Hard constraints (inherited from AGENTS.md / STRATEGY.md):**
- No threshold gaming — thresholds rise only when actual coverage already exceeds them.
- No deleting or skipping failing/slow tests.
- Zero new runtime dependencies (`node:test` + stdlib only).
- Public API frozen (A3): tests import from `../dist/*.js`, no source-behavior changes.

## 3. Non-Goals

| Excluded | Rationale |
|---|---|
| Refactoring `src/` for testability | Separate concern; dead-code findings get reported, not silently "fixed" here |
| Version-drift sync (package.json `0.7.0-rc.1` vs README `v1.0.0-rc.1`) | Separate P1 commit; mixing scopes pollutes history |
| Per-guard behavior changes | Guards are already at/near 100%; untouched |
| New CI features | Existing 3 jobs suffice once green |

## 4. Success Metrics

| Metric | Baseline (now) | Target |
|---|---|---|
| Line coverage | 91.38% | ≥ 95% (+3.62pp) |
| **Branch coverage** | **81.37%** | **≥ 95% (+13.63pp ← binding constraint)** |
| Function coverage | 93.28% | ≥ 95% (+1.72pp) |
| Test suites | 141 (514 tests) | all pass, zero skipped |
| GitHub Actions | 🔴 RED on main | 🟢 GREEN (test matrix + lint + coverage) |

Branch coverage is ~70% of the total effort: it requires exercising error paths, flag-validation branches, and fallback logic — not just happy paths.

## 5. Milestones (Execution Waves)

Each wave = one conventional commit, gate green at every commit.

| Wave | Scope | Files (by uncovered lines) | Est. effort |
|---|---|---|---|
| **W0** | Land existing growth-cli test | `tests/growth-cli.test.js` (validated, uncommitted) | XS |
| **W1** | CLI handler layer | `lesson.js` (48.65%, L33–110/264–285/295–332), `eval.js` (branch 14.29%), `init.js` (37.50% branch), `doctor.js` (60% branch), `hints-emit.js`, `cli/feedback.js`, `cli/index.js` router, `verify.js` | L |
| **W2** | Core memory/feedback layer | `lesson-outcome.js` (branch 41.27%), `core/feedback.js`, `hint-state.js`, `memory.js`, `engine.js` residuals, `dspy-stub.js` | M–L |
| **W3** | Edges & residuals | `file-provider.js`, `http-provider.js` timeout/error paths, `root-pollution.ts` L30, `ticket-identity.ts` branches | S |
| **W4** | Gate bump + CI proof | Bump THRESHOLDS in `scripts/check-coverage.mjs` to 95/95/95 → push → verify all 3 GitHub Actions jobs green | S |

## 6. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Remote main failure (20s run) has a second root cause beyond coverage | Medium | W4 reads full Actions log before declaring victory |
| Some branches are defensively unreachable → artificial tests smell | Medium | ADR-0004: unreachable code is reported as dead-code finding, never faked |
| Branch coverage stalls near 93–94% despite wave work | Low-Med | Re-run gap audit after W2; re-prioritize by branch density |
| Windows/macOS matrix flakiness in new fs-heavy tests | Low | Follow `mkdtemp(tmpdir)` convention used by all existing suites |

## 7. Decisions Requiring Sign-off

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | "Tất cả trên 95%" scope | (a) 3 aggregate metrics ≥95 [CI-enforceable] · (b) every file ≥95 individually [requires per-file floors in check-coverage.mjs] | **(a)** aggregate gate + soft target ≥85/file with documented exceptions list |
| **D2** | Threshold sequencing | (a) bump first (gate red mid-work) · (b) tests-first, bump last | **(b)** every commit stays green; ratchet mandate honored |
| **D3** | Branch naming | `test/coverage-95-gate` (matches stale `test/contract-tests-issue-35` precedent) vs `feat/*` | **`test/coverage-95-gate`** off latest main |
| **D4** | Unreachable/dead branches found during W1–W3 | (a) fake tests to hit them · (b) report findings, exclude from scope | **(b)** honesty over metrics; findings feed a separate cleanup PR |

Full rationale → `ADR.md`. Detailed requirements → `SRS.md`.
