/**
 * Tests for phaseGateGuard.
 *
 * Spec: tests/fixtures/phase-gate/edge_cases.md
 * Mock audit: uses fs.existsSync — exercised via real temp dirs, not mocks.
 *
 * Executor: Devin
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { phaseGateGuard } from "../dist/guards/phase-gate.js";
import { Severity } from "../dist/core/types.js";

function ctxIn(projectRoot, stagedFiles, phaseGateConfig) {
  return {
    stagedFiles,
    projectRoot,
    config: {
      version: "1.0",
      guards: {
        phaseGate: phaseGateConfig ? { enabled: true, ...phaseGateConfig } : { enabled: true },
      },
    },
  };
}

describe("phaseGateGuard — no source files staged", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-pgate-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("passes with empty stagedFiles", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, []));
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("passes when only doc / config files are staged", async () => {
    const result = await phaseGateGuard.check(
      ctxIn(tmp, ["README.md", "docs/x.md", "package.json"]),
    );
    assert.equal(result.passed, true);
  });

  it("passes when only test files are staged", async () => {
    const result = await phaseGateGuard.check(
      ctxIn(tmp, ["tests/foo.test.js", "tests/bar.test.js"]),
    );
    assert.equal(result.passed, true);
  });
});

describe("phaseGateGuard — source files staged + plan present", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-pgate-"));
    fs.writeFileSync(path.join(tmp, "implementation_plan.md"), "# Plan\n\nSteps...\n");
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  for (const file of ["src/foo.ts", "lib/x.js", "app/a.ts"]) {
    it(`accepts ${file} when plan exists`, async () => {
      const result = await phaseGateGuard.check(ctxIn(tmp, [file]));
      assert.equal(result.passed, true);
    });
  }
});

describe("phaseGateGuard — source files staged + plan missing", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-pgate-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("blocks src/foo.ts when no plan file exists", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, ["src/foo.ts"]));
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, Severity.BLOCK);
  });

  it("block message names the missing plan file", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, ["src/foo.ts"]));
    assert.ok(result.findings[0].message.includes("implementation_plan.md"));
  });

  it("block message lists offending source files (capped at 5 with overflow note)", async () => {
    const stagedSources = [
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
      "src/d.ts",
      "src/e.ts",
      "src/f.ts",
      "src/g.ts",
    ];
    const result = await phaseGateGuard.check(ctxIn(tmp, stagedSources));
    assert.equal(result.passed, false);
    const msg = result.findings[0].message;
    // First 5 listed
    for (const f of stagedSources.slice(0, 5)) {
      assert.ok(msg.includes(f), `message should include ${f}`);
    }
    // Overflow indicator includes the count of remaining files (here: +2)
    assert.ok(/\+2 more/.test(msg), `expected '+2 more' overflow note in: ${msg}`);
  });

  it("fix message tells the user to create the plan file", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, ["src/foo.ts"]));
    assert.ok(result.findings[0].fix?.includes("implementation_plan.md"));
  });
});

describe("phaseGateGuard — isSourceFile matcher edges", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-pgate-"));
    // No plan — so any "source" match would block.
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("does NOT treat 'srcs/foo.ts' as a source file (no boundary match)", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, ["srcs/foo.ts"]));
    assert.equal(result.passed, true);
  });

  it("does NOT treat 'SRC/foo.ts' as source (case-sensitive)", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, ["SRC/foo.ts"]));
    assert.equal(result.passed, true);
  });

  it("normalizes backslashes — 'src\\\\foo.ts' matches", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, ["src\\foo.ts"]));
    assert.equal(result.passed, false);
  });
});

describe("phaseGateGuard — custom config", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-pgate-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("respects custom planFile", async () => {
    fs.writeFileSync(path.join(tmp, "PLAN.md"), "# Plan\n");
    const result = await phaseGateGuard.check(ctxIn(tmp, ["src/foo.ts"], { planFile: "PLAN.md" }));
    assert.equal(result.passed, true);
  });

  it("supports a nested planFile path", async () => {
    fs.mkdirSync(path.join(tmp, "docs"));
    fs.writeFileSync(path.join(tmp, "docs/PLAN.md"), "# Plan\n");
    const result = await phaseGateGuard.check(
      ctxIn(tmp, ["src/foo.ts"], { planFile: "docs/PLAN.md" }),
    );
    assert.equal(result.passed, true);
  });

  it("respects custom sourcePatterns (only flags new prefixes)", async () => {
    // Custom patterns exclude src/ → src/foo.ts is NOT a source file under this config.
    const result = await phaseGateGuard.check(
      ctxIn(tmp, ["src/foo.ts"], { sourcePatterns: ["packages/"] }),
    );
    assert.equal(result.passed, true);
  });

  it("blocks a file under a custom source prefix when plan is missing", async () => {
    const result = await phaseGateGuard.check(
      ctxIn(tmp, ["packages/x/foo.ts"], { sourcePatterns: ["packages/"] }),
    );
    assert.equal(result.passed, false);
  });
});

describe("phaseGateGuard — finding shape", () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-pgate-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("durationMs is non-negative", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, ["src/x.ts"]));
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0);
  });

  it("guardId is correct on the result", async () => {
    const result = await phaseGateGuard.check(ctxIn(tmp, []));
    assert.equal(result.guardId, "phaseGate");
  });
});
