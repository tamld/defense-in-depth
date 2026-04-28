/**
 * Smoke tests for the public API surface (`import ... from "defense-in-depth"`).
 *
 * Spec: issue #33 — every shipped guard and every public type must be
 * reachable through the barrel file. This file imports the package via
 * its compiled barrel (`dist/index.js`) — the same path that external
 * consumers hit when they `npm install defense-in-depth` and
 * `import { ... } from "defense-in-depth"`.
 *
 * If a future change drops a re-export, these tests fail before the
 * change reaches a consumer's `node_modules`.
 *
 * Executor: Devin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import * as publicApi from "../dist/index.js";

import {
  // Engine + Config (values)
  DefendEngine,
  loadConfig,
  DEFAULT_CONFIG,
  // Enums (values)
  Severity,
  EvidenceLevel,
  // Built-in guards (values)
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
  // Federation (values)
  createProvider,
  FileTicketProvider,
  HttpTicketProvider,
} from "../dist/index.js";

describe("public API barrel — runtime values", () => {
  it("re-exports the engine constructor", () => {
    assert.equal(typeof DefendEngine, "function");
    assert.equal(DefendEngine.name, "DefendEngine");
  });

  it("re-exports loadConfig + DEFAULT_CONFIG", () => {
    assert.equal(typeof loadConfig, "function");
    assert.equal(typeof DEFAULT_CONFIG, "object");
    assert.ok(DEFAULT_CONFIG.guards, "DEFAULT_CONFIG must contain a `guards` block");
  });

  it("re-exports the Severity enum with the documented members", () => {
    assert.equal(typeof Severity, "object");
    assert.equal(Severity.PASS, "pass");
    assert.equal(Severity.WARN, "warn");
    assert.equal(Severity.BLOCK, "block");
  });

  it("re-exports the EvidenceLevel enum with the documented members", () => {
    assert.equal(typeof EvidenceLevel, "object");
    assert.equal(EvidenceLevel.CODE, "CODE");
    assert.equal(EvidenceLevel.RUNTIME, "RUNTIME");
    assert.equal(EvidenceLevel.INFER, "INFER");
    assert.equal(EvidenceLevel.HYPO, "HYPO");
  });
});

describe("public API barrel — built-in guards", () => {
  const guardCases = [
    ["hollowArtifactGuard", hollowArtifactGuard, "hollowArtifact"],
    ["ssotPollutionGuard", ssotPollutionGuard, "ssotPollution"],
    ["rootPollutionGuard", rootPollutionGuard, "rootPollution"],
    ["commitFormatGuard", commitFormatGuard, "commitFormat"],
    ["branchNamingGuard", branchNamingGuard, "branchNaming"],
    ["phaseGateGuard", phaseGateGuard, "phaseGate"],
    ["ticketIdentityGuard", ticketIdentityGuard, "ticketIdentity"],
    ["hitlReviewGuard", hitlReviewGuard, "hitlReview"],
    ["federationGuard", federationGuard, "federation"],
  ];

  for (const [exportName, guard, expectedId] of guardCases) {
    it(`${exportName} satisfies the Guard interface`, () => {
      assert.equal(typeof guard, "object");
      assert.equal(typeof guard.check, "function");
      assert.equal(guard.id, expectedId, `${exportName}.id must be "${expectedId}"`);
    });
  }

  it("allBuiltinGuards is a frozen-shape array containing every built-in guard", () => {
    assert.ok(Array.isArray(allBuiltinGuards));
    assert.equal(
      allBuiltinGuards.length,
      guardCases.length,
      `allBuiltinGuards must contain ${guardCases.length} guards (one per built-in)`,
    );
    for (const [, guard] of guardCases) {
      assert.ok(
        allBuiltinGuards.includes(guard),
        `allBuiltinGuards must include ${guard.id}`,
      );
    }
  });
});

describe("public API barrel — federation entry points", () => {
  it("re-exports createProvider", () => {
    assert.equal(typeof createProvider, "function");
  });

  it("re-exports FileTicketProvider class", () => {
    assert.equal(typeof FileTicketProvider, "function");
    assert.equal(FileTicketProvider.name, "FileTicketProvider");
  });

  it("re-exports HttpTicketProvider class", () => {
    assert.equal(typeof HttpTicketProvider, "function");
    assert.equal(HttpTicketProvider.name, "HttpTicketProvider");
  });
});

describe("public API barrel — module shape", () => {
  it("does not leak unexpected runtime exports", () => {
    // Allow-list of every value-level export the public API ships.
    // Type-only exports (Guard, GuardContext, Lesson, ...) are erased
    // at runtime, so they never appear here.
    const expected = new Set([
      "DefendEngine",
      "loadConfig",
      "DEFAULT_CONFIG",
      "Severity",
      "EvidenceLevel",
      "hollowArtifactGuard",
      "ssotPollutionGuard",
      "rootPollutionGuard",
      "commitFormatGuard",
      "branchNamingGuard",
      "phaseGateGuard",
      "ticketIdentityGuard",
      "hitlReviewGuard",
      "federationGuard",
      "allBuiltinGuards",
      "createProvider",
      "FileTicketProvider",
      "HttpTicketProvider",
    ]);

    const actual = new Set(Object.keys(publicApi));

    const unexpected = [...actual].filter((k) => !expected.has(k));
    const missing = [...expected].filter((k) => !actual.has(k));

    assert.deepEqual(unexpected, [], `unexpected runtime exports leaked: ${unexpected.join(", ")}`);
    assert.deepEqual(missing, [], `expected runtime exports missing: ${missing.join(", ")}`);
  });
});
