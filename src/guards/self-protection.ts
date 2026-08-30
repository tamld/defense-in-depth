/**
 * Self Protection Guard (Issue #116)
 *
 * Prevents AI agents from modifying critical governance mechanisms, coverage gates,
 * and security rules without explicit human-in-the-loop authorization / ticket linkage.
 *
 * STRIDE category: Tampering (with the security mechanism itself)
 */

import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

const DEFAULT_PROTECTED_PATHS = [
  "scripts/check-coverage.mjs",
  ".gitleaks.toml",
  "tsconfig.json",
  ".github/workflows/",
];

const TICKET_REGEX = /(TK-[0-9A-Z-]+|[A-Z]+-[0-9]+|#\d+)/i;

export const selfProtectionGuard: Guard = {
  id: "selfProtection",
  name: "Self Protection Guard",
  description: "Protects critical governance, test thresholds, and security configuration files from unauthorized tampering.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const config = ctx.config.guards.selfProtection;

    if (config && config.enabled === false) {
      return {
        guardId: "selfProtection",
        passed: true,
        findings: [],
        durationMs: Date.now() - start,
      };
    }

    const severity = config?.severity === "warn" ? Severity.WARN : Severity.BLOCK;
    const protectedList = config?.protectedPaths ?? DEFAULT_PROTECTED_PATHS;
    const hasTicketContext = Boolean(
      (ctx.ticket && ctx.ticket.id) ||
      (ctx.commitMessage && TICKET_REGEX.test(ctx.commitMessage))
    );

    for (const stagedRelPath of ctx.stagedFiles) {
      const normalizedPath = stagedRelPath.replace(/\\/g, "/");

      const isProtected = protectedList.some((pattern) => {
        if (pattern.endsWith("/")) {
          return normalizedPath.startsWith(pattern) || normalizedPath.includes(pattern);
        }
        return normalizedPath === pattern || normalizedPath.endsWith(`/${pattern}`);
      });

      if (!isProtected) {
        continue;
      }

      // If protected file is touched without a valid ticket ID
      if (!hasTicketContext) {
        findings.push({
          guardId: "selfProtection",
          severity,
          filePath: stagedRelPath,
          message: `Self-protection violation: '${stagedRelPath}' is a core governance/security file. Modifying it requires explicit ticket context or HITL authorization.`,
          fix: `Include a valid ticket ID (e.g. 'TK-XXX' or '#123') in the commit message or ticket context to authorize changes to '${stagedRelPath}'.`,
          evidence: EvidenceLevel.CODE,
        });
      }
    }

    const passed = !findings.some((f) => f.severity === Severity.BLOCK);
    return {
      guardId: "selfProtection",
      passed,
      findings,
      durationMs: Date.now() - start,
    };
  },
};
