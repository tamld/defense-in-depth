/**
 * Public API CONTRACT tests (issue #35).
 *
 * ────────────────────────────────────────────────────────────────────
 * Breaking any test in this file = SEMVER MAJOR bump per
 * docs/SEMVER.md §3. These tests are the living specification of the
 * v1.0 public surface as seen by external consumers. They import ONLY
 * via the published barrel (`../dist/index.js` — what npm ships); they
 * do NOT touch internal modules. If the structure of an exported value
 * or the shape of a returned object changes, a consumer's code breaks
 * silently — these tests fire first.
 * ────────────────────────────────────────────────────────────────────
 *
 * Scope (deliberately narrower than `tests/public-api.test.js`):
 *
 *   public-api.test.js     → "is the symbol exported?" (presence)
 *   public-api-contract.js → "does the symbol BEHAVE per its contract?"
 *                            (shape of return values, chainability,
 *                            constructor signatures, enum stability)
 *
 * The two files are complementary. Presence tests catch dropped
 * re-exports; contract tests catch silent behavioural drift.
 *
 * Rule: every assertion below pins a contract that a consumer in the
 * wild can build against. No assertion should reach into private state
 * or internal module paths — if a refactor needs to reshape internals,
 * these tests should keep passing.
 *
 * Executor: Devin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  DefendEngine,
  loadConfig,
  DEFAULT_CONFIG,
  Severity,
  EvidenceLevel,
  hollowArtifactGuard,
  ssotPollutionGuard,
  rootPollutionGuard,
  commitFormatGuard,
  branchNamingGuard,
  phaseGateGuard,
  ticketIdentityGuard,
  hitlReviewGuard,
  federationGuard,
  allBuiltinGuards,
  createProvider,
  FileTicketProvider,
  HttpTicketProvider,
} from "../../dist/index.js";

// ─── Shared fixture: a throw-away project root ───────────────────────
function mkProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "did-contract-"));
  return root;
}

// ─── Section 1: DefendEngine constructor & instance contracts ────────

describe("CONTRACT — DefendEngine class shape", () => {
  it("is constructable with projectRoot only (config defaults from disk)", () => {
    // Breaking this = MAJOR. Many consumers rely on `new DefendEngine(root)`
    // as their one-liner integration.
    const root = mkProjectRoot();
    const engine = new DefendEngine(root);
    assert.ok(engine instanceof DefendEngine, "constructor must return a DefendEngine instance");
  });

  it("is constructable with explicit config (DI for tests / overrides)", () => {
    const root = mkProjectRoot();
    const engine = new DefendEngine(root, DEFAULT_CONFIG);
    assert.ok(engine instanceof DefendEngine);
  });

  it("exposes .use() that returns the engine itself (chainable)", () => {
    // Breaking this = MAJOR. The README and migration guide both show
    // `new DefendEngine(root).use(g1).use(g2).run(...)` style.
    const engine = new DefendEngine(mkProjectRoot(), DEFAULT_CONFIG);
    const out = engine.use(hollowArtifactGuard);
    assert.strictEqual(out, engine, ".use() must return `this` for chaining");
  });

  it("exposes .useAll() that returns the engine itself (chainable)", () => {
    const engine = new DefendEngine(mkProjectRoot(), DEFAULT_CONFIG);
    const out = engine.useAll([hollowArtifactGuard, commitFormatGuard]);
    assert.strictEqual(out, engine, ".useAll() must return `this` for chaining");
  });

  it("exposes .run() that returns a Promise", () => {
    const engine = new DefendEngine(mkProjectRoot(), DEFAULT_CONFIG);
    const p = engine.run([], {});
    assert.ok(p && typeof p.then === "function", ".run() must return a thenable");
    return p; // make sure the test waits on it (no unhandled rejection)
  });
});

// ─── Section 2: EngineVerdict shape contract ─────────────────────────

describe("CONTRACT — EngineVerdict object shape from engine.run()", () => {
  it("returns the documented shape: passed | totalGuards | passedGuards | failedGuards | warnedGuards | results | durationMs", async () => {
    // Breaking this = MAJOR. The fields below are the only guarantees
    // consumers (CI scripts, hooks, dashboards) can rely on.
    const engine = new DefendEngine(mkProjectRoot(), DEFAULT_CONFIG)
      .use(commitFormatGuard);
    const verdict = await engine.run([], { commitMessage: "feat: contract test" });

    assert.strictEqual(typeof verdict, "object");
    assert.ok(verdict !== null, "verdict must not be null");

    // Required boolean
    assert.strictEqual(typeof verdict.passed, "boolean", "passed: boolean");

    // Required counters
    assert.strictEqual(typeof verdict.totalGuards, "number", "totalGuards: number");
    assert.strictEqual(typeof verdict.passedGuards, "number", "passedGuards: number");
    assert.strictEqual(typeof verdict.failedGuards, "number", "failedGuards: number");
    assert.strictEqual(typeof verdict.warnedGuards, "number", "warnedGuards: number");

    // Required results array
    assert.ok(Array.isArray(verdict.results), "results: GuardResult[]");

    // Required timing
    assert.strictEqual(typeof verdict.durationMs, "number", "durationMs: number");
    assert.ok(verdict.durationMs >= 0, "durationMs must be non-negative");

    // Internal accounting consistency (a published invariant — not
    // implementation detail). If this fails, the verdict is incoherent
    // and dashboards reading these fields will mis-render.
    assert.strictEqual(
      verdict.totalGuards,
      verdict.results.length,
      "totalGuards must equal results.length",
    );
    assert.strictEqual(
      verdict.totalGuards,
      verdict.passedGuards + verdict.failedGuards,
      "totalGuards must equal passedGuards + failedGuards",
    );
    assert.strictEqual(
      verdict.passed,
      verdict.failedGuards === 0,
      "verdict.passed must be true iff failedGuards === 0",
    );
  });
});

// ─── Section 3: GuardResult shape contract ───────────────────────────

describe("CONTRACT — GuardResult object shape (per-guard output)", () => {
  it("each result item has guardId | passed | findings | durationMs", async () => {
    // Breaking this = MAJOR. Every consumer that introspects per-guard
    // output (custom reporters, IDE plugins) reads exactly these fields.
    const engine = new DefendEngine(mkProjectRoot(), DEFAULT_CONFIG)
      .use(hollowArtifactGuard)
      .use(commitFormatGuard);
    const verdict = await engine.run([], { commitMessage: "feat: ok" });

    assert.strictEqual(verdict.results.length, 2);
    for (const r of verdict.results) {
      assert.strictEqual(typeof r.guardId, "string", "guardId: string");
      assert.ok(r.guardId.length > 0, "guardId must be non-empty");
      assert.strictEqual(typeof r.passed, "boolean", "passed: boolean");
      assert.ok(Array.isArray(r.findings), "findings: Finding[]");
      assert.strictEqual(typeof r.durationMs, "number", "durationMs: number");
      assert.ok(r.durationMs >= 0, "durationMs must be non-negative");
    }
  });

  it("Finding objects (when present) have guardId | severity | message", async () => {
    // Force at least one Finding by feeding an obviously bad commit message.
    const engine = new DefendEngine(mkProjectRoot(), DEFAULT_CONFIG).use(commitFormatGuard);
    const verdict = await engine.run([], { commitMessage: "no type prefix here" });
    const findings = verdict.results.flatMap((r) => r.findings);
    assert.ok(findings.length >= 1, "expected at least one finding for bad commit message");

    for (const f of findings) {
      assert.strictEqual(typeof f.guardId, "string", "Finding.guardId: string");
      assert.strictEqual(typeof f.severity, "string", "Finding.severity: string");
      assert.ok(
        Object.values(Severity).includes(f.severity),
        `Finding.severity must be one of Severity values, got ${f.severity}`,
      );
      assert.strictEqual(typeof f.message, "string", "Finding.message: string");
      assert.ok(f.message.length > 0, "Finding.message must be non-empty");
    }
  });
});

// ─── Section 4: Guard interface shape contract ───────────────────────

describe("CONTRACT — Guard interface shape (every built-in)", () => {
  for (const guard of allBuiltinGuards) {
    it(`${guard.id}: id | name | description | check() per Guard contract`, () => {
      // Breaking this = MAJOR. User-authored guards rely on this exact
      // shape (it is THE pluggability contract) — see
      // .agents/contracts/guard-interface.md.
      assert.strictEqual(typeof guard.id, "string");
      assert.ok(guard.id.length > 0, "Guard.id must be non-empty");

      assert.strictEqual(typeof guard.name, "string", `Guard.name on ${guard.id}`);
      assert.ok(guard.name.length > 0, `Guard.name must be non-empty on ${guard.id}`);

      assert.strictEqual(
        typeof guard.description,
        "string",
        `Guard.description on ${guard.id}`,
      );
      assert.ok(
        guard.description.length > 0,
        `Guard.description must be non-empty on ${guard.id}`,
      );

      assert.strictEqual(typeof guard.check, "function", `Guard.check on ${guard.id}`);
      // Guard.check must take a single ctx argument per the contract.
      assert.strictEqual(guard.check.length, 1, `Guard.check must accept exactly 1 argument on ${guard.id}`);
    });
  }

  it("every built-in guard has a unique id (no collisions in registry)", () => {
    const ids = allBuiltinGuards.map((g) => g.id);
    const unique = new Set(ids);
    assert.strictEqual(
      ids.length,
      unique.size,
      `duplicate guard ids in allBuiltinGuards: ${ids.join(", ")}`,
    );
  });
});

// ─── Section 5: Severity & EvidenceLevel enum contracts ──────────────

describe("CONTRACT — enum value stability", () => {
  it("Severity has EXACTLY {PASS:'pass', WARN:'warn', BLOCK:'block'} — no more, no less", () => {
    // Breaking this = MAJOR. Severity values are persisted in
    // dashboards, lesson logs, and CI output. Adding a new severity is
    // additive (Minor); REMOVING or RENAMING one is breaking.
    assert.deepStrictEqual(
      { ...Severity },
      { PASS: "pass", WARN: "warn", BLOCK: "block" },
      "Severity enum value-set must match the v1.0 contract",
    );
  });

  it("EvidenceLevel has EXACTLY {CODE, RUNTIME, INFER, HYPO} with stable string values", () => {
    assert.deepStrictEqual(
      { ...EvidenceLevel },
      {
        CODE: "CODE",
        RUNTIME: "RUNTIME",
        INFER: "INFER",
        HYPO: "HYPO",
      },
      "EvidenceLevel enum value-set must match the v1.0 contract",
    );
  });
});

// ─── Section 6: Config contracts ─────────────────────────────────────

describe("CONTRACT — loadConfig & DEFAULT_CONFIG shape", () => {
  it("loadConfig(<no defense.config.yml>) returns the documented defaults", () => {
    // Breaking this = MAJOR. The "zero-config out of the box" promise
    // is the headline value prop in README §1 — `loadConfig()` on a
    // fresh repo MUST return a usable DefendConfig with all guards
    // present.
    const root = mkProjectRoot(); // no defense.config.yml inside
    const cfg = loadConfig(root);
    assert.strictEqual(typeof cfg, "object");
    assert.ok(cfg.guards && typeof cfg.guards === "object", "cfg.guards must be an object");

    // Defaults ship configuration for the seven always-on guards.
    // `hitlReview` and `federation` are deliberately opt-in (they
    // require user-supplied policy / a ticket provider) and are NOT in
    // DEFAULT_CONFIG.guards by design — verified by the explicit
    // negative assertions below.
    for (const expectedKey of [
      "hollowArtifact",
      "ssotPollution",
      "rootPollution",
      "commitFormat",
      "branchNaming",
      "phaseGate",
      "ticketIdentity",
    ]) {
      assert.ok(
        expectedKey in cfg.guards,
        `cfg.guards.${expectedKey} must be present in defaults`,
      );
    }
    for (const optInKey of ["hitlReview", "federation"]) {
      assert.ok(
        !(optInKey in cfg.guards),
        `cfg.guards.${optInKey} is opt-in and MUST NOT appear in defaults`,
      );
    }
  });

  it("DEFAULT_CONFIG is a real, non-empty DefendConfig instance", () => {
    assert.strictEqual(typeof DEFAULT_CONFIG, "object");
    assert.ok(DEFAULT_CONFIG !== null);
    assert.ok(
      typeof DEFAULT_CONFIG.guards === "object" && DEFAULT_CONFIG.guards !== null,
      "DEFAULT_CONFIG.guards must be a non-null object",
    );
  });
});

// ─── Section 7: Federation provider contracts ────────────────────────

describe("CONTRACT — federation provider factory & TicketStateProvider shape", () => {
  it("createProvider(undefined) returns a FileTicketProvider instance (default)", () => {
    const p = createProvider(undefined, undefined, mkProjectRoot());
    assert.ok(
      p instanceof FileTicketProvider,
      "default provider must be FileTicketProvider",
    );
  });

  it("createProvider('file') returns a FileTicketProvider instance", () => {
    const p = createProvider("file", undefined, mkProjectRoot());
    assert.ok(p instanceof FileTicketProvider);
  });

  it("createProvider('http') returns an HttpTicketProvider instance", () => {
    const p = createProvider("http", { endpoint: "http://localhost:0" }, mkProjectRoot());
    assert.ok(p instanceof HttpTicketProvider);
  });

  it("createProvider(<unknown>) gracefully degrades to the file provider (does NOT throw)", () => {
    // Breaking this = MAJOR. The graceful-degradation contract is
    // documented in src/federation/index.ts and is what allows users
    // to upgrade a config without taking down the pipeline.
    const root = mkProjectRoot();
    const p = createProvider("does-not-exist-12345", undefined, root);
    assert.ok(
      p instanceof FileTicketProvider,
      "unknown provider must fall back to FileTicketProvider, not throw",
    );
  });

  it("every TicketStateProvider exposes the documented interface (name | resolve | optional dispose)", async () => {
    const cases = [
      createProvider("file", undefined, mkProjectRoot()),
      createProvider("http", { endpoint: "http://localhost:0" }, mkProjectRoot()),
    ];

    for (const p of cases) {
      assert.strictEqual(typeof p.name, "string", "provider.name: string");
      assert.ok(p.name.length > 0, "provider.name must be non-empty");

      assert.strictEqual(typeof p.resolve, "function", "provider.resolve: function");
      // resolve(ticketId) — exactly 1 documented param.
      assert.strictEqual(
        p.resolve.length,
        1,
        "provider.resolve must accept exactly 1 argument (ticketId)",
      );

      // dispose is optional. If present, must be a function.
      if ("dispose" in p && p.dispose !== undefined) {
        assert.strictEqual(typeof p.dispose, "function", "provider.dispose: function (when present)");
      }
    }
  });
});
