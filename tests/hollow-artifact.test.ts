import test from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { hollowArtifactGuard } from "../src/guards/hollow-artifact.js";
import { Severity } from "../src/core/types.js";

// Utility to create a temporary workspace
function createTempWorkspace(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-test-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

let originalFetch: typeof globalThis.fetch;

test("Hollow Artifact Guard (v0.5)", async (t) => {
  t.beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("deterministic checks", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    
    // Write test files
    fs.writeFileSync(path.join(dir, "good.md"), "# Valid Doc\n\nThis is a totally valid and substantive document with plenty of words to pass the minimum length check, unlike an empty file.");
    fs.writeFileSync(path.join(dir, "hollow.md"), "# My Doc\nTODO: write this");
    fs.writeFileSync(path.join(dir, "small.md"), "too small");

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["good.md", "hollow.md", "small.md"],
      config: {
        guards: {
          hollowArtifact: {
            useDspy: false, 
            minContentLength: 50
          }
        }
      }
    } as any;

    const result = await hollowArtifactGuard.check(ctx);
    
    assert.strictEqual(result.passed, false, "Should fail due to hollow file");
    
    const hollowFinding = result.findings.find(f => f.filePath === "hollow.md");
    assert.ok(hollowFinding);
    assert.strictEqual(hollowFinding.severity, Severity.BLOCK);
    
    const smallFinding = result.findings.find(f => f.filePath === "small.md");
    assert.ok(smallFinding);
    assert.strictEqual(smallFinding.severity, Severity.WARN);

    cleanup();
  });

  await t.test("DSPy logic correctly filters non-semantic files", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    
    fs.writeFileSync(path.join(dir, "binary.exe"), "just pretending to be a binary that happens to have the exact length needed so it passes deterministic checks: this is a completely valid string meant to be over 50 characters to bypass the deterministic hollow artifact check.");

    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ score: 0.1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["binary.exe"],
      config: {
        guards: { hollowArtifact: { useDspy: true, extensions: [".exe"] } }
      }
    } as any;

    const result = await hollowArtifactGuard.check(ctx);
    
    assert.strictEqual(fetchCalled, false, "DSPy should not be called for binary files even if they pass config extensions");
    assert.strictEqual(result.passed, true);
    
    cleanup();
  });

  await t.test("DSPy graceful degradation on timeout/error", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "good.md"), "This is a totally valid document with plenty of words to pass the minimum length check, unlike an empty file.");

    globalThis.fetch = async () => {
      throw new Error("Network timeout simulation");
    };

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["good.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      }
    } as any;

    const result = await hollowArtifactGuard.check(ctx);
    
    // Should pass, no blocking, the error should just be swallowed and logged as warning
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 0);

    cleanup();
  });

  await t.test("DSPy warning emitted when score < 0.5", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "sneaky.md"), "This is a document that technically passes simple string checks by being very long but completely lacks actual semantic meaning because it is just generated filler text designed to bypass simple text string matching algorithms.");

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ score: 0.2, feedback: "Garbage filler" }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    };

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["sneaky.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      }
    } as any;

    const result = await hollowArtifactGuard.check(ctx);
    
    // Warn not Block
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].severity, Severity.WARN);
    assert.ok(result.findings[0].message.includes("Garbage filler"));

    cleanup();
  });

  // ── Edge-case tests (v0.5 hardening) ──────────────────────────────

  await t.test("DSPy graceful degradation on HTTP 500", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "doc.md"), "This is a fully valid document with enough words to pass the minimum length check and should not be blocked by deterministic patterns.");

    globalThis.fetch = async () => {
      return new Response("Internal Server Error", { status: 500 });
    };

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["doc.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      }
    } as any;

    const result = await hollowArtifactGuard.check(ctx);

    // HTTP 500 should degrade gracefully — pass with zero findings
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 0);

    cleanup();
  });

  await t.test("DSPy graceful degradation on malformed JSON response", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "doc.md"), "This is a fully valid document with enough words to pass the minimum length check and should not be blocked by deterministic patterns.");

    globalThis.fetch = async () => {
      return new Response("{invalid json!!!}", {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["doc.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      }
    } as any;

    const result = await hollowArtifactGuard.check(ctx);

    // Malformed JSON should be caught by try/catch → graceful degradation
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 0);

    cleanup();
  });

  await t.test("DSPy boundary: score exactly 0.5 should NOT warn", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "borderline.md"), "This document is on the boundary of quality. It is exactly at the threshold and should not trigger a warning because the condition is strictly less than 0.5.");

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ score: 0.5, feedback: "Borderline quality" }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["borderline.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      }
    } as any;

    const result = await hollowArtifactGuard.check(ctx);

    // score === 0.5 is NOT < 0.5, so no warning
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 0, "Score exactly 0.5 should not produce a warning");

    cleanup();
  });

  await t.test("DSPy boundary: score 0.0 should warn", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "zero.md"), "This document will receive the absolute worst score from the evaluator, testing the lower boundary of the scoring system to ensure it triggers a warning.");

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ score: 0.0, feedback: "Completely empty semantics" }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["zero.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      }
    } as any;

    const result = await hollowArtifactGuard.check(ctx);

    assert.strictEqual(result.passed, true, "Score 0.0 is WARN not BLOCK");
    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].severity, Severity.WARN);
    assert.ok(result.findings[0].message.includes("0.00"));
    assert.ok(result.findings[0].message.includes("Completely empty semantics"));

    cleanup();
  });
});
