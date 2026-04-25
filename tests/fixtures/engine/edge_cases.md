# Adversarial Test Spec — DefendEngine

> Source: `src/core/engine.ts`
> Pre-PR coverage: line 78%, **branch 53%**, funcs 85%.
> Target: branch ≥90%.

## Mock audit

The engine touches:
- `loadConfig()` — bypassed by passing an explicit config to the constructor.
- `createProvider()` (federation) — bypassed by registering NO guards that need a provider, OR by mocking `globalThis.fetch` (existing pattern in `engine-federation.test.js`).
- `callDspy()` — exercised by setting `hollowArtifact.useDspy = true` and pointing `dspyEndpoint` at a sink the test controls (or a non-existent URL — DSPy client must degrade gracefully on network error).
- `fs.existsSync` / `fs.readFileSync` — exercised via real temp dirs, same pattern as `phase-gate.test.js`.
- `console.warn` — silenced per-test where it would clutter output.

## Adversarial scenarios

### `useAll` and registration ordering
1. `engine.useAll([g1, g2, g3])` — all three registered, executed in order.
2. `engine.use(g1).use(g2)` — chained `use` returns same engine instance.
3. Empty pipeline (`engine.run([])` with no guards) — verdict has 0 totalGuards, passed=true.

### `extractTicketRef` matrix
4. `branch="feat/TK-123-foo"` → ticket.id="TK-123" (uppercased), type="feat".
5. `branch="bugfix/TK-abc"` → ticket.id="TK-ABC", type undefined (prefix not in feat/fix/chore/docs/refactor).
6. `commitMessage="fix: addresses TK-456"` (no branch) → ticket.id="TK-456".
7. Branch precedence over commit message — when both contain a different TK-ID, branch wins.
8. Project root dir name fallback — `/tmp/TK-999/repo` does NOT match (basename is "repo"), but `/tmp/proj-TK-999` does.
9. No source for ID anywhere → ticket undefined.

### Guard crash handler
10. Guard `check()` throws synchronously → engine pushes a BLOCK finding "Guard crashed: …" with the error message; pipeline continues.
11. Guard `check()` rejects async → same handling.
12. Guard throws a non-Error object (e.g. a string) → engine stringifies it.
13. After a guard crash, subsequent guards still run (no short-circuit).

### Provider failure (enrichTicketRef)
14. `ticketIdentity.enabled=true` + `provider.resolve` throws → engine logs warning, returns basicRef untouched, pipeline still runs.
15. Provider hangs longer than `providerConfig.timeout` → timeout error logged, pipeline still runs.
16. `ticketIdentity.enabled=false` → provider never instantiated, ticket = basicRef.

### Parent provider failure (enrichParentTicket)
17. Child ticket has `parentId` + federation enabled + parent provider throws → parentPhase/authorized stay undefined, no crash.
18. Child has no `parentId` → enrichParentTicket short-circuits.
19. Federation disabled → enrichParentTicket short-circuits.

### Disabled / unknown guards
20. `config.guards.<id>.enabled=false` → guard is skipped (not present in results).
21. Config has no entry for a registered guard's id → guard runs (default-on).

### Verdict aggregation
22. Mix of pass/warn/block guards → `passedGuards`, `failedGuards`, `warnedGuards` counts are exact.
23. `warnedGuards` only counts guards that `passed=true` AND have at least one WARN finding.
24. `durationMs` is non-negative.

### Semantic evaluations (DSPy)
25. `hollowArtifact.useDspy=true` + `globalThis.fetch` returns 200 with body `{score, feedback}` → `ctx.semanticEvals.dspy[file]` populated.
26. DSPy fetch throws / returns non-200 → entry is `null` (degraded).
27. File extension not in semantic set → skipped.

## Assertion rules

- Behavioral; no snapshots, no `durationMs` exact-match.
- Silence `console.warn` per test (`const orig = console.warn; console.warn = () => {};`) and restore in `afterEach`.
- Every test that mocks `globalThis.fetch` must restore the original in `after()`.
- No external network. Tests must pass offline.
