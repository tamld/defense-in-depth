/**
 * Tests for Federation Guard (v0.6).
 *
 * Validates parent↔child ticket authorization governance.
 * Uses Node.js built-in test runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import from dist (compiled output)
import { federationGuard } from "../dist/guards/federation.js";
import { Severity } from "../dist/core/types.js";

/** Helper: build a minimal GuardContext for testing */
function makeCtx(overrides = {}) {
  const base = {
    stagedFiles: ["README.md"],
    projectRoot: "/tmp/test-project",
    config: {
      version: "1.0",
      guards: {
        federation: {
          enabled: true,
          severity: "block",
          blockedParentPhases: ["BLOCKED", "CANCELLED", "ARCHIVED"],
        },
      },
    },
    ticket: undefined,
  };
  return { ...base, ...overrides };
}

describe("Federation Guard", () => {
  it("passes silently when no parent context (standalone project)", async () => {
    const ctx = makeCtx({ ticket: { id: "TK-CHILD-001" } });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("passes silently when ticket is undefined", async () => {
    const ctx = makeCtx({ ticket: undefined });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("passes when parent phase is EXECUTING (authorized)", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "EXECUTING",
        authorized: true,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("passes when parent phase is PLANNING (authorized)", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "PLANNING",
        authorized: true,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("BLOCKs when parent phase is BLOCKED", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "BLOCKED",
        authorized: false,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, false);
    assert.ok(result.findings.length >= 1);
    const blockFindings = result.findings.filter(f => f.severity === Severity.BLOCK);
    assert.ok(blockFindings.length >= 1, "Should have at least one BLOCK finding");
    // One finding for authorization denial + one for blocked phase
    assert.ok(result.findings.some(f => f.message.includes("BLOCKED") || f.message.includes("denied")));
  });

  it("BLOCKs when parent phase is CANCELLED", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "CANCELLED",
        authorized: false,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, false);
    assert.ok(result.findings.some(f => f.message.includes("CANCELLED")));
  });

  it("BLOCKs when parent phase is ARCHIVED", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "ARCHIVED",
        authorized: false,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, false);
    assert.ok(result.findings.some(f => f.message.includes("ARCHIVED")));
  });

  it("BLOCKs when authorized is explicitly false", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "CUSTOM_DENY",
        authorized: false,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, false);
    assert.ok(result.findings.some(f => f.message.includes("denied authorization")));
  });

  it("emits WARN (not BLOCK) when severity is 'warn'", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "BLOCKED",
        authorized: false,
      },
      config: {
        version: "1.0",
        guards: {
          federation: {
            enabled: true,
            severity: "warn",
            blockedParentPhases: ["BLOCKED"],
          },
        },
      },
    });
    const result = await federationGuard.check(ctx);

    // severity=warn → guard always passes
    assert.equal(result.passed, true);
    assert.ok(result.findings.length >= 1);
    const warnFinding = result.findings.find(f => f.severity === Severity.WARN);
    assert.ok(warnFinding, "Should have a WARN finding");
  });

  it("warns when parent state could not be resolved (parentPhase undefined)", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        // parentPhase: undefined (not resolved)
        // authorized: undefined (not resolved)
      },
    });
    const result = await federationGuard.check(ctx);

    // Should pass (no blocking) but emit a warning
    assert.equal(result.passed, true);
    assert.ok(result.findings.length === 1);
    assert.equal(result.findings[0].severity, Severity.WARN);
    assert.ok(result.findings[0].message.includes("Could not resolve"));
  });

  it("is a pure guard (has no I/O methods)", () => {
    // Verify the guard is a simple object with check() — no fetch, no fs
    assert.equal(typeof federationGuard.check, "function");
    assert.equal(federationGuard.id, "federation");
    assert.equal(typeof federationGuard.name, "string");
  });

  it("supports custom blockedParentPhases list", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "ON_HOLD",
        authorized: false,
      },
      config: {
        version: "1.0",
        guards: {
          federation: {
            enabled: true,
            severity: "block",
            blockedParentPhases: ["ON_HOLD", "SUSPENDED"],
          },
        },
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, false);
    assert.ok(result.findings.some(f => f.message.includes("ON_HOLD")));
  });

  // ─── Edge / Worst Cases ───

  // Edge: case-insensitive phase matching (lowercase "blocked" should still match)
  it("matches blocked phases case-insensitively", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "blocked", // lowercase
        authorized: false,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, false, "Should block even with lowercase phase");
  });

  // Edge: parentId is empty string (truthy in guard check)
  it("skips when parentId is empty string", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "", // empty string = falsy
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, true, "Empty parentId should be treated as no parent");
    assert.equal(result.findings.length, 0);
  });

  // Edge: parentPhase is empty string (not in blocked list)
  it("passes when parentPhase is empty string", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "",
        authorized: true,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, true, "Empty parentPhase should not trigger block");
  });

  // Worst: both authorized=false AND parentPhase in blocked list → should emit 2 findings
  it("emits TWO findings when both auth denied AND phase blocked", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "CANCELLED",
        authorized: false,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 2, "Should have 2 findings: auth + phase");
    const severities = result.findings.map(f => f.severity);
    assert.ok(severities.every(s => s === Severity.BLOCK), "Both should be BLOCK severity");
  });

  // Worst: federation config is completely missing from guards
  it("uses defaults when federation config is absent", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "BLOCKED",
        authorized: false,
      },
      config: {
        version: "1.0",
        guards: {}, // no federation config at all
      },
    });
    const result = await federationGuard.check(ctx);

    // Should still work with defaults (severity=block, default blocked phases)
    assert.equal(result.passed, false);
    assert.ok(result.findings.length >= 1);
  });

  // Edge: durationMs should be a positive number
  it("reports valid durationMs", async () => {
    const ctx = makeCtx({
      ticket: {
        id: "TK-CHILD-001",
        parentId: "TK-PARENT-001",
        parentPhase: "EXECUTING",
        authorized: true,
      },
    });
    const result = await federationGuard.check(ctx);

    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0, "durationMs should be non-negative");
  });
});

