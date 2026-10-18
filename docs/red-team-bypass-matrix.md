# Red-Team Bypass Matrix — Defense-in-Depth Guards

> **Purpose**: Document known bypass techniques for the 4 highest-risk guards so reviewers can design countermeasures and detection logic.
> **Scope**: Only the 4 highest-risk guards (by STRIDE impact and exploitability).
> **Method**: Adversarial review of guard source code — each bypass must be demonstrated or disproven.

---

## Guard Selection Rationale

| Rank | Guard | STRIDE Impact | Why Highest-Risk |
|------|-------|---------------|------------------|
| 1 | `secretDetection` | **Information Disclosure** + **Repudiation** | Credentials in git history = irreversible breach. Single miss = production compromise. |
| 2 | `noTypeSafetyBypass` | **Tampering** (type system) | `as any` / `@ts-ignore` silently disable compiler guarantees. Undermines entire static analysis pipeline. |
| 3 | `selfProtection` | **Tampering** (governance) | If bypassed, agents can disable coverage gates, security config, CI — cascading control failure. |
| 4 | `hitlReview` | **Repudiation** + **Elevation of Privilege** | Bypassing PR gate = unchecked code in main. Direct commit to protected branch = broken HITL contract. |

> **Excluded**: `noStubReturn`, `noSwallowedError`, `noTriviallyTrueTest` — lower blast radius (test quality, not production security). `rootPollution`, `fileSizeLimit` — hygiene, not exploitability.

---

## Bypass Matrix Format

| Bypass ID | Technique | Target Guard | Prerequisites | Detection Difficulty | Mitigation Status |
|-----------|-----------|--------------|---------------|---------------------|-------------------|
| BYP-001 | ... | secretDetection | ... | High / Medium / Low | Mitigated / Partial / Open |

---

## 1. secretDetection Bypasses

### BYP-SD-001: Encoded/Obfuscated Secrets
- **Technique**: Base64, hex, or custom encoding of credentials (e.g., `atob("c2VjcmV0")`).
- **Prerequisites**: Secret assigned to variable, then decoded at runtime.
- **Detection Difficulty**: **High** — static regex cannot decode arbitrary transformations.
- **Proof of Concept**:
  ```ts
  const encoded = "c2VjcmV0LWFwaS1rZXk="; // "secret-api-key"
  const key = atob(encoded); // decoded at runtime
  ```
- **Current Status**: **Open** — guard only scans literal strings.
- **Mitigation Ideas**:
  - Entropy-based detection on variable assignments (high false positive risk).
  - Runtime secret scanning (out of scope for pre-commit).
  - Document as known limitation; rely on runtime secret rotation.

### BYP-SD-002: String Concatenation / Template Literals
- **Technique**: Split secret across concatenation: `"AKIA" + "1234567890123456"`.
- **Prerequisites**: Secret constructed at runtime.
- **Detection Difficulty**: **High** — line-by-line regex misses split parts.
- **Proof of Concept**:
  ```ts
  const key = "AKIA" + "1234567890123456";
  ```
- **Current Status**: **Open** — regex runs per line, not per AST expression.
- **Mitigation Ideas**:
  - Simple concatenation detection (e.g., `+` between string literals matching partial patterns).
  - Accept limitation; rotate keys on detection.

### BYP-SD-003: Environment Variable Reference (False Negative by Design)
- **Technique**: `process.env.AWS_SECRET_ACCESS_KEY` — not a secret, correct usage.
- **Prerequisites**: None.
- **Detection Difficulty**: **N/A** — this is correct behavior, not a bypass.
- **Status**: **Mitigated** — guard ignores `process.env.*` patterns (not in regex).

### BYP-SD-004: Custom Pattern Evasion
- **Technique**: Attacker adds custom pattern that is intentionally weak or matches nothing.
- **Prerequisites**: Write access to `defense.config.yml`.
- **Detection Difficulty**: **Low** — config change is visible in diff.
- **Status**: **Partial** — config changes require PR review (hitlReview gate).

### BYP-SD-005: Binary/Minified File Injection
- **Technique**: Commit a minified `.js` or binary file containing secrets.
- **Prerequisites**: Binary file staged.
- **Detection Difficulty**: **Medium** — `fs.readFileSync` reads as UTF-8, may mangle or skip.
- **Current Status**: **Partial** — binary files throw and are skipped silently.
- **Mitigation**: Add binary detection (null bytes, high entropy) → block or scan with `strings`.

