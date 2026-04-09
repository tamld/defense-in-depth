/**
 * Root Pollution Guard
 *
 * Detects unauthorized files from being created or modified in the root directory.
 * Forces agents to place temporary tools, drafts, or internal scripts into the correct directories
 * (such as .agents/, docs/, src/) instead of polluting the ecosystem root.
 */

import * as path from "node:path";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity } from "../core/types.js";

const DEFAULT_ALLOWED_FILES: string[] = [];
const DEFAULT_ALLOWED_PATTERNS: string[] = []; 

/**
 * Checks if a file path is located directly at the root (no subdirectories).
 */
function isRootFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return !normalized.includes("/");
}

/**
 * Simple matcher to test if a file matches allowed patterns (e.g., *.md).
 */
function matchesPattern(filename: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const ext = pattern.slice(1); // e.g. ".md"
    return filename.endsWith(ext);
  }
  if (pattern === ".*") {
    return filename.startsWith(".");
  }
  return filename === pattern;
}

export const rootPollutionGuard: Guard = {
  id: "rootPollution",
  name: "Root Pollution Guard",
  description: "Prevents unauthorized files from polluting the project's root directory.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();
    const findings: Finding[] = [];

    const config = ctx.config.guards.rootPollution;
    // Strict adherence to config: No hidden fallback whitelist!
    const allowedFiles = config?.allowedRootFiles ?? [];
    const allowedPatterns = config?.allowedRootPatterns ?? [];

    for (const filePath of ctx.stagedFiles) {
      if (isRootFile(filePath)) {
        const basename = path.basename(filePath);

        // Check explicit file list
        let isAllowed = allowedFiles.includes(basename);

        // Check patterns
        if (!isAllowed) {
          for (const pattern of allowedPatterns) {
            if (matchesPattern(basename, pattern)) {
              isAllowed = true;
              break;
            }
          }
        }

        if (!isAllowed) {
          findings.push({
            guardId: "rootPollution",
            severity: Severity.BLOCK,
            message: `[Ecosystem Pollution] File "${basename}" is NOT allowed at the project root. The root is strictly restricted to configs and READMEs defined in defense.config.yml.`,
            filePath,
            fix: `git reset HEAD ${JSON.stringify(filePath)} && mv ${JSON.stringify(filePath)} <target-directory>/\n\nGuiding Map for AI Agents:\n  - 🧠 Scratch/Drafts/Memory -> .gemini/brain/, .claude/, .cursor/, or /tmp/\n  - 📜 Documentation -> docs/\n  - ⚙️ Governance/Rules -> .agents/rules/\n  - 💻 Source Code -> src/`,
          });
        }
      }
    }

    return {
      guardId: "rootPollution",
      passed: findings.length === 0,
      findings,
      durationMs: performance.now() - start,
    };
  },
};
