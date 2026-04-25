# Ground-Truth CLI Integration Spec (Phase 4 hardening)

> Source: `src/cli/index.ts`, `src/cli/verify.ts`, `src/cli/doctor.ts`
> Existing tests stub the engine and import guards in-process. **None exercise the
> compiled CLI as a subprocess.** This spec adds black-box, end-to-end coverage
> via `node dist/cli/index.js <cmd>` so we catch regressions in:
>   - argv parsing
>   - exit codes
>   - YAML config loading + deep-merge with defaults
>   - guard registration order
>   - human-readable output formatting

## Mock audit

- **Real `fs`**, real subprocess. Each test gets its own `mkdtempSync` workspace.
- No network. `useDspy` defaults to false → no DSPy calls.
- No `git` interaction needed: tests always pass `--files` explicitly so the
  staged-file fallback in `getStagedFiles()` is bypassed.
- The CLI binary used is `dist/cli/index.js` — assumed already built by `npm run build`.

## Scenarios

### Exit-code matrix

1. `--version` → exit 0; stdout begins with `defense-in-depth v`.
2. `--help` → exit 0; stdout includes `Usage:` and lists `init`, `verify`, `doctor`.
3. (no command) → exit 0; same usage banner as `--help`.
4. `unknown-cmd` → exit 1; stderr contains `Unknown command: "unknown-cmd"`.

### Verify against clean fixtures

5. `verify --files clean.md` against substantive markdown → exit 0; stdout shows guard-summary block.
6. `verify --files src/clean.ts` with corresponding `implementation_plan.md` while `phaseGate.enabled=false` (default) → exit 0.

### Verify catches each guard category

7. `verify --files hollow.md` with `TODO`-only markdown → exit 1; output mentions `Hollow Artifact Detector`.
8. `verify --files .agents/rule-x.md` (touching a protected SSOT path) → exit 1; output mentions `SSOT Pollution`.
9. `verify --files custom-root-file.txt` not on the rootPollution allow-list → exit 1; output mentions `Root Pollution`.
10. **Combined offender** — both a hollow `.md` and an SSOT-protected path staged → exit 1; output mentions BOTH guards.

### Custom config loading

11. Custom `defense.config.yml` with `hollowArtifact.minContentLength: 5` → a 6-char file no longer warns.
12. Custom `defense.config.yml` disabling `hollowArtifact.enabled: false` → a `TODO`-only file passes (guard skipped).
13. Custom `defense.config.yml` enabling `phaseGate.enabled: true` with no plan file → `verify --files src/x.ts` → exit 1, mentions `Phase Gate`.

### Argv-edge handling

14. `verify` with NO `--files` and NO staged files → exit 0; stdout includes `No staged files found`.
15. `verify --files ghost.md` (file does not exist on disk) → exit 0; guards silently skip the missing file (matches the in-process test in `hollow-artifact-adversarial.test.js`).

### Doctor command

16. `doctor` in a fresh fixture (no hooks installed, no config) → exit 0 (advisory) and prints a structured health report.

## Assertion rules

- Use `node:child_process` `spawnSync` (synchronous, easy to assert on).
- Capture `status`, `stdout`, `stderr` for every invocation.
- Assert on **substrings**, not exact full output, because the CLI prints emojis
  and aligned columns whose whitespace is OS-dependent.
- Each test cleans up its tempdir in `afterEach`.
- Tests must be **idempotent** — no shared state between scenarios.
