# Adversarial Test Spec — noTypeSafetyBypassGuard

> Source: `src/guards/no-type-safety-bypass.ts`
> Opt-in: `enabled: true` by default
> Config: `severity: "warn" | "block"` (default: `"block"`), `allowlistPaths: string[]` (default: `[]`)
> Scans staged `.ts`, `.tsx` files
> Uses `fs.readFileSync` — **mock `fs` in tests**
> Line-by-line scan for `as any`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`

## Mock audit

The guard uses `fs.readFileSync`. **Mock `fs`** in tests. It scans staged TypeScript files line-by-line for type safety bypass patterns.

## Adversarial scenarios

### Disabled gate
1. `enabled: false` → pass, no findings, early return.

### File filtering
2. Staged file `src/foo.js` (not .ts/.tsx) → skipped.
3. Staged file `tests/foo.ts` → skipped (default allowlist pattern `/\btests?\//`).
4. Staged file `fixtures/foo.ts` → skipped (default allowlist pattern `/\bfixtures\//`).
5. Staged file `src/foo.d.ts` → skipped (default allowlist pattern `/\.d\.ts$/`).
6. Staged file `src/foo.test.ts` → skipped (default allowlist pattern `/\.test\.[jt]sx?$/`).
7. Staged file `src/foo.spec.ts` → skipped (default allowlist pattern `/\.spec\.[jt]sx?$/`).
8. Custom `allowlistPaths: ["src/generated/"]` + `src/generated/api.ts` → skipped (substring match).
9. Custom `allowlistPaths: ["vendor"]` + `src/vendor/lib.ts` → skipped (substring match).

### 'as any' detection
10. `const x: any = foo as any;` → BLOCK finding (line with `as any`).
11. `const y = value as any;` → BLOCK finding.
12. `function foo<T>(t: T): T { return t as any; }` → BLOCK finding.
13. `// const x = foo as any;` (commented) → pass (line starts with `//`).
14. `const msg = "error: as any";` (string literal) → pass (inside quotes).
15. `const regex = /as any/;` (regex literal) → pass (inside quotes).

### '@ts-ignore' detection
16. `// @ts-ignore` → BLOCK finding.
17. `// @ts-ignore: some comment` → BLOCK finding.
18. `// @ts-ignore — TK-123` → BLOCK finding (no ticket escape hatch for @ts-ignore).

### '@ts-nocheck' detection
19. `// @ts-nocheck` (at top of file) → BLOCK finding.
20. `// @ts-nocheck // comment` → BLOCK finding.

### '@ts-expect-error' with ticket escape hatch
21. `// @ts-expect-error — TK-123: reason` → pass (ticket escape hatch matched).
22. `// @ts-expect-error - TK-ABC-456: reason` → pass (dash separator).
23. `// @ts-expect-error: #123 reason` → pass (colon separator, issue number).
24. `// @ts-expect-error — PROJ-789: reason` → pass (project ticket format).

### '@ts-expect-error' without ticket (violation)
25. `// @ts-expect-error` → BLOCK finding (no ticket reference).
26. `// @ts-expect-error some comment` → BLOCK finding (no ticket ID pattern).
27. `// @ts-expect-error TODO: fix later` → BLOCK finding (no ticket ID).

### Severity config
28. `severity: "block"` (default) + `as any` → BLOCK finding.
29. `severity: "warn"` + `as any` → WARN finding, `passed: true`.

### Finding shape & evidence
30. Finding includes `filePath`, `line` (line number), `message` with context.
31. Finding includes `fix` with actionable guidance.
32. Finding includes `evidence: EvidenceLevel.CODE`.
33. `durationMs` is non-negative on every result.

### Line-by-line scanning (sanitized content)
34. Block comments `/* ... */` replaced with spaces/newlines to preserve line numbers.
35. `as any` inside block comment → pass (block comment stripped, but check runs on sanitized content).

### String literal false positive prevention
36. `const s = "foo as any bar";` → pass (string literal check).
37. `const t = \`template \${"as any"}\`;` → pass (template literal check).
38. `const r = /as any/;` → pass (regex literal check).

### Multiple findings per file
39. File with both `as any` and `@ts-ignore` → two separate findings.
40. Multiple `as any` on different lines → multiple findings.

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity`, `findings[i].message` substrings, `findings[i].filePath`, `findings[i].line`, `findings[i].evidence === EvidenceLevel.CODE`.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.
- Mock `fs.readFileSync` for deterministic tests.