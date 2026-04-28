/**
 * Subpath exports smoke tests (issue #36).
 *
 * package.json declares four public subpaths in addition to the root:
 *   - `defense-in-depth`              → barrel index
 *   - `defense-in-depth/guards`       → built-in guards barrel
 *   - `defense-in-depth/federation`   → ticket-provider factory + types
 *   - `defense-in-depth/types`        → core types module (Severity, etc.)
 *
 * These tests use Node's package self-referencing — because the local
 * package.json has `name: "defense-in-depth"` and an `exports` map, Node
 * resolves `import "defense-in-depth/<subpath>"` from inside this repo
 * via the same code path external consumers will hit. That makes this
 * file the trip-wire for any future change to the subpath surface:
 * adding, renaming, or removing a subpath without updating the
 * allow-list below will fail this test.
 *
 * Coverage:
 *   1. Each subpath resolves (no `ERR_PACKAGE_PATH_NOT_EXPORTED`).
 *   2. Each subpath exposes the expected named exports.
 *   3. Symbols imported via subpath are object-identical to the same
 *      symbols imported via the root barrel (no module duplication).
 *   4. The root subpath surface is unchanged (backward-compat for v0.7).
 *
 * Executor: Devin
 */

import test from "node:test";
import assert from "node:assert";

test("subpath exports — package self-referencing (issue #36)", async (t) => {
  await t.test("root subpath: 'defense-in-depth' still works", async () => {
    const root = await import("defense-in-depth");
    assert.strictEqual(typeof root.DefendEngine, "function", "DefendEngine class export");
    assert.strictEqual(typeof root.loadConfig, "function", "loadConfig fn export");
    assert.strictEqual(typeof root.DEFAULT_CONFIG, "object", "DEFAULT_CONFIG value export");
    assert.strictEqual(typeof root.Severity, "object", "Severity enum value export");
    assert.strictEqual(typeof root.EvidenceLevel, "object", "EvidenceLevel enum value export");
    assert.strictEqual(typeof root.hollowArtifactGuard, "object", "hollowArtifactGuard value export");
    assert.strictEqual(typeof root.allBuiltinGuards, "object", "allBuiltinGuards array");
    assert.ok(Array.isArray(root.allBuiltinGuards), "allBuiltinGuards is an array");
  });

  await t.test("'defense-in-depth/types' exposes core types & enum values", async () => {
    const types = await import("defense-in-depth/types");
    // Value-level (enum runtime objects)
    assert.strictEqual(typeof types.Severity, "object", "Severity is exported as an enum object");
    assert.strictEqual(typeof types.EvidenceLevel, "object", "EvidenceLevel is exported as an enum object");
    // Sanity-check enum values (per src/core/types.ts current shape)
    assert.strictEqual(types.Severity.PASS, "pass");
    assert.strictEqual(types.Severity.WARN, "warn");
    assert.strictEqual(types.Severity.BLOCK, "block");
    assert.strictEqual(types.EvidenceLevel.CODE, "CODE");
    assert.strictEqual(types.EvidenceLevel.RUNTIME, "RUNTIME");
    assert.strictEqual(types.EvidenceLevel.INFER, "INFER");
    assert.strictEqual(types.EvidenceLevel.HYPO, "HYPO");
  });

  await t.test("'defense-in-depth/guards' exposes every built-in guard", async () => {
    const guards = await import("defense-in-depth/guards");
    const expected = [
      "hollowArtifactGuard",
      "ssotPollutionGuard",
      "rootPollutionGuard",
      "commitFormatGuard",
      "branchNamingGuard",
      "phaseGateGuard",
      "ticketIdentityGuard",
      "hitlReviewGuard",
      "federationGuard",
    ];
    for (const name of expected) {
      assert.strictEqual(
        typeof guards[name],
        "object",
        `guards barrel must export ${name}`,
      );
      assert.strictEqual(
        typeof guards[name].check,
        "function",
        `${name} must implement Guard.check()`,
      );
    }
    // The aggregate also has to ship for "register-everything" use cases.
    assert.ok(Array.isArray(guards.allBuiltinGuards), "allBuiltinGuards is exported");
    assert.strictEqual(
      guards.allBuiltinGuards.length,
      expected.length,
      "allBuiltinGuards length must match the named-export count",
    );
  });

  await t.test("'defense-in-depth/federation' exposes provider factory + impls", async () => {
    const federation = await import("defense-in-depth/federation");
    assert.strictEqual(typeof federation.createProvider, "function", "createProvider factory");
    assert.strictEqual(typeof federation.FileTicketProvider, "function", "FileTicketProvider class");
    assert.strictEqual(typeof federation.HttpTicketProvider, "function", "HttpTicketProvider class");

    // Smoke-call: createProvider() with no args must default to the file provider.
    const provider = federation.createProvider(undefined, undefined, "/tmp");
    assert.ok(
      provider instanceof federation.FileTicketProvider,
      "default provider is FileTicketProvider",
    );
  });

  await t.test("identical symbol resolves to identical object across subpaths", async () => {
    // Severity is exposed both via the root barrel AND via the /types subpath.
    // They MUST be the same runtime object — otherwise consumers comparing
    // `severity === Severity.BLOCK` get false negatives across boundaries
    // (the classic "two copies of the same enum" trap).
    const root = await import("defense-in-depth");
    const types = await import("defense-in-depth/types");
    assert.strictEqual(
      root.Severity,
      types.Severity,
      "Severity from root must be === Severity from /types subpath",
    );
    assert.strictEqual(
      root.EvidenceLevel,
      types.EvidenceLevel,
      "EvidenceLevel from root must be === EvidenceLevel from /types subpath",
    );

    // Same check for guards: a single guard instance must resolve identically
    // through both the root barrel and the /guards subpath.
    const guards = await import("defense-in-depth/guards");
    assert.strictEqual(
      root.hollowArtifactGuard,
      guards.hollowArtifactGuard,
      "hollowArtifactGuard from root must be === from /guards subpath",
    );
  });

  await t.test("'defense-in-depth/package.json' resolves (ergonomic helper)", async () => {
    // Many tools (workspace runners, version-bump scripts) need to read the
    // package.json without calling `require.resolve` tricks. The exports map
    // exposes it explicitly so this is a stable, documented surface.
    const pkg = await import("defense-in-depth/package.json", { with: { type: "json" } });
    assert.strictEqual(pkg.default.name, "defense-in-depth");
    assert.ok(typeof pkg.default.version === "string", "version field is a string");
  });

  await t.test("undeclared subpath is correctly blocked by the exports map", async () => {
    // The exports field exists to ENFORCE the public surface — deep imports
    // into dist/ are a v0.x compatibility liability we explicitly close in
    // v1.0. This test pins that contract.
    await assert.rejects(
      () => import("defense-in-depth/dist/core/engine.js"),
      (err) => err.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
      "deep dist/* imports must be blocked by the exports map",
    );
  });
});
