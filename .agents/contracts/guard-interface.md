---
id: CONTRACT-GUARD-INTERFACE
status: active
version: 1.0.0
runtime_refs:
  - src/core/types.ts
---

# Contract: Guard Interface

> The mechanical contract that every guard — built-in or custom — MUST implement.

## TypeScript Interface

```typescript
interface Guard {
  /** Unique kebab-case identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** Whether this guard is enabled by default */
  defaultEnabled: boolean;

  /** Default severity when findings exist */
  defaultSeverity: Severity;

  /** Execute the guard against a context */
  run(context: GuardContext): Promise<GuardResult>;
}
```

## Context (what guards receive)

```typescript
interface GuardContext {
  /** Absolute paths to files being checked */
  files: string[];

  /** Absolute path to project root */
  projectRoot: string;

  /** Current branch name (empty if detached HEAD) */
  branch: string;

  /** Latest commit message (empty if no commits) */
  commitMessage: string;

  /** Merged user config for this guard (from defend.config.yml) */
  config: Record<string, unknown>;
}
```

## Result (what guards return)

```typescript
interface GuardResult {
  /** Guard name (must match guard.name) */
  guard: string;

  /** Aggregate severity: PASS if no findings, else max of finding severities */
  severity: Severity;

  /** Individual findings */
  findings: Finding[];
}
```

## Finding (individual issue)

```typescript
interface Finding {
  /** Absolute path to the problematic file */
  file: string;

  /** Human-readable description of the issue */
  message: string;

  /** Suggested fix (REQUIRED for BLOCK severity) */
  fix?: string;

  /** Line number if applicable */
  line?: number;

  /** Evidence type tag */
  evidence?: "CODE" | "RUNTIME" | "INFER" | "HYPO";
}
```

## Invariants (Non-Negotiable)

1. **Pure**: Guards MUST NOT write to the filesystem, make network requests, or mutate state
2. **Crash-safe**: Guards MUST handle their own errors and return a result, never throw uncaught
3. **Fast**: Guards MUST complete in <100ms for typical workloads (≤50 files)
4. **Independent**: Guards MUST NOT import from other guards
5. **Deterministic**: Same input → same output, always
6. **Evidence-tagged**: BLOCK findings SHOULD include evidence type

## Severity Enum

```typescript
enum Severity {
  PASS = "PASS",   // No issues — guard succeeded
  WARN = "WARN",   // Issues found — commit allowed but flagged
  BLOCK = "BLOCK", // Critical issues — commit rejected
}
```

## Registration

Guards are registered by adding to `src/guards/index.ts`:

```typescript
export { myGuard } from "./my-guard.js";
```

And imported by the engine via `allBuiltinGuards` in `src/core/engine.ts`.
