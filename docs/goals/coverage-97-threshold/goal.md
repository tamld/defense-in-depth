# Goal Charter: Restore 97% Test Coverage Threshold (Issue #135)

## Original Request
> "duyệt, em làm đi" — proceed with writing test coverage for 6 untested modules to restore 97% threshold.

## Interpreted Outcome
All 6 untested Track B/CLI modules have comprehensive unit + integration test suites. `npm run coverage` passes all thresholds: line ≥ 97%, funcs ≥ 97%, branch ≥ 91%.

## Input Shape
`existing_plan` — Issue #135 defines exact modules and coverage gaps. See `docs/goals/coverage-97-threshold/notes/coverage-gaps.md` for facts.

## Audience / Beneficiary
- **Primary**: tamld (maintainer) — needs coverage gate passing for CI/CD
- **Secondary**: CI pipeline — gate must pass for releases

## Non-Goals & Hard Constraints
- ❌ No new feature implementation
- ❌ No changes to production code (except test files)
- ✅ All tests in `tests/` directory
- ✅ Must pass existing 832 tests + new tests
- ✅ Coverage gate: line 97%, funcs 97%, branch 91%

## Authority
`approved` — Issue #135 explicitly assigned to main agent.

## Proof Type
`test + metric` — Coverage report shows thresholds met.

## Completion Proof (Goal Oracle)
**All must be true:**
1. `npm run coverage` → line ≥ 97%, funcs ≥ 97%, branch ≥ 91%
2. All 832 existing tests still pass
3. New tests added for each untested module:
   - `src/cli/audit.ts`
   - `src/cli/lesson/dedup.ts`
   - `src/cli/metrics.ts`
   - `src/core/dedup.ts`
   - `src/core/injection.ts`
   - `src/core/metagrowth.ts`
4. No regression in any existing test

## Likely Misfire
Writing tests that only cover happy paths → coverage % increases but edge cases untested → false confidence.

## Blind Spots
1. **Module interdependencies**: Some modules may need mocking of shared dependencies
2. **DSPy graceful degradation**: `injection.ts` and `metagrowth.ts` have DSPy paths that need mocking
3. **File system operations**: `audit.ts` does git/fs operations — need temp dir fixtures
4. **Pre-existing flaky test**: `no-execsync-regression.test.js` on `audit.ts` — ensure our tests don't conflict

## Existing Plan Facts (from Issue #135)
| Module | Current Line | Current Func | Target |
|--------|-------------|-------------|--------|
| `src/cli/audit.ts` | 10.00% | 0.00% | 97% |
| `src/cli/lesson/dedup.ts` | 2.59% | 0.00% | 97% |
| `src/cli/metrics.ts` | 7.04% | 0.00% | 97% |
| `src/core/dedup.ts` | 22.62% | 0.00% | 97% |
| `src/core/injection.ts` | 34.42% | 46.67% | 97% |
| `src/core/metagrowth.ts` | 19.05% | 0.00% | 97% |

## Tranche Definition
This tranche = **Test Coverage Restoration Only**. No feature work.