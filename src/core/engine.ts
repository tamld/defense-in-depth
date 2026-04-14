/**
 * Defend-in-Depth Engine
 *
 * The core pipeline runner:
 *   1. Load config (defense.config.yml)
 *   2. Register guards
 *   3. Run each guard against context
 *   4. Aggregate into EngineVerdict
 *
 * Pattern source: internal project pre-push-runner.ts (sequential gate pipeline → verdict)
 */

import type {
  Guard,
  GuardContext,
  GuardResult,
  EngineVerdict,
  DefendConfig,
  TicketRef,
} from "./types.js";
import { Severity } from "./types.js";
import { loadConfig } from "./config-loader.js";
import { createProvider } from "../federation/index.js";
import type { TicketStateProvider } from "../federation/types.js";
import { callDspy } from "./dspy-client.js";
import * as fs from "node:fs";
import * as path from "node:path";

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

  /** Extract a TicketRef from common contexts */
  private extractTicketRef(branch?: string, commitMessage?: string, projectRoot?: string): TicketRef | undefined {
    let id: string | undefined;

    // 1. Extract ID from branch
    if (branch) {
      const match = branch.match(/(TK-[0-9A-Z-]+)/i);
      if (match) id = match[1].toUpperCase();
    }

    // 2. If no ID from branch, try commit message
    if (!id && commitMessage) {
      const match = commitMessage.match(/(TK-[0-9A-Z-]+)/i);
      if (match) id = match[1].toUpperCase();
    }

    // 3. If no ID, try project root directory name (generic — works with any naming convention)
    if (!id && projectRoot) {
      const dirName = projectRoot.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
      const match = dirName.match(/(TK-[0-9A-Z-]+)/i);
      if (match) id = match[1].toUpperCase();
    }

    if (!id) return undefined;

    const ticketRef: TicketRef = { id };

    // Try to infer type from branch prefix
    if (branch) {
      const typeMatch = branch.match(/^(feat|fix|chore|docs|refactor)\//i);
      if (typeMatch) {
         ticketRef.type = typeMatch[1].toLowerCase() as TicketRef["type"];
      }
    }

    return ticketRef;
  }

  /** Run all registered guards and produce a verdict */
  async run(
    stagedFiles: string[],
    options?: { commitMessage?: string; branch?: string },
  ): Promise<EngineVerdict> {
    const start = performance.now();

    // Phase 1: Extract basic TicketRef from branch/commit/directory (pure, no I/O)
    const basicRef = this.extractTicketRef(options?.branch, options?.commitMessage, this.projectRoot);

    // Phase 2: Enrich with provider (MAY do I/O — file, DB, API)
    const { ticket, provider } = await this.enrichTicketRef(basicRef);

    // Phase 2.5: Precompute semantic evaluations (Orchestration I/O)
    const semanticEvals = await this.enrichSemanticEvals(stagedFiles);

    const ctx: GuardContext = {
      stagedFiles,
      projectRoot: this.projectRoot,
      commitMessage: options?.commitMessage,
      branch: options?.branch,
      config: this.config,
      ticket,
      semanticEvals,
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

    // Cleanup provider resources (DB connections, etc.)
    await provider?.dispose?.();

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

  /**
   * Enrich a basic TicketRef with provider data (phase, metadata).
   *
   * This runs BEFORE the guard pipeline. If the provider fails or is
   * unavailable, the basic ref is returned unchanged — guards degrade
   * gracefully to non-phase-aware mode.
   */
  private async enrichTicketRef(
    basicRef: TicketRef | undefined,
  ): Promise<{ ticket: TicketRef | undefined; provider: TicketStateProvider | undefined }> {
    if (!basicRef) return { ticket: undefined, provider: undefined };

    const guardConfig = this.config.guards.ticketIdentity;
    if (!guardConfig?.enabled) return { ticket: basicRef, provider: undefined };

    const provider = createProvider(
      guardConfig.provider,
      guardConfig.providerConfig,
      this.projectRoot,
    );

    try {
      const timeoutMs =
        typeof guardConfig.providerConfig?.timeout === "number"
          ? guardConfig.providerConfig.timeout
          : 5000;

      const enriched = await Promise.race([
        provider.resolve(basicRef.id),
        new Promise<undefined>((_, reject) =>
          setTimeout(() => reject(new Error(`Resolution timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);

      // Merge: provider data enriches basic ref, basic ref provides fallback
      const ticket: TicketRef = enriched
        ? { ...basicRef, ...enriched }
        : basicRef;
      return { ticket, provider };
    } catch (err) {
      // Provider errors never crash the guard pipeline
      console.warn(
        `⚠ Ticket provider '${provider.name}' failed for ${basicRef.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ticket: basicRef, provider };
    }
  }

  /**
   * Precompute semantic evaluations using DSPy for safe, pure guard context.
   */
  private async enrichSemanticEvals(
    stagedFiles: string[],
  ): Promise<GuardContext["semanticEvals"]> {
    const hollowCfg = this.config.guards.hollowArtifact;
    if (!hollowCfg?.useDspy) return undefined;

    const dspyEndpoint = hollowCfg.dspyEndpoint ?? "http://localhost:8080/evaluate";
    const dspyTimeout = hollowCfg.dspyTimeoutMs ?? 5000;
    const semanticExts = new Set([".md", ".json", ".js", ".ts", ".html", ".yml", ".yaml", ".txt"]);
    
    // Extensions explicitly configured or default
    const extensions = hollowCfg.extensions ?? [".md", ".json", ".yml", ".yaml"];

    const dspyEvals: Record<string, { score: number; feedback?: string } | null> = {};

    for (const relPath of stagedFiles) {
      if (!extensions.some((ext) => relPath.endsWith(ext))) continue;

      const ext = path.extname(relPath).toLowerCase();
      if (!semanticExts.has(ext)) continue;

      const absPath = path.join(this.projectRoot, relPath);
      if (!fs.existsSync(absPath)) continue;

      let content: string;
      try {
        content = fs.readFileSync(absPath, "utf-8");
      } catch {
        continue;
      }

      const result = await callDspy(
        { type: "artifact", id: relPath, content },
        dspyEndpoint,
        dspyTimeout,
      );
      dspyEvals[relPath] = result ? { score: result.score, feedback: result.feedback } : null;
    }

    return { dspy: dspyEvals };
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
