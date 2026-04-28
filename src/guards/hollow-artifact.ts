/**
 * Hollow Artifact Guard
 *
 * Detects files that contain only template placeholders without real content.
 * AI agents commonly create "hollow" artifacts to bypass workflow gates.
 *
 * What it catches:
 *   - Files with TODO, TBD, FILL IN HERE, <Empty>, [Insert Here], PLACEHOLDER
 *   - Files with only markdown headers and no substantive body
 *   - Files below minimum content length threshold
 *   - v0.5: Optionally, semantic quality below threshold (via DSPy adapter, opt-in)
 *
 * Pattern source: dspy-reflection-service.ts HOLLOW_PATTERNS + rule-reflection-taxonomy-guard.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

// DSPy contract schema moved to src/core/dspy-client.ts
// Re-export for backward compatibility
export type { DSPyEvalResponse } from "../core/dspy-client.js";

/** Default patterns that indicate hollow content */
const DEFAULT_HOLLOW_PATTERNS = [
  /\bTODO\b/i,
  /\bTBD\b/i,
  /FILL\s*IN\s*HERE/i,
  /<Empty>/i,
  /\[Insert\s*Here\]/i,
  /\bPLACEHOLDER\b/i,
];

/**
 * Escape regex metacharacters so user-supplied `patterns` strings from
 * `defense.config.yml` are treated as literal substrings (case-insensitive),
 * not as regular expressions. Without this, a default pattern like
 * `[Insert Here]` compiles into a character class that matches any letter
 * `I/n/s/e/r/t/space/H` and false-positives on common English text.
 *
 * The escaped set is the union of all regex metacharacters defined by
 * ECMAScript: `\ ^ $ . | ? * + ( ) [ ] { }` plus `-` (which is special
 * inside character classes — escape it for safety even outside them).
 */
function escapeRegExp(s: string): string {
  return s.replace(/[\\^$.|?*+()[\]{}\-]/g, "\\$&");
}

/** Default file extensions to scan */
const DEFAULT_EXTENSIONS = [".md", ".json", ".yml", ".yaml"];

/** Minimum meaningful content length (after stripping headers/whitespace) */
const DEFAULT_MIN_CONTENT_LENGTH = 50;

/** Default DSPy timeout */
const DEFAULT_DSPY_TIMEOUT_MS = 5000;

/** Hard-coded whitelist of semantic text extensions safely scannable by DSPy */
const SEMANTIC_TEXT_EXTS = new Set([".md", ".json", ".js", ".ts", ".html", ".yml", ".yaml", ".txt"]);

/**
 * Strip markdown headers, frontmatter, and whitespace to get "meaningful" content.
 */
function stripBoilerplate(content: string): string {
  return content
    .replace(/^---[\s\S]*?---/m, "")       // YAML frontmatter
    .replace(/^#+\s.*$/gm, "")             // Markdown headers
    .replace(/^\s*[-*]\s*$/gm, "")         // Empty list items
    .replace(/^\s*$/gm, "")               // Blank lines
    .trim();
}

// v0.5: Network call moved to src/core/engine.ts to keep guards pure.

export const hollowArtifactGuard: Guard = {
  id: "hollowArtifact",
  name: "Hollow Artifact Detector",
  description:
    "Detects files with only placeholder content (TODO, TBD, etc.) — prevents agents from creating empty artifacts to bypass gates.",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();
    const findings: Finding[] = [];

    const config = ctx.config.guards.hollowArtifact;
    const extensions = config?.extensions ?? DEFAULT_EXTENSIONS;
    const minLength = config?.minContentLength ?? DEFAULT_MIN_CONTENT_LENGTH;

    // Build regex patterns from config or defaults.
    // User-supplied strings are escaped so they match as literal substrings
    // (case-insensitive). The DEFAULT_HOLLOW_PATTERNS array uses real RegExp
    // literals with anchors / word boundaries and is consumed verbatim.
    const patterns: RegExp[] = config?.patterns
      ? config.patterns.map((p) => new RegExp(escapeRegExp(p), "i"))
      : DEFAULT_HOLLOW_PATTERNS;

    // v0.5: DSPy configuration (opt-in, disabled by default)
    const useDspy = config?.useDspy === true;

    // Filter staged files to only check relevant extensions
    const filesToCheck = ctx.stagedFiles.filter((f) =>
      extensions.some((ext) => f.endsWith(ext)),
    );

    for (const relPath of filesToCheck) {
      const absPath = path.join(ctx.projectRoot, relPath);

      if (!fs.existsSync(absPath)) continue;

      let content: string;
      try {
        content = fs.readFileSync(absPath, "utf-8");
      } catch {
        continue; // Can't read → skip
      }

      // Check 1: Hollow patterns (deterministic, zero-infrastructure)
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          findings.push({
            guardId: "hollowArtifact",
            severity: Severity.BLOCK,
            message: `Hollow content detected: pattern "${pattern.source}" found in ${relPath}`,
            filePath: relPath,
            fix: `Edit ${relPath} and replace placeholder content with substantive information.`,
          });
          break; // One pattern match per file is enough
        }
      }

      // Check 2: Content length after stripping boilerplate
      const stripped = stripBoilerplate(content);
      if (stripped.length < minLength && stripped.length > 0) {
        findings.push({
          guardId: "hollowArtifact",
          severity: Severity.WARN,
          message: `File ${relPath} has only ${stripped.length} chars of meaningful content (minimum: ${minLength})`,
          filePath: relPath,
        });
      }

      // Check 3: Completely empty (after stripping)
      if (stripped.length === 0 && content.length > 0) {
        findings.push({
          guardId: "hollowArtifact",
          severity: Severity.BLOCK,
          message: `File ${relPath} contains only headers/frontmatter with zero substantive content`,
          filePath: relPath,
          fix: `Add meaningful content beneath the headers in ${relPath}.`,
        });
      }

      // Check 4 (v0.5): DSPy semantic evaluation — opt-in only
      const ext = path.extname(relPath).toLowerCase();
      const isSemanticText = SEMANTIC_TEXT_EXTS.has(ext);

      // Only runs when useDspy is true AND file passed deterministic checks AND file is a safe text type
      if (useDspy && isSemanticText && !findings.some((f) => f.filePath === relPath && f.severity === Severity.BLOCK)) {
        const dspyEval = ctx.semanticEvals?.dspy?.[relPath];
        if (dspyEval && dspyEval.score < 0.5) {
          findings.push({
            guardId: "hollowArtifact",
            severity: Severity.WARN,
            message: `DSPy semantic score ${dspyEval.score.toFixed(2)}/1.0 for ${relPath}. ${dspyEval.feedback ?? ""}`,
            filePath: relPath,
            evidence: EvidenceLevel.RUNTIME,
          });
        }
      }
    }

    const hasBlocking = findings.some((f) => f.severity === Severity.BLOCK);

    return {
      guardId: "hollowArtifact",
      passed: !hasBlocking,
      findings,
      durationMs: performance.now() - start,
    };
  },
};

