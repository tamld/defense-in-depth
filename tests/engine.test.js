/**
 * Adversarial tests for DefendEngine.
 *
 * Spec: tests/fixtures/engine/edge_cases.md
 *
 * Goal: lift engine branch coverage from 53% to >=90% by exercising:
 *   - useAll / registration ordering
 *   - extractTicketRef across branch / commit / dirname
 *   - guard crash handler (sync throw, async reject, non-Error throw)
 *   - provider failures (enrichTicketRef)
 *   - parent provider failures (enrichParentTicket)
 *   - enabled=false skip path
 *   - verdict aggregation (passed / warned / failed counts)
 *   - DSPy semantic eval enrichment
 *
 * Mock audit: globalThis.fetch is mocked per scenario; console.warn silenced.
 *
 * Executor: Devin
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { DefendEngine } from "../dist/core/engine.js";
import { Severity } from "../dist/core/types.js";

/** Build a minimal config object with overrides merged in. */
function makeConfig(overrides = {}) {
  return {
    version: "1.0",
    guards: {
      ...overrides,
    },
  };
}

/** Build a guard stub. The result is fully controllable. */
function stubGuard(id, behavior = {}) {
  return {
    id,
    name: id,
    description: `stub ${id}`,
    check: behavior.check
      ? behavior.check
      : async () => ({
          guardId: id,
          passed: behavior.passed ?? true,
          findings: behavior.findings ?? [],
          durationMs: 1,
        }),
  };
}

let savedFetch;
let savedWarn;

beforeEach(() => {
  savedFetch = globalThis.fetch;
  savedWarn = console.warn;
  console.warn = () => {};
});

afterEach(() => {
  globalThis.fetch = savedFetch;
  console.warn = savedWarn;
});

describe("DefendEngine — registration and basic pipeline", () => {
  it("useAll registers all guards in order", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    const order = [];
    engine.useAll([
      stubGuard("a", {
        check: async () => {
          order.push("a");
          return { guardId: "a", passed: true, findings: [], durationMs: 1 };
        },
      }),
      stubGuard("b", {
        check: async () => {
          order.push("b");
          return { guardId: "b", passed: true, findings: [], durationMs: 1 };
        },
      }),
    ]);
    const verdict = await engine.run([]);
    assert.deepEqual(order, ["a", "b"]);
    assert.equal(verdict.totalGuards, 2);
    assert.equal(verdict.passed, true);
  });

  it("use() returns the engine for chaining", () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    const same = engine.use(stubGuard("x"));
    assert.equal(same, engine);
  });

  it("empty pipeline produces verdict with totalGuards=0 and passed=true", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    const verdict = await engine.run([]);
    assert.equal(verdict.totalGuards, 0);
    assert.equal(verdict.passed, true);
    assert.equal(verdict.failedGuards, 0);
    assert.equal(verdict.warnedGuards, 0);
    assert.ok(verdict.durationMs >= 0);
  });

  it("getConfig returns the config the engine was constructed with", () => {
    const cfg = makeConfig({ commitFormat: { enabled: true } });
    const engine = new DefendEngine("/tmp", cfg);
    assert.equal(engine.getConfig(), cfg);
  });
});

