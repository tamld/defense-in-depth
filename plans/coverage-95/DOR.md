# DoR — Coverage Gate 95% Initiative

> Definition of Ready — conditions that must hold BEFORE wave execution starts.
> An item unchecked = initiative not ready; do not start W1.
> **Executor**: Sisyphus (OhMyOpenCode)

---

## Planning Artifacts

- [x] Baseline measured with tool output, not estimated: 91.38 / 81.37 / 93.28 (post-growth-fix, local run)
- [x] Per-file gap audit completed with exact uncovered-line ranges (SRS §2 tables)
- [x] Gap math quantified: line +3.62pp, branch +13.63pp (binding), funcs +1.72pp
- [x] SRS, PRD, ADR, DoD, DoR drafted and stored in `plans/coverage-95/`

## Decisions (sponsor sign-off required — blocking)

- [ ] **D1**: Scope = aggregate 95/95/95 gate (recommended) vs strict per-file floors
- [ ] **D2**: Sequencing = tests-first, threshold-bump-last (recommended) vs bump-first
- [ ] **D3**: Branch name `test/coverage-95-gate` approved; branched from latest `main`
- [ ] **D4**: Dead-code policy = report findings, never fabricate tests (recommended)

## Working State

- [ ] W0 commit (existing validated `tests/growth-cli.test.js`, 514/514 + coverage exit 0) either committed to current branch or included as first commit on `test/coverage-95-gate` — must not be lost
- [ ] Latest `main` pulled; known remote state: latest Actions run RED (2026-08-22, 20s duration) — full failure log read before W4 claims victory
- [ ] Version-drift fix (package.json `0.7.0-rc.1` vs README `v1.0.0-rc.1`) explicitly OUT of this scope, tracked separately so it isn't forgotten

## Environment

- [ ] Node ≥18 active locally; `pretest` build verified working (`dist/` fresh)
- [ ] Test conventions confirmed against newest merged suite (import-from-dist, mkdtemp tmpdir, Executor signature)
- [ ] Time-box agreed: waves are sequential commits; W1 may split across sessions — each session ends with a green, committed state (never leave broken tree)

---

**Ready ⇔ all four sections checked.** Then W1 starts immediately per SRS FR-1 ordering (lesson.js and eval.js first — largest branch deficits).
