/**
 * Configuration loader for defense-in-depth.
 *
 * Reads defense.config.yml from the project root.
 * Falls back to sensible defaults if no config file exists.
 *
 * Pattern source: internal project constitution.ts (YAML config → merge defaults)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "yaml";
import type { DefendConfig } from "./types.js";

const DEFAULT_CONFIG: DefendConfig = {
  version: "1.0",
  guards: {
    hollowArtifact: {
      enabled: true,
      extensions: [".md", ".json", ".yml", ".yaml"],
      patterns: [
        "TODO",
        "TBD",
        "FILL IN HERE",
        "<Empty>",
        "[Insert Here]",
        "PLACEHOLDER",
      ],
      minContentLength: 50,
    },
    ssotPollution: {
      enabled: true,
      protectedPaths: [
        ".agents/**",
        "**/flow_state.yml",
        "**/backlog.yml",
      ],
    },
    commitFormat: {
      enabled: true,
      pattern:
        "^(feat|fix|chore|docs|refactor|test|style|perf|ci)(\\\\(.*\\\\))?(!)?:\\\\s.+",
      types: [
        "feat", "fix", "chore", "docs",
        "refactor", "test", "style", "perf", "ci",
      ],
    },
    branchNaming: {
      enabled: false,
      pattern: "^(feat|fix|chore|docs)/.*",
    },
    phaseGate: {
      enabled: false,
      planFile: "implementation_plan.md",
      sourcePatterns: ["src/**", "lib/**", "app/**"],
    },
    ticketIdentity: {
      enabled: false,
      tkidPattern: "TK-[0-9A-Z-]+",
      severity: "warn",
      provider: "file",
    },
  },
};

const CONFIG_FILE_NAMES = [
  "defense.config.yml",
  "defend.config.yaml",
  ".defendrc.yml",
];

/**
 * Load configuration from defense.config.yml or return defaults.
 */
export function loadConfig(projectRoot: string): DefendConfig {
  for (const name of CONFIG_FILE_NAMES) {
    const configPath = path.join(projectRoot, name);
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = yaml.parse(raw) as Record<string, unknown>;
        return deepMerge(DEFAULT_CONFIG, parsed as Partial<DefendConfig>);
      } catch (err) {
        console.warn(`⚠ Failed to parse ${name}: ${err}`);
        return DEFAULT_CONFIG;
      }
    }
  }

  return DEFAULT_CONFIG;
}

/**
 * Deep merge: user config overrides defaults, preserving unset fields.
 */
function deepMerge<T extends object>(
  defaults: T,
  overrides: Partial<T>,
): T {
  const result = { ...defaults };

  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const val = overrides[key];
    if (val === undefined) continue;

    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val)
    ) {
      result[key] = deepMerge(
        (result[key] ?? {}) as Record<string, unknown> as typeof val,
        val as Partial<typeof val>,
      ) as T[keyof T];
    } else {
      result[key] = val as T[keyof T];
    }
  }

  return result;
}

export { DEFAULT_CONFIG };
