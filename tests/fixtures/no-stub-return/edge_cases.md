# Adversarial Test Spec — noStubReturnGuard

> Source: `src/guards/no-stub-return.ts`
> Opt-in: `enabled: true` by default (no config disables it)
> Config: `severity: "warn" | "block"` (default: `"block"`), `allowlistPaths: string[]` (default: `[]`)
> Scans staged `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs` files
> Uses `fs.readFileSync` — **mock `fs` in tests**
> Regex-based AST-lite detection (function blocks + arrow functions)

## Mock audit

The guard uses `fs.readFileSync`. **Mock `fs`** in tests. It scans staged files for function/method bodies and arrow functions returning stub values.

## Adversarial scenarios

### Disabled gate
1. `enabled: false` → pass, no findings, early return.

### File filtering
2. Staged file `src/foo.py` (non-JS/TS) → skipped (extension filter).
3. Staged file `tests/foo.test.ts` → skipped (default allowlist pattern `/\btests?\//`).
4. Staged file `fixtures/foo.ts` → skipped (default allowlist pattern `/\bfixtures\//`).
5. Staged file `src/foo.d.ts` → skipped (default allowlist pattern `/\.d\.ts$/`).
6. Staged file `src/foo.spec.ts` → skipped (default allowlist pattern `/\.spec\.[jt]sx?$/`).
7. Custom `allowlistPaths: ["src/generated/"]` + `src/generated/api.ts` → skipped (substring match).
8. Custom `allowlistPaths: ["vendor"]` + `src/vendor/lib.ts` → skipped (substring match).
9. Custom `allowlistPaths: ["/generated/"]` + `src/generated/api.ts` → skipped (RegExp match).

### Stub return patterns (function/method blocks)
10. `function foo() { return null; }` → BLOCK finding (line number, `codeWithoutComments` = `return null`).
11. `function bar() { return undefined; }` → BLOCK finding.
12. `function baz() { return {}; }` → BLOCK finding.
13. `function qux() { return []; }` → BLOCK finding.
14. `function withCast() { return null as any; }` → BLOCK finding (regex allows optional `as any`).
15. `function throwNotImpl() { throw new Error('Not implemented'); }` → BLOCK finding.
16. `function throwTodo() { throw new Error('TODO'); }` → BLOCK finding.
17. `function throwTbd() { throw new Error('TBD'); }` → BLOCK finding.
18. `function throwPlaceholder() { throw new Error('Placeholder'); }` → BLOCK finding.
19. `function throwStub() { throw new Error('Stub'); }` → BLOCK finding.

### Arrow function stubs
20. `const foo = () => null;` → BLOCK finding (arrow regex matches).
21. `const bar = () => undefined;` → BLOCK finding.
22. `const baz = () => ({});` → BLOCK finding (empty object).
23. `const qux = () => [];` → BLOCK finding (empty array).
24. `let fn = () => null;` → BLOCK finding (arrow regex matches `let ` pattern).
25. `var fn = () => [];` → BLOCK finding.

### Ticket escape hatch
25. `function foo() { // TK-123 return null; }` → pass (TICKET_PATTERN in body skips).
26. `function bar() { return null; // TK-ABC-456 }` → pass (ticket in fullMatch).
27. `const fn = () => null; // TK-789` → pass (ticket in line).

### Comment stripping
28. `function foo() { // comment\n  return null; }` → BLOCK (comment stripped, `return null` remains).
29. `function bar() { /* block comment */ return null; }` → BLOCK (block comment stripped).

### Multi-statement bodies (should pass)
30. `function foo() { const x = 1; return x; }` → pass (not a stub pattern, multiple statements).
31. `function bar() { if (true) return 1; return 0; }` → pass (complex body).

### Severity config
32. `severity: "block"` (default) + stub → BLOCK finding.
33. `severity: "warn"` + stub → WARN finding, `passed: true`.

### Finding shape & evidence
34. Finding includes `filePath`, `line` (line number), `message` with stub code snippet.
35. Finding includes `fix` with implementation guidance.
36. Finding includes `evidence: EvidenceLevel.CODE`.
37. `durationMs` is non-negative on every result.

### Edge: async functions
38. `async function foo() { return null; }` → BLOCK (regex handles `async` prefix).

### Edge: getters/setters
39. `get foo() { return null; }` → BLOCK (regex handles `get` prefix).

### Edge: method shorthand
40. `const obj = { foo() { return null; } }` → BLOCK (regex handles method shorthand).

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity`, `findings[i].message` substrings (stub code), `findings[i].filePath`, `findings[i].line`, `findings[i].evidence === EvidenceLevel.CODE`.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.
- Mock `fs.readFileSync` for deterministic tests.