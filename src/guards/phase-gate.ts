/**
 * Phase Gate Guard
 *
 * Enforces "plan before code" by requiring a plan file to exist
 * before source code files can be committed.
 *
 * Disabled by default — designed for agentic projects.
 *
 * Pattern source: strategy_git_only_enforcement.md (the 2-gate domino chain)
 * Logic: If staged files match sourcePatterns AND planFile doesn't exist → BLOCK
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity } from "../core/types.js";

const DEFAULT_SOURCE_PATTERNS = ["src/", "lib/", "app/"];
const DEFAULT_PLAN_FILE = "implementation_plan.md";

/**
 * Check if a file path matches any of the source patterns.
 */
function isSourceFile(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.replace(/\\/g, "/").replace(/\*\*/g, "");
    return normalized.startsWith(normalizedPattern);
  });
}

export const phaseGateGuard: Guard = {
  id: "phaseGate",
  name: "Phase Gate (Plan Before Code)",
  description:
    "Requires a plan file to exist before source code can be committed. Enforces the 'plan before code' discipline for agentic workflows.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();
    const findings: Finding[] = [];

    const config = ctx.config.guards.phaseGate;
    const planFile = config?.planFile ?? DEFAULT_PLAN_FILE;
    const sourcePatterns = config?.sourcePatterns ?? DEFAULT_SOURCE_PATTERNS;

    // Check if any staged files are source code
    const sourceFiles = ctx.stagedFiles.filter((f) =>
      isSourceFile(f, sourcePatterns),
    );

    if (sourceFiles.length === 0) {
      // No source files staged — gate passes (planner mode OK)
      return {
        guardId: "phaseGate",
        passed: true,
        findings: [],
        durationMs: performance.now() - start,
      };
    }

    // Source files staged — check if plan exists
    const planPath = path.join(ctx.projectRoot, planFile);
    const planExists = fs.existsSync(planPath);

    if (!planExists) {
      findings.push({
        guardId: "phaseGate",
        severity: Severity.BLOCK,
        message: `Source code files modified but no "${planFile}" found.\n  Create a plan before writing code.\n  Source files: ${sourceFiles.slice(0, 5).join(", ")}${sourceFiles.length > 5 ? ` (+${sourceFiles.length - 5} more)` : ""}`,
        fix: `Create ${planFile} with your implementation plan before committing source code.`,
      });
    }

    return {
      guardId: "phaseGate",
      passed: findings.length === 0,
      findings,
      durationMs: performance.now() - start,
    };
  },
};
