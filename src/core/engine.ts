/**
 * Defend-in-Depth Engine
 *
 * The core pipeline runner:
 *   1. Load config (defend.config.yml)
 *   2. Register guards
 *   3. Run each guard against context
 *   4. Aggregate into EngineVerdict
 *
 * Pattern source: pre-push-runner.ts from AAOS (sequential gate pipeline → verdict)
 */

import type {
  Guard,
  GuardContext,
  GuardResult,
  EngineVerdict,
  DefendConfig,
} from "./types.js";
import { Severity } from "./types.js";
import { loadConfig } from "./config-loader.js";

export class DefendEngine {
  private guards: Guard[] = [];
  private config: DefendConfig;
  private projectRoot: string;

  constructor(projectRoot: string, config?: DefendConfig) {
    this.projectRoot = projectRoot;
    this.config = config ?? loadConfig(projectRoot);
  }

  /** Register a guard into the pipeline */
  use(guard: Guard): this {
    this.guards.push(guard);
    return this;
  }

  /** Register multiple guards */
  useAll(guards: Guard[]): this {
    for (const g of guards) this.use(g);
    return this;
  }

  /** Run all registered guards and produce a verdict */
  async run(
    stagedFiles: string[],
    options?: { commitMessage?: string; branch?: string },
  ): Promise<EngineVerdict> {
    const start = performance.now();

    const ctx: GuardContext = {
      stagedFiles,
      projectRoot: this.projectRoot,
      commitMessage: options?.commitMessage,
      branch: options?.branch,
      config: this.config,
    };

    const results: GuardResult[] = [];

    for (const guard of this.guards) {
      // Skip guards disabled in config
      const guardCfg = this.getGuardConfig(guard.id);
      if (guardCfg !== undefined && !guardCfg.enabled) {
        continue;
      }

      try {
        const result = await guard.check(ctx);
        results.push(result);
      } catch (err) {
        // Guard crashed — treat as hard BLOCK
        results.push({
          guardId: guard.id,
          passed: false,
          findings: [
            {
              guardId: guard.id,
              severity: Severity.BLOCK,
              message: `Guard crashed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          durationMs: 0,
        });
      }
    }

    const durationMs = performance.now() - start;
    const failedGuards = results.filter((r) => !r.passed).length;
    const warnedGuards = results.filter(
      (r) =>
        r.passed &&
        r.findings.some((f) => f.severity === Severity.WARN),
    ).length;

    return {
      passed: failedGuards === 0,
      totalGuards: results.length,
      passedGuards: results.length - failedGuards,
      failedGuards,
      warnedGuards,
      results,
      durationMs,
    };
  }

  /** Look up a guard's config section by its id */
  private getGuardConfig(
    guardId: string,
  ): { enabled: boolean } | undefined {
    const key = guardId as keyof DefendConfig["guards"];
    const cfg = this.config.guards[key];
    return cfg as { enabled: boolean } | undefined;
  }

  /** Get the loaded configuration */
  getConfig(): DefendConfig {
    return this.config;
  }
}

// Re-export everything consumers need
export { Severity } from "./types.js";
export type {
  Guard,
  GuardContext,
  GuardResult,
  EngineVerdict,
  DefendConfig,
  Finding,
} from "./types.js";