### BYP-SD-006: Commented-Out Secrets
- **Technique**: `// const key = "AKIA123..."` — in comment, not code.
- **Prerequisites**: Secret in comment line.
- **Detection Difficulty**: **Low** — current regex scans all lines including comments.
- **Status**: **Mitigated** — comments are scanned (intentional: dead secrets still leak).

### BYP-SD-007: Test Fixture Secrets
- **Technique**: Place realistic-looking fake secrets in test fixtures.
- **Prerequisites**: Test file staged.
- **Detection Difficulty**: **Medium** — test files are scanned (no default allowlist for secretDetection).
- **Status**: **Open** — no allowlist for test files. False positives expected.
- **Mitigation**: Add `allowlistPaths` config for test fixtures.

---

## 2. noTypeSafetyBypass Bypasses

### BYP-NTSB-001: `as unknown as Type` Pattern
- **Technique**: `value as unknown as AnyType` — bypasses `as any` check.
- **Prerequisites**: TypeScript allows `unknown` as intermediate.
- **Detection Difficulty**: **Low** — distinct pattern, easy to add to regex.
- **Proof of Concept**:
  ```ts
  const x: any = "hello";
  const y = x as unknown as number; // compiles, runtime crash
  ```
- **Current Status**: **Open** — guard only checks `as any`.
- **Mitigation**: Add `/as\s+unknown\s+as\s+\w+/` to detection patterns.

### BYP-NTSB-002: Type Assertion Function
- **Technique**: Create a function that asserts any type: `function asAny<T>(v: unknown): T { return v as T; }`
- **Prerequisites**: Helper function in codebase.
- **Detection Difficulty**: **High** — requires data flow analysis.
- **Proof of Concept**:
  ```ts
  const unsafe = asAny<AdminUser>(externalInput);
  ```
- **Current Status**: **Open** — line-by-line regex cannot trace function definitions.
- **Mitigation**: Document as known limitation; lint rule `no-unsafe-type-assertion` (eslint).

### BYP-NTSB-003: `@ts-expect-error` with Valid Ticket (Escape Hatch Abuse)
- **Technique**: Use real ticket ID to suppress real type error: `// @ts-expect-error — TK-123: legacy API`
- **Prerequisites**: Valid ticket ID (or guessed format).
- **Detection Difficulty**: **Medium** — ticket format verified, but intent not.
- **Status**: **Partial** — escape hatch requires ticket, but ticket may be stale/irrelevant.
- **Mitigation**: Require ticket to be "open" via ticket tracker API (out of scope for pre-commit).

### BYP-NTSB-004: `@ts-ignore` on Previous Line (Not Same Line)
- **Technique**: Place `@ts-ignore` on line before error:
  ```ts
  // @ts-ignore
  const x: number = "string";
  ```
- **Prerequisites**: Error on next line.
- **Detection Difficulty**: **Low** — current regex only checks same line (`^//\s*@ts-ignore`).
- **Current Status**: **Open** — guard misses multi-line suppression.
- **Mitigation**: Scan previous N lines for `@ts-ignore` when type error detected (requires TS compiler integration).

### BYP-NTSB-005: `@ts-nocheck` in Non-Top-Level Position
- **Technique**: `// @ts-nocheck` not at file top (TS ignores it, but guard flags it).
- **Prerequisites**: None.
- **Detection Difficulty**: **Low** — false positive for guard, not bypass.
- **Status**: **Mitigated** — guard flags any `@ts-nocheck` (correct: TS only honors at top).

### BYP-NTSB-006: JSDoc `@type {any}` Cast
- **Technique**: `/** @type {any} */ const x = foo;`
- **Prerequisites**: JSDoc comments enabled.
- **Detection Difficulty**: **Medium** — different syntax, not caught by `as any` regex.
- **Current Status**: **Open**.
- **Mitigation**: Add JSDoc `@type {any}` pattern to regex.

### BYP-NTSB-007: Import `any` from External Declaration
- **Technique**: `import type { AnyType } from "external"; const x: AnyType = foo;`
- **Prerequisites**: External types package with `export type AnyType = any;`
- **Detection Difficulty**: **High** — requires cross-file analysis.
- **Current Status**: **Open**.
- **Mitigation**: Forbid `any` in shared type packages (policy, not tool).

