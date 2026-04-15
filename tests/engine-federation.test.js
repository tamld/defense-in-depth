/**
 * Integration Tests: DefendEngine ↔ Federation Guard Pipeline (FE.01-04)
 *
 * These tests verify the FULL engine pipeline:
 *   extractTicketRef → enrichTicketRef → enrichParentTicket → federation guard
 *
 * Key insight: The engine uses ticketIdentity provider to enrich the child ticket,
 * then federation config to resolve the parent ticket. Both use HTTP providers
 * with mock fetch.
 */

import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import { DefendEngine } from "../dist/core/engine.js";
import { Severity } from "../dist/core/types.js";
import { federationGuard } from "../dist/guards/federation.js";

describe("DefendEngine: Federation Orchestration (FE.01-04)", () => {
  const dummyRoot = "/dummy/engine/root";
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Helper: create config with proper endpoint for BOTH child and parent providers.
   * ticketIdentity.providerConfig.endpoint → used to resolve child ticket
   * federation.parentEndpoint → used to resolve parent ticket
   */
  const createMockConfig = (federationEnabled, fedTimeout = 500) => ({
    version: "1.0",
    guards: {
      ticketIdentity: {
        enabled: true,
        severity: "warn",
        provider: "http",
        providerConfig: {
          timeout: 1000,
          endpoint: "http://child-api/tickets", // must set endpoint!
        },
      },
      federation: {
        enabled: federationEnabled,
        severity: "block",
        provider: "http",
        parentEndpoint: "http://parent-api/tickets",
        blockedParentPhases: ["BLOCKED", "ARCHIVED"],
        providerConfig: { timeout: fedTimeout },
      },
    },
  });

  /**
   * Helper: mock globalThis.fetch to intercept both child and parent resolution.
   * Child URL pattern: http://child-api/tickets/TK-CHILD
   * Parent URL pattern: http://parent-api/tickets/TK-PARENT
   */
  const setupMockFetch = (childRef, parentRef, parentDelayMs = 0) => {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      // Child resolution (called by enrichTicketRef)
      if (url.includes("child-api")) {
        return {
          ok: true,
          status: 200,
          json: async () => childRef,
        };
      }

      // Parent resolution (called by enrichParentTicket)
      if (url.includes("parent-api")) {
        if (parentDelayMs > 0) {
          // Respect AbortController signal for timeout tests
          const signal = init?.signal;
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, parentDelayMs);
            if (signal) {
              signal.addEventListener("abort", () => {
                clearTimeout(timer);
                reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          });
        }

        if (parentRef === "NETWORK_ERROR") {
          throw new TypeError("fetch failed");
        }
        if (parentRef === "404") {
          return { ok: false, status: 404, json: async () => ({}) };
        }

        return {
          ok: true,
          status: 200,
          json: async () => parentRef,
        };
      }

      throw new Error(`Unexpected mock fetch url: ${url}`);
    };
  };

  // ─── Test 1: Federation disabled → parent never fetched ───

  it("does not fetch parent if federation is disabled (regression check)", async () => {
    let parentFetched = false;
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("child-api")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "TK-CHILD", phase: "EXECUTING", parentId: "TK-PARENT" }),
        };
      }
      if (url.includes("parent-api")) {
        parentFetched = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "TK-PARENT", phase: "EXECUTING" }),
        };
      }
      return { ok: false, status: 500 };
    };

    const engine = new DefendEngine(dummyRoot, createMockConfig(false)).use(federationGuard);
    const result = await engine.run(["src/index.ts"], { branch: "feat/TK-CHILD" });

    assert.equal(parentFetched, false, "Should not resolve parent if federation is disabled");
    // Federation guard is skipped by engine because enabled: false
    const fedGuardResult = result.results.find((r) => r.guardId === "federation");
    // When federation.enabled=false, getGuardConfig returns {enabled:false} and the guard is SKIPPED
    assert.equal(fedGuardResult, undefined, "Federation guard should be completely skipped when disabled");
  });

  // ─── Test 2: FE.01–03: Full pipeline, parent phase unblocked ───

  it("FE.01 & FE.02: enriches parent and FE.03: injects authorized=true for unblocked phase", async () => {
    setupMockFetch(
      { id: "TK-CHILD", phase: "EXECUTING", parentId: "TK-PARENT" },
      { id: "TK-PARENT", phase: "EXECUTING" } // EXECUTING is NOT in blockedParentPhases
    );

    const engine = new DefendEngine(dummyRoot, createMockConfig(true)).use(federationGuard);
    const result = await engine.run(["src/index.ts"], { branch: "feat/TK-CHILD" });

    const fedGuardResult = result.results.find((r) => r.guardId === "federation");
    assert.ok(fedGuardResult, "Federation guard should run");

    // parentPhase = EXECUTING → authorized = true → guard passes with 0 findings
    assert.equal(fedGuardResult.passed, true, "Should pass for unblocked parent phase");
    assert.equal(fedGuardResult.findings.length, 0, "Should have 0 findings");
  });

  // ─── Test 3: FE.03: Parent phase BLOCKED → authorized=false, guard blocks ───

  it("FE.03: blocks when parent phase is in blockedParentPhases", async () => {
    setupMockFetch(
      { id: "TK-CHILD", phase: "EXECUTING", parentId: "TK-PARENT" },
      { id: "TK-PARENT", phase: "BLOCKED" } // BLOCKED IS in blockedParentPhases
    );

    const engine = new DefendEngine(dummyRoot, createMockConfig(true)).use(federationGuard);
    const result = await engine.run(["src/index.ts"], { branch: "feat/TK-CHILD" });

    const fedGuardResult = result.results.find((r) => r.guardId === "federation");
    assert.ok(fedGuardResult, "Federation guard should run");

    // Parent BLOCKED → authorized = false | phase in blocked list → 2 findings
    assert.equal(fedGuardResult.passed, false, "Should BLOCK when parent is in blocked phase");
    assert.ok(
      fedGuardResult.findings.some((f) => f.message.includes("BLOCKED")),
      "Should mention BLOCKED in finding message"
    );
  });

  // ─── Test 4: FE.04: Parent 404 → graceful degradation (WARN) ───

  it("FE.04: degrades gracefully to WARN when parent fetch returns 404", async () => {
    setupMockFetch(
      { id: "TK-CHILD", phase: "EXECUTING", parentId: "TK-PARENT" },
      "404"
    );

    const engine = new DefendEngine(dummyRoot, createMockConfig(true)).use(federationGuard);
    const result = await engine.run(["src/index.ts"], { branch: "feat/TK-CHILD" });

    const fedGuardResult = result.results.find((r) => r.guardId === "federation");
    assert.ok(fedGuardResult, "Federation guard should run");

    // 404 → provider returns undefined → enrichParentTicket catches → parentPhase undefined
    // Guard Check 3 fires: parentId exists but parentPhase undefined → WARN
    assert.equal(fedGuardResult.passed, true, "Should pass (WARN only, not BLOCK)");
    assert.ok(
      fedGuardResult.findings.some((f) => f.severity === Severity.WARN),
      "Should have WARN finding for unresolved parent"
    );
  });

  // ─── Test 5: FE.04: Parent network error → graceful degradation ───

  it("FE.04: degrades gracefully to WARN on network error", async () => {
    setupMockFetch(
      { id: "TK-CHILD", phase: "EXECUTING", parentId: "TK-PARENT" },
      "NETWORK_ERROR"
    );

    const engine = new DefendEngine(dummyRoot, createMockConfig(true)).use(federationGuard);
    const result = await engine.run(["src/index.ts"], { branch: "feat/TK-CHILD" });

    const fedGuardResult = result.results.find((r) => r.guardId === "federation");
    assert.ok(fedGuardResult, "Federation guard should run");

    assert.equal(fedGuardResult.passed, true, "Should pass (graceful degradation)");
    assert.ok(
      fedGuardResult.findings.some((f) => f.severity === Severity.WARN),
      "Should have WARN finding for network failure"
    );
  });

  // ─── Test 6: FE.04: Parent timeout → graceful degradation ───

  it("FE.04: degrades gracefully on parent provider timeout", async () => {
    setupMockFetch(
      { id: "TK-CHILD", phase: "EXECUTING", parentId: "TK-PARENT" },
      { id: "TK-PARENT", phase: "EXECUTING" },
      2000 // parent takes 2 seconds
    );

    // Federation timeout is 50ms (parent takes 2s → will timeout)
    const engine = new DefendEngine(dummyRoot, createMockConfig(true, 50)).use(federationGuard);
    const result = await engine.run(["src/index.ts"], { branch: "feat/TK-CHILD" });

    const fedGuardResult = result.results.find((r) => r.guardId === "federation");
    assert.ok(fedGuardResult, "Federation guard should run");

    // Timeout → provider returns undefined → parentPhase is undefined → WARN
    assert.equal(fedGuardResult.passed, true, "Should pass (timeout = graceful degradation)");
    assert.ok(
      fedGuardResult.findings.some((f) => f.severity === Severity.WARN),
      "Should have WARN finding for timeout"
    );
  });
});
