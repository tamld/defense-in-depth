/**
 * E2E adversarial tests for the DSPy fallback chain — Issue #14.
 *
 * Scope: prove that the L1 (regex) → L2 (length) → L3 (DSPy) pipeline
 * degrades gracefully when DSPy is unreachable, slow, or returns
 * adversarial scores. Real local HTTP stub server (tests/helpers/dspy-stub.js)
 * exercises src/core/dspy-client.ts callDspy() end-to-end — no fetch mocks,
 * no http mocks.
 *
 * Architectural contracts under test:
 *   1. WARN-NOT-BLOCK — DSPy findings never block (severity = WARN)
 *   2. GRACEFUL DEGRADATION — failure ⇒ null, never throws
 *   3. L1+L2 INTEGRITY — deterministic checks remain authoritative
 *      regardless of DSPy availability
 *
 * Spec source: GitHub issue #14 acceptance criteria + maintainer plan
 *   approval comment.
 *
 * Mock audit: real fs (os.tmpdir), real HTTP via createDspyStub, real engine.
 *   console.warn silenced per-test to keep stdout clean while still letting
 *   tests inspect emitted warnings via a captured array when needed.
 *
 * Executor: Devin-AI
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { DefendEngine } from "../dist/core/engine.js";
import { hollowArtifactGuard } from "../dist/guards/hollow-artifact.js";
import { callDspy } from "../dist/core/dspy-client.js";
import { Severity } from "../dist/core/types.js";

import { createDspyStub, getClosedPort } from "./helpers/dspy-stub.js";

// Substantive content that passes the L2 minimum-length check by itself.
// Reused across scenarios so we can isolate which layer triggers a finding.
const SUBSTANTIVE =
  "This document contains a real paragraph of meaningful content that is well above the default minimum length threshold so that length-based findings do not interfere with the layer we are exercising right now.";

let tmp;
let savedWarn;
let warnCapture;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-dspy-fallback-"));
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

function write(rel, content) {
  fs.writeFileSync(path.join(tmp, rel), content);
}

function makeConfig(hollowOverrides = {}) {
  return {
    version: "1.0",
    guards: {
      hollowArtifact: {
        enabled: true,
        useDspy: true,
        dspyTimeoutMs: 1000,
        extensions: [".md"],
        ...hollowOverrides,
      },
    },
  };
}

describe("DSPy fallback — Scenario 1: endpoint unreachable", () => {
  // AC: DSPy unreachable + useDspy=true ⇒ L1 still BLOCKs hollow artifacts.
  // The deterministic regex layer must be authoritative even when the
  // semantic layer cannot be reached.
  it("L1 BLOCK still fires on a TODO-only file when DSPy is unreachable", async () => {
    const { endpoint } = await getClosedPort();
    write("hollow.md", "# Title\n\nTODO: write the rest of this doc.\n");

    const engine = new DefendEngine(
      tmp,
      makeConfig({ dspyEndpoint: endpoint }),
    );
    engine.use(hollowArtifactGuard);

    const verdict = await engine.run(["hollow.md"]);

    assert.equal(verdict.passed, false, "L1 must BLOCK on TODO regardless of DSPy state");
    const blocking = verdict.results
      .flatMap((r) => r.findings)
      .filter((f) => f.severity === Severity.BLOCK);
    assert.ok(
      blocking.some((f) => f.filePath === "hollow.md"),
      "expected a BLOCK finding for hollow.md",
    );
  });

  it("DSPy unreachable degrades to null in semanticEvals (no throw)", async () => {
    const { endpoint } = await getClosedPort();
    write("doc.md", `${SUBSTANTIVE}\n`);

    let observed;
    const engine = new DefendEngine(
      tmp,
      makeConfig({ dspyEndpoint: endpoint }),
    );
    engine.use({
      id: "observer",
      name: "observer",
      description: "captures ctx.semanticEvals",
      check: async (ctx) => {
        observed = ctx.semanticEvals;
        return { guardId: "observer", passed: true, findings: [], durationMs: 0 };
      },
    });

    await engine.run(["doc.md"]);

    assert.ok(observed?.dspy, "engine must populate semanticEvals.dspy even on failure");
    assert.equal(observed.dspy["doc.md"], null, "unreachable DSPy ⇒ null entry");
  });
});

describe("DSPy fallback — Scenario 2: endpoint returns HTTP 500", () => {
  let stub;

  beforeEach(async () => {
    stub = await createDspyStub({ mode: "500" });
  });

  afterEach(async () => {
    await stub.close();
  });

  // AC: DSPy 500 ⇒ pipeline continues, no crash, no BLOCK-from-DSPy.
  // callDspy emits a console.warn but returns null; engine records null.
  it("pipeline completes and stores null for the file when DSPy returns 500", async () => {
    write("doc.md", `${SUBSTANTIVE}\n`);

    let observed;
    const engine = new DefendEngine(
      tmp,
      makeConfig({ dspyEndpoint: stub.endpoint }),
    );
    engine.use({
      id: "observer",
      name: "observer",
      description: "captures ctx.semanticEvals",
      check: async (ctx) => {
        observed = ctx.semanticEvals;
        return { guardId: "observer", passed: true, findings: [], durationMs: 0 };
      },
    });
    engine.use(hollowArtifactGuard);

    const verdict = await engine.run(["doc.md"]);

    assert.equal(verdict.passed, true, "no BLOCK should arise from DSPy 500");
    assert.ok(observed?.dspy, "semanticEvals.dspy must be populated");
    assert.equal(observed.dspy["doc.md"], null, "500 ⇒ null entry");
    assert.ok(stub.requests.length > 0, "stub server must have been contacted at least once");
    assert.ok(
      warnCapture.some((line) => /500/.test(line)),
      "callDspy should emit a WARN about the 500 status",
    );
  });
});

describe("DSPy fallback — Scenario 3: low semantic score", () => {
  let stub;

  beforeEach(async () => {
    stub = await createDspyStub({ mode: "score", score: 0.0, feedback: "very generic" });
  });

  afterEach(async () => {
    await stub.close();
  });

  // AC: score=0.0 ⇒ WARN finding, never BLOCK. WARN-NOT-BLOCK is the
  // architectural contract for any DSPy-derived finding.
  it("substantive doc with score 0.0 produces a WARN, never BLOCK", async () => {
    write("doc.md", `${SUBSTANTIVE}\n`);

    const engine = new DefendEngine(
      tmp,
      makeConfig({ dspyEndpoint: stub.endpoint }),
    );
    engine.use(hollowArtifactGuard);

    const verdict = await engine.run(["doc.md"]);

    const findings = verdict.results.flatMap((r) => r.findings);
    const warns = findings.filter((f) => f.severity === Severity.WARN);
    const blocks = findings.filter((f) => f.severity === Severity.BLOCK);

    assert.equal(blocks.length, 0, "DSPy must never produce a BLOCK finding");
    assert.ok(
      warns.some((f) => f.filePath === "doc.md" && /DSPy/.test(f.message)),
      "expected a DSPy WARN for doc.md with score 0.0",
    );
    assert.equal(verdict.passed, true, "WARN-only ⇒ pipeline still passes");
  });
});

describe("DSPy fallback — Scenario 4: server-side hang triggers AbortController", () => {
  let stub;

  beforeEach(async () => {
    stub = await createDspyStub({ mode: "timeout" });
  });

  afterEach(async () => {
    await stub.close();
  });

  // AC: timeout ⇒ callDspy returns null within timeoutMs + buffer.
  // We assert directly against callDspy here so the timing assertion is not
  // diluted by engine bookkeeping. The buffer accounts for AbortController
  // teardown and event-loop scheduling on slow CI.
  it("returns null within timeoutMs + buffer when the server never responds", async () => {
    const timeoutMs = 200;
    const startedAt = Date.now();
    const result = await callDspy(
      { type: "artifact", id: "doc.md", content: SUBSTANTIVE },
      stub.endpoint,
      timeoutMs,
    );
    const elapsed = Date.now() - startedAt;

    assert.equal(result, null, "timeout must surface as null (graceful degradation)");
    assert.ok(
      elapsed < timeoutMs + 1500,
      `callDspy elapsed ${elapsed}ms; expected < ${timeoutMs + 1500}ms (timeoutMs + buffer)`,
    );
    assert.ok(
      warnCapture.some((line) => /DSPy evaluation failed/.test(line)),
      "callDspy should emit a WARN about the abort/timeout",
    );
  });
});