---

## 3. selfProtection Bypasses

### BYP-SP-001: Ticket ID in Commit Message (Valid but Irrelevant)
- **Technique**: `git commit -m "TK-123: unrelated change"` — ticket exists but doesn't authorize this file.
- **Prerequisites**: Valid ticket ID format.
- **Detection Difficulty**: **Medium** — guard validates format, not authorization scope.
- **Current Status**: **Open** — guard assumes any ticket = authorization.
- **Mitigation**: Integrate with ticket tracker to verify ticket labels/components match file.

### BYP-SP-002: Ticket ID in Branch Name (Valid but Irrelevant)
- **Technique**: `git checkout -b feat/TK-123` then modify protected file.
- **Prerequisites**: Branch naming convention includes ticket.
- **Detection Difficulty**: **Medium** — same as BYP-SP-001.
- **Current Status**: **Open**.

### BYP-SP-003: `TICKET_ID` Env Var Injection
- **Technique**: `TICKET_ID=TK-999 git commit ...` — CI or local env sets ticket.
- **Prerequisites**: Ability to set env var.
- **Detection Difficulty**: **Low** — env var visible in CI logs.
- **Status**: **Partial** — legitimate for CI automation. Document as accepted risk.

### BYP-SP-004: Symlink to Protected File
- **Technique**: `ln -s tsconfig.json my-config.json` — stage `my-config.json` (not in protected list).
- **Prerequisites**: Filesystem supports symlinks.
- **Detection Difficulty**: **High** — guard checks staged path, not resolved target.
- **Proof of Concept**:
  ```bash
  ln -s tsconfig.json /tmp/evil.ts
  git add /tmp/evil.ts  # if staged via absolute path
  ```
- **Current Status**: **Open** — guard uses `stagedRelPath`, not resolved path.
- **Mitigation**: Resolve symlinks before checking protected list.

### BYP-SP-005: Case-Insensitive Filesystem Bypass
- **Technique**: On macOS/Windows: `TSConfig.json` vs `tsconfig.json` — git may stage differently.
- **Prerequisites**: Case-insensitive FS.
- **Detection Difficulty**: **Medium** — guard normalizes path but protected list is exact match.
- **Current Status**: **Partial** — protected list includes exact filenames.

### BYP-SP-006: Protected Path via Directory Traversal
- **Technique**: Stage `../../tsconfig.json` from subdirectory.
- **Prerequisites**: Project root not enforced in staged paths.
- **Detection Difficulty**: **Low** — `path.basename` extracts filename.
- **Status**: **Mitigated** — guard uses `path.basename` and `endsWith`.

### BYP-SP-007: New Protected File Not in List
- **Technique**: Create new critical file (e.g., `.github/workflows/security.yml`) not in default `protectedPaths`.
- **Prerequisites**: New file created.
- **Detection Difficulty**: **Low** — requires config update.
- **Status**: **Open** — default list may be incomplete.
- **Mitigation**: Automated PR to update `protectedPaths` when new workflow/config added.

---

## 4. hitlReview Bypasses

### BYP-HITL-001: Branch Name Manipulation
- **Technique**: Rename local branch to non-protected name, commit, push, then rename remote.
- **Prerequisites**: Local branch rename (`git branch -m`), force push.
- **Detection Difficulty**: **Medium** — guard runs pre-commit on local branch name.
- **Proof of Concept**:
  ```bash
  git checkout main
  git branch -m temp-main
  # commit to temp-main
  git push origin temp-main:main --force
  ```
- **Current Status**: **Open** — guard only checks current branch name at commit time.
- **Mitigation**: Server-side branch protection (GitHub branch protection rules) — this guard is client-side only.

### BYP-HITL-002: Detached HEAD Commit
- **Technique**: `git checkout <commit-hash>` (detached HEAD), commit, push to main.
- **Prerequisites**: Ability to push to main.
- **Detection Difficulty**: **Medium** — `ctx.branch` is `"HEAD"` (not in protected list).
- **Current Status**: **Open** — guard passes for `HEAD` (detached).
- **Mitigation**: Block commits when `ctx.branch === "HEAD"` or `!ctx.branch`.

