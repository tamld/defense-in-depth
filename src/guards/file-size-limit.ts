/**
 * File Size Limit Guard
 *
 * Scans staged files and blocks any file exceeding a maximum threshold (default 1MB).
 * Prevents accidental commits of large binaries, build outputs, or database dumps.
 *
 * Tier 0 — Pure, deterministic, zero-infrastructure.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

const DEFAULT_MAX_SIZE_BYTES = 1024 * 1024; // 1 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const fileSizeLimitGuard: Guard = {
  id: "fileSizeLimit",
  name: "File Size Limit Guard",
  description: "Blocks staged files exceeding a maximum size threshold (default: 1 MB)",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const start = performance.now();
    const findings: Finding[] = [];

    const config = ctx.config.guards?.fileSizeLimit;
    if (config?.enabled === false) {
      return {
        guardId: "fileSizeLimit",
        passed: true,
        findings: [],
        durationMs: performance.now() - start,
      };
    }

    const maxSizeBytes = config?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    const severity = config?.severity === "warn" ? Severity.WARN : Severity.BLOCK;
    const ignoredExtensions = new Set((config?.ignoredExtensions ?? []).map((e) => e.toLowerCase()));

    for (const relPath of ctx.stagedFiles) {
      const ext = path.extname(relPath).toLowerCase();
      if (ignoredExtensions.has(ext)) continue;

      const absPath = path.join(ctx.projectRoot, relPath);
      if (!fs.existsSync(absPath)) continue;

      let stat: fs.Stats;
      try {
        stat = fs.statSync(absPath);
      } catch {
        continue;
      }

      if (stat.isFile() && stat.size > maxSizeBytes) {
        findings.push({
          guardId: "fileSizeLimit",
          severity,
          message: `File "${relPath}" is ${formatBytes(stat.size)}, exceeding maximum size limit of ${formatBytes(maxSizeBytes)}.`,
          filePath: relPath,
          evidence: EvidenceLevel.CODE,
          fix: `Track large files with Git LFS (git lfs track "${relPath}") or add them to .gitignore.`,
        });
      }
    }

    const hasBlock = findings.some((f) => f.severity === Severity.BLOCK);

    return {
      guardId: "fileSizeLimit",
      passed: !hasBlock,
      findings,
      durationMs: performance.now() - start,
    };
  },
};
