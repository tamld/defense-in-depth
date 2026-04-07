/**
 * CLI: init command
 *
 * Installs Git hooks (pre-commit, pre-push) into .git/hooks/
 * Creates defend.config.yml if it doesn't exist.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { generatePreCommitHook } from "../hooks/pre-commit.js";
import { generatePrePushHook } from "../hooks/pre-push.js";

export async function init(projectRoot: string): Promise<void> {
  console.log("🛡️  defend-in-depth init\n");

  // 1. Check we're in a Git repo
  const gitDir = path.join(projectRoot, ".git");
  if (!fs.existsSync(gitDir)) {
    console.error("❌ Not a Git repository. Run 'git init' first.");
    process.exit(1);
  }

  const hooksDir = path.join(gitDir, "hooks");
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // 2. Install pre-commit hook
  const preCommitPath = path.join(hooksDir, "pre-commit");
  writeHook(preCommitPath, generatePreCommitHook(), "pre-commit");

  // 3. Install pre-push hook
  const prePushPath = path.join(hooksDir, "pre-push");
  writeHook(prePushPath, generatePrePushHook(), "pre-push");

  // 4. Create defend.config.yml if it doesn't exist
  const configPath = path.join(projectRoot, "defend.config.yml");
  if (!fs.existsSync(configPath)) {
    const templatePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "..",
      "..",
      "templates",
      "defend.config.yml",
    );

    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, configPath);
      console.log("  ✅ Created defend.config.yml (customize as needed)");
    } else {
      // Inline minimal config
      const minimalConfig = `# defend-in-depth configuration
version: "1.0"

guards:
  hollowArtifact:
    enabled: true
  ssotPollution:
    enabled: true
  commitFormat:
    enabled: true
  branchNaming:
    enabled: false
  phaseGate:
    enabled: false
`;
      fs.writeFileSync(configPath, minimalConfig, "utf-8");
      console.log("  ✅ Created defend.config.yml (customize as needed)");
    }
  } else {
    console.log("  ℹ  defend.config.yml already exists — skipping");
  }

  console.log("\n✅ defend-in-depth initialized successfully!");
  console.log("   Hooks installed. Your commits are now guarded.\n");
}

function writeHook(hookPath: string, content: string, name: string): void {
  // Check if hook already exists and is not ours
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, "utf-8");
    if (existing.includes("defend-in-depth")) {
      fs.writeFileSync(hookPath, content, { mode: 0o755 });
      console.log(`  ✅ Updated ${name} hook`);
      return;
    }
    // Existing hook from another tool — append
    const merged = existing + "\n\n# --- defend-in-depth ---\n" + content;
    fs.writeFileSync(hookPath, merged, { mode: 0o755 });
    console.log(`  ✅ Appended ${name} hook (existing hook preserved)`);
    return;
  }

  fs.writeFileSync(hookPath, content, { mode: 0o755 });
  console.log(`  ✅ Installed ${name} hook`);
}
