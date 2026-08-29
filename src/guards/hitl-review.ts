/**
 * Human-in-the-Loop (HITL) Review Guard
 *
 * Enforces branch protection by proactively blocking direct commits or pushes
 * to protected branches like 'main' or 'master' on the local machine.
 * This ensures that agents use a pull request workflow and do not bypass HITL.
 */

import type { Guard, GuardContext, GuardResult } from "../core/types.js";
import { Severity } from "../core/types.js";

const DEFAULT_PROTECTED_BRANCHES = ["main", "master"];

export const hitlReviewGuard: Guard = {
  id: "hitlReview",
  name: "HITL Enforcement",
  description:
    "Blocks direct commits to protected branches (main/master) to force a pull request workflow.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();

    // If there is no branch info, we can't reliably block
    if (!ctx.branch) {
      return {
        guardId: "hitlReview",
        passed: true,
        findings: [],
        durationMs: performance.now() - start,
      };
    }

    const config = ctx.config?.guards?.hitlReview;
    if (!config?.enabled) {
      return {
        guardId: "hitlReview",
        passed: true,
        findings: [],
        durationMs: performance.now() - start,
      };
    }

    const protectedBranches = config?.protectedBranches || DEFAULT_PROTECTED_BRANCHES;

    // Check if the current branch is protected
    if (protectedBranches.includes(ctx.branch)) {
      return {
        guardId: "hitlReview",
        passed: false,
        findings: [
          {
            guardId: "hitlReview",
            severity: Severity.BLOCK,
            message: `Direct commits to protected branch '${ctx.branch}' are strictly prohibited to enforce Human-in-the-Loop review.`,
            fix: `Create a feature branch via 'git checkout -b <branch>' and open a pull request.`,
          },
        ],
        durationMs: performance.now() - start,
      };
    }

    return {
      guardId: "hitlReview",
      passed: true,
      findings: [],
      durationMs: performance.now() - start,
    };
  },
};
