/**
 * Lesson outcome scanner (passive mode) tests (issue #23 MVP).
 *
 * Builds a synthetic git fixture in a tmp dir with:
 *   - a seeded lesson (with `wrongApproachPattern`)
 *   - a pre-recorded recall event
 *   - one or more commits whose diff text either matches or doesn't match
 *     the pattern
 *
 * Then runs `did lesson scan-outcomes` and asserts the inferred verdicts.
 *
 * Covers:
 *   - pattern hit in a subsequent commit diff → helpful=false,
 *     source="scanner-pattern-match"
 *   - pattern miss → helpful=true, source="scanner-no-match"
 *   - lesson with no `wrongApproachPattern` → helpful=null,
 *     source="scanner-no-match"
 *   - --dry-run does not write any outcomes
 *   - re-running the scan is idempotent (deterministic id)
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
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(REPO_ROOT, "dist", "cli", "index.js");
const RECALLS_PATH = ".agents/records/lesson-recalls.jsonl";
const OUTCOMES_PATH = ".agents/records/lesson-outcomes.jsonl";
const LESSONS_PATH = "lessons.jsonl";

let tmp;

const GIT_ENV = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-lesson-s-"));
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: tmp });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function commit(file, content, message) {
  const full = path.join(tmp, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  spawnSync("git", ["add", file], { cwd: tmp, env: { ...process.env, ...GIT_ENV } });
  spawnSync(
    "git",
    [
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-q",
      "-m",
      message,
    ],
    { cwd: tmp, env: { ...process.env, ...GIT_ENV } },
  );
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, "lesson", ...args], {
    cwd: tmp,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function readJsonl(rel) {
  const full = path.join(tmp, rel);
  if (!fs.existsSync(full)) return [];
  return fs
    .readFileSync(full, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function recallEventId(lessonId, ticketId, queryHash, matchMethod) {
  return createHash("sha256")
    .update(`${lessonId}|${ticketId}|${queryHash}|${matchMethod}`)
    .digest("hex")
    .slice(0, 16);
}

function hashQuery(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Seed a lesson + a pre-recorded recall event timestamped slightly in the
 *  past. Git stores commit time at second precision, so the recall must be
 *  comfortably earlier than any subsequent commit for the scanner's
 *  in-window filter to include those commits. */
function seed({ lessonExtra = {}, recallTs = new Date(Date.now() - 5000) } = {}) {
  const lesson = {
    id: "lesson-scan-001",
    title: "Avoid skipping npm run build",
    scenario: "Tests fail because dist/ is stale",
    wrongApproach: "Run npm test directly without building first",
    correctApproach: "Always npm run build before npm test",
    insight: "Build artifacts must exist before tests can import them",
    category: "process",
    evidence: "RUNTIME",
    confidence: 0.9,
    createdAt: new Date().toISOString(),
    ...lessonExtra,
  };
  fs.writeFileSync(path.join(tmp, LESSONS_PATH), JSON.stringify(lesson) + "\n");

  const queryHash = hashQuery("build");
  const recall = {
    id: recallEventId(lesson.id, "", queryHash, "string"),
    lessonId: lesson.id,
    ticketId: "",
    queryHash,
    matchMethod: "string",
    source: "search",
    timestamp: recallTs.toISOString(),
    executor: "human",
  };
  fs.mkdirSync(path.join(tmp, ".agents/records"), { recursive: true });
  fs.writeFileSync(path.join(tmp, RECALLS_PATH), JSON.stringify(recall) + "\n");
  return { lesson, recall };
}

describe("scan-outcomes — pattern match positive", () => {
  it("a commit whose diff repeats the wrongApproachPattern → helpful=false", () => {
    seed({
      lessonExtra: {
        wrongApproachPattern: "npm test\\b(?!.*npm run build)",
      },
    });
    // Initial commit with build step.
    commit("Makefile", "all:\n\tnpm run build\n\tnpm test\n", "feat: build then test");
    // Subsequent commit that "repeats the wrong approach" — diff line text
    // contains the literal string the regex looks for.
    commit(
      "scripts/quick-test.sh",
      "#!/bin/sh\nnpm test --watch\n",
      "feat(scripts): quick re-run helper",
    );

    const r = runCli(["scan-outcomes", "--max", "10"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const outcomes = readJsonl(OUTCOMES_PATH);
    assert.equal(outcomes.length, 1, JSON.stringify(outcomes));
    const o = outcomes[0];
    assert.equal(o.lessonId, "lesson-scan-001");
    assert.equal(o.helpful, false);
    assert.equal(o.source, "scanner-pattern-match");
    assert.match(o.executor, /^scanner:v\d+/);
    assert.ok(o.matchedPattern, "expected matchedPattern to be set");
  });
});

describe("scan-outcomes — pattern miss → helpful=true", () => {
  it("no commit diff matches the pattern → helpful=true", () => {
    seed({
      lessonExtra: {
        // Pattern that never appears in our seeded commits.
        wrongApproachPattern: "rm -rf node_modules && npm install",
      },
    });
    commit("README.md", "# project\n", "docs: initial readme");
    commit("src/app.ts", "export const x = 1;\n", "feat(app): export x");

    const r = runCli(["scan-outcomes", "--max", "10"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const outcomes = readJsonl(OUTCOMES_PATH);
    assert.equal(outcomes.length, 1);
    const o = outcomes[0];
    assert.equal(o.helpful, true);
    assert.equal(o.source, "scanner-no-match");
    assert.equal(o.matchedPattern, undefined);
  });
});

describe("scan-outcomes — no wrongApproachPattern → helpful=null", () => {
  it("lesson without a pattern (and no DSPy) writes helpful=null", () => {
    seed(); // wrongApproachPattern omitted
    commit("README.md", "# project\n", "docs: initial readme");

    const r = runCli(["scan-outcomes", "--max", "10"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const outcomes = readJsonl(OUTCOMES_PATH);
    assert.equal(outcomes.length, 1);
    const o = outcomes[0];
    assert.equal(o.helpful, null);
    assert.equal(o.source, "scanner-no-match");
  });
});

describe("scan-outcomes — --dry-run does not write", () => {
  it("--dry-run prints proposals but writes nothing to outcomes.jsonl", () => {
    seed({
      lessonExtra: {
        wrongApproachPattern: "npm test\\b(?!.*npm run build)",
      },
    });
    commit("scripts/test.sh", "#!/bin/sh\nnpm test\n", "feat(scripts): test runner");

    const r = runCli(["scan-outcomes", "--max", "10", "--dry-run"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /\(dry-run\)/);
    assert.match(r.stdout, /HELPFUL|NOT-HELPFUL|UNKNOWN/);
    assert.equal(readJsonl(OUTCOMES_PATH).length, 0);
  });
});

describe("scan-outcomes — idempotency", () => {
  it("re-running the scan produces no second line per recall", () => {
    seed({
      lessonExtra: {
        wrongApproachPattern: "npm test\\b(?!.*npm run build)",
      },
    });
    commit("scripts/test.sh", "#!/bin/sh\nnpm test --watch\n", "feat(scripts): runner");

    const first = runCli(["scan-outcomes", "--max", "10"]);
    assert.equal(first.status, 0, `stderr=${first.stderr}`);
    assert.equal(readJsonl(OUTCOMES_PATH).length, 1);

    const second = runCli(["scan-outcomes", "--max", "10"]);
    assert.equal(second.status, 0, `stderr=${second.stderr}`);
    assert.equal(readJsonl(OUTCOMES_PATH).length, 1, "scanner must not double-write");
  });
});
