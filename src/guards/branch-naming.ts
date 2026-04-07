/**
 * Branch Naming Guard
 *
 * Enforces branch naming conventions.
 * Disabled by default — enable in defend.config.yml.
 *
 * Pattern source: AAOS rule-git-collaboration-guard.ts
 */

import type { Guard, GuardContext, GuardResult } from "../core/types.js";
import { Severity } from "../core/types.js";

const DEFAULT_PATTERN = /^(feat|fix|chore|docs)\/.+/;

/** Branches that are always exempt from naming rules */
const EXEMPT_BRANCHES = new Set(["main", "master", "develop", "staging", "HEAD"]);

export const branchNamingGuard: Guard = {
  id: "branchNaming",
  name: "Branch Naming Enforcer",
  description:
    "Enforces branch naming conventions (e.g. feat/my-feature). Disabled by default.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();

    if (!ctx.branch) {
      return {
        guardId: "branchNaming",
        passed: true,
        findings: [],
        durationMs: performance.now() - start,
      };
    }

    // Skip exempt branches
    if (EXEMPT_BRANCHES.has(ctx.branch)) {
      return {
        guardId: "branchNaming",
        passed: true,
        findings: [],
        durationMs: performance.now() - start,
      };
    }

    const config = ctx.config.guards.branchNaming;
    const pattern = config?.pattern
      ? new RegExp(config.pattern)
      : DEFAULT_PATTERN;

    if (!pattern.test(ctx.branch)) {
      return {
        guardId: "branchNaming",
        passed: false,
        findings: [
          {
            guardId: "branchNaming",
            severity: Severity.BLOCK,
            message: `Branch name "${ctx.branch}" does not match required pattern: ${pattern.source}`,
            fix: `git branch -m "${ctx.branch}" "feat/${ctx.branch}"`,
          },
        ],
        durationMs: performance.now() - start,
      };
    }

    return {
      guardId: "branchNaming",
      passed: true,
      findings: [],
      durationMs: performance.now() - start,
    };
  },
};
