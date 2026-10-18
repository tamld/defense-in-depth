# Goal: Resolve 4 Open Issues (2026-09-18)

## Outcome
All 4 GitHub issues resolved, verified, and CI passing. v1.0.0 GA ready.

## Issues in Priority Order
1. **#143 (CRITICAL)**: README severity drift vs implementation — blocks GA
2. **#144 (HIGH)**: 12/17 guards missing adversarial fixtures (edge_cases.md)
3. **#145 (HIGH)**: Red-team bypass matrix for 4 highest-risk guards
4. **#146 (STRATEGIC)**: Roadmap proposal — Tier A/B/non-goals (document only)

## Success Criteria
- [ ] #143: README.md severity matches guard implementations (BLOCK/WARN consistent)
- [ ] #143: Guard interface contract updated to match implementation
- [ ] #144: All 17 guards have `tests/fixtures/<guard>/edge_cases.md`
- [ ] #145: Bypass matrix documented for hollow-artifact, secret-detection, commit-format, branch-naming
- [ ] #146: Roadmap proposal accepted as-is (no code changes needed)
- [ ] All CI gates pass: tests 1037+, coverage line≥97% branch≥90% funcs≥95%, lint clean

## Constraints
- Local gates MUST pass before push
- Each fix verified with `pnpm test && pnpm run coverage && pnpm run lint`
- Evidence tags on all claims: [RUNTIME] / [CODE] / [HYPO]
- No implementation without active Worker task with allowed_files
- One write-capable Worker at a time

## Authority
User (tamld) owns outcome. Agent executes with full implementation authority within scope.