import * as fs from "fs/promises";
import * as path from "path";
import { loadConfig } from "../core/config-loader.js";
import { hollowArtifactGuard } from "../guards/hollow-artifact.js";
import { callDspy, DEFAULT_DSPY_ENDPOINT, DEFAULT_DSPY_TIMEOUT_MS } from "../core/dspy-client.js";
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

  // Precompute the DSPy semantic evaluation for this single file so the
  // guard can use it in its Check 4. Previously `eval` set `useDspy = true`
  // but never populated `ctx.semanticEvals`, so the guard's DSPy branch was
  // silently dead code. We also need the null-vs-value distinction here to
  // decide whether to emit the "DSPy unavailable" banner after the run.
  const dspyEndpoint =
    config.guards.hollowArtifact?.dspyEndpoint ?? DEFAULT_DSPY_ENDPOINT;
  const dspyTimeoutMs =
    config.guards.hollowArtifact?.dspyTimeoutMs ?? DEFAULT_DSPY_TIMEOUT_MS;

  let fileContent = "";
  try {
    fileContent = await fs.readFile(fullPath, "utf-8");
  } catch {
    // Already verified existence above; a read error here is exotic —
    // leave dspyEval null and let the banner fire.
  }

  const dspyEval = fileContent
    ? await callDspy(
        { type: "artifact", id: relPath, content: fileContent },
        dspyEndpoint,
        dspyTimeoutMs,
      )
    : null;

  const ctx: GuardContext = {
    stagedFiles: [relPath],
    projectRoot,
    config,
    semanticEvals: {
      dspy: {
        [relPath]: dspyEval
          ? { score: dspyEval.score, feedback: dspyEval.feedback }
          : null,
      },
    },
  };

  console.log(`\n🔍 Evaluating artifact: ${relPath}`);
  console.log(`🔗 DSPy endpoint: ${dspyEndpoint}`);

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

  // DSPy-unavailable banner: useDspy was forced on, but callDspy returned
  // null (service unavailable / timeout / 500). Tell the user the L3
  // semantic layer was skipped so they know this result reflects L1+L2
  // only — identical contract to memory.ts silent-degradation WARN.
  if (config.guards.hollowArtifact?.useDspy && dspyEval === null) {
    process.stderr.write(
      "⚠  DSPy unavailable: semantic evaluation skipped. Results reflect L1+L2 only.\n",
    );
  }

  if (!result.passed) {
    process.exitCode = 1;
  }
}
