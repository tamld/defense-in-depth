# Adversarial Test Spec — ticketIdentityGuard

> Source: `src/guards/ticket-identity.ts`
> Opt-in: `enabled: false` by default
> Config: `tkidPattern: string` (default: `"TK-[0-9A-Z-]+"`), `severity: "warn" | "block"` (default: `"warn"`)
> Pure guard: reads `ctx.ticket?.id`, `ctx.commitMessage`, `ctx.ticket.phase`
> Graceful skip when `ctx.ticket?.id` undefined

## Mock audit

The guard is **pure** — no I/O, only reads context fields. **No mocks needed** — just set `ctx.ticket`, `ctx.commitMessage`, and optionally `ctx.config.guards.ticketIdentity`.

## Adversarial scenarios

### Disabled gate / graceful skip
1. `ctx.ticket: undefined` → pass (standalone project, early return).
2. `ctx.ticket: { id: "TK-123" }` but `ctx.commitMessage: undefined` → pass (no commit message to validate, early return).
3. `enabled: false` not a config field (guard is opt-in by default via `ctx.ticket` presence).

### Non-contradiction check: matching ticket
4. `ticket.id: "TK-123"`, `commitMessage: "Fix bug TK-123"` → pass (same ticket).
5. `ticket.id: "TK-123"`, `commitMessage: "TK-123: Fix bug"` → pass (same ticket).
6. `ticket.id: "TK-123"`, `commitMessage: "Refactor (TK-123)"` → pass (same ticket, case-insensitive).
7. `ticket.id: "tk-123"`, `commitMessage: "TK-123 fix"` → pass (case-insensitive comparison).

### Non-contradiction check: foreign ticket
8. `ticket.id: "TK-123"`, `commitMessage: "Fix TK-456"` → BLOCK/WARN finding (foreign ticket TK-456).
9. `ticket.id: "TK-123"`, `commitMessage: "TK-123 and TK-456"` → BLOCK/WARN finding (foreign ticket TK-456).
10. `ticket.id: "TK-123"`, `commitMessage: "Related to PROJ-789"` → BLOCK/WARN finding (foreign ticket PROJ-789, matches default pattern).
11. `ticket.id: "TK-123"`, `commitMessage: "See #123"` → BLOCK/WARN finding if pattern matches `#123` (default pattern doesn't, but custom might).

### Multiple foreign tickets
12. `ticket.id: "TK-123"`, `commitMessage: "TK-456 TK-789"` → BLOCK/WARN finding with both tickets in message.

### Custom tkidPattern
13. Config `tkidPattern: "PROJ-[0-9]+"`, `ticket.id: "PROJ-1"`, `commitMessage: "PROJ-2"` → BLOCK/WARN (custom pattern).
14. Config `tkidPattern: "TK-[0-9A-Z-]+"`, `ticket.id: "TK-123"`, `commitMessage: "JIRA-456"` → pass (JIRA-456 doesn't match pattern).

### Severity config
15. `severity: "warn"` (default) + foreign ticket → WARN finding, `passed: true`.
16. `severity: "block"` + foreign ticket → BLOCK finding, `passed: false`.
17. `severity: "warn"` + no foreign ticket → pass.

### Phase-aware validation
18. `ticket: { id: "TK-123", phase: "DONE" }`, `commitMessage: "TK-123"` → WARN/BLOCK finding (terminal phase).
19. `ticket: { id: "TK-123", phase: "CLOSED" }`, `commitMessage: "TK-123"` → WARN/BLOCK finding.
20. `ticket: { id: "TK-123", phase: "ARCHIVED" }`, `commitMessage: "TK-123"` → WARN/BLOCK finding.
21. `ticket: { id: "TK-123", phase: "IN_PROGRESS" }`, `commitMessage: "TK-123"` → pass (non-terminal phase).
22. `ticket: { id: "TK-123", phase: "done" }` (lowercase) → WARN/BLOCK finding (case-insensitive phase check).
23. `ticket: { id: "TK-123" }` (no phase) → pass (no phase check).

### Combined: foreign ticket + terminal phase
24. `ticket: { id: "TK-123", phase: "DONE" }`, `commitMessage: "TK-456"` → two findings (foreign ticket + terminal phase).

### Finding shape
25. Foreign ticket finding: includes `message` with foreign ticket IDs and branch ticket ID.
26. Foreign ticket finding: includes `fix` with guidance.
27. Terminal phase finding: includes `message` with ticket ID and phase.
28. Terminal phase finding: includes `fix` with guidance.
29. `durationMs` is non-negative on every result.

### Passed logic
30. `severity: "warn"` → `passed: true` always (warn never blocks).
31. `severity: "block"` + no findings → `passed: true`.
32. `severity: "block"` + findings → `passed: false`.

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity`, `findings[i].message` substrings (foreign tickets, terminal phase).
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.