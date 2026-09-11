/**
 * Dependency Audit Guard
 *
 * Scans dependencies for known security vulnerabilities via `npm audit --json`.
 *
 * Tier 1 — Opt-in (disabled by default), gracefully degrades if npm or network is offline.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

interface AuditSummary {
  vulnerabilities?: Record<string, number | { total: number }>;
  metadata?: {
    vulnerabilities?: {
      info?: number;
      low?: number;
      moderate?: number;
      high?: number;
      critical?: number;
      total?: number;
    };
  };
}

interface DependencyAuditOptions {
  /**
   * Custom executor for `npm audit --json`. Used for testing to inject
   * mock audit results without invoking the real npm binary.
   */
  executor?: (
    command: string,
    args: string[],
    options: {
      cwd: string;
      encoding: BufferEncoding;
      timeout: number;
      stdio: ("ignore" | "pipe" | "inherit")[];
    },
  ) => string | Buffer;
}

/**
 * Creates a Dependency Audit Guard instance.
 *
 * @param options - Optional configuration for test injection
 * @returns A Guard instance
 */
export function createDependencyAuditGuard(options: DependencyAuditOptions = {}): Guard {
  const { executor = execFileSync } = options;

  return {
    id: "dependencyAudit",
    name: "Dependency Audit Guard",
    description: "Scans project dependencies for known security vulnerabilities via npm audit",

    async check(ctx: GuardContext): Promise<GuardResult> {
      const start = performance.now();
      const findings: Finding[] = [];

      const config = ctx.config.guards?.dependencyAudit;
      // Tier 1 contract: strictly opt-in, disabled by default
      if (!config?.enabled) {
        return {
          guardId: "dependencyAudit",
          passed: true,
          findings: [],
          durationMs: performance.now() - start,
        };
      }

      const packageJsonPath = path.join(ctx.projectRoot, "package.json");
      if (!fs.existsSync(packageJsonPath)) {
        return {
          guardId: "dependencyAudit",
          passed: true,
          findings: [],
          durationMs: performance.now() - start,
        };
      }

      // Check if package.json or lockfile is touched in staged files, or if run on whole project
      const packageFilesTouched = ctx.stagedFiles.length === 0 || ctx.stagedFiles.some((f) =>
        f === "package.json" || f.endsWith("lock.yaml") || f.endsWith("package-lock.json") || f.endsWith("yarn.lock")
      );

      if (!packageFilesTouched) {
        return {
          guardId: "dependencyAudit",
          passed: true,
          findings: [],
          durationMs: performance.now() - start,
        };
      }

      try {
        let stdout = "";
        try {
          const result = executor("npm", ["audit", "--json"], {
            cwd: ctx.projectRoot,
            encoding: "utf-8",
            timeout: 10000,
            stdio: ["ignore", "pipe", "ignore"],
          });
          stdout = typeof result === "string" ? result : result.toString("utf-8");
        } catch (err: unknown) {
          // npm audit exits with non-zero when vulnerabilities are found and outputs JSON to stdout
          if (err && typeof err === "object" && "stdout" in err && typeof err.stdout === "string") {
            stdout = err.stdout;
          } else {
            console.warn(
              `⚠ Dependency audit skipped: npm audit could not be executed (${err instanceof Error ? err.message : String(err)})`,
            );
            return {
              guardId: "dependencyAudit",
              passed: true,
              findings: [
                {
                  guardId: "dependencyAudit",
                  severity: Severity.WARN,
                  message: `Dependency audit skipped: npm audit could not be executed (${err instanceof Error ? err.message : String(err)})`,
                  filePath: "package.json",
                  evidence: EvidenceLevel.RUNTIME,
                },
              ],
              durationMs: performance.now() - start,
            };
          }
        }

        if (!stdout || !stdout.trim().startsWith("{")) {
          return {
            guardId: "dependencyAudit",
            passed: true,
            findings: [],
            durationMs: performance.now() - start,
          };
        }

        const auditData = JSON.parse(stdout) as AuditSummary;
        const vulns = auditData.metadata?.vulnerabilities || {};
        const criticalCount = vulns.critical ?? 0;
        const highCount = vulns.high ?? 0;
        const moderateCount = vulns.moderate ?? 0;

        if (criticalCount > 0 || highCount > 0) {
          findings.push({
            guardId: "dependencyAudit",
            severity: config.severity === "warn" ? Severity.WARN : Severity.BLOCK,
            message: `Vulnerable dependencies detected: ${criticalCount} critical, ${highCount} high severity.`,
            filePath: "package.json",
            evidence: EvidenceLevel.RUNTIME,
            fix: `Run 'npm audit fix' or upgrade vulnerable dependencies in package.json.`,
          });
        } else if (moderateCount > 0) {
          findings.push({
            guardId: "dependencyAudit",
            severity: Severity.WARN,
            message: `Moderate vulnerabilities detected: ${moderateCount} moderate.`,
            filePath: "package.json",
            evidence: EvidenceLevel.RUNTIME,
            fix: `Review dependencies with 'npm audit' and update where feasible.`,
          });
        }
      } catch (parseErr) {
        console.warn(
          `⚠ Failed to parse audit results: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        );
        findings.push({
          guardId: "dependencyAudit",
          severity: Severity.WARN,
          message: `Failed to parse audit results: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          filePath: "package.json",
          evidence: EvidenceLevel.RUNTIME,
        });
      }

      const hasBlock = findings.some((f) => f.severity === Severity.BLOCK);

      return {
        guardId: "dependencyAudit",
        passed: !hasBlock,
        findings,
        durationMs: performance.now() - start,
      };
    },
  };
}

/** Default instance using the real `execFileSync` for production use. */
export const dependencyAuditGuard = createDependencyAuditGuard();
