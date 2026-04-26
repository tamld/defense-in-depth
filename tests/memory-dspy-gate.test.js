/**
 * E2E tests for the lesson quality gate's DSPy fallback — Issue #14 scope update.
 *
 * Scope: prove that recordLesson() with `dspy.enabled = true` behaves
 * correctly across four DSPy states: down (unreachable), down (HTTP 500),
 * low score (gate rejects), high score (happy path).
 *
 * Critical bug DOCUMENTED here (NOT fixed):
 *   When DSPy is enabled but the call fails (network down OR 500 response),
 *   recordLesson silently persists the lesson without emitting any WARN to
 *   the user. The user has no way of knowing the quality gate was bypassed.
 *
 *   This is the "silent degradation" bug noted in maintainer-comment #14.
 *   Tests in scenarios 1 and 2 assert the CURRENT (buggy) behavior so a
 *   future refactor cannot accidentally re-introduce it without conscious
 *   review. PR B (separate) will fix the bug and flip the assertions.
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
let warnCapture;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-memory-gate-"));
  warnCapture = [];
  savedWarn = console.warn;
  console.warn = (...args) => {
    warnCapture.push(args.map((a) => String(a)).join(" "));
  };
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.warn = savedWarn;
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
  // BUG: quality gate silently passes when DSPy is down (no WARN emitted).
  // This test documents current behavior. Fix tracked in PR B (separate issue).
  // DO NOT change this assertion without also fixing memory.ts and adding the WARN.
  it("persists the lesson with qualityScore=null and emits NO user-facing WARN", async () => {
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

    // BUG ASSERTION (PR A): the only warning emitted is the dspy-client's
    // internal "DSPy evaluation failed" log. There is NO WARN that tells
    // the user "Lesson persisted WITHOUT quality check" — the silent-
    // degradation bug. PR B will introduce that WARN and this assertion
    // will flip from "no quality-gate warning" to "quality-gate WARN present".
    const qualityGateWarn = warnCapture.find((line) =>
      /quality.?gate/i.test(line) && /persisted WITHOUT/i.test(line),
    );
    assert.equal(
      qualityGateWarn,
      undefined,
      "BUG: no quality-gate-bypass WARN is emitted today; PR B will add it",
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

  // BUG: quality gate silently passes when DSPy is down (no WARN emitted).
  // This test documents current behavior. Fix tracked in PR B (separate issue).
  // DO NOT change this assertion without also fixing memory.ts and adding the WARN.
  it("persists the lesson with qualityScore=null and emits NO user-facing WARN", async () => {
    const result = await recordLesson(BASE_LESSON, tmp, {
      enabled: true,
      endpoint: stub.endpoint,
      timeoutMs: 500,
    });

    assert.equal(result.persisted, true, "lesson is persisted despite gate returning 500");
    assert.equal(result.qualityScore, null, "qualityScore must be null on 500");
    assert.equal(readPersistedCount(), 1, "lessons.jsonl must contain the persisted lesson");
    assert.ok(stub.requests.length >= 1, "stub server must have been contacted");

    const qualityGateWarn = warnCapture.find((line) =>
      /quality.?gate/i.test(line) && /persisted WITHOUT/i.test(line),
    );
    assert.equal(
      qualityGateWarn,
      undefined,
      "BUG: no quality-gate-bypass WARN is emitted today; PR B will add it",
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
