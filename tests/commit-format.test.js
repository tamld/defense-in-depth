/**
 * Tests for commitFormatGuard.
 *
 * Spec: tests/fixtures/commit-format/edge_cases.md
 * Mock audit: pure guard, no I/O — no mocks needed.
 *
 * Executor: Devin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { commitFormatGuard } from "../dist/guards/commit-format.js";
import { Severity } from "../dist/core/types.js";

function ctxWith(commitMessage, commitFormatConfig) {
  return {
    stagedFiles: [],
    projectRoot: "/fake/root",
    commitMessage,
    config: {
      version: "1.0",
      guards: {
        commitFormat: commitFormatConfig
          ? { enabled: true, ...commitFormatConfig }
          : { enabled: true },
      },
    },
  };
}

describe("commitFormatGuard — default pattern accepts", () => {
  for (const msg of [
    "feat: add login",
    "fix(api): null guard",
    "chore!: drop node 16",
    "feat(scope)!: scoped breaking",
    "docs(): empty scope",
    "perf(engine): faster pipeline",
    "test(guards): edge cases",
    "feat: ✨ unicode subject",
    "feat: subject with trailing whitespace   ",
    "  feat: leading whitespace",
    "\tfeat: tab prefix",
  ]) {
    it(`accepts: ${JSON.stringify(msg)}`, async () => {
      const result = await commitFormatGuard.check(ctxWith(msg));
      assert.equal(result.passed, true, `expected pass for "${msg}"`);
      assert.equal(result.findings.length, 0);
      assert.ok(result.durationMs >= 0);
    });
  }
});

describe("commitFormatGuard — default pattern rejects", () => {
  for (const msg of [
    "wip: hack",
    "feat add login",
    "feat:no-space-after-colon",
    ": missing type",
    "(scope): missing type",
    "feat: ",
    "Feat: case mismatch",
  ]) {
    it(`blocks: ${JSON.stringify(msg)}`, async () => {
      const result = await commitFormatGuard.check(ctxWith(msg));
      assert.equal(result.passed, false, `expected block for "${msg}"`);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].severity, Severity.BLOCK);
    });
  }
});

describe("commitFormatGuard — multi-line handling", () => {
  it("accepts when first line is valid (body ignored)", async () => {
    const result = await commitFormatGuard.check(
      ctxWith("feat: ok\n\nLong body explaining the change.\n- bullet"),
    );
    assert.equal(result.passed, true);
  });

  it("blocks when first line is invalid even if a later line matches", async () => {
    const result = await commitFormatGuard.check(ctxWith("invalid header\n\nfeat: hidden in body"));
    assert.equal(result.passed, false);
  });

  it("blocks whitespace-only first line", async () => {
    const result = await commitFormatGuard.check(ctxWith("   \n\nfeat: real subject in line 2"));
    assert.equal(result.passed, false);
  });
});

describe("commitFormatGuard — missing commit message", () => {
  it("passes when commitMessage is undefined", async () => {
    const result = await commitFormatGuard.check(ctxWith(undefined));
    assert.equal(result.passed, true);
  });

  it("passes when commitMessage is empty string", async () => {
    const result = await commitFormatGuard.check(ctxWith(""));
    assert.equal(result.passed, true);
  });
});

describe("commitFormatGuard — custom config", () => {
  it("custom pattern accepts non-conventional formats when explicitly allowed", async () => {
    const result = await commitFormatGuard.check(ctxWith("WIP foo bar", { pattern: "^WIP\\s.+" }));
    assert.equal(result.passed, true);
  });

  it("empty pattern '' falls back to DEFAULT_PATTERN (truthy guard semantics)", async () => {
    const result = await commitFormatGuard.check(ctxWith("anything", { pattern: "" }));
    // "anything" does not match the default; should block.
    assert.equal(result.passed, false);
  });

  it("custom types list is echoed in the block message but does NOT change validation", async () => {
    // Per source: types affects only the failure message; pattern still drives validation.
    const result = await commitFormatGuard.check(ctxWith("wip: hack", { types: ["wip", "exp"] }));
    assert.equal(result.passed, false);
    assert.ok(result.findings[0].message.includes("wip"));
    assert.ok(result.findings[0].message.includes("exp"));
  });
});

describe("commitFormatGuard — finding shape", () => {
  it("block message includes the rejected subject", async () => {
    const result = await commitFormatGuard.check(ctxWith("bogus header"));
    assert.ok(
      result.findings[0].message.includes("bogus header"),
      "expected message to include the offending subject",
    );
  });

  it("block message lists the allowed types (default)", async () => {
    const result = await commitFormatGuard.check(ctxWith("bogus"));
    const msg = result.findings[0].message;
    for (const t of ["feat", "fix", "chore", "docs", "refactor", "test"]) {
      assert.ok(msg.includes(t), `default types list should include ${t}`);
    }
  });

  it("includes a 'git commit --amend' fix suggestion", async () => {
    const result = await commitFormatGuard.check(ctxWith("bogus"));
    assert.ok(result.findings[0].fix?.includes("git commit --amend"));
  });

  it("durationMs is non-negative on success", async () => {
    const result = await commitFormatGuard.check(ctxWith("feat: x"));
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0);
  });

  it("guardId is correct on the result", async () => {
    const result = await commitFormatGuard.check(ctxWith("feat: x"));
    assert.equal(result.guardId, "commitFormat");
  });
});
