/**
 * SSoT Pollution Guard
 *
 * Detects state files (governance configs, flow state, backlog) leaking into commits.
 * These files should never be part of feature PRs — they are SSoT managed by tooling.
 *
 * Pattern source: sheriff.ts artifact_zones + pre-push-structure-guard.ts from AAOS
 */

import * as path from "node:path";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity } from "../core/types.js";

/** Default protected path patterns */
const DEFAULT_PROTECTED: string[] = [
  ".agents/",
  "flow_state.yml",
  "backlog.yml",
  "transition_log.jsonl",
  "last_violations.json",
];

/**
 * Simple glob-like matcher: supports ** (any depth) and * (segment).
 * Not a full glob — covers common SSoT protection patterns.
 */
function matchesProtected(filePath: string, pattern: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const normalizedPattern = pattern.replace(/\\/g, "/");

  // Direct substring match (most common case)
  if (normalized.includes(normalizedPattern)) return true;

  // ** glob: match any depth
  if (normalizedPattern.includes("**")) {
    const prefix = normalizedPattern.split("**")[0];
    if (prefix && normalized.startsWith(prefix)) return true;
  }

  // Exact filename match (e.g. "backlog.yml" matches "any/path/backlog.yml")
  if (!normalizedPattern.includes("/")) {
    const basename = path.basename(normalized);
    if (basename === normalizedPattern) return true;
  }

  return false;
}

export const ssotPollutionGuard: Guard = {
  id: "ssotPollution",
  name: "SSoT Pollution Detector",
  description:
    "Prevents governance state files from leaking into feature commits/PRs.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();
    const findings: Finding[] = [];

    const config = ctx.config.guards.ssotPollution;
    const protectedPaths = config?.protectedPaths ?? DEFAULT_PROTECTED;

    for (const filePath of ctx.stagedFiles) {
      for (const pattern of protectedPaths) {
        if (matchesProtected(filePath, pattern)) {
          findings.push({
            guardId: "ssotPollution",
            severity: Severity.BLOCK,
            message: `SSoT file "${filePath}" must not be included in commits (matches protected pattern "${pattern}")`,
            filePath,
            fix: `git reset HEAD "${filePath}" to unstage this file.`,
          });
          break;
        }
      }
    }

    return {
      guardId: "ssotPollution",
      passed: findings.length === 0,
      findings,
      durationMs: performance.now() - start,
    };
  },
};
