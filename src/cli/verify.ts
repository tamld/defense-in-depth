/**
 * CLI: verify command
 *
 * Runs all enabled guards against staged files or specified paths.
 *
 * Usage:
 *   defend-in-depth verify                    # scan staged files
 *   defend-in-depth verify --files a.md b.ts  # scan specific files
 *   defend-in-depth verify --hook pre-commit   # called from hook
 */

import { execSync } from "node:child_process";
import { DefendEngine } from "../core/engine.js";
import { allBuiltinGuards } from "../guards/index.js";
import { Severity } from "../core/types.js";

export async function verify(
  projectRoot: string,
  args: string[],
): Promise<void> {
  const hookMode = args.includes("--hook");
  const hook = hookMode ? args[args.indexOf("--hook") + 1] : undefined;

  // Get files to check
  let files: string[];
  const filesIdx = args.indexOf("--files");

  if (filesIdx !== -1) {
    // Explicit file list
    files = args.slice(filesIdx + 1).filter((a) => !a.startsWith("--"));
  } else {
    // Default: staged files from Git
    files = getStagedFiles(projectRoot);
  }

  if (files.length === 0 && !hookMode) {
    console.log("ℹ  No staged files found. Nothing to verify.\n");
    console.log("   Tip: Stage files with 'git add' first, or use --files.");
    return;
  }

  // Build engine with all guards
  const engine = new DefendEngine(projectRoot);
  engine.useAll(allBuiltinGuards);

  // Get optional context
  const branch = getBranch(projectRoot);
  const commitMessage = hook === "pre-push" ? getLastCommitMessage(projectRoot) : undefined;

  // Run
  const verdict = await engine.run(files, { branch, commitMessage });

  // Output
  if (!hookMode) {
    console.log("🛡️  defend-in-depth verify\n");
  }

  for (const result of verdict.results) {
    const icon = result.passed ? "✅" : "❌";
    const guard = allBuiltinGuards.find((g) => g.id === result.guardId);
    const name = guard?.name ?? result.guardId;

    if (result.findings.length === 0) {
      console.log(`  ${icon} ${name}`);
    } else {
      console.log(`  ${icon} ${name}`);
      for (const f of result.findings) {
        const sevIcon =
          f.severity === Severity.BLOCK
            ? "🚫"
            : f.severity === Severity.WARN
              ? "⚠️ "
              : "✅";
        console.log(`     ${sevIcon} ${f.message}`);
        if (f.fix) {
          console.log(`        💡 Fix: ${f.fix}`);
        }
      }
    }
  }

  console.log(
    `\n📊 ${verdict.passedGuards}/${verdict.totalGuards} guards passed (${Math.round(verdict.durationMs)}ms)`,
  );

  if (!verdict.passed) {
    process.exit(1);
  }
}

function getStagedFiles(root: string): string[] {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf-8",
      cwd: root,
    });
    return output.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function getBranch(root: string): string | undefined {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      cwd: root,
    }).trim();
  } catch {
    return undefined;
  }
}

function getLastCommitMessage(root: string): string | undefined {
  try {
    return execSync("git log -1 --format=%s", {
      encoding: "utf-8",
      cwd: root,
    }).trim();
  } catch {
    return undefined;
  }
}
