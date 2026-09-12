/**
 * Typed error hierarchy for defense-in-depth (issue #37).
 *
 * Public, programmatic error classes for library consumers. Every error
 * thrown by the public API (engine, config loader, providers) is an
 * instance of `DiDError` and carries a stable string `.code` so callers
 * can branch on it without parsing `.message`.
 *
 * Hierarchy:
 *   DiDError                       (base — code: string)
 *   ├── ConfigError                (code: "DID_CONFIG_INVALID")
 *   ├── GuardCrashError            (code: "DID_GUARD_CRASH",  .guardId)
 *   └── ProviderError              (code: "DID_PROVIDER_FAIL", .providerName)
 *
 * Stability: error class names AND the values of the `code` constants
 * below are part of the v1.0 public API. Renaming them is a SemVer
 * MAJOR change — see docs/SEMVER.md §3 and docs/migration/v0-to-v1.md.
 *
 * Executor: Devin
 */

/** Stable error-code constants. Treat these strings as part of the API. */
export const ErrorCodes = {
  CONFIG_INVALID: "DID_CONFIG_INVALID",
  GUARD_CRASH: "DID_GUARD_CRASH",
  PROVIDER_FAIL: "DID_PROVIDER_FAIL",
} as const;

export type DiDErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Base class for every error thrown by the public defense-in-depth API.
 *
 * Consumers SHOULD branch on `.code` (stable string) rather than `.name`
 * or `.message` so future internal refactors do not break their handlers.
 */
export class DiDError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (cause !== undefined) this.cause = cause;
    // Preserve the prototype chain across `target: ES2017+` builds so
    // `err instanceof DiDError` works when the error crosses a module
    // boundary.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a `defense.config.yml` (or alternative config file) exists
 * but cannot be parsed as YAML, or when its contents fail validation.
 *
 * Not thrown when the config file is missing — that case is the
 * documented zero-config path and silently returns DEFAULT_CONFIG.
 */
export class ConfigError extends DiDError {
  readonly configPath?: string;

  constructor(message: string, options: { configPath?: string; cause?: unknown } = {}) {
    super(message, ErrorCodes.CONFIG_INVALID, options.cause);
    if (options.configPath !== undefined) this.configPath = options.configPath;
  }
}

/**
 * Constructed by the engine when a guard's `check()` throws a
 * synchronous or asynchronous error. The original error is preserved on
 * `.cause`. The engine itself does NOT re-throw — it records a BLOCK
 * finding and continues the pipeline; this class exists so the typed
 * cause is reachable from telemetry / debug paths.
 */
export class GuardCrashError extends DiDError {
  readonly guardId: string;

  constructor(message: string, guardId: string, cause?: unknown) {
    super(message, ErrorCodes.GUARD_CRASH, cause);
    this.guardId = guardId;
  }
}

/**
 * Constructed by ticket providers (file, http) when resolution fails
 * for a non-missing reason — invalid YAML frontmatter, parse error,
 * non-404 HTTP response, network/timeout. Providers MUST NOT re-throw
 * to the caller (the federation contract requires graceful
 * degradation), but they DO surface a `ProviderError` instance via
 * `console.warn` and via internal telemetry.
 */
export class ProviderError extends DiDError {
  readonly providerName: string;

  constructor(message: string, providerName: string, cause?: unknown) {
    super(message, ErrorCodes.PROVIDER_FAIL, cause);
    this.providerName = providerName;
  }
}
