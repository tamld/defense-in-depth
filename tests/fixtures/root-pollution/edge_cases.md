# Adversarial Test Spec — rootPollutionGuard

> Source: `src/guards/root-pollution.ts`
> Enabled: `enabled: true` by default (configurable)
> Config: `allowedRootFiles: string[]` (default: `[]`), `allowedRootPatterns: string[]` (default: `[]`)
> Pure guard: no I/O, only checks `ctx.stagedFiles` paths
> Uses `path` module — no `fs` needed

## Mock audit

The guard is **pure** — no I/O, only string path matching on `ctx.stagedFiles`. **No mocks needed** — just set `ctx.stagedFiles` appropriately.

## Adversarial scenarios

### Disabled gate (via config)
1. `enabled: false` in config → not implemented (guard has no enabled field, but config allows empty allowedFiles to effectively disable). Actually the guard doesn't have an `enabled` field in config — it's controlled by whether `allowedRootFiles` and `allowedRootPatterns` are populated. If both empty, any root file is blocked. If populated, only those are allowed.

### Root file detection
2. `stagedFiles: ["README.md"]` → BLOCK finding (not in default empty allowed list).
3. `stagedFiles: ["src/foo.ts"]` → pass (not a root file, contains `/`).
4. `stagedFiles: [".gitignore"]` → BLOCK finding (root file).
5. `stagedFiles: ["../outside.txt"]` → pass (not a root file, contains `/`).
6. `stagedFiles: [".hidden"]` → BLOCK finding (root file, no leading dot special-casing).

### Allowed files (explicit list)
7. Config `allowedRootFiles: ["README.md", "CHANGELOG.md"]` + `stagedFiles: ["README.md"]` → pass (exact match).
8. Config `allowedRootFiles: ["README.md"]` + `stagedFiles: ["readme.md"]` → BLOCK (case-sensitive exact match).
9. Config `allowedRootFiles: []` (default) + any root file → BLOCK.

### Allowed patterns
10. Config `allowedRootPatterns: ["*.md"]` + `stagedFiles: ["NOTES.md"]` → pass (`*.md` matches `.md` suffix).
11. Config `allowedRootPatterns: ["*.md"]` + `stagedFiles: ["notes.txt"]` → BLOCK (no match).
12. Config `allowedRootPatterns: [".*"]` + `stagedFiles: [".gitignore"]` → pass (pattern `.*` matches dotfiles).
13. Config `allowedRootPatterns: ["*.md", "*.txt"]` + `stagedFiles: ["notes.txt"]` → pass (multiple patterns, any match allows).
14. Config `allowedRootPatterns: ["*.md"]` + `stagedFiles: ["README"]` (no extension) → BLOCK.

### Combination of allowed files and patterns
15. Config `allowedRootFiles: ["README.md"]`, `allowedRootPatterns: ["*.md"]` + `stagedFiles: ["CHANGELOG.md"]` → pass (pattern matches).
16. Config `allowedRootFiles: ["package.json"]`, `allowedRootPatterns: ["*.json"]` + `stagedFiles: ["tsconfig.json"]` → pass (pattern matches).

### Finding shape & evidence
17. Finding includes `filePath` = staged relative path.
18. Finding includes `message` with ecosystem pollution explanation and file name.
19. Finding includes `fix` with detailed guiding map for AI agents (scratch -> .gemini/, docs -> docs/, governance -> .agents/, source -> src/).
20. Finding uses `severity: Severity.BLOCK` (no config for severity — always BLOCK).
21. `durationMs` is non-negative on every result.

### Path normalization
16. Windows paths `stagedFiles: ["README.md"]` → pass (normalized via `path.basename`).

## Assertion rules

- Behavioral: assert on `passed`, `findings.length`, `findings[i].severity === Severity.BLOCK`, `findings[i].message` substrings (Ecosystem Pollution, file name), `findings[i].filePath`, `findings[i].fix` contains guiding map.
- NEVER snapshot the entire result — it includes `durationMs` which is non-deterministic.