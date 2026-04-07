/**
 * Commit Format Guard
 *
 * Enforces conventional commit message format.
 * Default pattern: type(scope): description
 *
 * Pattern source: AAOS rule-pr-standards.md
 */

import type { Guard, GuardContext, GuardResult } from "../core/types.js";
import { Severity } from "../core/types.js";

const DEFAULT_PATTERN =
  /^(feat|fix|chore|docs|refactor|test|style|perf|ci)(\(.*\))?(!)?\:\s.+/;

export const commitFormatGuard: Guard = {
  id: "commitFormat",
  name: "Commit Format Enforcer",
  description:
    "Enforces conventional commit message format (e.g. feat(scope): description).",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();

    if (!ctx.commitMessage) {
      return {
        guardId: "commitFormat",
        passed: true,
        findings: [],
        durationMs: performance.now() - start,
      };
    }

    const config = ctx.config.guards.commitFormat;
    const pattern = config?.pattern
      ? new RegExp(config.pattern)
      : DEFAULT_PATTERN;

    // Only check the first line (subject)
    const subject = ctx.commitMessage.split("\n")[0].trim();
    const matches = pattern.test(subject);

    if (!matches) {
      const allowedTypes = config?.types ?? [
        "feat", "fix", "chore", "docs",
        "refactor", "test", "style", "perf", "ci",
      ];

      return {
        guardId: "commitFormat",
        passed: false,
        findings: [
          {
            guardId: "commitFormat",
            severity: Severity.BLOCK,
            message: `Commit message does not match conventional format.\n  Got: "${subject}"\n  Expected: <type>(<scope>): <description>\n  Allowed types: ${allowedTypes.join(", ")}`,
            fix: `git commit --amend -m "type(scope): your description"`,
          },
        ],
        durationMs: performance.now() - start,
      };
    }

    return {
      guardId: "commitFormat",
      passed: true,
      findings: [],
      durationMs: performance.now() - start,
    };
  },
};
