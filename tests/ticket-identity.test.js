/**
 * Tests for ticketIdentityGuard (v0.3 — enhanced with phase-aware validation).
 *
 * Tests cover:
 * 1. Cross-ticket contamination detection (existing)
 * 2. Phase-aware validation (new in v0.3)
 * 3. Graceful skip when no ticket context
 * 4. Severity configuration
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ticketIdentityGuard } from "../dist/guards/ticket-identity.js";
import { Severity } from "../dist/core/types.js";

/** Helper to create a minimal GuardContext */
function makeCtx(overrides = {}) {
  return {
    stagedFiles: [],
    projectRoot: "/tmp/test",
    config: {
      version: "1.0",
      guards: {
        ticketIdentity: {
          enabled: true,
          tkidPattern: "TK-[0-9A-Z-]+",
          severity: "warn",
        },
      },
    },
    ...overrides,
  };
}

describe("ticketIdentityGuard", () => {
  describe("graceful skip", () => {
    it("passes when no ticket context", async () => {
      const ctx = makeCtx({ ticket: undefined, commitMessage: "feat: add something" });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    });

    it("passes when no commit message", async () => {
      const ctx = makeCtx({ ticket: { id: "TK-001" }, commitMessage: undefined });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    });
  });

  describe("cross-ticket contamination", () => {
    it("warns when commit references a different ticket", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001" },
        commitMessage: "feat(TK-002): wrong ticket",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.passed, true, "warn severity still passes");
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].severity, Severity.WARN);
      assert.ok(result.findings[0].message.includes("TK-002"));
    });

    it("passes when commit references the same ticket", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001" },
        commitMessage: "feat(TK-001): correct ticket",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    });

    it("passes when commit has no ticket reference", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001" },
        commitMessage: "feat: add feature without ticket ref",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    });

    it("blocks when severity is 'block' and foreign ticket detected", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001" },
        commitMessage: "feat(TK-999): foreign ticket",
      });
      ctx.config.guards.ticketIdentity.severity = "block";
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.passed, false, "block severity fails the guard");
      assert.equal(result.findings[0].severity, Severity.BLOCK);
    });
  });

  describe("phase-aware validation", () => {
    it("warns when ticket phase is DONE", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001", phase: "DONE" },
        commitMessage: "feat: late change on done ticket",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.findings.length, 1, "Should have 1 finding for stale phase");
      assert.ok(result.findings[0].message.includes("DONE"));
    });

    it("warns when ticket phase is CLOSED (case-insensitive)", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001", phase: "closed" },
        commitMessage: "fix: oops",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.findings.length, 1);
      assert.ok(result.findings[0].message.includes("closed"));
    });

    it("warns when ticket phase is ARCHIVED", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001", phase: "ARCHIVED" },
        commitMessage: "chore: cleanup",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.findings.length, 1);
    });

    it("does not warn when ticket phase is EXECUTING", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001", phase: "EXECUTING" },
        commitMessage: "feat: active work",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.findings.length, 0);
    });

    it("does not warn when ticket has no phase", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001" },
        commitMessage: "feat: no phase info",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.findings.length, 0);
    });

    it("blocks on DONE phase when severity is 'block'", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001", phase: "DONE" },
        commitMessage: "feat: late commit",
      });
      ctx.config.guards.ticketIdentity.severity = "block";
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.passed, false, "block severity + DONE = fail");
      assert.equal(result.findings.length, 1);
    });
  });

  describe("combined scenarios", () => {
    it("reports both cross-ticket AND phase findings", async () => {
      const ctx = makeCtx({
        ticket: { id: "TK-001", phase: "DONE" },
        commitMessage: "feat(TK-999): foreign ticket on done ticket",
      });
      const result = await ticketIdentityGuard.check(ctx);
      assert.equal(result.findings.length, 2, "Should have 2 findings");
      // One for cross-ticket, one for phase
      const messages = result.findings.map((f) => f.message);
      assert.ok(messages.some((m) => m.includes("TK-999")), "Should flag foreign ticket");
      assert.ok(messages.some((m) => m.includes("DONE")), "Should flag stale phase");
    });
  });
});
