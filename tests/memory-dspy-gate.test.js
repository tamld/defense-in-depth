/**
 * E2E tests for the lesson quality gate's DSPy fallback — Issue #14 scope update.
 *
 * Scope: prove that recordLesson() with `dspy.enabled = true` behaves
 * correctly across four DSPy states: down (unreachable), down (HTTP 500),
 * low score (gate rejects), high score (happy path).
 *
 * HISTORY:
 *   - PR A (#17) shipped these scenarios asserting the CURRENT (buggy)
 *     behavior where scenarios 1+2 emitted NO WARN on DSPy failure.
 *   - PR B (this PR, issue #19) adds the quality-gate-bypass WARN to
 *     src/core/memory.ts and flips scenarios 1+2 to assert the WARN
 *     IS NOW EMITTED. That is the "red → green" arc of the silent-
 *     degradation bug.
 *
 * Real local HTTP stub server (tests/helpers/dspy-stub.js) exercises
 * src/core/memory.ts → callDspy() end-to-end — no fetch mocks.
 *
 * Executor: Devin-AI
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { recordLesson } from "../dist/core/memory.js";
import { EvidenceLevel } from "../dist/core/types.js";

import { createDspyStub, getClosedPort } from "./helpers/dspy-stub.js";

const BASE_LESSON = {
  title: "Always cite source files when describing behavior",
  scenario:
    "An agent claimed a function returned an ISO-8601 timestamp but did not link to the source file or test output that proved it.",
  wrongApproach:
    "Asserting return-value shapes from inferred behavior without running or reading the code.",
  correctApproach:
    "Open the source, run the test, paste the actual output, and tag the claim [RUNTIME].",
  insight:
    "Agents must distinguish [INFER] from [RUNTIME]; users cannot trust untagged claims.",
  category: "process",
  evidence: EvidenceLevel.RUNTIME,
  confidence: 0.9,
};

let tmp;
let savedWarn;
let savedStderrWrite;
let warnCapture;
let stderrCapture;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-memory-gate-"));
  warnCapture = [];
  stderrCapture = [];
  savedWarn = console.warn;
  console.warn = (...args) => {
    warnCapture.push(args.map((a) => String(a)).join(" "));
  };
  // Capture stderr writes. memory.ts emits the quality-gate-bypass WARN
  // through process.stderr.write (not console.warn) so tests can assert
  // against a predictable sink — console.warn in some Node versions adds
  // timestamps or labels that break regex-based matching.
  savedStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, encoding, cb) => {
    stderrCapture.push(String(chunk));
    return savedStderrWrite(chunk, encoding, cb);
  };
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.warn = savedWarn;
  process.stderr.write = savedStderrWrite;
});

function readPersistedCount() {
  const p = path.join(tmp, "lessons.jsonl");
  if (!fs.existsSync(p)) return 0;
  return fs
    .readFileSync(p, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0).length;
}

describe("recordLesson + DSPy quality gate — Scenario 1: DSPy unreachable", () => {
  // Fixed in PR B (#19): the gate now emits a WARN to stderr whenever DSPy
  // is enabled but callDspy() returns null, so users immediately see that
  // the quality guarantee was bypassed for this record.
  it("persists the lesson with qualityScore=null AND emits quality-gate-bypass WARN to stderr", async () => {
    const { endpoint } = await getClosedPort();

    const result = await recordLesson(BASE_LESSON, tmp, {
      enabled: true,
      endpoint,
      timeoutMs: 500,
    });

    assert.equal(result.persisted, true, "lesson is persisted despite gate being unreachable");
    assert.equal(result.qualityScore, null, "qualityScore must be null (not 0)");
    assert.equal(result.qualityFeedback, null, "qualityFeedback must be null when DSPy is down");
    assert.equal(readPersistedCount(), 1, "lessons.jsonl must contain the persisted lesson");

    // PR B contract: the quality-gate-bypass WARN MUST be emitted to stderr
    // so users cannot miss it. This closes the silent-degradation bug.
    const qualityGateWarn = stderrCapture.find(
      (line) => /\[quality-gate\]/.test(line) && /persisted WITHOUT/.test(line),
    );
    assert.ok(
      qualityGateWarn,
      `expected a quality-gate-bypass WARN on stderr; captured: ${JSON.stringify(stderrCapture)}`,
    );
  });
});

describe("recordLesson + DSPy quality gate — Scenario 2: DSPy returns HTTP 500", () => {
  let stub;

  beforeEach(async () => {
    stub = await createDspyStub({ mode: "500" });
  });

  afterEach(async () => {
    await stub.close();
  });

  // Fixed in PR B (#19): same silent-degradation bug as Scenario 1 —
  // a 500 from DSPy must not be swallowed silently.
  it("persists the lesson with qualityScore=null AND emits quality-gate-bypass WARN to stderr", async () => {
    const result = await recordLesson(BASE_LESSON, tmp, {
      enabled: true,
      endpoint: stub.endpoint,
      timeoutMs: 500,
    });

    assert.equal(result.persisted, true, "lesson is persisted despite gate returning 500");
    assert.equal(result.qualityScore, null, "qualityScore must be null on 500");
    assert.equal(readPersistedCount(), 1, "lessons.jsonl must contain the persisted lesson");
    assert.ok(stub.requests.length >= 1, "stub server must have been contacted");

    const qualityGateWarn = stderrCapture.find(
      (line) => /\[quality-gate\]/.test(line) && /persisted WITHOUT/.test(line),
    );
    assert.ok(
      qualityGateWarn,
      `expected a quality-gate-bypass WARN on stderr; captured: ${JSON.stringify(stderrCapture)}`,
    );
  });
});

describe("recordLesson + DSPy quality gate — Scenario 3: low semantic score", () => {
  let stub;

  beforeEach(async () => {
    stub = await createDspyStub({ mode: "score", score: 0.2, feedback: "too generic" });
  });

  afterEach(async () => {
    await stub.close();
  });

  // Sanity check: when DSPy IS reachable and returns a low score, the gate
  // does its job. This is the contrast scenario that proves the gate works
  // when the network is healthy — making the silent-degradation bug above
  // significant by comparison.
  it("rejects the lesson (persisted=false) when DSPy returns score < 0.5", async () => {
    const result = await recordLesson(BASE_LESSON, tmp, {
      enabled: true,
      endpoint: stub.endpoint,
      timeoutMs: 500,
    });

    assert.equal(result.persisted, false, "gate must reject low-quality lesson");
    assert.equal(result.qualityScore, 0.2, "qualityScore must reflect DSPy verdict");
    assert.equal(result.qualityFeedback, "too generic", "feedback must propagate");
    assert.equal(readPersistedCount(), 0, "rejected lesson must not be persisted");
  });
});

describe("recordLesson + DSPy quality gate — Scenario 4: high semantic score", () => {
  let stub;

  beforeEach(async () => {
    stub = await createDspyStub({ mode: "score", score: 0.85, feedback: "actionable + specific" });
  });

  afterEach(async () => {
    await stub.close();
  });

  // Happy path: DSPy reachable + high score ⇒ persisted with feedback.
  it("persists the lesson with the DSPy score+feedback when score >= 0.5", async () => {
    const result = await recordLesson(BASE_LESSON, tmp, {
      enabled: true,
      endpoint: stub.endpoint,
      timeoutMs: 500,
    });

    assert.equal(result.persisted, true, "happy path persists");
    assert.equal(result.qualityScore, 0.85, "qualityScore must propagate");
    assert.equal(result.qualityFeedback, "actionable + specific", "feedback must propagate");
    assert.equal(readPersistedCount(), 1, "lessons.jsonl must contain the persisted lesson");
  });
});
