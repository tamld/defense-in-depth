/**
 * No Stub Return Guard (Issue #114)
 *
 * Blocks hollow function implementations whose entire body is a placeholder:
 *   - Function bodies whose ONLY statement is return null / undefined / {} / []
 *   - Function bodies whose ONLY statement is throw new Error('Not implemented' / 'TODO')
 *   - Arrow functions immediately returning stub literals: () => null / () => ({}) / () => []
 *
 * STRIDE category: Tampering (with function semantics) + Repudiation (no real work done)
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

// Patterns representing hollow single-statement bodies
const STUB_RETURN_PATTERNS = [
  /^return\s+(null|undefined|\{\}|\[\])\s*(?:as\s+any)?\s*;?$/i,
  /^throw\s+new\s+(?:Error|TypeError)\s*\(\s*['"`](?:Not\s+implemented|TODO|TBD|Placeholder|Stub)['"`]\s*\)\s*;?$/i,
];

// Arrow function short bodies: () => null / () => ({}) / () => []
const STUB_ARROW_REGEX = /=>\s*(null|undefined|\(\s*\{\s*\}\s*\)|\[\s*\])\s*;?$/;

export const noStubReturnGuard: Guard = {
  id: "noStubReturn",
  name: "No Stub Return Guard",
  description: "Blocks placeholder functions whose only body statement returns a stub default or throws TODO.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const config = ctx.config.guards.noStubReturn;

    if (config && config.enabled === false) {
      return {
        guardId: "noStubReturn",
        passed: true,
        findings: [],
        durationMs: Date.now() - start,
      };
    }

    const severity = config?.severity === "warn" ? Severity.WARN : Severity.BLOCK;
    const customAllowlist = config?.allowlistPaths ?? [];

    for (const stagedRelPath of ctx.stagedFiles) {
      const normalizedPath = stagedRelPath.replace(/\\/g, "/");

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

      // Match function/method block bodies: function/method/constructor(...) { <body> }
      // We look for function definitions followed by a single statement block
      const funcBlockRegex = /(?:function\s*[\w$]*|\b(?:async\s+)?(?:get\s+|set\s+)?[\w$]+\s*)\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{([^}]*)\}/g;
      let match: RegExpExecArray | null;

      while ((match = funcBlockRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const body = match[1].trim();
        const matchIndex = match.index;
        const lineNumber = content.slice(0, matchIndex).split("\n").length;

        // Skip if there is an explicit ticket comment escape hatch
        if (TICKET_PATTERN.test(body) || TICKET_PATTERN.test(fullMatch)) {
          continue;
        }

        const codeWithoutComments = body
          .replace(/\/\/[^\n]*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .trim();

        for (const pattern of STUB_RETURN_PATTERNS) {
          if (pattern.test(codeWithoutComments)) {
            findings.push({
              guardId: "noStubReturn",
              severity,
              filePath: stagedRelPath,
              line: lineNumber,
              message: `Hollow stub function detected at line ${lineNumber}: body contains only '${codeWithoutComments}'. Implement the substantive business logic.`,
              fix: `Implement actual function logic or annotate with '// TODO(TK-XXX): stub description' if intentionally deferred.`,
              evidence: EvidenceLevel.CODE,
            });
            break;
          }
        }
      }

      // Check arrow functions: const foo = (...) => null / () => ({})
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i].trim();
        const lineNum = i + 1;

        if (lineText.startsWith("//") || lineText.startsWith("/*") || lineText.startsWith("*")) {
          continue;
        }

        if (STUB_ARROW_REGEX.test(lineText)) {
          if (TICKET_PATTERN.test(lineText)) {
            continue;
          }

          // Ensure it's not part of a test fixture or complex multi-line expression
          if (lineText.includes("const ") || lineText.includes("let ") || lineText.includes("var ") || lineText.includes("= (")) {
            findings.push({
              guardId: "noStubReturn",
              severity,
              filePath: stagedRelPath,
              line: lineNum,
              message: `Hollow stub arrow function detected at line ${lineNum}: '${lineText}'.`,
              fix: `Implement substantive return logic or document with a ticket reference.`,
              evidence: EvidenceLevel.CODE,
            });
          }
        }
      }
    }

    const passed = !findings.some((f) => f.severity === Severity.BLOCK);
    return {
      guardId: "noStubReturn",
      passed,
      findings,
      durationMs: Date.now() - start,
    };
  },
};
