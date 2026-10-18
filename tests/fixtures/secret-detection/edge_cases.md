# Adversarial Test Spec — secretDetectionGuard

> Source: `src/guards/secret-detection.ts`
> Opt-in: `enabled: true` by default
> Config: `customPatterns: string[]` (default: `[]`) — each compiled to RegExp with BLOCK severity
> Scans all staged files via `fs.readFileSync` — **mock `fs` in tests**
> Line-by-line scan against built-in + custom secret patterns
> Uses `performance.now()` for duration

Token-shaped inputs below are written as string concatenations (e.g. `'AKIA' + '1234567890123456'`). Tests must build them the same way at runtime so the repository itself never contains a literal secret-shaped string.

## Mock audit

The guard uses `fs.readFileSync`. **Mock `fs`** in tests. It scans all staged files line-by-line against built-in secret patterns and any custom patterns.

## Adversarial scenarios

### Disabled gate
1. `enabled: false` → pass, no findings, early return.

### Built-in secret patterns
2. `'-----BEGIN ' + 'PRIVATE KEY-----'` → BLOCK finding (Private Key pattern).
3. `'-----BEGIN ' + 'RSA PRIVATE KEY-----'` → BLOCK finding (Private Key pattern, flexible prefix).
4. `'AKIA' + '1234567890123456'` (20 chars) → BLOCK finding (AWS Access Key ID).
5. `'ABIA' + '1234567890123456'` → BLOCK finding (AWS variant).
6. `'ACCA' + '1234567890123456'` → BLOCK finding (AWS variant).
7. `'ASIA' + '1234567890123456'` → BLOCK finding (AWS variant).
8. `'gh' + 'p_' + '123456789012345678901234567890123456'` (36+ chars) → BLOCK finding (GitHub PAT).
9. `'gh' + 'o_' + '123456789012345678901234567890123456'` → BLOCK finding (GitHub OAuth).
10. `'gh' + 'u_' + '123456789012345678901234567890123456'` → BLOCK finding (GitHub user).
11. `'gh' + 's_' + '123456789012345678901234567890123456'` → BLOCK finding (GitHub server).
12. `'gh' + 'r_' + '123456789012345678901234567890123456'` → BLOCK finding (GitHub refresh).
13. `'sk-' + '12345678901234567890'` (20+ chars) → BLOCK finding (OpenAI API key).
14. `'sk-ant-' + '12345678901234567890'` → BLOCK finding (Anthropic API key).
15. `'T3BlbkFJ' + '123456789012345678'` → BLOCK finding (OpenAI legacy).
16. `'sk_' + 'live_' + '123456789012345678901234'` (24+ chars) → BLOCK finding (Stripe secret key).
17. `'rk_' + 'live_' + '123456789012345678901234'` → BLOCK finding (Stripe restricted key).

### Generic secret assignment (WARN severity)
18. `'pass' + 'word = "' + 'supersecret' + 'password123"'` → WARN finding (Generic Secret Assignment).
19. `'pass' + 'wd: \'' + 'mysecret' + 'value12345\''` → WARN finding.
20. `'sec' + 'ret = "' + 'abcdefgh' + 'ijklmnop"'` (16+ chars) → WARN finding.
21. `'api_' + 'key = "' + 'myapikey' + '123456789"'` → WARN finding.
22. `'api' + 'key: "' + 'myapikey' + '123456789"'` → WARN finding.
23. `'access_' + 'token = "' + 'myaccesstoken' + '123456789"'` → WARN finding.
24. `'auth_' + 'token: "' + 'myauthtoken' + '123456789"'` → WARN finding.
25. Short value: `password = "short"` → pass (less than 16 chars).
26. No quotes: `password = secretvalue` → pass (regex requires quotes).

### Custom patterns
27. Config `customPatterns: ["my-secret-[a-z0-9]{20}"]` + `my-secret-abcdefghijklmnopqrst` → BLOCK finding (Custom Secret Pattern).
28. Multiple custom patterns → all applied.

### Redaction in message
29. Finding message includes redacted secret: `"AKIA1234...3456"` (first 4, last 4).
30. Short secret (≤8 chars) fully redacted as `[REDACTED]`.

### Finding shape & evidence
31. Finding includes `filePath`, `line` (line number), `message` with pattern name and redacted value.
32. Finding includes `fix` with rotation and env var guidance.
33. Finding includes `evidence: EvidenceLevel.CODE`.
34. `durationMs` is non-negative on every result.

### Severity per pattern
35. Private Key, AWS, GitHub, OpenAI/Anthropic, Stripe → `Severity.BLOCK`.
36. Generic Secret Assignment → `Severity.WARN`.

### Multiple findings per file
37. File with both AWS key and generic password → two findings (BLOCK + WARN).
38. Multiple secrets on different lines → multiple findings.

### Edge: binary/unreadable files
39. `fs.readFileSync` throws → silently continue (no finding).

### Edge: first match per line
40. Line with multiple pattern matches → only first pattern triggers (break after match).

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity` (BLOCK vs WARN), `findings[i].message` substrings (pattern name, redacted), `findings[i].filePath`, `findings[i].line`, `findings[i].evidence === EvidenceLevel.CODE`.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.
- Mock `fs.readFileSync` for deterministic tests.