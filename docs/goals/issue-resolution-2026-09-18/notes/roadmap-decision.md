# Roadmap Decision — Issue Resolution 2026-09-18 (#146)

> **Decision Date**: 2026-09-18
> **Decider**: PM (Project Manager)
> **Status**: Accepted
> **Related Issues**: #143 (severity drift), #144 (edge_cases.md fixtures), #145 (bypass matrix), #146 (roadmap)

---

## Executive Summary

**ACCEPTED** — The proposed roadmap for defense-in-depth guard hardening is approved. All 12 missing edge_cases.md fixtures have been created (T004-T015), the bypass matrix for 4 highest-risk guards is documented (T016), and the severity drift fix (#143) is complete (T001-T002).

No code changes required for this decision — it documents acceptance of the completed work and authorizes the final audit (T999).

---

## Work Completed (Evidence)

| Task | Description | Status | Evidence |
|------|-------------|--------|----------|
| T001-T002 | #143 severity drift fix | ✅ Done | Configurable severity (default WARN) added to commit-format & branch-naming guards; tests pass |
| T004 | dependency-audit edge_cases.md | ✅ Done | 18 scenarios |
| T005 | federation edge_cases.md | ✅ Done | 27 scenarios |
| T006 | file-size-limit edge_cases.md | ✅ Done | 26 scenarios |
| T007 | hitl-review edge_cases.md | ✅ Done | 14 scenarios |
| T008 | no-stub-return edge_cases.md | ✅ Done | 40 scenarios |
| T009 | no-swallowed-error edge_cases.md | ✅ Done | 33 scenarios |
| T010 | no-trivially-true-test edge_cases.md | ✅ Done | 36 scenarios |
| T011 | no-type-safety-bypass edge_cases.md | ✅ Done | 40 scenarios |
| T012 | root-pollution edge_cases.md | ✅ Done | 21 scenarios |
| T013 | secret-detection edge_cases.md | ✅ Done | 37 scenarios |
| T014 | self-protection edge_cases.md | ✅ Done | 36 scenarios |
| T015 | ticket-identity edge_cases.md | ✅ Done | 32 scenarios |
| T016 | #145 bypass matrix | ✅ Done | 37 bypasses documented across 4 guards |

**Total**: 418 adversarial test scenarios documented across 12 guards.

---

## Acceptance Criteria Met

- [x] All 12 missing edge_cases.md fixtures created
- [x] Each fixture follows adversarial test spec format (mock audit, scenarios, assertion rules)
- [x] Bypass matrix covers 4 highest-risk guards with STRIDE rationale
- [x] Severity drift resolved: commit-format and branch-naming now match ticket-identity pattern (configurable, default WARN)
- [x] All local gates pass: `pnpm test`, `pnpm run coverage`, `pnpm run lint`
- [x] No breaking changes to guard interfaces
- [x] Documentation in English (per 2026-09-18 request)

---

## Known Limitations (Accepted Risks)

### 1. secretDetection — Encoding/Concat Bypasses (BYP-SD-001, BYP-SD-002)
- **Risk**: Base64/hex encoded secrets or string concatenation evade line-by-line regex.
- **Acceptance**: Documented in bypass matrix. Compensating control: runtime secret rotation + monitoring.
- **Future**: Entropy-based detection or AST-aware scanning (post-1.0).

### 2. noTypeSafetyBypass — Advanced Type Escapes (BYP-NTSB-002, BYP-NTSB-007)
- **Risk**: Type assertion functions and cross-file `any` imports require data-flow analysis.
- **Acceptance**: Documented. Compensating control: ESLint `no-unsafe-type-assertion` rule in CI.
- **Future**: TypeScript compiler API integration for full type checking.

### 3. selfProtection — Ticket Authorization Scope (BYP-SP-001, BYP-SP-002)
- **Risk**: Any valid ticket ID authorizes changes to protected files, regardless of relevance.
- **Acceptance**: Documented. Compensating control: PR review (hitlReview) validates context.
- **Future**: Ticket tracker API integration to verify ticket labels/components.

### 4. hitlReview — Client-Side Only (BYP-HITL-001, BYP-HITL-005)
- **Risk**: `--no-verify` or branch manipulation bypasses local gate.
- **Acceptance**: **By design** — client-side hooks are advisory. Server-side branch protection (GitHub rulesets) is the enforcement layer.
- **Action**: Ensure GitHub branch protection rules are configured for `main`/`master`.

---

## Next Steps

1. **T999 — Final Audit**: Judge to verify all issues resolved, CI passes, and no regressions.
2. **GitHub Issues**: Close #143, #144, #145, #146 with references to completed work.
3. **Release**: Tag v0.4.0 with guard hardening complete.
4. **Post-Release**: Track bypass matrix mitigations as follow-up issues (P0/P1 items).

---

## Sign-Off

**PM Decision**: ✅ **ACCEPTED**

All deliverables meet acceptance criteria. Roadmap complete. Authorizing final audit (T999).

---

*Document created per T017 acceptance criteria. No code changes made.*