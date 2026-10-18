# Adversarial Test Spec — selfProtectionGuard

> Source: `src/guards/self-protection.ts`
> Opt-in: `enabled: true` by default
> Config: `severity: "warn" | "block"` (default: `"block"`), `protectedPaths: string[]` (default: `["scripts/check-coverage.mjs", ".gitleaks.toml", "tsconfig.json", ".github/workflows/"]`)
> Pure guard: no I/O, checks `ctx.stagedFiles`, `ctx.ticket?.id`, `ctx.commitMessage`, `ctx.branch`, `process.env.TICKET_ID`
> Uses ticket regex: `/(TK-[0-9A-Z-]+|[A-Z]+-[0-9]+|#\d+)/i`

## Mock audit

The guard is **pure** — no I/O, only reads context fields. **No mocks needed** — just set `ctx.stagedFiles`, `ctx.ticket`, `ctx.commitMessage`, `ctx.branch`, and optionally `process.env.TICKET_ID`.

## Adversarial scenarios

### Disabled gate
1. `enabled: false` → pass, no findings, early return.

### Protected file detection
2. `stagedFiles: ["scripts/check-coverage.mjs"]` → BLOCK finding (exact match).
3. `stagedFiles: ["src/scripts/check-coverage.mjs"]` → BLOCK finding (ends with `/scripts/check-coverage.mjs`).
4. `stagedFiles: [".gitleaks.toml"]` → BLOCK finding.
5. `stagedFiles: ["tsconfig.json"]` → BLOCK finding.
6. `stagedFiles: [".github/workflows/ci.yml"]` → BLOCK finding (prefix match on `.github/workflows/`).
7. `stagedFiles: [".github/workflows/"]` → BLOCK finding (exact directory match).
8. `stagedFiles: ["src/foo.ts"]` → pass (not protected).
9. `stagedFiles: [".github/other/file.yml"]` → pass (not under `.github/workflows/`).

### Custom protected paths
10. Config `protectedPaths: ["custom/config.yaml"]` + `stagedFiles: ["custom/config.yaml"]` → BLOCK.
11. Config `protectedPaths: ["custom/"]` + `stagedFiles: ["custom/file.txt"]` → BLOCK (prefix match).
12. Config `protectedPaths: ["custom/"]` + `stagedFiles: ["other/custom/file.txt"]` → BLOCK (contains pattern).

### Ticket context from commit message
13. `commitMessage: "Fix issue TK-123"` + protected file → pass (ticket in commit message).
14. `commitMessage: "Fix #456"` + protected file → pass (issue number in commit message).
15. `commitMessage: "feat/awesome-feature"` (no ticket) + protected file → BLOCK.

### Ticket context from branch name
16. `branch: "feat/TK-789"` + protected file → pass (ticket in branch).
17. `branch: "fix/#123"` + protected file → pass (issue number in branch).
18. `branch: "feat/my-feature"` (no ticket) + protected file → BLOCK.
19. `branch: "chore/update"` (conventional prefix but no ticket) + protected file → BLOCK (regex only matches ticket IDs, not just prefixes).
20. `branch: "refactor/TK-ABC-123"` + protected file → pass.

### Ticket context from ctx.ticket
21. `ctx.ticket: { id: "TK-999" }` + protected file → pass.
22. `ctx.ticket: { id: "PROJ-456" }` + protected file → pass.

### Ticket context from env var
23. `process.env.TICKET_ID = "TK-ENV-123"` + protected file → pass.

### Multiple ticket sources (any one works)
24. `commitMessage: "TK-111"` + `branch: "fix/TK-222"` + protected file → pass (first match wins).

### Severity config
25. `severity: "block"` (default) + protected file without ticket → BLOCK finding.
26. `severity: "warn"` + protected file without ticket → WARN finding, `passed: true`.

### Finding shape & evidence
27. Finding includes `filePath` = staged relative path.
28. Finding includes `message` with self-protection violation and file name.
29. Finding includes `fix` with guidance to include ticket ID in commit message.
30. Finding uses `evidence: EvidenceLevel.CODE`.
31. `durationMs` is non-negative on every result.

### Path normalization
32. Windows paths `stagedFiles: ["scripts\\check-coverage.mjs"]` → BLOCK (normalized to forward slashes).

### Non-protected files under protected directory prefix
33. `stagedFiles: [".github/workflows/ci.yml"]` → BLOCK (prefix match).
34. `stagedFiles: [".github/workflows/lint.yml"]` → BLOCK (prefix match).
35. `stagedFiles: [".github/workflows/"]` → BLOCK (exact directory).

### Protected paths with no trailing slash
36. Default `scripts/check-coverage.mjs` matches both exact and `src/scripts/check-coverage.mjs`.

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity`, `findings[i].message` substrings, `findings[i].filePath`, `findings[i].evidence === EvidenceLevel.CODE`.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.