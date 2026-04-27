/**
 * Feedback scraper (passive mode) tests (issue #22 MVP).
 *
 * Builds a synthetic git fixture in a tmp dir, runs `did feedback
 * scan-history`, and asserts on inferred events. Covers:
 *   - R1 fix-up commit within window → TP for unassigned-tp
 *   - R3 [guard-override:X] in commit body → FP for guard X
 *   - Negative control: no fix-ups, no overrides → zero events
 *   - Idempotency on re-run (Q&A locked: deterministic id)
 *   - --dry-run does not write
 *
 * Mock audit: real fs, real subprocess, real `git` binary. No network.
 *
 * Executor: Devin-AI
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(REPO_ROOT, "dist", "cli", "index.js");
const FEEDBACK_PATH = ".agents/records/feedback.jsonl";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-feedback-s-"));
  // Pure git plumbing — no `git config` (forbidden by environment policy);
  // we set author identity via commit-time env vars instead.
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: tmp });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const GIT_ENV = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(args, opts = {}) {
  return spawnSync("git", args, {
    cwd: tmp,
    encoding: "utf-8",
    env: { ...process.env, ...GIT_ENV, ...(opts.env ?? {}) },
  });
}

function commit(file, content, message) {
  const full = path.join(tmp, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  git(["add", file]);
  // -c flags scope identity to this single command without mutating
  // user-level git config (which is forbidden in this environment).
  git([
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-q",
    "-m",
    message,
  ]);
}

function runScan(args = []) {
  return spawnSync(
    process.execPath,
    [CLI_PATH, "feedback", "scan-history", ...args],
    {
      cwd: tmp,
      encoding: "utf-8",
      env: { ...process.env, NO_COLOR: "1" },
    },
  );
}

function readJsonl() {
  const full = path.join(tmp, FEEDBACK_PATH);
  if (!fs.existsSync(full)) return [];
  return fs
    .readFileSync(full, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

describe("feedback scraper — R1 fix-up rule", () => {
  it("fix(scope): touching the same files as a recent feat commit infers TP", () => {
    commit("src/foo.ts", "export const x = 1;\n", "feat(foo): add x");
    commit("src/foo.ts", "export const x = 1;\nexport const y = 2;\n", "fix(foo): handle empty case");
    const r = runScan(["--max", "10"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const events = readJsonl();
    const tp = events.find((e) => e.label === "TP" && e.source === "scraper-fixup");
    assert.ok(tp, `expected scraper-fixup TP, got: ${JSON.stringify(events)}`);
    assert.equal(tp.guardId, "unassigned-tp");
    assert.equal(tp.ticketId, "");
    assert.match(tp.executor, /^scraper:v\d+/);
  });
});

describe("feedback scraper — R3 override rule", () => {
  it("commit body containing [guard-override:hollowArtifact] infers FP", () => {
    const message = "feat(x): intentional placeholder\n\nWill be fleshed out next sprint.\n[guard-override:hollowArtifact]\n";
    commit("docs/plan.md", "TODO: write plan", message);
    const r = runScan(["--max", "10"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const events = readJsonl();
    const fp = events.find((e) => e.label === "FP" && e.source === "scraper-override");
    assert.ok(fp, `expected scraper-override FP, got: ${JSON.stringify(events)}`);
    assert.equal(fp.guardId, "hollowArtifact");
  });
});

describe("feedback scraper — negative control", () => {
  it("no fix-ups, no overrides, no reverts → zero events written", () => {
    commit("src/a.ts", "export const a = 1;\n", "feat(a): add a");
    commit("src/b.ts", "export const b = 2;\n", "feat(b): add b");
    commit("src/c.ts", "export const c = 3;\n", "docs(c): add c");
    const r = runScan(["--max", "10"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.equal(readJsonl().length, 0);
    assert.match(r.stdout, /no feedback inferred|written=0/);
  });
});

describe("feedback scraper — idempotency", () => {
  it("re-running scan-history produces no new lines (deterministic id)", () => {
    commit("src/foo.ts", "export const x = 1;\n", "feat(foo): add x");
    commit("src/foo.ts", "export const x = 1;\nexport const y = 2;\n", "fix(foo): handle empty case");
    const first = runScan(["--max", "10"]);
    assert.equal(first.status, 0);
    const before = readJsonl().length;
    assert.ok(before >= 1);
    const second = runScan(["--max", "10"]);
    assert.equal(second.status, 0);
    assert.equal(readJsonl().length, before);
    assert.match(second.stdout, /skippedDuplicates=\d+/);
  });
});

describe("feedback scraper — --dry-run", () => {
  it("--dry-run reports proposed events but writes nothing to disk", () => {
    commit("src/foo.ts", "export const x = 1;\n", "feat(foo): add x");
    commit("src/foo.ts", "export const x = 1;\nexport const y = 2;\n", "fix(foo): handle empty case");
    const r = runScan(["--max", "10", "--dry-run"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /dry-run/);
    assert.match(r.stdout, /proposed=\d+/);
    assert.equal(readJsonl().length, 0);
  });
});
