# Adversarial Test Spec — dependencyAuditGuard

> Source: `src/guards/dependency-audit.ts`
> Opt-in: `enabled: false` by default
> Config: `severity: "warn" | "block"` (default: `"warn"`)
> Executor injection: `createDependencyAuditGuard({ executor })`

## Mock audit

The guard uses `execFileSync("npm", ["audit", "--json"])`. **Mock the executor** via `createDependencyAuditGuard({ executor })` for deterministic tests. Do NOT call real npm in unit tests.

## Adversarial scenarios

### Opt-in gate
1. `enabled: false` (default) → pass, no findings, early return.
2. `enabled: true` + no package.json → pass, no findings.
3. `enabled: true` + package.json exists but no lockfile touched in staged files → pass, no findings (only runs when package files change).

### npm audit execution
4. `npm audit --json` fails with non-zero exit code but outputs JSON to stdout (vulnerabilities found) → guard parses stdout, reports findings.
5. `npm audit --json` fails with non-zero and NO stdout (network error, timeout) → guard catches error, emits WARN finding "Dependency audit skipped", passes overall.
6. `npm audit --json` succeeds (exit 0) → no vulnerabilities, pass.

### Parsing vulnerabilities (metadata.vulnerabilities)
7. `critical: 2, high: 1` + `severity: "block"` → BLOCK finding with "2 critical, 1 high severity" message.
8. `critical: 0, high: 1` + `severity: "warn"` → WARN finding (severity config respected).
9. `critical: 0, high: 0, moderate: 3` → WARN finding "3 moderate" (always WARN regardless of config).
10. `critical: 0, high: 0, moderate: 0` → pass, no findings.

### Malformed / edge JSON
11. stdout doesn't start with `{` (e.g., npm warning text) → pass, no findings (guard silently skips).
12. JSON parse error → WARN finding "Failed to parse audit results", passes overall.

### Finding shape & evidence
13. BLOCK findings include `filePath: "package.json"`, `evidence: EvidenceLevel.RUNTIME`, and `fix` with "npm audit fix" suggestion.
14. WARN findings include same fields.
15. `durationMs` is non-negative on every result.

### Severity config
16. `severity: "block"` (default for critical/high) → BLOCK.
17. `severity: "warn"` (configurable) → WARN for critical/high.

### Executor injection (testability)
18. Custom executor returning mock JSON with `critical: 1` → guard processes mock data identically to real npm output.

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[0].severity`, `findings[0].message` substrings, `findings[0].filePath === "package.json"`.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.
- Use injected executor for all tests — never call real `npm audit`.