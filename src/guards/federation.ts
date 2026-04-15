/**
 * Federation Guard (v0.6 — TKID-Aware Parent↔Child Governance)
 *
 * Cross-validates child project execution against parent ticket state.
 * This guard enforces the Federation Lifecycle rule:
 *   "A child project MUST NOT proceed if the parent ticket is blocked,
 *    cancelled, or archived."
 *
 * Configurable via defense.config.yml:
 *   guards.federation.enabled: true/false (default: false — opt-in)
 *   guards.federation.severity: "warn" | "block" (default: "block")
 *   guards.federation.blockedParentPhases: string[] (default: ["BLOCKED", "CANCELLED", "ARCHIVED"])
 *
 * Graceful skip: when ticket.parentId is undefined (standalone projects
 * or projects without federation), this guard passes silently.
 *
 * PURE GUARD: This guard performs ZERO I/O. All parent state is resolved
 * by the engine's enrichTicketRef phase before the guard pipeline starts.
 * The guard only reads ctx.ticket.parentPhase and ctx.ticket.authorized.
 */

import type { Guard, GuardContext, GuardResult } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

/** Default parent phases that block child execution */
const DEFAULT_BLOCKED_PHASES = ["BLOCKED", "CANCELLED", "ARCHIVED"];

export const federationGuard: Guard = {
  id: "federation",
  name: "Federation Parent-Child Check",
  description:
    "Validates child project authorization against parent ticket state",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();
    const findings: GuardResult["findings"] = [];

    // Skip gracefully: no parent context → standalone project
    if (!ctx.ticket?.parentId) {
      return {
        guardId: this.id,
        passed: true,
        findings,
        durationMs: performance.now() - start,
      };
    }

    const guardConfig = ctx.config.guards.federation;
    const severityLevel = guardConfig?.severity ?? "block";
    const blockedPhases = guardConfig?.blockedParentPhases ?? DEFAULT_BLOCKED_PHASES;
    const severity = severityLevel === "block" ? Severity.BLOCK : Severity.WARN;

    // Check 1: Explicit authorization denial
    if (ctx.ticket.authorized === false) {
      findings.push({
        guardId: this.id,
        severity,
        message: `Parent ticket ${ctx.ticket.parentId} has denied authorization for child ticket ${ctx.ticket.id}. Execution is blocked by federation governance.`,
        fix: `Verify parent ticket status and ensure it authorizes child work. Check with the parent project owner.`,
        evidence: EvidenceLevel.RUNTIME,
      });
    }

    // Check 2: Parent phase is in blocked list
    if (ctx.ticket.parentPhase) {
      const normalizedPhase = ctx.ticket.parentPhase.toUpperCase();
      if (blockedPhases.map(p => p.toUpperCase()).includes(normalizedPhase)) {
        findings.push({
          guardId: this.id,
          severity,
          message: `Parent ticket ${ctx.ticket.parentId} is in phase "${ctx.ticket.parentPhase}" which blocks child execution. Child ticket: ${ctx.ticket.id}.`,
          fix: `Wait for the parent ticket to transition to an active phase (e.g., PLANNING, EXECUTING), or create a new parent ticket.`,
          evidence: EvidenceLevel.RUNTIME,
        });
      }
    }

    // Check 3: Parent phase could not be resolved (warn only)
    if (ctx.ticket.parentId && !ctx.ticket.parentPhase && ctx.ticket.authorized === undefined) {
      findings.push({
        guardId: this.id,
        severity: Severity.WARN,
        message: `Could not resolve parent ticket ${ctx.ticket.parentId} state. Federation validation skipped. Child ticket: ${ctx.ticket.id}.`,
        fix: `Ensure federation provider is configured and parent project is accessible.`,
        evidence: EvidenceLevel.INFER,
      });
    }

    return {
      guardId: this.id,
      passed: severityLevel === "warn" ? true : findings.filter(f => f.severity === Severity.BLOCK).length === 0,
      findings,
      durationMs: performance.now() - start,
    };
  },
};
