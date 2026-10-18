# Adversarial Test Spec — hitlReviewGuard

> Source: `src/guards/hitl-review.ts`
> Opt-in: `enabled: false` by default
> Config: `protectedBranches: string[]` (default: `["main", "master"]`)
> Reads `ctx.branch` — no I/O, pure guard

## Mock audit

The guard is **pure** — no I/O, only reads `ctx.branch`. **No mocks needed** — just set `ctx.branch` appropriately.

## Adversarial scenarios

### Disabled gate
1. `enabled: false` (default) → pass, no findings, early return.
2. `enabled: true` + `ctx.branch: undefined` → pass, no findings (early return, can't determine branch).

### Protected branch match
3. `branch: "main"` (default protected) → BLOCK finding with message, fix suggestion.
4. `branch: "master"` (default protected) → BLOCK finding.
5. `branch: "MAIN"` (uppercase) → pass (Set lookup is case-sensitive, `includes` exact match).
6. `branch: "main-feature"` → pass (exact match only, not prefix).
7. `branch: "release/main"` → pass (not exact match).

### Custom protected branches
8. `protectedBranches: ["production", "release"]` + `branch: "production"` → BLOCK finding.
9. `protectedBranches: ["production"]` + `branch: "main"` → pass (not in custom list).
10. `protectedBranches: []` (empty) → pass for all branches.

### Finding shape & evidence
11. BLOCK finding includes `message` with protected branch name.
12. BLOCK finding includes `fix` with `git checkout -b` suggestion.
13. `durationMs` is non-negative on every result.

### Edge: branch = HEAD (detached)
14. `branch: "HEAD"` → pass (not in default protected list).

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[0].severity === Severity.BLOCK`, `findings[0].message` substrings (branch name), `findings[0].fix` substrings.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.