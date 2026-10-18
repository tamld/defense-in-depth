# Adversarial Test Spec — fileSizeLimitGuard

> Source: `src/guards/file-size-limit.ts`
> Enabled by default: `enabled: true` (not opt-in)
> Config: `maxSizeBytes: number` (default: 1048576 = 1 MB), `severity: "warn" | "block"` (default: `"block"`), `ignoredExtensions: string[]` (default: `[]`)
> Reads staged files from `ctx.stagedFiles`, uses `fs.statSync` on each

## Mock audit

The guard uses `fs.statSync` on staged files. **Mock `fs`** in tests (e.g., via `vi.mock("node:fs")` or similar). Do NOT rely on real filesystem in unit tests.

## Adversarial scenarios

### Enabled/disabled gate
1. `enabled: false` → pass, no findings, early return.
2. `enabled: true` (default) → proceeds to check staged files.

### Staged files iteration
3. `ctx.stagedFiles: []` (empty) → pass, no findings.
4. `ctx.stagedFiles` includes file not on disk (`fs.existsSync` false) → skipped silently, no finding.
5. `ctx.stagedFiles` includes directory (`stat.isDirectory()` true) → skipped (guard only checks `isFile()`).
6. `fs.statSync` throws (permission error) → caught, file skipped silently.

### Size threshold
7. File size = `maxSizeBytes` (exactly 1 MB) → pass (strict `>` comparison).
8. File size = `maxSizeBytes + 1` (1 byte over) → finding with `severity` per config.
9. Default `maxSizeBytes: 1048576` + file 1.5 MB → BLOCK finding (default severity=block).
10. Custom `maxSizeBytes: 524288` (512 KB) + file 1 MB → BLOCK finding.

### Severity config
11. `severity: "block"` (default) + oversized file → BLOCK finding, `passed: false`.
12. `severity: "warn"` + oversized file → WARN finding, `passed: true`.
13. Multiple oversized files + `severity: "block"` → multiple BLOCK findings, `passed: false`.

### Ignored extensions
14. `ignoredExtensions: [".mp4", ".zip"]` + staged `video.mp4` (10 MB) → pass (extension matched, case-insensitive).
15. `ignoredExtensions: [".MP4"]` (uppercase) + staged `video.mp4` → pass (`.toLowerCase()` normalization).
16. `ignoredExtensions: [".log"]` + staged `app.log` (5 MB) → pass.
17. No `ignoredExtensions` config + staged `.zip` file → checked normally (not ignored).

### Finding shape & evidence
18. Finding includes `filePath` = relative staged path.
19. Finding includes `message` with formatted size (e.g., "1.50 MB") and limit.
20. Finding includes `evidence: EvidenceLevel.CODE` (file content check).
21. Finding includes `fix` with `git lfs track` suggestion.
21. `durationMs` is non-negative on every result.

### Multiple files
22. Mix of passing and failing files → only failing files generate findings.
23. All files pass → empty findings, `passed: true`.

### Edge: formatBytes helper
24. Size < 1 KB → "X B" format.
25. Size 1 KB - 1 MB → "X.X KB" format.
26. Size > 1 MB → "X.XX MB" format.

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity`, `findings[i].message` substrings (formatted size, limit), `findings[i].filePath`, `findings[i].evidence === EvidenceLevel.CODE`.
- `passed` is `false` only when BLOCK findings exist.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.
- Mock `fs` for deterministic tests.