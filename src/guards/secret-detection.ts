/**
 * Secret Detection Guard
 *
 * Scans staged files for high-confidence secret patterns (API keys, tokens, private keys)
 * to prevent accidental credential leakage into Git history.
 *
 * Tier 0 — Pure, deterministic, zero-infrastructure.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

interface SecretPattern {
  name: string;
  regex: RegExp;
  severity: Severity;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "Private Key",
    regex: /-----BEGIN (?:[A-Z0-9_-]+ )*PRIVATE KEY-----/,
    severity: Severity.BLOCK,
  },
  {
    name: "AWS Access Key ID",
    regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/,
    severity: Severity.BLOCK,
  },
  {
    name: "GitHub Personal Access Token",
    regex: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b/,
    severity: Severity.BLOCK,
  },
  {
    name: "OpenAI / Anthropic API Key",
    regex: /\b(sk-[a-zA-Z0-9]{20,T3BlbkFJ[a-zA-Z0-9]{20,}|sk-ant-[a-zA-Z0-9_\-]{20,})\b/,
    severity: Severity.BLOCK,
  },
  {
    name: "Stripe API Key",
    regex: /\b(sk_live|rk_live)_[0-9a-zA-Z]{24,}\b/,
    severity: Severity.BLOCK,
  },
  {
    name: "Generic Secret Assignment",
    regex: /(?:password|passwd|secret|api_key|apikey|access_token|auth_token)\s*[:=]\s*['"][a-zA-Z0-9_\-.~!@#$%^&*]{16,}['"]/i,
    severity: Severity.WARN,
  },
];

function redactSecret(line: string, match: string): string {
  if (match.length <= 8) return line.replace(match, "[REDACTED]");
  const preview = `${match.slice(0, 4)}...${match.slice(-4)}`;
  return line.replace(match, `[REDACTED:${preview}]`);
}

export const secretDetectionGuard: Guard = {
  id: "secretDetection",
  name: "Secret Detection Guard",
  description: "Prevents accidental commits of private keys, cloud credentials, and API secrets",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();
    const findings: Finding[] = [];

    const config = ctx.config.guards?.secretDetection;
    if (config?.enabled === false) {
      return {
        guardId: "secretDetection",
        passed: true,
        findings: [],
        durationMs: performance.now() - start,
      };
    }

    const customPatterns: SecretPattern[] = (config?.customPatterns ?? []).map((pat) => ({
      name: "Custom Secret Pattern",
      regex: new RegExp(pat),
      severity: Severity.BLOCK,
    }));

    const allPatterns = [...SECRET_PATTERNS, ...customPatterns];

    for (const relPath of ctx.stagedFiles) {
      const absPath = path.join(ctx.projectRoot, relPath);
      if (!fs.existsSync(absPath)) continue;

      let content: string;
      try {
        content = fs.readFileSync(absPath, "utf-8");
      } catch {
        continue; // Skip binary or unreadable files
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of allPatterns) {
          const match = pattern.regex.exec(line);
          if (match) {
            const redacted = redactSecret(line.trim(), match[0]);
            findings.push({
              guardId: "secretDetection",
              severity: pattern.severity,
              message: `Potential credential detected (${pattern.name}) at line ${i + 1}: "${redacted}"`,
              filePath: relPath,
              line: i + 1,
              evidence: EvidenceLevel.CODE,
              fix: `Remove the hardcoded secret from ${relPath}, rotate it if already compromised, and inject it via environment variables or secret vaults.`,
            });
            break;
          }
        }
      }
    }

    const hasBlock = findings.some((f) => f.severity === Severity.BLOCK);

    return {
      guardId: "secretDetection",
      passed: !hasBlock,
      findings,
      durationMs: performance.now() - start,
    };
  },
};
