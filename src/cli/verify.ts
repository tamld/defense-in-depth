/**
 * CLI: verify command
 *
 * Runs all enabled guards against staged files or specified paths.
 *
 * Usage:
 *   defense-in-depth verify                       # scan staged files
 *   defense-in-depth verify --files a.md b.ts     # scan specific files
 *   defense-in-depth verify --hook pre-commit     # called from hook
 *   defense-in-depth verify --dry-run-dspy        # simulate DSPy unavailable
 */

import { execSync } from "node:child_process";
import { DefendEngine } from "../core/engine.js";
import { loadConfig } from "../core/config-loader.js";
import { allBuiltinGuards } from "../guards/index.js";
import { Severity } from "../core/types.js";
import type { DefendConfig } from "../core/types.js";
import { emitOneHint } from "./hints-emit.js";

export async function verify(
  projectRoot: string,
  args: string[],
): Promise<void> {
  const hookMode = args.includes("--hook");
  const hook = hookMode ? args[args.indexOf("--hook") + 1] : undefined;
  const dryRunDspy = args.includes("--dry-run-dspy");

  // Get files to check
  let files: string[];
  const filesIdx = args.indexOf("--files");

  if (filesIdx !== -1) {
    // Explicit file list — terminate at the next flag (so `--dry-run-dspy`
    // appearing after `--files a.md` does not get treated as a path).
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

  // --dry-run-dspy: load config and force-disable DSPy semantic enrichment so
  // users can verify their L1+L2 governance still passes when DSPy is offline.
  // Banner goes to stderr (predictable for CI output and shell redirection).
  let config: DefendConfig | undefined;
  if (dryRunDspy) {
    config = loadConfig(projectRoot);
    if (config.guards.hollowArtifact) {
      config.guards.hollowArtifact.useDspy = false;
    }
    process.stderr.write(
      "⚠  --dry-run-dspy: DSPy semantic evaluation skipped\n",
    );
  }

  // Build engine with all guards
  const engine = new DefendEngine(projectRoot, config);
  engine.useAll(allBuiltinGuards);

  // Get optional context
  const branch = getBranch(projectRoot);
  const commitMessage = hook === "pre-push" ? getLastCommitMessage(projectRoot) : undefined;

  // Run
  const verdict = await engine.run(files, { branch, commitMessage });

  // Output
  if (!hookMode) {
    console.log("🛡️  defense-in-depth verify\n");
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

  // DSPy-unavailable banner — fourth and final silent-degradation site
  // closed by the contract from án lệ L-2026-04-29-silent-tier1-degradation.
  // When the project opts into Tier-1 (config.guards.hollowArtifact.useDspy =
  // true) but the precompute returned null for at least one file, the
  // hollow-artifact guard's Check 4 produced no finding for that file —
  // identical contract surface to the bug PR #20 fixed in `eval`.
  // We treat any null as "DSPy was unavailable for at least one file" and
  // emit one banner per run, matching `eval`'s wording for predictability.
  // The --dry-run-dspy banner above (which forces useDspy=false at config
  // load time) means this branch is only reached for real configs that
  // expected DSPy and didn't get it.
  const effectiveConfig = config ?? engine.getConfig();
  if (effectiveConfig.guards.hollowArtifact?.useDspy) {
    const dspyEvals = verdict.semanticEvals?.dspy ?? {};
    const anyNull = Object.values(dspyEvals).some((v) => v === null);
    if (anyNull) {
      process.stderr.write(
        "⚠  DSPy unavailable: semantic evaluation skipped. Results reflect L1+L2 only.\n",
      );
    }
  }

  if (!verdict.passed) {
    process.exit(1);
  }

  // v0.7 (#21) Progressive Discovery: emit at most one earned hint to stderr
  // on a clean verify exit. Never on hook mode (the hook should be silent
  // when nothing is wrong) and never on a BLOCK exit (we already exited
  // above). The renderer in `hints-emit.ts` handles NO_HINTS, CI=true, and
  // the per-channel allowlist — see issue #21 for the anti-nag contract.
  if (!hookMode) {
    emitOneHint(projectRoot, "verify-success");
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
