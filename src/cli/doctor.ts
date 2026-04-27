/**
 * CLI: doctor command
 *
 * Health check — verifies that:
 *   1. Config file exists and is valid
 *   2. Git hooks are installed
 *   3. Guards are properly registered
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "../core/config-loader.js";
import { shouldShowHint, recordHintShown } from "../core/hints.js";

export async function doctor(projectRoot: string): Promise<void> {
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

  // 5. Progressive Discovery Hints
  try {
    const config = loadConfig(projectRoot);
    if (!config.guards.hollowArtifact?.useDspy) {
      if (await shouldShowHint(projectRoot, "dspy-opt-in", config)) {
        console.log("\x1b[90m💡 Hint: You have no DSPy config. Want to enable it for semantic checks?\x1b[0m");
        console.log("\x1b[90m   Set hollowArtifact.useDspy: true in defense.config.yml\x1b[0m");
        console.log("\x1b[90m   (Dismiss: npx defense-in-depth hint dismiss dspy-opt-in)\x1b[0m\n");
        await recordHintShown(projectRoot, "dspy-opt-in");
      }
    }
  } catch {
    // Ignore config errors for hints
  }
}
