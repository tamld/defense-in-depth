import * as fs from "fs/promises";
import * as path from "path";
import { loadConfig } from "../core/config-loader.js";
import { hollowArtifactGuard } from "../guards/hollow-artifact.js";
import type { GuardContext } from "../core/types.js";

/**
 * CLI: eval command (v0.5)
 *
 * Evaluates a single artifact file using the hollow-artifact guard
 * with DSPy semantic evaluation forced ON (regardless of config).
 *
 * This is useful for manual pre-commit quality checks without requiring
 * `useDspy: true` in the project config.
 *
 * Usage:
 *   defense-in-depth eval <path_to_file>
 */
export async function evalCommand(projectRoot: string, args: string[]): Promise<void> {
  const targetFile = args[0];
  if (!targetFile) {
    console.error("❌ Usage: defense-in-depth eval <path_to_file>");
    process.exit(1);
  }

  const relPath = path.relative(projectRoot, path.resolve(projectRoot, targetFile));
  const fullPath = path.resolve(projectRoot, targetFile);

  // Prevent path traversal
  if (relPath.startsWith(`..${path.sep}`) || relPath === "..") {
    console.error(`❌ Security Error: Target file resolves outside project root`);
    process.exit(1);
  }

  // Verify file exists
  try {
    await fs.access(fullPath);
  } catch {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  // Load config and FORCE DSPy on for eval mode
  const config = loadConfig(projectRoot);
  if (config.guards.hollowArtifact) {
    config.guards.hollowArtifact.useDspy = true;
    
    // Ensure the target file's extension is in the allowed extensions list
    const ext = path.extname(relPath).toLowerCase();
    if (ext) {
      const exts = config.guards.hollowArtifact.extensions ?? [".md", ".json", ".yml", ".yaml"];
      if (!exts.includes(ext)) {
        exts.push(ext);
      }
      config.guards.hollowArtifact.extensions = exts;
    }
  }

  const ctx: GuardContext = {
    stagedFiles: [relPath],
    projectRoot,
    config,
  };

  console.log(`\n🔍 Evaluating artifact: ${relPath}`);
  console.log(`🔗 DSPy endpoint: ${config.guards.hollowArtifact?.dspyEndpoint ?? "http://localhost:8080/evaluate"}`);

  const result = await hollowArtifactGuard.check(ctx);

  console.log(`\n📊 Results (${Math.round(result.durationMs)}ms)`);
  console.log(`-----------------------------------`);

  if (result.findings.length === 0) {
    console.log(`✅ No issues found.`);
  } else {
    for (const f of result.findings) {
      const icon = f.severity === "block" ? "🚫" : "⚠️ ";
      console.log(`${icon} ${f.message}`);
      if (f.fix) {
        console.log(`   💡 ${f.fix}`);
      }
    }
  }

  console.log(`\n${result.passed ? "✅ PASSED" : "❌ FAILED"}`);

  if (!result.passed) {
    process.exitCode = 1;
  }
}
