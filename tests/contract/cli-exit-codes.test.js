/**
 * CLI exit-code CONTRACT tests (issue #35).
 *
 * ────────────────────────────────────────────────────────────────────
 * Breaking any test in this file = SEMVER MAJOR bump per
 * docs/SEMVER.md §3 (CLI is one of the four public surfaces).
 * Git hooks, CI scripts, husky pipelines, and Lefthook configs all
 * branch on these exit codes — silently changing them breaks every
 * downstream automation that calls `defense-in-depth` from a shell.
 * ────────────────────────────────────────────────────────────────────
 *
 * Scope (deliberately complementary to `tests/cli-ground-truth.test.js`):
 *
 *   cli-ground-truth.test.js → broad behavioural coverage of `verify`
 *                               under many config / file shapes.
 *   cli-exit-codes.test.js   → the THIN exit-code contract that hook
 *                               authors and CI consumers depend on.
 *
 * The contract pinned here covers all top-level commands, not just
 * `verify`, and frames each assertion as "the v1.0 process-level
 * promise". Adding new commands is additive (Minor); changing an
 * existing exit code is breaking (Major).
 *
 * Executor: Devin
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CLI_PATH = path.join(REPO_ROOT, "dist", "cli", "index.js");

let tmp;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-cli-contract-"));
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function runCli(args, cwd = tmp) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1", CI: "true" },
  });
}

function freshGitRepo(name) {
  const root = path.join(tmp, name);
  fs.mkdirSync(root, { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: root });
  // Local identity so future `git commit` inside the fixture (if any)
  // never blocks on global config in CI runners.
  spawnSync("git", ["config", "user.email", "did-contract@example.test"], { cwd: root });
  spawnSync("git", ["config", "user.name", "did-contract"], { cwd: root });
  return root;
}

// ─── Section 1: meta commands (always 0 / always 1) ──────────────────

describe("CONTRACT — meta-command exit codes (CLI, issue #35)", () => {
  it("`--version` exits 0 (consumed by version pinning scripts)", () => {
    // Breaking this = MAJOR. Tools like Renovate / Dependabot scripts
    // probe `defense-in-depth --version` to confirm a successful install.
    const r = runCli(["--version"]);
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);
    // Also pin the output shape: a semver-ish line MUST be on stdout.
    assert.match(
      r.stdout,
      /\d+\.\d+\.\d+(?:[-.+][\w.-]+)?/,
      "--version stdout must contain a semver-ish version string",
    );
  });

  it("`-v` is a stable shorthand for `--version` and exits 0", () => {
    const r = runCli(["-v"]);
    assert.equal(r.status, 0);
  });

  it("`--help` exits 0 (every shell-completion / man-page renderer relies on this)", () => {
    const r = runCli(["--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage:/i, "--help stdout must contain a Usage banner");
  });

  it("`-h` is a stable shorthand for `--help` and exits 0", () => {
    const r = runCli(["-h"]);
    assert.equal(r.status, 0);
  });

  it("no command exits 0 (printing the banner is the documented zero-arg behaviour)", () => {
    const r = runCli([]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage:/i);
  });

  it("unknown command exits 1 with a stderr message (NOT 0, NOT 2)", () => {
    // Breaking this = MAJOR. CI shell scripts use `did <subcommand>` and
    // distinguish "guard violated" (exit 1) from "the binary itself
    // is broken" (other codes). Returning 0 on a typo would silently
    // green-light pipelines; returning 2 would diverge from the rest of
    // the CLI surface.
    const r = runCli(["this-is-not-a-real-command"]);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.length > 0, "unknown command must write to stderr");
  });
});

// ─── Section 2: `verify` exit codes (the most-used surface) ──────────

describe("CONTRACT — `verify` exit codes (CLI, issue #35)", () => {
  it("`verify` with no staged files and no --files exits 0 (no-op success)", () => {
    // Breaking this = MAJOR. Every Git hook calls `verify`; an empty
    // commit (e.g. `--allow-empty`, or a hook firing on a clean tree)
    // MUST NOT block the user.
    const root = freshGitRepo("verify-empty");
    const r = runCli(["verify"], root);
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);
  });

  it("`verify --files <substantive doc>` exits 0 (clean prose passes)", () => {
    // Breaking this = MAJOR. The "your normal docs aren't blocked"
    // contract is the headline DX promise. (PR #60 issue #59 hardened
    // this against regex-escape false positives — this contract test
    // is the long-lived guardrail.)
    const root = freshGitRepo("verify-clean");
    const docPath = path.join(root, "docs", "ok.md");
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(
      docPath,
      "This document contains a real paragraph of meaningful content well above the default minimum length threshold so length-based findings do not interfere with normal prose.\n",
    );
    const r = runCli(["verify", "--files", "docs/ok.md"], root);
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);
  });

  it("`verify --files <hollow doc>` exits 1 (BLOCK is non-zero)", () => {
    // Breaking this = MAJOR. Pre-commit hooks read $? — non-zero is the
    // ONLY signal Git understands as "abort the commit". Returning 0
    // here would let hollow content reach the index.
    const root = freshGitRepo("verify-hollow");
    const docPath = path.join(root, "docs", "bad.md");
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(
      docPath,
      "This document contains a real paragraph of meaningful content well above the default minimum length threshold but ends with a literal placeholder: PLACEHOLDER right here.\n",
    );
    const r = runCli(["verify", "--files", "docs/bad.md"], root);
    assert.equal(r.status, 1, `stdout=${r.stdout}\nstderr=${r.stderr}`);
  });

  it("`verify --files <missing path>` exits 0 (guards skip silently — documented)", () => {
    // Breaking this = MAJOR. Hooks pass file lists from `git diff
    // --name-only` which can include paths that have already been
    // deleted (rename / unstage races). Crashing on missing files would
    // make the hook flaky.
    const root = freshGitRepo("verify-missing");
    const r = runCli(["verify", "--files", "docs/never-existed.md"], root);
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);
  });
});

// ─── Section 3: `doctor` & `init` exit codes ─────────────────────────

describe("CONTRACT — `doctor` & `init` exit codes (CLI, issue #35)", () => {
  it("`doctor` in a healthy fresh repo exits 0", () => {
    // Breaking this = MAJOR. Onboarding scripts (`did init && did
    // doctor`) and CI smoke-tests pin this. A non-zero exit on a fresh
    // clean tree would mean every greenfield project starts red.
    const root = freshGitRepo("doctor-healthy");
    const r = runCli(["doctor"], root);
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);
  });

  it("`init` in a fresh git repo exits 0 and creates pre-commit + pre-push + defense.config.yml", () => {
    // Breaking this = MAJOR. README quickstart (`npx defense-in-depth
    // init`) treats exit 0 + the three artifacts below as success. A
    // user whose CI-bound install no longer sees these files would
    // silently lose enforcement.
    const root = freshGitRepo("init-fresh");
    const r = runCli(["init"], root);
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);

    // Pin the on-disk side effects — these are the published
    // outcomes of `init`, not internals.
    assert.ok(
      fs.existsSync(path.join(root, ".git", "hooks", "pre-commit")),
      "init must install .git/hooks/pre-commit",
    );
    assert.ok(
      fs.existsSync(path.join(root, ".git", "hooks", "pre-push")),
      "init must install .git/hooks/pre-push",
    );
    assert.ok(
      fs.existsSync(path.join(root, "defense.config.yml")),
      "init must scaffold defense.config.yml at the project root",
    );
  });
});
