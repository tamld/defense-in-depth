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
import { ConfigError } from "./errors.js";

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
      useDspy: false,
      dspyEndpoint: "http://localhost:8080/evaluate",
      dspyTimeoutMs: 5000,
    },
    ssotPollution: {
      enabled: true,
      protectedPaths: [
        ".agents/**",
        "**/flow_state.yml",
        "**/backlog.yml",
      ],
    },
    rootPollution: {
      enabled: true,
      allowedRootFiles: [
        "README.md",
        "README.vi.md",
        "CHANGELOG.md",
        "CONTRIBUTING.md",
        "CONTRIBUTING.vi.md",
        "CODE_OF_CONDUCT.md",
        "SECURITY.md",
        "STRATEGY.md",
        "AGENTS.md",
        "GEMINI.md",
        "CLAUDE.md",
        "LICENSE",
        "defense.config.yml",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        ".gitignore",
        ".cursorrules",
      ],
      allowedRootPatterns: [],
    },
    commitFormat: {
      enabled: true,
      pattern:
        "^(feat|fix|chore|docs|refactor|test|style|perf|ci)(\\([^)]*\\))?(!)?:\\s.+",
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
 *
 * If a config file is found but its contents cannot be parsed (YAML
 * syntax error, non-object root, …), throws a {@link ConfigError} with
 * `code === "DID_CONFIG_INVALID"`. This is a v1.0 SemVer MAJOR change
 * from v0.x, which silently warned and fell back to defaults — see
 * docs/migration/v0-to-v1.md.
 */
export function loadConfig(projectRoot: string): DefendConfig {
  for (const name of CONFIG_FILE_NAMES) {
    const configPath = path.join(projectRoot, name);
    if (fs.existsSync(configPath)) {
      let raw: string;
      try {
        raw = fs.readFileSync(configPath, "utf-8");
      } catch (err) {
        throw new ConfigError(
          `Failed to read ${name}: ${err instanceof Error ? err.message : String(err)}`,
          { configPath, cause: err },
        );
      }
      let parsed: unknown;
      try {
        parsed = yaml.parse(raw);
      } catch (err) {
        throw new ConfigError(
          `Failed to parse ${name}: ${err instanceof Error ? err.message : String(err)}`,
          { configPath, cause: err },
        );
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new ConfigError(
          `Invalid ${name}: top-level value must be a YAML mapping`,
          { configPath },
        );
      }
      validateConfigSchema(parsed, configPath);
      return deepMerge(DEFAULT_CONFIG, parsed as Partial<DefendConfig>);
    }
  }

  return DEFAULT_CONFIG;
}

const KNOWN_GUARD_KEYS = new Set([
  "hollowArtifact",
  "ssotPollution",
  "rootPollution",
  "commitFormat",
  "branchNaming",
  "phaseGate",
  "ticketIdentity",
  "hitlReview",
  "federation",
  "secretDetection",
  "fileSizeLimit",
  "dependencyAudit",
  "noTypeSafetyBypass",
  "noSwallowedError",
  "noStubReturn",
  "noTriviallyTrueTest",
  "selfProtection",
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set(["version", "guards", "hints"]);

/**
 * Validates parsed YAML configuration against the JSON Schema structure.
 * Pure function: throws ConfigError on schema violations.
 */
export function validateConfigSchema(parsed: unknown, configPath: string): void {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigError("Configuration root must be an object", { configPath });
  }

  const obj = parsed as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      throw new ConfigError(
        `Unknown top-level configuration key "${key}". Allowed keys: ${[...ALLOWED_TOP_LEVEL_KEYS].join(", ")}`,
        { configPath },
      );
    }
  }

  if (obj.version !== undefined && typeof obj.version !== "string" && typeof obj.version !== "number") {
    throw new ConfigError('Configuration "version" must be a string or number', { configPath });
  }

  if (obj.guards !== undefined) {
    if (typeof obj.guards !== "object" || obj.guards === null || Array.isArray(obj.guards)) {
      throw new ConfigError('"guards" must be an object mapping guard IDs to configurations', { configPath });
    }

    const guardsObj = obj.guards as Record<string, unknown>;

    for (const [guardName, guardVal] of Object.entries(guardsObj)) {
      if (!KNOWN_GUARD_KEYS.has(guardName)) {
        throw new ConfigError(
          `Unknown guard "${guardName}". Known guards: ${[...KNOWN_GUARD_KEYS].join(", ")}`,
          { configPath },
        );
      }

      if (typeof guardVal !== "object" || guardVal === null || Array.isArray(guardVal)) {
        throw new ConfigError(`Configuration for guard "${guardName}" must be an object`, { configPath });
      }

      const g = guardVal as Record<string, unknown>;

      if (g.enabled !== undefined && typeof g.enabled !== "boolean") {
        throw new ConfigError(`guards.${guardName}.enabled must be a boolean`, { configPath });
      }

      if (g.severity !== undefined && g.severity !== "warn" && g.severity !== "block") {
        throw new ConfigError(`guards.${guardName}.severity must be "warn" or "block"`, { configPath });
      }

      // Check numeric bounds
      const nonNegativeNumbers: Array<[string, unknown]> = [
        ["minContentLength", g.minContentLength],
        ["dspyTimeoutMs", g.dspyTimeoutMs],
        ["maxSizeBytes", g.maxSizeBytes],
      ];

      for (const [field, val] of nonNegativeNumbers) {
        if (val !== undefined && (typeof val !== "number" || isNaN(val) || val < 0)) {
          throw new ConfigError(`guards.${guardName}.${field} must be a non-negative number`, { configPath });
        }
      }

      // Check string arrays
      const stringArrays: Array<[string, unknown]> = [
        ["extensions", g.extensions],
        ["patterns", g.patterns],
        ["protectedPaths", g.protectedPaths],
        ["allowedRootFiles", g.allowedRootFiles],
        ["allowedRootPatterns", g.allowedRootPatterns],
        ["types", g.types],
        ["sourcePatterns", g.sourcePatterns],
        ["protectedBranches", g.protectedBranches],
        ["blockedParentPhases", g.blockedParentPhases],
        ["customPatterns", g.customPatterns],
        ["ignoredExtensions", g.ignoredExtensions],
        ["allowlistPaths", g.allowlistPaths],
      ];

      for (const [field, val] of stringArrays) {
        if (val !== undefined) {
          if (!Array.isArray(val) || !val.every((item) => typeof item === "string")) {
            throw new ConfigError(`guards.${guardName}.${field} must be an array of strings`, { configPath });
          }
        }
      }
    }
  }

  if (obj.hints !== undefined) {
    if (typeof obj.hints !== "object" || obj.hints === null || Array.isArray(obj.hints)) {
      throw new ConfigError('"hints" must be an object', { configPath });
    }

    const hints = obj.hints as Record<string, unknown>;
    if (hints.enabled !== undefined && typeof hints.enabled !== "boolean") {
      throw new ConfigError("hints.enabled must be a boolean", { configPath });
    }

    if (hints.cooldownDays !== undefined && (typeof hints.cooldownDays !== "number" || hints.cooldownDays < 0)) {
      throw new ConfigError("hints.cooldownDays must be a non-negative number", { configPath });
    }

    if (hints.channels !== undefined) {
      if (!Array.isArray(hints.channels) || !hints.channels.every((c) => c === "doctor" || c === "verify-success")) {
        throw new ConfigError('hints.channels must be an array of "doctor" or "verify-success"', { configPath });
      }
    }
  }
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
