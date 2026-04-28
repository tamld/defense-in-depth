/**
 * Regression LINT: `execSync` MUST NOT be reintroduced into `src/`.
 *
 * ────────────────────────────────────────────────────────────────────
 * This file is a code-level lint rule (issue #44). It scans the
 * `src/` tree at test time and FAILS if any source file still imports
 * or calls `execSync` from `node:child_process`.
 *
 * Rationale (from issue #44):
 *
 *   `execSync` runs its first argument through `/bin/sh -c …`, which
 *   means any string interpolation becomes a theoretical shell-
 *   injection surface. defense-in-depth is a security-adjacent
 *   governance tool — shipping a single `execSync` call site
 *   undermines the entire "we run guards safely on your machine"
 *   message.
 *
 *   The codebase is standardised on `execFileSync(cmd, [args])`
 *   which does NOT spawn a shell. This test prevents anyone (human or
 *   agent) from regressing that contract.
 *
 * If you legitimately need `execSync` (e.g. a Windows-only escape
 * hatch), do NOT silence this lint by editing the regex. Instead,
 * open an RFC issue, get explicit human approval, and add a single
 * narrowly-scoped allow-list entry next to the call site documenting
 * why `execFileSync` is insufficient.
 *
 * Breaking this contract = SEMVER MAJOR per docs/SEMVER.md §3
 * (process-execution behaviour is part of the operational surface
 * downstream consumers depend on).
 * ────────────────────────────────────────────────────────────────────
 *
 * Executor: Devin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(REPO_ROOT, "src");

/** Walk every `.ts` file under `src/`, returning absolute paths. */
function listTsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const entries = fs.readdirSync(next, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(next, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && full.endsWith(".ts")) {
        out.push(full);
      }
    }
  }
  return out;
}

// `\bexecSync\b` matches the bare identifier (import or call) but not
// `execFileSync`. Comment lines (`//` or `*`) are stripped before match
// so the lesson docstrings inside src/* that *mention* `execSync` for
// historical context don't trip the rule.
function stripComments(source) {
  // Remove single-line `// …` comments.
  const noLine = source.replace(/^[ \t]*\/\/.*$/gm, "");
  // Remove `/* … */` block comments (non-greedy, multi-line).
  const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock;
}

describe("CONTRACT — `execSync` MUST NOT be used in src/ (issue #44)", () => {
  it("no `.ts` source file imports or calls execSync (only execFileSync is allowed)", () => {
    const offenders = [];
    for (const file of listTsFiles(SRC_DIR)) {
      const stripped = stripComments(fs.readFileSync(file, "utf-8"));
      if (/\bexecSync\b/.test(stripped)) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }

    assert.deepStrictEqual(
      offenders,
      [],
      [
        "execSync usage detected in the following source files — convert to execFileSync(cmd, [args]):",
        ...offenders.map((f) => `  - ${f}`),
        "",
        "Rationale: execSync goes through /bin/sh -c <string>, which makes any",
        "argument interpolation a shell-injection surface. defense-in-depth ships",
        "execFileSync everywhere (no shell). See issue #44 / PR #44.",
      ].join("\n"),
    );
  });

  it("execFileSync is in fact the primitive used (sanity-check the rule isn't a no-op)", () => {
    // If the codebase ever stops shelling out entirely this assertion
    // would need to be relaxed — but as long as ANY git plumbing lives
    // in src/, the substitute must be present. This protects against a
    // future refactor that accidentally removes both primitives and
    // makes the no-execSync rule trivially satisfied.
    let found = false;
    for (const file of listTsFiles(SRC_DIR)) {
      const stripped = stripComments(fs.readFileSync(file, "utf-8"));
      if (/\bexecFileSync\b/.test(stripped)) {
        found = true;
        break;
      }
    }
    assert.ok(
      found,
      "expected at least one src/* file to use execFileSync — if that's no longer true, this lint rule is a no-op and must be reviewed",
    );
  });
});
