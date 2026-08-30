/**
 * No Trivially True Test Guard (Issue #115)
 *
 * Blocks hollow test assertions that falsify test coverage:
 *   - expect(true).toBe(true) / expect(1).toBe(1)
 *   - assert.strictEqual(1, 1) / assert.equal(true, true)
 *   - assert.ok(true) / assert.ok(1) / assert.equal(1, 1)
 *   - Test blocks (test/it) that perform operations but invoke zero assertions
 *
 * STRIDE category: Repudiation (test assertions and quality guarantees are falsified)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

const DEFAULT_ALLOWLIST_PATTERNS = [
  /tests\/fixtures\//,
];

// Patterns matching trivially true constant assertions
const TRIVIAL_ASSERTION_PATTERNS = [
  /expect\s*\(\s*(?:true|1|['"]ok['"])\s*\)\s*\.(?:toBe|toEqual|strictEqual)\s*\(\s*(?:true|1|['"]ok['"])\s*\)/i,
  /assert\s*\.(?:strictEqual|equal|deepEqual|deepStrictEqual)\s*\(\s*(\d+|true|false|['"][^'"]*['"])\s*,\s*\1\s*\)/i,
  /assert\s*\.ok\s*\(\s*(?:true|1)\s*\)/i,
];

const ASSERTION_CALL_PATTERN = /\b(?:assert(?:\.[a-zA-Z_$]+|\s*\()|expect\s*\(|t\.assert|t\.equal|t\.strictEqual|t\.ok|t\.deepEqual|t\.throws|t\.doesNotThrow)\b/;

export const noTriviallyTrueTestGuard: Guard = {
  id: "noTriviallyTrueTest",
  name: "No Trivially True Test Guard",
  description: "Blocks trivially true assertions and test blocks without assertions in staged test files.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const config = ctx.config.guards.noTriviallyTrueTest;

    if (config && config.enabled === false) {
      return {
        guardId: "noTriviallyTrueTest",
        passed: true,
        findings: [],
        durationMs: Date.now() - start,
      };
    }

    const severity = config?.severity === "warn" ? Severity.WARN : Severity.BLOCK;
    const customAllowlist = config?.allowlistPaths ?? [];

    for (const stagedRelPath of ctx.stagedFiles) {
      const normalizedPath = stagedRelPath.replace(/\\/g, "/");

      // Only check test files under tests/ or files ending in .test.js / .spec.js / .test.ts
      if (!/tests\/.*|\.test\.[mc]?[jt]sx?$|\.spec\.[mc]?[jt]sx?$/i.test(normalizedPath)) {
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
      } catch {
        continue;
      }

      // Check for trivial constant comparisons line by line
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        for (const pattern of TRIVIAL_ASSERTION_PATTERNS) {
          if (pattern.test(line)) {
            findings.push({
              guardId: "noTriviallyTrueTest",
              severity,
              filePath: stagedRelPath,
              line: lineNum,
              message: `Trivially true assertion detected at line ${lineNum}: '${line.trim()}'. Constant assertions do not test system invariants.`,
              fix: `Assert real system outputs or dynamic values instead of constant-to-constant comparisons.`,
              evidence: EvidenceLevel.CODE,
            });
            break;
          }
        }
      }

      // Check test block bodies for complete lack of assertions: test('name', [async] (t) => { ... })
      const testBlockRegex = /(?:\btest|\bit|\bdescribe)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_$]+)\s*=>\s*\{([^}]*)\}/g;
      let match: RegExpExecArray | null;

      while ((match = testBlockRegex.exec(content)) !== null) {
        const testName = match[1];
        const body = match[2].trim();
        const matchIndex = match.index;
        const lineNum = content.slice(0, matchIndex).split("\n").length;

        // Skip nested describe / suite wrappers if they contain subtests
        if (/\b(?:test|it)\s*\(/.test(body)) {
          continue;
        }

        const codeWithoutComments = body
          .replace(/\/\/[^\n]*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .trim();

        // If body has statements but no assertion calls at all
        if (codeWithoutComments.length > 0 && !ASSERTION_CALL_PATTERN.test(codeWithoutComments)) {
          findings.push({
            guardId: "noTriviallyTrueTest",
            severity,
            filePath: stagedRelPath,
            line: lineNum,
            message: `Test '${testName}' at line ${lineNum} executes code without any assert or expect statements.`,
            fix: `Add explicit assertions (e.g. assert.strictEqual, assert.ok, assert.throws) to verify state or return value.`,
            evidence: EvidenceLevel.CODE,
          });
        }
      }
    }

    const passed = !findings.some((f) => f.severity === Severity.BLOCK);
    return {
      guardId: "noTriviallyTrueTest",
      passed,
      findings,
      durationMs: Date.now() - start,
    };
  },
};
