/**
 * Feedback writer tests (issue #22 MVP).
 *
 * Drives the compiled CLI as a subprocess against an isolated tmp dir.
 * Asserts:
 *   - active mode appends a valid FeedbackEvent line to the JSONL
 *   - second invocation with same inputs is idempotent (no-op + WARN)
 *   - missing --finding emits a clear stderr error and exits non-zero
 *   - --ticket is optional (Persona A path, Q2 default)
 *
 * Mock audit: real fs, real subprocess, no network, no git. Pure CLI behavior.
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
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-feedback-w-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, "feedback", ...args], {
    cwd: tmp,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
  });
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

describe("feedback writer — active CLI mode", () => {
  it("tp + --guard + --finding writes one valid FeedbackEvent line", () => {
    const r = runCli([
      "tp",
      "--guard",
      "hollowArtifact",
      "--ticket",
      "TK-100",
      "--finding",
      "test finding alpha",
    ]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /TP recorded for guard "hollowArtifact"/);
    const events = readJsonl();
    assert.equal(events.length, 1);
    assert.equal(events[0].guardId, "hollowArtifact");
    assert.equal(events[0].ticketId, "TK-100");
    assert.equal(events[0].label, "TP");
    assert.equal(events[0].source, "cli");
    assert.equal(events[0].executor, "human");
    assert.match(events[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(events[0].id, /^[0-9a-f]{16}$/);
    assert.match(events[0].findingHash, /^[0-9a-f]{16}$/);
  });

  it("re-running the same command is idempotent: no second line, WARN to stderr", () => {
    const args = [
      "fp",
      "--guard",
      "phaseGate",
      "--ticket",
      "TK-200",
      "--finding",
      "duplicate test finding",
    ];
    const first = runCli(args);
    assert.equal(first.status, 0);
    const second = runCli(args);
    assert.equal(second.status, 0);
    assert.match(second.stderr, /already recorded/);
    assert.equal(readJsonl().length, 1);
  });

  it("missing --finding exits 1 with a helpful stderr message", () => {
    const r = runCli([
      "tp",
      "--guard",
      "hollowArtifact",
      "--ticket",
      "TK-300",
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /requires --finding/);
    assert.equal(readJsonl().length, 0);
  });

  it("--ticket is optional (Persona A path); ticketId becomes empty string", () => {
    const r = runCli([
      "tn",
      "--guard",
      "branchNaming",
      "--finding",
      "no ticket case",
    ]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const events = readJsonl();
    assert.equal(events.length, 1);
    assert.equal(events[0].ticketId, "");
    assert.equal(events[0].label, "TN");
  });

  it("missing --guard exits 1 with a helpful stderr message", () => {
    const r = runCli(["tp", "--finding", "x"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /requires --guard/);
  });
});

describe("feedback list — read back", () => {
  it("returns appended events with --guard filter", () => {
    runCli([
      "tp",
      "--guard",
      "hollowArtifact",
      "--finding",
      "alpha",
    ]);
    runCli([
      "fp",
      "--guard",
      "phaseGate",
      "--finding",
      "beta",
    ]);
    const r = runCli(["list", "--guard", "hollowArtifact"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /TP\s+hollowArtifact/);
    assert.doesNotMatch(r.stdout, /phaseGate/);
    assert.match(r.stdout, /1 event\(s\)/);
  });

  it("returns a friendly empty message when no events exist", () => {
    const r = runCli(["list"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no feedback events match/);
  });
});
