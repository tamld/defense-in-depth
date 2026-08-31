/**
 * No Swallowed Error Guard (Issue #113)
 *
 * Blocks silent error suppression in catch blocks:
 *   - Empty catch blocks: catch (e) {} or catch {}
 *   - Catch blocks containing only noop/ignore comments without a ticket reference
 *   - Catch blocks that immediately return stub values (null/{}/[]) to hide failures
 *
 * STRIDE category: Repudiation (audit trail and error visibility destroyed)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

const DEFAULT_ALLOWLIST_PATTERNS = [
  /(^|\/)tests?\//,
  /(^|\/)fixtures\//,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.d\.ts$/,
];

const TICKET_PATTERN = /(TK-[0-9A-Z-]+|[A-Z]+-[0-9]+|#\d+)/i;

export const noSwallowedErrorGuard: Guard = {
  id: "noSwallowedError",
  name: "No Swallowed Error Guard",
  description: "Blocks empty catch blocks and silent error swallowing in staged source files.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const config = ctx.config.guards.noSwallowedError;

    if (config && config.enabled === false) {
      return {
        guardId: "noSwallowedError",
        passed: true,
        findings: [],
        durationMs: Date.now() - start,
      };
    }

    const severity = config?.severity === "warn" ? Severity.WARN : Severity.BLOCK;
    const customAllowlist = config?.allowlistPaths ?? [];

    for (const stagedRelPath of ctx.stagedFiles) {
      const normalizedPath = stagedRelPath.replace(/\\/g, "/");

      // Only scan .ts, .tsx, .js, .mjs, .cjs
      if (!/\.(tsx?|[mc]?js)$/i.test(normalizedPath)) {
        continue;
      }

      if (DEFAULT_ALLOWLIST_PATTERNS.some((p) => p.test(normalizedPath))) {
        continue;
      }

      if (customAllowlist.some((pat) => normalizedPath.includes(pat) || new RegExp(pat).test(normalizedPath))) {
        continue;
      }

      const absPath = path.resolve(ctx.projectRoot, stagedRelPath);
      if (!fs.existsSync(absPath)) {
        continue;
      }

      let content = "";
      try {
        content = fs.readFileSync(absPath, "utf-8");
      } catch (readErr) {
        // Ignore file read error on inaccessible files (TK-000)
        continue;
      }

      // Replace multi-line block comments with equivalent space/newlines to preserve line numbers
      const sanitizedContent = content.replace(/\/\*[\s\S]*?\*\//g, (m) => {
        return m.replace(/[^\n]/g, " ");
      });

      // Regex matching catch clauses: catch(...) { ... } or catch { ... }
      // Matches both single-line and multi-line catch blocks
      const catchRegex = /catch\s*(?:\([^)]*\))?\s*\{([^}]*)\}/g;
      let match: RegExpExecArray | null;

      while ((match = catchRegex.exec(sanitizedContent)) !== null) {
        const body = match[1].trim();
        const matchIndex = match.index;
        const lineNumber = sanitizedContent.slice(0, matchIndex).split("\n").length;
        const originalBlock = content.slice(matchIndex, matchIndex + match[0].length);

        // Strip comments to check if body has real code
        const codeWithoutComments = body
          .replace(/\/\/[^\n]*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .trim();

        const hasTicket = TICKET_PATTERN.test(body) || TICKET_PATTERN.test(originalBlock);

        // 1. Empty catch body
        if (codeWithoutComments.length === 0) {
          // If there's a comment with a ticket reference, allow as escape hatch
          if (hasTicket) {
            continue;
          }

          findings.push({
            guardId: "noSwallowedError",
            severity,
            filePath: stagedRelPath,
            line: lineNumber,
            message: `Swallowed error detected: empty catch block at line ${lineNumber}. Exceptions must be logged, handled, rethrown, or documented with a ticket ID.`,
            fix: `Add error logging (e.g. console.error/logger), rethrow 'throw err', or document with '// TODO(TK-XXX): reason'.`,
            evidence: EvidenceLevel.CODE,
          });
          continue;
        }

        // 2. Catch block that only returns a stub value
        if (/^return\s+(null|undefined|\{\}|\[\])\s*;?$/i.test(codeWithoutComments)) {
          if (hasTicket) {
            continue;
          }

          findings.push({
            guardId: "noSwallowedError",
            severity,
            filePath: stagedRelPath,
            line: lineNumber,
            message: `Swallowed error with stub return detected at line ${lineNumber} ('return ${codeWithoutComments.replace(/^return\s+/i, "")}').`,
            fix: `Log the caught error or handle the failure explicitly instead of returning a hollow default.`,
            evidence: EvidenceLevel.CODE,
          });
        }
      }
    }

    const passed = !findings.some((f) => f.severity === Severity.BLOCK);
    return {
      guardId: "noSwallowedError",
      passed,
      findings,
      durationMs: Date.now() - start,
    };
  },
};