### BYP-HITL-003: Empty/Undefined Branch Context
- **Technique**: Run guard in context where `ctx.branch` is undefined.
- **Prerequisites**: CI environment without branch info.
- **Detection Difficulty**: **Low** — guard passes when `!ctx.branch` (early return).
- **Current Status**: **Partial** — by design (can't block without branch info).
- **Mitigation**: Require branch context in CI; fail if missing.

### BYP-HITL-004: Protected Branch Not in Config
- **Technique**: Push to `production` or `release` branch not in `protectedBranches` config.
- **Prerequisites**: Custom protected branches not configured.
- **Detection Difficulty**: **Low** — config gap.
- **Current Status**: **Open** — default only `main`, `master`.
- **Mitigation**: Document required config; audit repos for branch naming.

### BYP-HITL-005: Git Hook Bypass (`--no-verify`)
- **Technique**: `git commit --no-verify` skips pre-commit hook entirely.
- **Prerequisites**: Local git config allows `--no-verify`.
- **Detection Difficulty**: **N/A** — guard never runs.
- **Status**: **Accepted Risk** — client-side hooks are advisory. Server-side enforcement required.

---

## Cross-Guard Bypass Chains

| Chain ID | Sequence | Result |
|----------|----------|--------|
| CHAIN-001 | Bypass `hitlReview` (BYP-HITL-005) → commit to `main` → bypass `secretDetection` (BYP-SD-001) → credentials in main | **Critical** — requires server-side enforcement |
| CHAIN-002 | Bypass `selfProtection` (BYP-SP-001) → modify `.github/workflows/ci.yml` → disable `secretDetection` in CI | **Critical** — cascading control failure |
| CHAIN-003 | Bypass `noTypeSafetyBypass` (BYP-NTSB-001) → add `as unknown as any` → introduce type confusion → bypass `secretDetection` logic | **High** — type confusion enables logic bypass |

---

## Summary: Open Bypasses Requiring Mitigation

| Priority | Bypass ID | Guard | Mitigation Effort |
|----------|-----------|-------|-------------------|
| P0 | BYP-SD-001 | secretDetection | High (entropy/runtime) |
| P0 | BYP-SD-002 | secretDetection | Medium (concat detection) |
| P0 | BYP-SP-001 | selfProtection | High (ticket tracker API) |
| P0 | BYP-SP-004 | selfProtection | Medium (symlink resolve) |
| P0 | BYP-HITL-001 | hitlReview | Low (server-side required) |
| P0 | BYP-HITL-002 | hitlReview | Low (block detached HEAD) |
| P1 | BYP-NTSB-001 | noTypeSafetyBypass | Low (add regex) |
| P1 | BYP-NTSB-006 | noTypeSafetyBypass | Low (add JSDoc regex) |
| P1 | BYP-SD-005 | secretDetection | Medium (binary detection) |
| P1 | BYP-SD-007 | secretDetection | Low (allowlist config) |
| P2 | BYP-NTSB-002 | noTypeSafetyBypass | High (data flow) |
| P2 | BYP-NTSB-004 | noTypeSafetyBypass | Medium (multi-line scan) |
| P2 | BYP-NTSB-007 | noTypeSafetyBypass | High (cross-file) |
| P2 | BYP-SP-007 | selfProtection | Low (automated config sync) |

---

## Acceptance Criteria for "Mitigated"

A bypass is **Mitigated** when:
1. Guard code updated to detect/block the technique.
2. Unit test added demonstrating the bypass is caught.
3. `pnpm test && pnpm run coverage` passes.
4. Document updated with mitigation date and version.

A bypass is **Partial** when:
- Mitigation exists but has gaps (e.g., config-dependent, false positives).
- Requires defense-in-depth (server-side + client-side).

A bypass is **Open** when:
- No mitigation in guard code.
- Documented as known limitation with compensating controls.

---

## Review Checklist for Contributors

When modifying any of the 4 highest-risk guards:
- [ ] Check this matrix for relevant bypasses.
- [ ] Add test case for any new bypass technique discovered.
- [ ] Update matrix with new bypass or mitigation status.
- [ ] Run full test suite (`pnpm test && pnpm run coverage`).
- [ ] Ensure no regression on existing bypass detections.

---

## References

- STRIDE Threat Model: Microsoft SDL
- OWASP ASVS v4.0: V7 (Error Handling), V12 (Supply Chain)
- GitHub Branch Protection: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository>
- TypeScript `ts-ignore` behavior: <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-6.html#suppress-errors-in-ts-files-using-comments>