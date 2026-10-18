# Adversarial Test Spec — noSwallowedErrorGuard

> Source: `src/guards/no-swallowed-error.ts`
> Opt-in: `enabled: true` by default
> Config: `severity: "warn" | "block"` (default: `"block"`), `allowlistPaths: string[]` (default: `[]`)
> Scans staged `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs` files
> Uses `fs.readFileSync` — **mock `fs` in tests**
> Regex-based catch block detection with comment stripping

## Mock audit

The guard uses `fs.readFileSync`. **Mock `fs`** in tests. It scans staged files for `catch (...) { ... }` or `catch { ... }` blocks, strips comments, and checks if the body is empty or only returns a stub.

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

### Empty catch block detection
10. `catch (e) {}` → BLOCK finding (empty body, no ticket).
11. `catch {}` (no parens) → BLOCK finding (regex handles optional parens).
12. `catch (err) { }` (whitespace only) → BLOCK finding.
13. `catch (e) { // just a comment }` → BLOCK finding (comment stripped, empty).
14. `catch (e) { /* comment */ }` → BLOCK finding (block comment stripped).

### Ticket escape hatch
15. `catch (e) { // TK-123 }` → pass (TICKET_PATTERN in body).
16. `catch (e) { /* TK-ABC-456 */ }` → pass (ticket in block comment, stripped but checked before stripping).
17. `catch (e) { /* TODO: handle later */ }` → BLOCK (no ticket ID pattern).

### Stub return in catch
18. `catch (e) { return null; }` → BLOCK finding (stub return pattern).
19. `catch (e) { return undefined; }` → BLOCK finding.
20. `catch (e) { return {}; }` → BLOCK finding.
21. `catch (e) { return []; }` → BLOCK finding.
22. `catch (e) { return null; // TK-789 }` → pass (ticket reference in catch block).

### Non-stub return in catch (should pass)
23. `catch (e) { console.error(e); throw e; }` → pass (real code after comment stripping).
24. `catch (e) { logger.warn(e); return fallbackValue(); }` → pass (not a stub return pattern).
25. `catch (e) { metrics.increment('error'); throw e; }` → pass.

### Multi-line catch blocks
26. `catch (e) {\n  // TK-123\n  return null;\n}` → pass (ticket in multi-line body).
27. `catch (e) {\n  const msg = e.message;\n  logger.error(msg);\n  throw e;\n}` → pass (real code).

### Severity config
28. `severity: "block"` (default) + empty catch → BLOCK finding.
29. `severity: "warn"` + empty catch → WARN finding, `passed: true`.

### Finding shape & evidence
30. Finding includes `filePath`, `line` (line number), `message` with context.
31. Finding includes `fix` with actionable guidance (logging, rethrow, ticket).
32. Finding includes `evidence: EvidenceLevel.CODE`.
33. `durationMs` is non-negative on every result.

### Edge: sanitized content preserves line numbers
34. Block comments `/* ... */` are replaced with spaces/newlines to preserve line numbers for accurate `line` reporting.

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity`, `findings[i].message` substrings, `findings[i].filePath`, `findings[i].line`, `findings[i].evidence === EvidenceLevel.CODE`.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.
- Mock `fs.readFileSync` for deterministic tests.