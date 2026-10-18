# Adversarial Test Spec — federationGuard

> Source: `src/guards/federation.ts`
> Opt-in: `enabled: false` by default
> Config: `severity: "warn" | "block"` (default: `"block"`), `blockedParentPhases: string[]` (default: `["BLOCKED", "CANCELLED", "ARCHIVED"]`)
> Pure guard: reads `ctx.ticket.parentId`, `ctx.ticket.parentPhase`, `ctx.ticket.authorized` — NO I/O

## Mock audit

The guard is **pure** — no I/O, no network, no file access. Only `performance.now()` for timing. **No mocks needed** — just construct `ctx.ticket` with appropriate values.

## Adversarial scenarios

### Graceful skip (no parent context)
1. `ctx.ticket.parentId === undefined` → pass, no findings (standalone project).
2. `ctx.ticket.parentId === ""` (empty string) → pass, no findings.
3. `ctx.ticket` missing entirely → pass, no findings.

### Authorization check (authorized === false)
4. `authorized: false` + `severity: "block"` → BLOCK finding with parentId, childId, fix suggestion.
5. `authorized: false` + `severity: "warn"` → WARN finding (severity config respected), `passed: true`.
6. `authorized: true` → no finding from this check (passes this check).

### Parent phase in blocked list
7. `parentPhase: "BLOCKED"` (exact default) + `severity: "block"` → BLOCK finding.
8. `parentPhase: "blocked"` (lowercase) → BLOCK finding (case-insensitive match via `toUpperCase()`).
9. `parentPhase: "CANCELLED"` → BLOCK finding.
10. `parentPhase: "ARCHIVED"` → BLOCK finding.
11. `parentPhase: "Planning"` (active phase) → pass this check.
12. `parentPhase: "EXECUTING"` (active phase) → pass this check.
13. Custom `blockedParentPhases: ["ON_HOLD"]` + `parentPhase: "ON_HOLD"` → BLOCK finding (custom phases work).

### Parent phase unresolved
14. `parentId: "PARENT-123"` + `parentPhase: undefined` + `authorized: undefined` → WARN finding "Could not resolve parent ticket", `evidence: INFER`, `passed: true` (always WARN, never BLOCK).
15. `parentId: "PARENT-123"` + `parentPhase: undefined` + `authorized: true` → no finding (authorized true bypasses phase resolution warning).
16. `parentId: "PARENT-123"` + `parentPhase: undefined` + `authorized: false` → BLOCK from authorization check (takes precedence).

### Combined findings
17. `authorized: false` AND `parentPhase: "BLOCKED"` → two findings (both BLOCK if severity=block).
18. `authorized: true` AND `parentPhase: "BLOCKED"` → one BLOCK finding (phase block).

### Severity config
19. `severity: "warn"` + blocked phase → WARN finding, `passed: true` (warn severity never blocks).
20. `severity: "block"` (default) + blocked phase → BLOCK finding, `passed: false`.

### Finding shape & evidence
21. BLOCK/WARN findings include `message` with parentId, childId, phase.
22. BLOCK/WARN findings include `fix` with actionable suggestion.
23. Unresolved phase finding has `evidence: EvidenceLevel.INFER`.
24. Authorization/phase findings have `evidence: EvidenceLevel.RUNTIME`.
25. `durationMs` is non-negative on every result.

### Edge: blockedPhases normalization
26. `blockedPhases: ["  BLOCKED  "]` (whitespace) → fails to match (no trimming in code).
27. `blockedPhases: []` (empty) → no phases blocked, pass.

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity`, `findings[i].message` substrings (parentId, childId, phase).
- `passed` is `true` when `severity: "warn"` regardless of findings (warn never blocks).
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.