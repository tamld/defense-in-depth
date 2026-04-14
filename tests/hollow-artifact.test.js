import test from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { hollowArtifactGuard } from "../dist/guards/hollow-artifact.js";
import { Severity } from "../dist/core/types.js";

// Utility to create a temporary workspace
function createTempWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-test-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

let originalFetch;

test("Hollow Artifact Guard (v0.5)", async (t) => {
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
    };

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

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["binary.exe"],
      config: {
        guards: { hollowArtifact: { useDspy: true, extensions: [".exe"] } }
      },
      semanticEvals: {
        dspy: {
          "binary.exe": { score: 0.1, feedback: "Should not be read" }
        }
      }
    };

    const result = await hollowArtifactGuard.check(ctx);
    
    // In pure logic, if the file is not a supported semantic text extension (like .exe),
    // it will be ignored even if it's in extensions, resulting in passed with no semantic eval trigger.
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 0);
    
    cleanup();
  });

  await t.test("DSPy graceful degradation (no semantic data)", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "good.md"), "This is a totally valid document with plenty of words to pass the minimum length check, unlike an empty file.");

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["good.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      },
      semanticEvals: {
         // Network timeout or 500 error would result in null eval
        dspy: { "good.md": null }
      }
    };

    const result = await hollowArtifactGuard.check(ctx);
    
    // Should pass, no blocking, null eval should just be swallowed
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 0);

    cleanup();
  });

  await t.test("DSPy warning emitted when score < 0.5", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "sneaky.md"), "This is a document that technically passes simple string checks by being very long but completely lacks actual semantic meaning because it is just generated filler text designed to bypass simple text string matching algorithms.");

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["sneaky.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      },
      semanticEvals: {
        dspy: {
          "sneaky.md": { score: 0.2, feedback: "Garbage filler" }
        }
      }
    };

    const result = await hollowArtifactGuard.check(ctx);
    
    // Warn not Block
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].severity, Severity.WARN);
    assert.ok(result.findings[0].message.includes("Garbage filler"));

    cleanup();
  });

  // ── Edge-case tests (v0.5 hardening) ──────────────────────────────

  await t.test("DSPy boundary: score exactly 0.5 should NOT warn", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "borderline.md"), "This document is on the boundary of quality. It is exactly at the threshold and should not trigger a warning because the condition is strictly less than 0.5.");

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["borderline.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      },
      semanticEvals: {
        dspy: {
          "borderline.md": { score: 0.5, feedback: "Borderline quality" }
        }
      }
    };

    const result = await hollowArtifactGuard.check(ctx);

    // score === 0.5 is NOT < 0.5, so no warning
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.findings.length, 0, "Score exactly 0.5 should not produce a warning");

    cleanup();
  });

  await t.test("DSPy boundary: score 0.0 should warn", async (st) => {
    const { dir, cleanup } = createTempWorkspace();
    fs.writeFileSync(path.join(dir, "zero.md"), "This document will receive the absolute worst score from the evaluator, testing the lower boundary of the scoring system to ensure it triggers a warning.");

    const ctx = {
      projectRoot: dir,
      stagedFiles: ["zero.md"],
      config: {
        guards: { hollowArtifact: { useDspy: true } }
      },
      semanticEvals: {
        dspy: {
          "zero.md": { score: 0.0, feedback: "Completely empty semantics" }
        }
      }
    };

    const result = await hollowArtifactGuard.check(ctx);

    assert.strictEqual(result.passed, true, "Score 0.0 is WARN not BLOCK");
    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].severity, Severity.WARN);
    assert.ok(result.findings[0].message.includes("0.00"));
    assert.ok(result.findings[0].message.includes("Completely empty semantics"));

    cleanup();
  });
});