describe("DefendEngine — extractTicketRef", () => {
  it("extracts ID + type from branch with conventional prefix", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    let captured;
    engine.use(
      stubGuard("capture", {
        check: async (ctx) => {
          captured = ctx.ticket;
          return { guardId: "capture", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([], { branch: "feat/TK-123" });
    assert.equal(captured?.id, "TK-123");
    assert.equal(captured?.type, "feat");
  });

  it("extracts only ID (no type) from branch with non-conventional prefix", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    let captured;
    engine.use(
      stubGuard("capture", {
        check: async (ctx) => {
          captured = ctx.ticket;
          return { guardId: "capture", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([], { branch: "bugfix/TK-abc" });
    assert.equal(captured?.id, "TK-ABC");
    assert.equal(captured?.type, undefined);
  });

  it("falls back to commitMessage when branch has no ID", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    let captured;
    engine.use(
      stubGuard("capture", {
        check: async (ctx) => {
          captured = ctx.ticket;
          return { guardId: "capture", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([], {
      branch: "feat/no-id-here",
      commitMessage: "fix: addresses TK-456",
    });
    assert.equal(captured?.id, "TK-456");
  });

  it("branch ID takes precedence over commit message ID", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    let captured;
    engine.use(
      stubGuard("capture", {
        check: async (ctx) => {
          captured = ctx.ticket;
          return { guardId: "capture", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([], {
      branch: "feat/TK-100",
      commitMessage: "fix: TK-200",
    });
    assert.equal(captured?.id, "TK-100");
  });

  it("falls back to projectRoot basename when no branch/commit IDs", async () => {
    const engine = new DefendEngine("/repos/proj-TK-999", makeConfig());
    let captured;
    engine.use(
      stubGuard("capture", {
        check: async (ctx) => {
          captured = ctx.ticket;
          return { guardId: "capture", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([], { branch: "main" });
    assert.equal(captured?.id, "TK-999");
  });

  it("returns undefined ticket when no source has an ID", async () => {
    const engine = new DefendEngine("/repos/regular-name", makeConfig());
    let captured;
    engine.use(
      stubGuard("capture", {
        check: async (ctx) => {
          captured = ctx.ticket;
          return { guardId: "capture", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([], { branch: "main", commitMessage: "fix: x" });
    assert.equal(captured, undefined);
  });
});

describe("DefendEngine — guard crash handler", () => {
  it("turns a synchronous throw into a BLOCK finding 'Guard crashed:'", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    engine.use(
      stubGuard("boom", {
        check: () => {
          throw new Error("kaboom");
        },
      }),
    );
    const verdict = await engine.run([]);
    assert.equal(verdict.passed, false);
    assert.equal(verdict.failedGuards, 1);
    const finding = verdict.results[0].findings[0];
    assert.equal(finding.severity, Severity.BLOCK);
    assert.ok(finding.message.includes("Guard crashed"));
    assert.ok(finding.message.includes("kaboom"));
  });

  it("turns an async rejection into a BLOCK finding", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    engine.use(
      stubGuard("boom", {
        check: async () => {
          throw new Error("async-kaboom");
        },
      }),
    );
    const verdict = await engine.run([]);
    assert.equal(verdict.passed, false);
    assert.ok(verdict.results[0].findings[0].message.includes("async-kaboom"));
  });

  it("stringifies non-Error throws", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    engine.use(
      stubGuard("boom", {
        check: async () => {
          // eslint-disable-next-line no-throw-literal
          throw "string-error";
        },
      }),
    );
    const verdict = await engine.run([]);
    assert.ok(verdict.results[0].findings[0].message.includes("string-error"));
  });

  it("subsequent guards still run after a crash (no short-circuit)", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    let secondRan = false;
    engine.use(
      stubGuard("boom", {
        check: async () => {
          throw new Error("x");
        },
      }),
    );
    engine.use(
      stubGuard("after", {
        check: async () => {
          secondRan = true;
          return { guardId: "after", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([]);
    assert.equal(secondRan, true);
  });
});

describe("DefendEngine — provider failure (enrichTicketRef)", () => {
  it("provider network failure is silently handled (HTTP provider returns undefined; basicRef passes through)", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    const engine = new DefendEngine(
      "/tmp",
      makeConfig({
        ticketIdentity: {
          enabled: true,
          severity: "warn",
          provider: "http",
          providerConfig: {
            endpoint: "http://child-api/tickets",
            timeout: 1000,
          },
        },
      }),
    );

    let observed;
    engine.use(
      stubGuard("observer", {
        check: async (ctx) => {
          observed = ctx.ticket;
          return {
            guardId: "observer",
            passed: true,
            findings: [],
            durationMs: 1,
          };
        },
      }),
    );

    const verdict = await engine.run([], { branch: "feat/TK-CHILD" });
    assert.equal(observed?.id, "TK-CHILD"); // basicRef passes through
    assert.equal(verdict.passed, true);
  });

  it("malformed JSON from provider → ticket falls back to basicRef (graceful)", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => "not-an-object", // HttpTicketProvider rejects this shape
    });

    const engine = new DefendEngine(
      "/tmp",
      makeConfig({
        ticketIdentity: {
          enabled: true,
          severity: "warn",
          provider: "http",
          providerConfig: {
            endpoint: "http://child-api/tickets",
            timeout: 1000,
          },
        },
      }),
    );

    let observed;
    engine.use(
      stubGuard("observer", {
        check: async (ctx) => {
          observed = ctx.ticket;
          return { guardId: "observer", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([], { branch: "feat/TK-MALFORMED" });
    assert.equal(observed?.id, "TK-MALFORMED");
  });

  it("ticketIdentity disabled → provider never instantiated, ticket equals basicRef", async () => {
    let fetched = false;
    globalThis.fetch = async () => {
      fetched = true;
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const engine = new DefendEngine(
      "/tmp",
      makeConfig({ ticketIdentity: { enabled: false } }),
    );

    let observed;
    engine.use(
      stubGuard("observer", {
        check: async (ctx) => {
          observed = ctx.ticket;
          return { guardId: "observer", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );

    await engine.run([], { branch: "feat/TK-OFF" });
    assert.equal(fetched, false);
    assert.equal(observed?.id, "TK-OFF");
  });
});

describe("DefendEngine — parent provider failure (enrichParentTicket)", () => {
  it("parent fetch rejection leaves parentPhase/authorized undefined", async () => {
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("child-api")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "TK-CHILD",
            phase: "EXECUTING",
            parentId: "TK-PARENT",
          }),
        };
      }
      // Parent: fail
      throw new TypeError("parent network down");
    };

    const engine = new DefendEngine(
      "/tmp",
      makeConfig({
        ticketIdentity: {
          enabled: true,
          severity: "warn",
          provider: "http",
          providerConfig: {
            endpoint: "http://child-api/tickets",
            timeout: 1000,
          },
        },
        federation: {
          enabled: true,
          severity: "block",
          provider: "http",
          parentEndpoint: "http://parent-api/tickets",
          providerConfig: { timeout: 500 },
        },
      }),
    );

    let observed;
    engine.use(
      stubGuard("observer", {
        check: async (ctx) => {
          observed = ctx.ticket;
          return { guardId: "observer", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );

    await engine.run([], { branch: "feat/TK-CHILD" });
    assert.equal(observed?.parentPhase, undefined);
    assert.equal(observed?.authorized, undefined);
  });

  it("no parentId on child → enrichParentTicket short-circuits (no parent fetch)", async () => {
    let parentFetched = false;
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("child-api")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "TK-SOLO", phase: "EXECUTING" }),
        };
      }
      if (url.includes("parent-api")) {
        parentFetched = true;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const engine = new DefendEngine(
      "/tmp",
      makeConfig({
        ticketIdentity: {
          enabled: true,
          severity: "warn",
          provider: "http",
          providerConfig: {
            endpoint: "http://child-api/tickets",
            timeout: 1000,
          },
        },
        federation: {
          enabled: true,
          severity: "block",
          provider: "http",
          parentEndpoint: "http://parent-api/tickets",
          providerConfig: { timeout: 500 },
        },
      }),
    );
    engine.use(stubGuard("noop"));
    await engine.run([], { branch: "feat/TK-SOLO" });
    assert.equal(parentFetched, false);
  });
});

describe("DefendEngine — disabled / unknown guard config", () => {
  it("skips a guard when its config has enabled=false", async () => {
    const engine = new DefendEngine(
      "/tmp",
      makeConfig({ commitFormat: { enabled: false } }),
    );
    let ran = false;
    engine.use(
      stubGuard("commitFormat", {
        check: async () => {
          ran = true;
          return { guardId: "commitFormat", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    const verdict = await engine.run([]);
    assert.equal(ran, false);
    assert.equal(verdict.totalGuards, 0);
  });

  it("runs a guard whose id has no config entry (default-on semantics)", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    let ran = false;
    engine.use(
      stubGuard("unknownGuard", {
        check: async () => {
          ran = true;
          return { guardId: "unknownGuard", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([]);
    assert.equal(ran, true);
  });
});

describe("DefendEngine — verdict aggregation", () => {
  it("counts pass / warn / fail correctly", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    engine.useAll([
      stubGuard("p", { passed: true, findings: [] }),
      stubGuard("w", {
        passed: true,
        findings: [
          { guardId: "w", severity: Severity.WARN, message: "minor" },
        ],
      }),
      stubGuard("f", {
        passed: false,
        findings: [
          { guardId: "f", severity: Severity.BLOCK, message: "bad" },
        ],
      }),
    ]);
    const verdict = await engine.run([]);
    assert.equal(verdict.totalGuards, 3);
    assert.equal(verdict.passedGuards, 2); // pass + warn (warn still passes)
    assert.equal(verdict.warnedGuards, 1); // only the warn-with-findings
    assert.equal(verdict.failedGuards, 1);
    assert.equal(verdict.passed, false);
  });

  it("warnedGuards does NOT count guards that failed (block trumps warn)", async () => {
    const engine = new DefendEngine("/tmp", makeConfig());
    engine.use(
      stubGuard("fw", {
        passed: false,
        findings: [
          { guardId: "fw", severity: Severity.WARN, message: "noise" },
          { guardId: "fw", severity: Severity.BLOCK, message: "real" },
        ],
      }),
    );
    const verdict = await engine.run([]);
    assert.equal(verdict.warnedGuards, 0);
    assert.equal(verdict.failedGuards, 1);
  });
});

describe("DefendEngine — DSPy semantic eval enrichment", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-engine-dspy-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("populates ctx.semanticEvals.dspy[file] when DSPy returns a payload", async () => {
    const target = "doc.md";
    fs.writeFileSync(path.join(tmp, target), "# Hello\nWorld");

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ score: 0.42, feedback: "looks fine" }),
    });

    const engine = new DefendEngine(
      tmp,
      makeConfig({
        hollowArtifact: {
          enabled: true,
          useDspy: true,
          dspyEndpoint: "http://dspy.local/evaluate",
          dspyTimeoutMs: 1000,
          extensions: [".md"],
        },
      }),
    );

    let observed;
    engine.use(
      stubGuard("observer", {
        check: async (ctx) => {
          observed = ctx.semanticEvals;
          return { guardId: "observer", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([target]);
    assert.ok(observed?.dspy);
    assert.deepEqual(observed.dspy[target], { score: 0.42, feedback: "looks fine" });
  });

  it("entry is null when DSPy fetch fails (degraded mode)", async () => {
    const target = "doc.md";
    fs.writeFileSync(path.join(tmp, target), "# Hello");

    globalThis.fetch = async () => {
      throw new TypeError("dspy down");
    };

    const engine = new DefendEngine(
      tmp,
      makeConfig({
        hollowArtifact: {
          enabled: true,
          useDspy: true,
          dspyEndpoint: "http://dspy.local/evaluate",
          dspyTimeoutMs: 200,
          extensions: [".md"],
        },
      }),
    );

    let observed;
    engine.use(
      stubGuard("observer", {
        check: async (ctx) => {
          observed = ctx.semanticEvals;
          return { guardId: "observer", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([target]);
    // Either the file got an entry of null, or no entry at all (depending on DSPy client behavior).
    // Both are acceptable degraded modes — assert we did not throw and pipeline produced semanticEvals.
    assert.ok(observed?.dspy);
    if (target in observed.dspy) {
      assert.equal(observed.dspy[target], null);
    }
  });

  it("skips files whose extension is outside the configured set", async () => {
    fs.writeFileSync(path.join(tmp, "code.ts"), "// noop");

    let fetched = false;
    globalThis.fetch = async () => {
      fetched = true;
      return { ok: true, status: 200, json: async () => ({ score: 1 }) };
    };

    const engine = new DefendEngine(
      tmp,
      makeConfig({
        hollowArtifact: {
          enabled: true,
          useDspy: true,
          dspyEndpoint: "http://dspy.local/evaluate",
          dspyTimeoutMs: 200,
          extensions: [".md"], // does not include .ts
        },
      }),
    );
    engine.use(stubGuard("noop"));
    await engine.run(["code.ts"]);
    assert.equal(fetched, false);
  });

  it("returns undefined semanticEvals when DSPy is disabled", async () => {
    const engine = new DefendEngine(
      "/tmp",
      makeConfig({ hollowArtifact: { enabled: true, useDspy: false } }),
    );
    let observed;
    engine.use(
      stubGuard("observer", {
        check: async (ctx) => {
          observed = ctx.semanticEvals;
          return { guardId: "observer", passed: true, findings: [], durationMs: 1 };
        },
      }),
    );
    await engine.run([]);
    assert.equal(observed, undefined);
  });
});
