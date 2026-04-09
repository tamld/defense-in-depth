import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { hitlReviewGuard } from "../../dist/guards/hitl-review.js";
import { Severity } from "../../dist/core/types.js";

const baseConfig = {
  version: "0.4.0",
  guards: {
    hitlReview: {
      enabled: true,
      // Default uses "main" and "master" if protectedBranches is undefined
    },
  },
};

function createContext(branch, configOverrides) {
  return {
    stagedFiles: ["src/index.ts"],
    projectRoot: "/mock/root",
    branch,
    config: {
      ...baseConfig,
      guards: {
        ...baseConfig.guards,
        hitlReview: configOverrides || baseConfig.guards.hitlReview,
      },
    },
  };
}

describe("hitlReviewGuard", () => {
  it("passes when branch is not provided", async () => {
    const ctx = createContext(undefined);
    const result = await hitlReviewGuard.check(ctx);
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("passes when on an unprotected branch", async () => {
    const ctx = createContext("feat/TK-12345");
    const result = await hitlReviewGuard.check(ctx);
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("blocks when on default protected branch 'main'", async () => {
    const ctx = createContext("main");
    const result = await hitlReviewGuard.check(ctx);
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0]?.severity, Severity.BLOCK);
    assert.ok(result.findings[0]?.message.includes("Direct commits to protected branch 'main' are strictly prohibited"));
  });

  it("blocks when on default protected branch 'master'", async () => {
    const ctx = createContext("master");
    const result = await hitlReviewGuard.check(ctx);
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
  });

  it("blocks when on custom protected branch configured in yaml", async () => {
    const ctx = createContext("production", {
      enabled: true,
      protectedBranches: ["production", "staging"],
    });
    const result = await hitlReviewGuard.check(ctx);
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.ok(result.findings[0]?.message.includes("production"));
  });

  it("passes on main if main is not in custom protectedBranches", async () => {
    const ctx = createContext("main", {
      enabled: true,
      protectedBranches: ["production", "staging"],
    });
    const result = await hitlReviewGuard.check(ctx);
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });
});
