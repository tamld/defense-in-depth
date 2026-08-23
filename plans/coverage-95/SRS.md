# SRS — Coverage Gate 95% Initiative

> **Status**: PROPOSED · **Companion doc**: PRD.md · **Date**: 2026-08-23
> All line references from `npm run coverage` output (2026-08-23, post-growth-fix baseline).
> **Executor**: Sisyphus (OhMyOpenCode)

---

## 1. Scope & Environment

- **Test runtime**: Node ≥18 built-in `node:test` + `node:assert`. No test frameworks, no mocks libraries.
- **Import rule**: tests import compiled artifacts from `../dist/**/*.js`; `pretest` builds via `tsc`.
- **FS convention**: `mkdtemp(join(tmpdir(), ...))` fixtures, `finally { rm(..., {recursive:true}) }` cleanup — mirrors `tests/memory.test.js`.
- **Artifact signing**: every new file ends with `// Executor: Sisyphus (OhMyOpenCode)` per AGENTS.md.
- **Determinism**: no network, no clock dependence, no ordering between suites.

## 2. Functional Requirements (per module)

Priority = branch-coverage deficit × file size (ROI). Format: `file — current L/B/F — uncovered regions`.

### FR-1 (W1, highest ROI): CLI command handlers

| Req | Module | Current (L/B/F %) | Must cover |
|---|---|---|---|
| FR-1.1 | `cli/lesson.js` | 48.65 / 43.33 / 66.67 | Subcommand dispatch table incl. unknown subcommand exit(1); `record` happy path persisting lesson JSONL (wrongApproach+correctApproach schema); `search` query matching; `outcome` update path (L33–110); listing/formatting branches (L128–180); scan/outcome aggregation branches (L241–246, 264–285); error exits (L295–332) |
| FR-1.2 | `cli/eval.js` | 77.68 / **14.29** / 100 | Every flag-validation failure exit (L21–23, 28–30, 36–38, 48–49); eval-run success path writing report artifact (L65–67); report rendering + summary exit codes (L91–99, 109–110). Branch density here is the single worst in repo — every `if/else` pair needs both sides |
| FR-1.3 | `cli/init.js` | 77.23 / **37.50** / 100 | Fresh-install happy path (hooks written, config scaffolded, L34–36); idempotent re-init branch; `--scaffold` flag branch (L16–18, 21–22); hook-conflict/existing-file skip branches (L77–79); doctor-hint emission on init (L86–97) |
| FR-1.4 | `cli/doctor.js` | 84.62 / **60.00** / 100 | Degraded-environment report branches: missing hook, stale config version, dismissed-hint rendering (L53–55, 67–74); hint reset path (L84–85, 91–92); multi-issue summary formatting (L101–103) |
| FR-1.5 | `cli/hints-emit.js` | 82.02 / **33.33** / **75.00** | Cooldown-window suppression branch vs emit branch (L48–63); function coverage requires invoking each exported emitter entry |
| FR-1.6 | `cli/feedback.js` | 83.54 / 50.00 / **77.78** | tp/fp/fn/tn label dispatch incl. invalid-label exit (L44–49); list rendering with empty store (L109–111); F1 computation display (L122–124); scan-history windowing (L148–163); missing-function coverage = invoke all exported handlers |
| FR-1.7 | `cli/index.js` | 96.27 / 66.67 / **75.00** | Router default/unknown-command exit path (L40–41); meta-command dispatch arms (L128, 131–132); exported-but-uncovered functions exercised directly |
| FR-1.8 | `cli/verify.js` | 94.33 / 76.47 / 87.50 | `--dry-run-dspy` degradation branch (L133–140); remaining flag combos |

### FR-2 (W2): Core memory/feedback engine

| Req | Module | Current (L/B/F %) | Must cover |
|---|---|---|---|
| FR-2.1 | `core/lesson-outcome.js` | 88.89 / **41.27** / 92.00 | Outcome-record parsing edge cases (L239–240, 246–249); scan aggregation with mixed valid/invalid rows (L295, 306–328); outcome→lesson promotion branches (L362–363); window/threshold logic (L382–396, 419–420) |
| FR-2.2 | `core/feedback.js` | 92.27 / 71.79 / 84.21 | Duplicate-feedback dedupe branch (L212–213); malformed-row tolerance (L240–246); F1 boundary math incl. zero-denominator guards (L317–318, 351–358); history-scan cutoffs (L365–374) |
| FR-2.3 | `core/hint-state.js` | 94.81 / 79.31 / 100 | Corrupt-state recovery defaults (L47–48, 59–60); dismissal expiry windows (L65–66, 74–75) |
| FR-2.4 | `core/memory.js` | 96.64 / 85.45 / 100 | Malformed-line skip in memory load (L54–58); retention/window pruning (L242–245) |
| FR-2.5 | `core/engine.js` | 97.28 / 86.96 / 100 | Lifecycle-hook failure isolation branches (L245–248, 282–284); guard-crash → BLOCK mapping (L313–314) |
| FR-2.6 | `federation/dspy-stub.js` | 91.79 / 86.96 / **88.24** | Stub-fallback response shapes (L55–56, 71–79); uncovered exported functions invoked |

### FR-3 (W3): Federation providers & guard residuals

| Req | Module | Current (L/B/F %) | Must cover |
|---|---|---|---|
| FR-3.1 | `federation/file-provider.js` | 95.15 / 88.89 / 100 | Missing-ticket-file fallback (L72–74); parse-error skip (L92–93) |
| FR-3.2 | `federation/http-provider.js` | 97.80 / 92.11 / 100 | Non-200 status branch (L73–74); timeout already covered by FE.01–04 contract tests — verify, extend only if gap remains |
| FR-3.3 | `guards/root-pollution.ts` | 98.68 / 80.00 / 100 | Branch at L30 (path-normalization edge: nested path outside allowed roots) |
| FR-3.4 | `guards/ticket-identity.ts` | 100 / 91.30 / 100 | Remaining TKID format-rejection branches (malformed prefix, wrong length) |

### FR-4 (W4): Gate enforcement

| Req | Requirement |
|---|---|
| FR-4.1 | `scripts/check-coverage.mjs` THRESHOLDS updated `{line:95, branch:95, funcs:95}` in the final commit only (ADR-0002) |
| FR-4.2 | Push to `test/coverage-95-gate` → open PR → all three GitHub Actions jobs green on PR head |
| FR-4.3 | Investigate the 20-second main failure (2026-08-22) via full Actions log; if distinct root cause exists, file finding (out of this scope unless trivial) |

## 3. Non-Functional Requirements

| NFR | Constraint |
|---|---|
| NFR-1 | Full suite wall-time ≤ 15s locally (current ~5.4s; budget headroom for ~90 new subtests) |
| NFR-2 | No `as any` / type suppression anywhere; strict TS clean (`npx tsc --noEmit` = exit 0) |
| NFR-3 | Tests assert observable behavior (persisted JSONL fields, exit codes, emitted output), never implementation internals |
| NFR-4 | Each wave's diff touches only `tests/**` (+ the single W4 script edit); any `src/` touch requires ADR amendment |
| NFR-5 | Zero hollow markers (`TODO`/`TBD`/placeholder) in committed test files — dogfooding our own hollowArtifact guard |

## 4. Validation Procedure (per wave)

```bash
npx tsc --noEmit                 # must exit 0
npm test                         # all pass, none skipped
npm run coverage                 # must stay exit 0 until W4 raises bar
npm run coverage; echo $?        # REAL_EXIT check (no pipe truncation)
```

Wave complete ⇔ all four green + diff review against NFR-4.
