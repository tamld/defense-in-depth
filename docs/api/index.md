# API Reference

> **Complete public API documentation for `defense-in-depth` package exports and interfaces.**

---

## 1. Package Structure & Subpaths

`defense-in-depth` supports modern Node.js ESM subpath exports:

| Subpath | Description | Primary Exports |
| :--- | :--- | :--- |
| `defense-in-depth` | Root package barrel | `DefendEngine`, `loadConfig`, `DEFAULT_CONFIG`, all built-in guards |
| `defense-in-depth/guards` | Pure guard validators | `hollowArtifactGuard`, `secretDetectionGuard`, `fileSizeLimitGuard`, etc. |
| `defense-in-depth/federation` | Cross-project providers | `createTicketProvider`, `FileTicketProvider`, `HttpTicketProvider` |
| `defense-in-depth/types` | TypeScript interfaces | `Guard`, `GuardContext`, `GuardResult`, `DefendConfig`, `Severity` |
| `defense-in-depth/errors` | Typed error hierarchy | `DiDError`, `ConfigError`, `GuardCrashError`, `FederationError` |

---

## 2. Core Classes & Functions

### `DefendEngine`
The central execution pipeline that runs registered guards against staged files or diff contexts.

```typescript
class DefendEngine {
  constructor(projectRoot: string, config?: Partial<DefendConfig>);

  // Register a guard in the pipeline (chainable)
  use(guard: Guard): this;

  // Execute all enabled guards
  run(context?: {
    files?: string[];
    branch?: string;
    commitMessage?: string;
    stagedFiles?: string[];
  }): Promise<EngineVerdict>;
}
```

### `loadConfig(projectRoot: string): DefendConfig`
Loads and validates `defense.config.yml` (or `.defendrc.yml`). Throws `ConfigError` with `DID_CONFIG_INVALID` if the schema is violated.

---

## 3. Core Enums & Types

### `Severity`
```typescript
export enum Severity {
  WARN = "warn",   // Emits non-blocking advisory findings
  BLOCK = "block", // Fails verification with exit code 1
}
```

### `EvidenceLevel`
```typescript
export enum EvidenceLevel {
  DIRECT = "direct", // Directly observed pattern in code
  DERIVED = "derived", // Inferred from state or metadata
  HYPOTHETICAL = "hypothetical", // Advisory heuristic
}
```

### `GuardResult` & `Finding`
```typescript
export interface GuardResult {
  passed: boolean;
  findings: Finding[];
  durationMs?: number;
  guardId?: string;
}

export interface Finding {
  guardId: string;
  severity: Severity;
  evidenceLevel: EvidenceLevel;
  filePath?: string;
  line?: number;
  message: string;
  fix: string;
}
```
