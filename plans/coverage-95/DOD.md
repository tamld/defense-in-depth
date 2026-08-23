# DoD — Coverage Gate 95% Initiative

> Definition of Done — the initiative is DONE only when every box below is checked
> with tool-output evidence from the final validation run. "Should pass" ≠ done.
> **Executor**: Sisyphus (OhMyOpenCode)

---

## Coverage Gate (the core deliverable)

- [ ] `npm run coverage` exits **0** with THRESHOLDS `{line:95, branch:95, funcs:95}` in `scripts/check-coverage.mjs`
- [ ] Final measured numbers recorded in this file: line ____% · branch ____% · funcs ____%
- [ ] Branch ≥95 achieved through real behavioral tests — cross-checked against SRS FR tables, not padding
- [ ] Exceptions table (files <85%, per ADR-0002 soft target) documented in ADR.md if any remain

## Test Suite Integrity

- [ ] `npm test` fully green: zero failures, **zero skipped**, **zero deleted** existing tests
- [ ] New test count reported (baseline 514 → final ____)
- [ ] Every new test asserts observable behavior: persisted JSONL/JSON fields, exit codes, emitted stdout/stderr — no internal-state poking (NFR-3)
- [ ] No new dependency added to package.json (`node:test` + stdlib only)

## Source Discipline

- [ ] `git diff main..test/coverage-95-gate -- src/` shows **zero changes** (NFR-4 / ADR-0004)
- [ ] Any dead-code findings logged in ADR.md Findings Log with `[CODE]` file:line tags
- [ ] Single exception allowed: W4's one-line threshold edit in `scripts/check-coverage.mjs`

## Static & Build Hygiene

- [ ] `npx tsc --noEmit` exit 0 (strict mode clean)
- [ ] Zero hollow markers in new files (`grep -rE 'TODO|TBD|PLACEHOLDER' tests/ plans/coverage-95/` → empty) — we must pass our own hollowArtifact guard
- [ ] Every new/modified artifact signed `// Executor: ...`

## Process & HITL

- [ ] Commit sequence matches ADR-0005 plan; each commit independently passes tsc + test + coverage
- [ ] Conventional commits used throughout (`test(...)`, single `chore(coverage)` bump)
- [ ] PR opened from `test/coverage-95-gate` → `main`; description links this directory and summarizes wave-by-wave deltas

## CI Proof (credibility restoration)

- [ ] All three GitHub Actions jobs green on PR head: test matrix (ubuntu/macos/windows × Node 18/20/22/24), lint, coverage
- [ ] The 2026-08-22 main failure root cause identified via full Actions log; either resolved by this work or filed as a separate finding with evidence
- [ ] Post-merge verification requested: main branch shows consecutive green runs

## Handoff

- [ ] Final report to sponsor includes: before/after table, waves completed, findings log, any D-decision deviations (with justification)
- [ ] `plans/coverage-95/DOD.md` itself filled in as the completion receipt
