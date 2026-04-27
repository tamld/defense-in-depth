/**
 * CLI: doctor command
 *
 * Health check — verifies that:
 *   1. Config file exists and is valid
 *   2. Git hooks are installed
 *   3. Guards are properly registered
 *
 * v0.7 (#21): also surfaces Progressive Discovery hints after the existing
 * 4-check summary. The hint surface is non-blocking (never changes exit code)
 * and dim-formatted to keep the doctor output scannable.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { loadConfig } from "../core/config-loader.js";
import { listAllHints } from "../core/hint-engine.js";
import { dismissHint, resetHintState } from "../core/hint-state.js";
import { emitAllHints, emitOneHint } from "./hints-emit.js";

export interface DoctorOptions {
  /**
   * v0.7 (#21): hint subcommand parsed from the CLI.
   *
   * - undefined  → default mode (existing 4-check + at most 1 earned hint).
   * - "all"      → emit *every* eligible hint, no cap.
   * - "dismiss"  → permanently dismiss `hintId`, emit confirmation, exit 0.
   * - "reset"    → wipe `.agents/state/hints-shown.json`, exit 0.
   */
  hintsAction?: "all" | "dismiss" | "reset";
  hintsActionArg?: string;
}

export async function doctor(
  projectRoot: string,
  options: DoctorOptions = {},
): Promise<void> {
  // Hint-only subcommands: short-circuit the health check.
  if (options.hintsAction === "dismiss") {
    runHintsDismiss(projectRoot, options.hintsActionArg);
    return;
  }
  if (options.hintsAction === "reset") {
    runHintsReset(projectRoot);
    return;
  }

  console.log("🩺 defense-in-depth doctor\n");

  let issues = 0;

  // 1. Git repo check
  const gitDir = path.join(projectRoot, ".git");
  if (fs.existsSync(gitDir)) {
    console.log("  ✅ Git repository found");
  } else {
    console.log("  ❌ Not a Git repository");
    issues++;
  }

  // 2. Config check
  const configNames = ["defense.config.yml", "defend.config.yaml", ".defendrc.yml"];
  const configFound = configNames.find((name) =>
    fs.existsSync(path.join(projectRoot, name)),
  );

  if (configFound) {
    console.log(`  ✅ Config found: ${configFound}`);
    try {
      const config = loadConfig(projectRoot);
      const enabledGuards = Object.entries(config.guards)
        .filter(([, v]) => v?.enabled)
        .map(([k]) => k);
      console.log(`     Enabled guards: ${enabledGuards.join(", ") || "none"}`);
    } catch (err) {
      console.log(`  ⚠️  Config parse error: ${err}`);
      issues++;
    }
  } else {
    console.log("  ⚠️  No config file found (using defaults)");
    console.log("     Run 'defense-in-depth init' to create one.");
  }

  // 3. Hooks check
  if (fs.existsSync(gitDir)) {
    const hooksDir = path.join(gitDir, "hooks");

    for (const hookName of ["pre-commit", "pre-push"]) {
      const hookPath = path.join(hooksDir, hookName);
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, "utf-8");
        if (content.includes("defense-in-depth")) {
          console.log(`  ✅ ${hookName} hook installed`);
        } else {
          console.log(`  ⚠️  ${hookName} hook exists but is not from defense-in-depth`);
        }
      } else {
        console.log(`  ❌ ${hookName} hook not installed`);
        issues++;
      }
    }
  }

  // 4. Summary
  console.log("");
  if (issues === 0) {
    console.log("✅ All checks passed. Your project is defended!\n");
  } else {
    console.log(`⚠️  ${issues} issue(s) found. Run 'defense-in-depth init' to fix.\n`);
  }

  // 5. Progressive Discovery hints (issue #21).
  if (options.hintsAction === "all") {
    emitAllHints(projectRoot, "doctor");
  } else {
    emitOneHint(projectRoot, "doctor");
  }
}

/** Permanently dismiss one hint id. Validates against the catalog so a typo
 *  doesn't silently write a no-op entry. */
function runHintsDismiss(projectRoot: string, hintId: string | undefined): void {
  if (!hintId) {
    process.stderr.write("Usage: did doctor --hints dismiss <hintId>\n");
    process.exit(1);
  }
  const known = new Set(listAllHints().map((h) => h.id));
  if (!known.has(hintId)) {
    process.stderr.write(
      `Unknown hint id: ${hintId}\n` +
        `Known: ${[...known].join(", ")}\n`,
    );
    process.exit(1);
  }
  dismissHint(projectRoot, hintId);
  console.log(`✅ Dismissed hint ${hintId}. It will no longer be shown.`);
}

function runHintsReset(projectRoot: string): void {
  resetHintState(projectRoot);
  console.log("✅ Hint state cleared. Eligible hints may surface again.");
}
