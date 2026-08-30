/**
 * No Type Safety Bypass Guard (Issue #112)
 *
 * Blocks patterns that disable or bypass the TypeScript compiler type system:
 *   - 'as any' casts
 *   - '// @ts-ignore' comments
 *   - '// @ts-nocheck' comments
 *   - '// @ts-expect-error' without an approved ticket/reason escape hatch
 *
 * STRIDE category: Tampering (with type-system guarantees)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

const DEFAULT_ALLOWLIST_PATTERNS = [
  /tests\/fixtures\//,
  /\.d\.ts$/,
];

// Regex for ticket escape hatch: // @ts-expect-error [-—:] (TK-123, PROJ-123, #123)
const TICKET_ESCAPE_HATCH = /@ts-expect-error\s*[-—:]\s*(TK-[0-9A-Z-]+|[A-Z]+-[0-9]+|#\d+)/i;

export const noTypeSafetyBypassGuard: Guard = {
  id: "noTypeSafetyBypass",
  name: "No Type Safety Bypass Guard",
  description: "Blocks 'as any', '@ts-ignore', '@ts-nocheck', and unreferenced '@ts-expect-error' on commit.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const config = ctx.config.guards.noTypeSafetyBypass;

    if (config && config.enabled === false) {
      return {
        guardId: "noTypeSafetyBypass",
        passed: true,
        findings: [],
        durationMs: Date.now() - start,
      };
    }

    const severity = config?.severity === "warn" ? Severity.WARN : Severity.BLOCK;
    const customAllowlist = config?.allowlistPaths ?? [];

    for (const stagedRelPath of ctx.stagedFiles) {
      // Normalize slashes for cross-platform compatibility
      const normalizedPath = stagedRelPath.replace(/\\/g, "/");

      // Only scan .ts and .tsx files
      if (!/\.tsx?$/i.test(normalizedPath)) {
        continue;
      }

      // Skip declaration files (*.d.ts) and default allowlists
      if (DEFAULT_ALLOWLIST_PATTERNS.some((p) => p.test(normalizedPath))) {
        continue;
      }

      // Check custom allowlist
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
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        const lineNum = i + 1;

        // 1. Check for 'as any'
        if (/\bas\s+any\b/.test(lineText)) {
          findings.push({
            guardId: "noTypeSafetyBypass",
            severity,
            filePath: stagedRelPath,
            line: lineNum,
            message: `Type safety bypass detected: 'as any' cast found at line ${lineNum}. Use proper type narrowing or 'as unknown as ConcreteType'.`,
            fix: `Replace 'as any' with exact type narrowing, a type predicate guard function, or 'as unknown as <Type>'.`,
            evidence: EvidenceLevel.CODE,
          });
        }

        // 2. Check for @ts-ignore
        if (/@ts-ignore\b/.test(lineText)) {
          findings.push({
            guardId: "noTypeSafetyBypass",
            severity,
            filePath: stagedRelPath,
            line: lineNum,
            message: `Type safety bypass detected: '@ts-ignore' found at line ${lineNum}. Fix the underlying type error instead of suppressing it.`,
            fix: `Resolve the compiler type error or use '@ts-expect-error — <ticket-id>: <reason>' if strictly required.`,
            evidence: EvidenceLevel.CODE,
          });
        }

        // 3. Check for @ts-nocheck
        if (/@ts-nocheck\b/.test(lineText)) {
          findings.push({
            guardId: "noTypeSafetyBypass",
            severity,
            filePath: stagedRelPath,
            line: lineNum,
            message: `Type safety bypass detected: '@ts-nocheck' disables type checking for the entire file.`,
            fix: `Remove '@ts-nocheck' and ensure TypeScript strict mode passes.`,
            evidence: EvidenceLevel.CODE,
          });
        }

        // 4. Check for @ts-expect-error without ticket reference
        if (/@ts-expect-error\b/.test(lineText) && !TICKET_ESCAPE_HATCH.test(lineText)) {
          findings.push({
            guardId: "noTypeSafetyBypass",
            severity,
            filePath: stagedRelPath,
            line: lineNum,
            message: `Unreferenced '@ts-expect-error' at line ${lineNum}. Escape hatch requires an associated ticket ID.`,
            fix: `Add a ticket reference: '// @ts-expect-error — TK-XXX: description of upstream issue'.`,
            evidence: EvidenceLevel.CODE,
          });
        }
      }
    }

    const passed = !findings.some((f) => f.severity === Severity.BLOCK);
    return {
      guardId: "noTypeSafetyBypass",
      passed,
      findings,
      durationMs: Date.now() - start,
    };
  },
};
