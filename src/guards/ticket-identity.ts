/**
 * Ticket Identity Guard (v0.3 — TKID Lite)
 *
 * Non-contradiction check: if the branch declares a TKID,
 * the commit message must NOT reference a DIFFERENT ticket.
 *
 * Configurable via defense.config.yml:
 *   guards.ticketIdentity.enabled: true/false (default: false — opt-in)
 *   guards.ticketIdentity.tkidPattern: regex string (default: "TK-[0-9A-Z-]+")
 *   guards.ticketIdentity.severity: "warn" | "block" (default: "warn")
 *
 * Graceful skip: when ticket === undefined (standalone projects
 * or branches without TKID pattern), this guard passes silently.
 *
 * Architectural note: Git worktree IS the Dependency Injection
 * mechanism. The engine receives projectRoot from CWD, which
 * automatically scopes branch/identity/artifacts. This guard
 * does NOT hardcode any directory structure.
 */

import type { Guard, GuardContext, GuardResult } from "../core/types.js";
import { Severity } from "../core/types.js";

export const ticketIdentityGuard: Guard = {
  id: "ticketIdentity",
  name: "Ticket Identity Check",
  description:
    "Warns when a commit message references a different ticket than the branch",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();
    const findings: GuardResult["findings"] = [];

    // Skip gracefully: no ticket context → standalone project or non-ticket branch
    if (!ctx.ticket?.id) {
      return { guardId: this.id, passed: true, findings, durationMs: performance.now() - start };
    }

    // Skip if no commit message to validate (e.g. pre-commit without message yet)
    if (!ctx.commitMessage) {
      return { guardId: this.id, passed: true, findings, durationMs: performance.now() - start };
    }

    // Read config — use defaults if not provided
    const guardConfig = ctx.config.guards.ticketIdentity;
    const tkidPattern = guardConfig?.tkidPattern ?? "TK-[0-9A-Z-]+";
    const severityLevel = guardConfig?.severity ?? "warn";

    // Non-contradiction check: does the commit mention a DIFFERENT TKID?
    const tkidRegex = new RegExp(tkidPattern, "gi");
    const foreignTkids = (ctx.commitMessage.match(tkidRegex) ?? []).filter(
      (tk) => tk.toUpperCase() !== ctx.ticket!.id.toUpperCase(),
    );

    if (foreignTkids.length > 0) {
      const severity = severityLevel === "block" ? Severity.BLOCK : Severity.WARN;
      findings.push({
        guardId: this.id,
        severity,
        message: `Commit references ticket(s) [${foreignTkids.join(", ")}] but branch is on ${ctx.ticket.id}. Possible cross-ticket contamination.`,
        fix: `Remove foreign ticket references from commit message, or split into separate commits per ticket.`,
      });
    }

    // Phase-aware validation: warn if ticket is in a terminal phase
    if (ctx.ticket.phase) {
      const terminalPhases = ["DONE", "CLOSED", "ARCHIVED"];
      if (terminalPhases.includes(ctx.ticket.phase.toUpperCase())) {
        const severity = severityLevel === "block" ? Severity.BLOCK : Severity.WARN;
        findings.push({
          guardId: this.id,
          severity,
          message: `Ticket ${ctx.ticket.id} is in phase "${ctx.ticket.phase}". Committing to a closed/done ticket may indicate stale work.`,
          fix: `Verify this ticket is still active, or create a new ticket for this work.`,
        });
      }
    }

    return {
      guardId: this.id,
      passed: severityLevel === "warn" ? true : findings.length === 0,
      findings,
      durationMs: performance.now() - start,
    };
  },
};

