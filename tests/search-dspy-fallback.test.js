/**
 * E2E tests for searchLessons --semantic DSPy fallback — Issue #24 Site #1.
 *
 * Background: PR #20 closed the silent-degradation contract for
 * recordLesson(--quality-gate) and `eval <file>`. The post-merge audit
 * surfaced two more sites with the same bug pattern. This file covers
 * Site #1 — searchLessons() in semantic mode.
 *
 * Pre-fix behavior: when callDspyRank() returned null (service unavailable
 * / timeout / 500), searchLessons silently fell through to string-matching
 * mode. Users who explicitly opted into Tier-1 semantic search received
 * Tier-0 string-match results with zero indication.
 *
 * Post-fix behavior: same fall-through (graceful degradation preserves
 * search results) but stderr now carries the contract-level WARN so the
 * downgrade is visible. Same contract surface as PR #20's two fixes.
 *
 * Real fs (os.tmpdir), real local HTTP stub for the negative control,
 * real port-1 ECONNREFUSED for the positive case. No fetch mocks.
 *
 * Executor: Devin-AI
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { searchLessons } from "../dist/core/memory.js";

import { createDspyStub, getClosedPort } from "./helpers/dspy-stub.js";

const SAMPLE_LESSONS = [
  {
    id: "L-001",
    title: "Cite source files when describing runtime behavior",
    scenario: "Agent claimed a return shape without running the code.",
    wrongApproach: "Inferring runtime values from type signatures alone.",
    correctApproach: "Open the source, run the test, paste actual output.",
    insight: "Agents must distinguish [INFER] from [RUNTIME].",
    category: "process",
    evidence: "runtime",
    confidence: 0.9,
    createdAt: "2026-04-30T00:00:00.000Z",
    searchTerms: ["citation", "evidence", "runtime"],
  },
  {
    id: "L-002",
    title: "Tier-1 features must signal when they degrade to Tier-0",
    scenario: "Quality gate silently bypassed when DSPy was down.",
    wrongApproach: "Treat null return as 'nothing to do' and continue silently.",
    correctApproach: "Add an explicit else branch that writes a WARN to stderr.",
    insight: "Progressive Enhancement requires user-visible signals on degrade.",
    category: "code",
    evidence: "runtime",
    confidence: 0.95,
    createdAt: "2026-04-30T00:00:01.000Z",
    searchTerms: ["dspy", "tier-1", "fallback", "degradation"],
  },
];

let tmp;
let savedStderrWrite;
let stderrCapture;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-search-dspy-"));
  // Seed the lessons file the searchLessons() reader expects.
  fs.writeFileSync(
    path.join(tmp, "lessons.jsonl"),
    SAMPLE_LESSONS.map((l) => JSON.stringify(l)).join("\n") + "\n",
  );
  stderrCapture = [];
  // Capture stderr (but still forward) so assertions can grep the captured
  // strings without losing real-time test runner output. memory.ts emits
  // the search-fallback WARN through process.stderr.write rather than
  // console.warn; same rationale as in memory-dspy-gate.test.js.
  savedStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, encoding, cb) => {
    stderrCapture.push(String(chunk));
    return savedStderrWrite(chunk, encoding, cb);
  };
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  process.stderr.write = savedStderrWrite;
});

describe("searchLessons --semantic — DSPy unreachable", () => {
  it("falls back to string matching AND emits the search-WARN to stderr", async () => {
    const { endpoint } = await getClosedPort();

    const results = await searchLessons("tier-1", tmp, {
      enabled: true,
      endpoint,
      timeoutMs: 500,
    });

    // Graceful degradation preserves results — string matcher finds L-002
    // via searchTerms or text body, so we get a non-empty array.
    assert.ok(results.length >= 1, `expected string-match results; got ${results.length}`);
    assert.equal(
      results[0].matchMethod,
      "string",
      "fall-through must mark results as string-matched",
    );

    // Contract-level WARN must land on stderr so a user reading their
    // terminal sees that semantic search was downgraded for this run.
    const warn = stderrCapture.find(
      (line) =>
        /\[search\]/.test(line) &&
        /DSPy semantic ranking unavailable/.test(line) &&
        /falling back to string match/.test(line),
    );
    assert.ok(
      warn,
      `expected the search-fallback WARN on stderr; captured: ${JSON.stringify(stderrCapture)}`,
    );
  });

  it("emits the WARN exactly once per searchLessons call", async () => {
    const { endpoint } = await getClosedPort();

    await searchLessons("tier-1", tmp, {
      enabled: true,
      endpoint,
      timeoutMs: 500,
    });

    const matches = stderrCapture.filter((line) =>
      /\[search\] DSPy semantic ranking unavailable/.test(line),
    );
    assert.equal(
      matches.length,
      1,
      `expected exactly one WARN per call; captured ${matches.length}: ${JSON.stringify(stderrCapture)}`,
    );
  });
});

describe("searchLessons --semantic — DSPy returns 500 (graceful degradation)", () => {
  let stub;

  afterEach(async () => {
    if (stub) {
      await stub.close();
      stub = undefined;
    }
  });

  it("treats HTTP 500 the same as unreachable: string fallback + WARN", async () => {
    stub = await createDspyStub({ mode: "500" });

    const results = await searchLessons("tier-1", tmp, {
      enabled: true,
      endpoint: stub.endpoint,
      timeoutMs: 5000,
    });

    assert.ok(results.length >= 1, "string-match results must still be returned");
    assert.equal(results[0].matchMethod, "string");

    const warn = stderrCapture.find((line) =>
      /\[search\] DSPy semantic ranking unavailable/.test(line),
    );
    assert.ok(warn, `expected the WARN on stderr; captured: ${JSON.stringify(stderrCapture)}`);

    // Sanity: the stub actually got contacted (proves we hit the network
    // path, not just the closed-port fast-fail path).
    assert.ok(stub.requests.length >= 1, "stub server must have been contacted");
  });
});

describe("searchLessons --semantic — happy path (negative control)", () => {
  let stub;

  afterEach(async () => {
    if (stub) {
      await stub.close();
      stub = undefined;
    }
  });

  it("does NOT emit the search-WARN when DSPy returns valid rankings", async () => {
    // The DSPy stub returns a single-score response by default; callDspyRank
    // expects a `results` array, so a non-rank response yields ranked=null
    // and triggers the WARN path. To exercise the *happy* path we must hand
    // the stub a /rank-shaped JSON. The stub's default mode is "score" which
    // returns `{score, feedback}`. We therefore need a custom server here
    // that returns `{results: [...]}` for the rank query.
    const http = await import("node:http");
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c.toString()));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            results: [
              { id: "L-002", score: 0.91, feedback: "highly relevant" },
              { id: "L-001", score: 0.42, feedback: "marginal" },
            ],
          }),
        );
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;
    try {
      const results = await searchLessons("tier-1", tmp, {
        enabled: true,
        endpoint: `http://127.0.0.1:${port}/rank`,
        timeoutMs: 5000,
      });

      assert.ok(results.length >= 1, "semantic results must come back");
      assert.equal(
        results[0].matchMethod,
        "semantic",
        "happy-path results must be marked semantic, not string",
      );

      // Anti-hallucination pair: without this assertion the test above
      // would still pass even if memory.ts always emitted the WARN.
      const warn = stderrCapture.find((line) =>
        /\[search\] DSPy semantic ranking unavailable/.test(line),
      );
      assert.equal(
        warn,
        undefined,
        `WARN must be silent on the happy path; captured: ${JSON.stringify(stderrCapture)}`,
      );
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
