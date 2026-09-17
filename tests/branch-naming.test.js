/**
 * Tests for branchNamingGuard.
 *
 * Spec: tests/fixtures/branch-naming/edge_cases.md
 * Mock audit: pure guard, no I/O — no mocks needed.
 *
 * Executor: Devin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { branchNamingGuard } from "../dist/guards/branch-naming.js";
import { Severity } from "../dist/core/types.js";

function ctxWith(branch, branchNamingConfig) {
  return {
    stagedFiles: [],
    projectRoot: "/fake/root",
    branch,
    config: {
      version: "1.0",
      guards: {
        branchNaming: branchNamingConfig
          ? { enabled: true, ...branchNamingConfig }
          : { enabled: true },
      },
    },
  };
}

describe("branchNamingGuard — default pattern", () => {
  for (const branch of ["feat/x", "fix/x", "chore/x", "docs/x"]) {
    it(`accepts allowed type prefix: ${branch}`, async () => {
      const result = await branchNamingGuard.check(ctxWith(branch));
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
      assert.ok(result.durationMs >= 0);
    });
  }

  for (const branch of ["refactor/x", "test/x", "perf/x", "ci/x", "style/x"]) {
    it(`blocks types not in the default 4: ${branch}`, async () => {
      const result = await branchNamingGuard.check(ctxWith(branch));
      assert.equal(result.passed, false);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].severity, Severity.BLOCK);
      assert.ok(result.findings[0].message.includes(branch));
      assert.ok(result.findings[0].fix?.includes("git branch -m"));
    });
  }

  it("blocks empty suffix (e.g. 'feat/')", async () => {
    const result = await branchNamingGuard.check(ctxWith("feat/"));
    assert.equal(result.passed, false);
  });

  it("accepts double-slash inside the suffix", async () => {
    const result = await branchNamingGuard.check(ctxWith("feat//double"));
    assert.equal(result.passed, true);
  });

  it("default pattern is case-sensitive (FEAT/x blocked)", async () => {
    const result = await branchNamingGuard.check(ctxWith("FEAT/x"));
    assert.equal(result.passed, false);
  });

  it("blocks branches without a slash separator", async () => {
    const result = await branchNamingGuard.check(ctxWith("feat-no-slash"));
    assert.equal(result.passed, false);
  });

  it("regex is anchored at start (prefix/feat/x blocked)", async () => {
    const result = await branchNamingGuard.check(ctxWith("prefix/feat/x"));
    assert.equal(result.passed, false);
  });

  it("permits whitespace in suffix", async () => {
    const result = await branchNamingGuard.check(ctxWith("feat/with space"));
    assert.equal(result.passed, true);
  });

  it("permits unicode in suffix", async () => {
    const result = await branchNamingGuard.check(ctxWith("feat/旧-bug"));
    assert.equal(result.passed, true);
  });
});

describe("branchNamingGuard — exempt list", () => {
  for (const branch of ["main", "master", "develop", "staging", "HEAD"]) {
    it(`exempts protected branch: ${branch}`, async () => {
      const result = await branchNamingGuard.check(ctxWith(branch));
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    });
  }

  it("does NOT exempt 'main-fix' (no substring fallback)", async () => {
    const result = await branchNamingGuard.check(ctxWith("main-fix"));
    assert.equal(result.passed, false);
  });

  it("does NOT exempt case variants like 'MAIN'", async () => {
    const result = await branchNamingGuard.check(ctxWith("MAIN"));
    assert.equal(result.passed, false);
  });
});

describe("branchNamingGuard — missing branch context", () => {
  it("passes when branch is undefined", async () => {
    const result = await branchNamingGuard.check(ctxWith(undefined));
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("passes when branch is empty string", async () => {
    const result = await branchNamingGuard.check(ctxWith(""));
    assert.equal(result.passed, true);
  });
});

describe("branchNamingGuard — custom pattern", () => {
  it("accepts release/vX.Y.Z when configured", async () => {
    const result = await branchNamingGuard.check(
      ctxWith("release/v1.2.3", { pattern: "^release/v\\d+\\.\\d+\\.\\d+$" }),
    );
    assert.equal(result.passed, true);
  });

  it("blocks release/v1.2 against semver pattern", async () => {
    const result = await branchNamingGuard.check(
      ctxWith("release/v1.2", { pattern: "^release/v\\d+\\.\\d+\\.\\d+$" }),
    );
    assert.equal(result.passed, false);
  });

  it("empty-string pattern is treated as 'unset' and falls back to the default", async () => {
    // `config?.pattern` is falsy for "" → guard uses DEFAULT_PATTERN, not new RegExp("").
    const result = await branchNamingGuard.check(ctxWith("anything-goes", { pattern: "" }));
    assert.equal(result.passed, false);
  });

  it("invalid regex in config surfaces as SyntaxError to the caller", async () => {
    await assert.rejects(
      () => branchNamingGuard.check(ctxWith("feat/x", { pattern: "([unterminated" })),
      SyntaxError,
    );
  });
});

describe("branchNamingGuard — finding shape", () => {
  it("includes branch name in the block message", async () => {
    const result = await branchNamingGuard.check(ctxWith("invalid-branch"));
    assert.ok(result.findings[0].message.includes("invalid-branch"));
  });

  it("includes the failing pattern in the block message", async () => {
    const result = await branchNamingGuard.check(ctxWith("invalid-branch"));
    assert.ok(
      result.findings[0].message.includes("(feat|fix|chore|docs)"),
      "message should reference the active pattern",
    );
  });

  it("durationMs is a non-negative number", async () => {
    const result = await branchNamingGuard.check(ctxWith("feat/x"));
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0);
  });

  it("guardId is correct on the result", async () => {
    const result = await branchNamingGuard.check(ctxWith("feat/x"));
    assert.equal(result.guardId, "branchNaming");
  });
});
