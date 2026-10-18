# Adversarial Test Spec — noTriviallyTrueTestGuard

> Source: `src/guards/no-trivially-true-test-guard.ts`
> Opt-in: `enabled: true` by default
> Config: `severity: "warn" | "block"` (default: `"block"`), `allowlistPaths: string[]` (default: `[]`)
> Scans staged test files (`tests/**/*`, `*.test.js`, `*.spec.js`, `*.test.ts`)
> Uses `fs.readFileSync` — **mock `fs` in tests**
> Line-by-line trivial assertion detection + test body extraction via brace counting

## Mock audit

The guard uses `fs.readFileSync`. **Mock `fs`** in tests. It scans staged test files for trivial assertions (constant-to-constant comparisons) and test bodies without any assertion calls.

## Adversarial scenarios

### Disabled gate
1. `enabled: false` → pass, no findings, early return.

### File filtering
2. Staged file `src/foo.ts` (not a test file) → skipped.
3. Staged file `tests/fixtures/foo.ts` → skipped (default allowlist pattern `/tests\/fixtures\//`).
5. Custom `allowlistPaths: ["tests/generated/"]` + `tests/generated/foo.test.ts` → skipped.
6. Custom `allowlistPaths: ["vendor"]` + `tests/vendor/foo.test.ts` → skipped.

### Trivial constant assertions (line-by-line)
7. `expect(true).toBe(true)` → BLOCK finding (pattern 1: `expect(true).toBe(true)`).
8. `expect(1).toEqual(1)` → BLOCK finding.
9. `expect("ok").toBe("ok")` → BLOCK finding (string constants).
10. `assert.strictEqual(1, 1)` → BLOCK finding (pattern 2: identical args).
11. `assert.equal(true, true)` → BLOCK finding.
12. `assert.deepEqual({a: 1}, {a: 1})` → BLOCK finding (identical object literals).
13. `assert.ok(true)` → BLOCK finding (pattern 3: `assert.ok(true)`).
14. `assert.ok(1)` → BLOCK finding.

### Non-trivial assertions (should pass)
15. `expect(actual).toBe(expected)` (variables) → pass (not constant literals).
16. `assert.strictEqual(actual, expected)` (variables) → pass.
17. `assert.ok(someCondition)` (dynamic) → pass.
18. `assert.throws(() => fn(), Error)` → pass.
18. `t.test("foo", async () => { assert.strictEqual(x, y); })` → pass.

### Test block without assertions
19. `test("name", () => { const x = 1 + 1; })` → BLOCK finding (no assertion calls in body).
20. `it("name", () => { doSomething(); })` → BLOCK finding.
21. `test("name", async () => { await doSomething(); })` → BLOCK finding.

### Test block with assertions (should pass)
22. `test("name", () => { assert.strictEqual(x, 1); })` → pass.
23. `test("name", () => { expect(y).toBe(2); })` → pass.

### Nested subtests (suite wrappers)
24. `describe("suite", () => { test("sub", () => { assert.ok(true); }); })` → pass (subtest has assertion, outer has `t.test` in body → skipped).

### Lines to skip
25. Lines starting with `//`, `*`, `/*` → skipped.
26. Lines with `await t.test(`, `test(`, `it(` → skipped (test declaration lines).
27. Lines with string literals containing `assert.strictEqual` → skipped (false positive prevention).

### Severity config
28. `severity: "block"` (default) + trivial assertion → BLOCK finding.
29. `severity: "warn"` + trivial assertion → WARN finding, `passed: true`.

### Finding shape & evidence
30. Finding includes `filePath`, `line` (line number), `message` with trimmed code snippet.
31. Finding includes `fix` with guidance to assert real outputs.
32. Finding includes `evidence: EvidenceLevel.CODE`.
33. `durationMs` is non-negative on every result.

### Edge: brace counting for test body extraction
35. `test("name", () => {\n  if (true) {\n    return;\n  }\n});` → correctly extracts body (nested braces counted).
36. `test("name", () => { const s = "}"; });` → correctly extracts body (string literals handled).

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity`, `findings[i].message` substrings, `findings[i].filePath`, `findings[i].line`, `findings[i].evidence === EvidenceLevel.CODE`.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.
- Mock `fs.readFileSync` for deterministic tests.