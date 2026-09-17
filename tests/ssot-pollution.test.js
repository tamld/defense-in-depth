/**
 * Tests for ssotPollutionGuard.
 *
 * Spec: tests/fixtures/ssot-pollution/edge_cases.md
 * Mock audit: pure guard, no I/O — no mocks needed.
 *
 * Executor: Devin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ssotPollutionGuard } from "../dist/guards/ssot-pollution.js";
import { Severity } from "../dist/core/types.js";

function ctxWith(stagedFiles, ssotPollutionConfig) {
  return {
    stagedFiles,
    projectRoot: "/fake/root",
    config: {
      version: "1.0",
      guards: {
        ssotPollution: ssotPollutionConfig
          ? { enabled: true, ...ssotPollutionConfig }
          : { enabled: true },
      },
    },
  };
}

describe("ssotPollutionGuard — substring match against defaults", () => {
  it("blocks files inside .agents/ directly", async () => {
    const result = await ssotPollutionGuard.check(ctxWith([".agents/rules/foo.md"]));
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, Severity.BLOCK);
    assert.equal(result.findings[0].filePath, ".agents/rules/foo.md");
    assert.ok(result.findings[0].message.includes(".agents/"));
  });

  it("blocks .agents/ path even when nested under another directory", async () => {
    const result = await ssotPollutionGuard.check(ctxWith(["nested/dir/.agents/x.md"]));
    assert.equal(result.passed, false);
  });

  it("does NOT block '.agentsignore' (similar prefix, no boundary)", async () => {
    const result = await ssotPollutionGuard.check(ctxWith([".agentsignore"]));
    assert.equal(result.passed, true);
  });

  it("blocks the literal protected file at any depth", async () => {
    const result = await ssotPollutionGuard.check(ctxWith(["flow_state.yml"]));
    assert.equal(result.passed, false);
  });
});

describe("ssotPollutionGuard — basename match for slash-less patterns", () => {
  it("blocks deeply-nested protected basename", async () => {
    const result = await ssotPollutionGuard.check(ctxWith(["backup/flow_state.yml"]));
    assert.equal(result.passed, false);
  });

  it("FALSE POSITIVE: 'flow_state.yml.bak' is currently blocked via substring match (caveat)", async () => {
    // Pinning current behavior: substring matcher is the FIRST check and is
    // permissive — '.bak' suffix still includes the protected basename as a
    // substring. This is a known false-positive cluster; see the spec at
    // tests/fixtures/ssot-pollution/edge_cases.md for the rationale and a
    // proposed v0.7 follow-up (boundary-aware matcher).
    const result = await ssotPollutionGuard.check(ctxWith(["flow_state.yml.bak"]));
    assert.equal(result.passed, false);
  });

  it("FALSE POSITIVE: 'prefix-flow_state.yml' is currently blocked via substring match (caveat)", async () => {
    // Same caveat as above — substring includes the protected basename even
    // when prefixed. Documented for future hardening.
    const result = await ssotPollutionGuard.check(ctxWith(["prefix-flow_state.yml"]));
    assert.equal(result.passed, false);
  });

  it("blocks deeply nested 'backlog.yml'", async () => {
    const result = await ssotPollutionGuard.check(ctxWith(["deep/nested/path/backlog.yml"]));
    assert.equal(result.passed, false);
  });
});

describe("ssotPollutionGuard — ** glob prefix mode", () => {
  it("blocks files under a custom 'secrets/**' pattern", async () => {
    const result = await ssotPollutionGuard.check(
      ctxWith(["secrets/api.key"], { protectedPaths: ["secrets/**"] }),
    );
    assert.equal(result.passed, false);
  });

  it("does NOT block siblings outside the 'secrets/**' prefix", async () => {
    const result = await ssotPollutionGuard.check(
      ctxWith(["not-secrets/api.key"], { protectedPaths: ["secrets/**"] }),
    );
    assert.equal(result.passed, true);
  });
});

describe("ssotPollutionGuard — Windows path normalization", () => {
  it("normalizes backslashes in staged paths before matching", async () => {
    const result = await ssotPollutionGuard.check(ctxWith([".agents\\rules\\x.md"]));
    assert.equal(result.passed, false);
  });

  it("normalizes backslashes in user-provided patterns too", async () => {
    const result = await ssotPollutionGuard.check(
      ctxWith([".agents/rules/x.md"], { protectedPaths: [".agents\\"] }),
    );
    assert.equal(result.passed, false);
  });
});

describe("ssotPollutionGuard — empty / disabled config behavior", () => {
  it("passes with empty stagedFiles array", async () => {
    const result = await ssotPollutionGuard.check(ctxWith([]));
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("passes when protectedPaths is overridden to []", async () => {
    const result = await ssotPollutionGuard.check(
      ctxWith([".agents/rules/x.md", "flow_state.yml"], {
        protectedPaths: [],
      }),
    );
    assert.equal(result.passed, true);
  });

  it("custom protectedPaths replaces defaults (no merge)", async () => {
    // Custom config protects only "secrets/" — `.agents/` should NOT be blocked.
    const result = await ssotPollutionGuard.check(
      ctxWith([".agents/rules/x.md"], { protectedPaths: ["secrets/"] }),
    );
    assert.equal(result.passed, true);
  });
});

describe("ssotPollutionGuard — multi-finding semantics", () => {
  it("emits exactly one finding per offending file", async () => {
    const result = await ssotPollutionGuard.check(
      ctxWith([".agents/x.md", "backlog.yml", "src/ok.ts"]),
    );
    assert.equal(result.findings.length, 2);
    const paths = result.findings.map((f) => f.filePath).sort();
    assert.deepEqual(paths, [".agents/x.md", "backlog.yml"]);
  });

  it("does NOT double-report a file matching multiple patterns", async () => {
    // ".agents/flow_state.yml" matches both `.agents/` (substring) and
    // `flow_state.yml` (basename). Inner loop breaks on first hit.
    const result = await ssotPollutionGuard.check(ctxWith([".agents/flow_state.yml"]));
    assert.equal(result.findings.length, 1);
  });
});

describe("ssotPollutionGuard — finding shape", () => {
  it("includes a 'git reset HEAD' fix suggestion", async () => {
    const result = await ssotPollutionGuard.check(ctxWith([".agents/rules/x.md"]));
    assert.ok(result.findings[0].fix?.includes("git reset HEAD"));
  });

  it("durationMs is non-negative on success", async () => {
    const result = await ssotPollutionGuard.check(ctxWith(["src/ok.ts"]));
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0);
  });

  it("guardId is correct on the result", async () => {
    const result = await ssotPollutionGuard.check(ctxWith([]));
    assert.equal(result.guardId, "ssotPollution");
  });
});
