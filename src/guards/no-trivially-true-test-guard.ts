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

function extractTestBodies(content: string): Array<{ name: string; body: string; lineNum: number }> {
  const results: Array<{ name: string; body: string; lineNum: number }> = [];
  const testStartRegex = /(?:\btest|\bit|\bdescribe|\bt\.test)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_$]+)\s*=>\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = testStartRegex.exec(content)) !== null) {
    const testName = match[1];
    const startIndex = match.index + match[0].length;
    const lineNum = content.slice(0, match.index).split("\n").length;

    let braceCount = 1;
    let currentIndex = startIndex;
    let inString: string | null = null;
    let isEscaped = false;

    while (currentIndex < content.length && braceCount > 0) {
      const char = content[currentIndex];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (char === "\\") {
          isEscaped = true;
        } else if (char === inString) {
          inString = null;
        }
      } else {
        if (char === '"' || char === "'" || char === "`") {
          inString = char;
        } else if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
        }
      }
      currentIndex++;
    }

    if (braceCount === 0) {
      const body = content.slice(startIndex, currentIndex - 1);
      results.push({ name: testName, body, lineNum });
    }
  }
  return results;
}

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
      } catch (readErr) {
        // Ignore unreadable or deleted test files (TK-000)
        continue;
      }

      // Check for trivial constant comparisons line by line
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("await t.test(") ||
          trimmed.startsWith("test(") ||
          trimmed.startsWith("it(") ||
          /["'`].*?\bassert\.(?:strictEqual|equal|ok)\b.*?["'`]/.test(line)
        ) {
          continue;
        }

        for (const pattern of TRIVIAL_ASSERTION_PATTERNS) {
          if (pattern.test(line)) {
            findings.push({
              guardId: "noTriviallyTrueTest",
              severity,
              filePath: stagedRelPath,
              line: lineNum,
              message: `Trivially true assertion detected at line ${lineNum}: '${trimmed}'. Constant assertions do not test system invariants.`,
              fix: `Assert real system outputs or dynamic values instead of constant-to-constant comparisons.`,
              evidence: EvidenceLevel.CODE,
            });
            break;
          }
        }
      }

      // Check test block bodies for complete lack of assertions
      const testBlocks = extractTestBodies(content);
      for (const block of testBlocks) {
        // Skip suite wrappers that contain subtests
        if (/\b(?:t\.test|test|it)\s*\(/.test(block.body)) {
          continue;
        }

        const codeWithoutComments = block.body
          .replace(/\/\/[^\n]*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .trim();

        // If body has statements but no assertion calls at all
        if (codeWithoutComments.length > 0 && !ASSERTION_CALL_PATTERN.test(codeWithoutComments)) {
          findings.push({
            guardId: "noTriviallyTrueTest",
            severity,
            filePath: stagedRelPath,
            line: block.lineNum,
            message: `Test '${block.name}' at line ${block.lineNum} executes code without any assert or expect statements.`,
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
