/**
 * Lesson outcome writer tests (issue #23 MVP).
 *
 * Drives the compiled CLI as a subprocess against an isolated tmp dir.
 * Asserts the eager + active half of the LessonOutcome pipeline:
 *   - searchLessons() writes one RecallEvent per result returned
 *   - re-running the same query within the dedupe window is a no-op
 *   - `did lesson outcome <id> --helpful` requires a prior recall
 *   - `did lesson outcome <id> --helpful` writes a LessonOutcome with
 *     source="cli-explicit", linked to the most recent recall
 *   - re-running the same outcome cli is idempotent (no second line)
 *   - missing flag combinations exit non-zero with a helpful stderr
 *
 * Mock audit: real fs, real subprocess, no network, no git. Pure CLI
 * behavior — mirrors `tests/feedback-writer.test.js`.
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
const RECALLS_PATH = ".agents/records/lesson-recalls.jsonl";
const OUTCOMES_PATH = ".agents/records/lesson-outcomes.jsonl";
const LESSONS_PATH = "lessons.jsonl";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-lesson-w-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

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

/** Seed a single lesson into lessons.jsonl. */
function seedLesson(extra = {}) {
  const lesson = {
    id: "lesson-test-001",
    title: "Test lesson alpha",
    scenario: "When the agent runs `npm test` without building first",
    wrongApproach: "Run npm test directly without npm run build",
    correctApproach: "Always run npm run build before npm test",
    insight: "Build artifacts must exist before tests can import compiled code",
    category: "process",
    evidence: "RUNTIME",
    confidence: 0.9,
    searchTerms: ["build", "test", "npm"],
    createdAt: new Date().toISOString(),
    ...extra,
  };
  fs.writeFileSync(path.join(tmp, LESSONS_PATH), JSON.stringify(lesson) + "\n");
  return lesson;
}

describe("lesson search → records a RecallEvent", () => {
  it("writes one recall line per result with stable id shape", () => {
    seedLesson();
    const r = runCli(["search", "build"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const recalls = readJsonl(RECALLS_PATH);
    assert.equal(recalls.length, 1, `expected 1 recall, got: ${JSON.stringify(recalls)}`);
    const e = recalls[0];
    assert.equal(e.lessonId, "lesson-test-001");
    assert.equal(e.matchMethod, "string");
    assert.equal(e.source, "search");
    assert.equal(e.executor, "human");
    assert.equal(e.ticketId, "");
    assert.match(e.id, /^[0-9a-f]{16}$/);
    assert.match(e.queryHash, /^[0-9a-f]{16}$/);
    assert.match(e.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("re-searching the same query is a no-op within the 1-hour window", () => {
    seedLesson();
    const first = runCli(["search", "build"]);
    assert.equal(first.status, 0);
    const second = runCli(["search", "build"]);
    assert.equal(second.status, 0);
    const recalls = readJsonl(RECALLS_PATH);
    assert.equal(recalls.length, 1, `dedupe failed: ${JSON.stringify(recalls)}`);
  });

  it("--ticket attribution lands on the recall event", () => {
    seedLesson();
    const r = runCli(["search", "--ticket", "TK-42", "build"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const recalls = readJsonl(RECALLS_PATH);
    assert.equal(recalls.length, 1);
    assert.equal(recalls[0].ticketId, "TK-42");
  });
});

describe("lesson outcome — explicit cli writes a LessonOutcome", () => {
  it("--helpful writes one outcome linked to the most recent recall", () => {
    seedLesson();
    const search = runCli(["search", "build"]);
    assert.equal(search.status, 0, `stderr=${search.stderr}`);
    const recalls = readJsonl(RECALLS_PATH);
    assert.equal(recalls.length, 1);

    const r = runCli(["outcome", "lesson-test-001", "--helpful"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const outcomes = readJsonl(OUTCOMES_PATH);
    assert.equal(outcomes.length, 1);
    const o = outcomes[0];
    assert.equal(o.lessonId, "lesson-test-001");
    assert.equal(o.recallId, recalls[0].id);
    assert.equal(o.helpful, true);
    assert.equal(o.source, "cli-explicit");
    assert.equal(o.executor, "human");
    assert.match(o.id, /^[0-9a-f]{16}$/);
  });

  it("re-running the same outcome cli is idempotent (no second line)", () => {
    seedLesson();
    runCli(["search", "build"]);
    const first = runCli(["outcome", "lesson-test-001", "--helpful"]);
    assert.equal(first.status, 0, `stderr=${first.stderr}`);
    const second = runCli(["outcome", "lesson-test-001", "--helpful"]);
    assert.equal(second.status, 0, `stderr=${second.stderr}`);
    assert.match(second.stderr, /already recorded/);
    const outcomes = readJsonl(OUTCOMES_PATH);
    assert.equal(outcomes.length, 1);
  });

  it("--not-helpful writes helpful=false with a distinct id", () => {
    seedLesson();
    runCli(["search", "build"]);
    runCli(["outcome", "lesson-test-001", "--helpful"]);
    const r = runCli(["outcome", "lesson-test-001", "--not-helpful"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const outcomes = readJsonl(OUTCOMES_PATH);
    assert.equal(outcomes.length, 2, JSON.stringify(outcomes));
    const labels = outcomes.map((o) => o.helpful).sort();
    assert.deepEqual(labels, [false, true]);
  });

  it("missing prior recall exits 1 with a helpful stderr", () => {
    seedLesson();
    const r = runCli(["outcome", "lesson-test-001", "--helpful"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no prior recall event/);
    assert.equal(readJsonl(OUTCOMES_PATH).length, 0);
  });

  it("requires exactly one of --helpful or --not-helpful", () => {
    seedLesson();
    runCli(["search", "build"]);
    const both = runCli(["outcome", "lesson-test-001", "--helpful", "--not-helpful"]);
    assert.equal(both.status, 1);
    assert.match(both.stderr, /exactly one of --helpful or --not-helpful/);
    const neither = runCli(["outcome", "lesson-test-001"]);
    assert.equal(neither.status, 1);
    assert.match(neither.stderr, /exactly one of --helpful or --not-helpful/);
  });
});
