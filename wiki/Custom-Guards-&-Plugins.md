# Custom Guards & Plugins

> **How to create pure, deterministic custom guards and extend the `defense-in-depth` engine.**

---

## 🛠️ The `Guard` Interface

All guards must implement the `Guard` interface from `src/core/types/guard.ts`:

```typescript
export interface Guard {
  readonly id: string;          // Unique kebab-case identifier
  readonly name: string;        // Human-readable display name
  readonly description: string; // Anti-pattern prevented
  check(ctx: GuardContext): Promise<GuardResult>;
}
```

---

## 🔒 The 6 Invariants of Pure Guards

1. **Pure & Deterministic**: Zero side-effects. Do not write to disk or mutate global variables.
2. **Crash-Safe**: Catch all internal exceptions and return safe findings.
3. **Execution Budget (<100ms)**: Fast in-memory AST and regex evaluation.
4. **Independent**: No circular imports between guard modules.
5. **Evidence-Tagged**: Attach `EvidenceLevel` (`CODE`, `RUNTIME`, `INFER`, `HYPO`) to every finding.
6. **Actionable Fixes**: Every `Severity.BLOCK` finding must specify a concrete `fix` recommendation.

---

## 📝 Example: Authoring a Header Guard

```typescript
// src/guards/license-header.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

const REQUIRED_HEADER = "// Copyright (c) 2026";

export const licenseHeaderGuard: Guard = {
  id: "license-header",
  name: "License Header Guard",
  description: "Ensures all TypeScript source files contain the copyright header",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const startTime = performance.now();
    const findings: Finding[] = [];

    for (const file of ctx.stagedFiles) {
      if (!file.endsWith(".ts")) continue;
      const fullPath = path.join(ctx.projectRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      if (!content.startsWith(REQUIRED_HEADER)) {
        findings.push({
          guardId: "license-header",
          severity: Severity.BLOCK,
          message: `Missing required copyright header in ${file}`,
          filePath: file,
          line: 1,
          evidence: EvidenceLevel.CODE,
          fix: `Prepend '${REQUIRED_HEADER}' to the top of ${file}`,
        });
      }
    }

    return {
      guardId: "license-header",
      passed: findings.length === 0,
      findings,
      durationMs: performance.now() - startTime,
    };
  },
};
```

---

## 📦 Registering Your Guard

1. Export the guard in `src/guards/index.ts`:
   ```typescript
   export { licenseHeaderGuard } from "./license-header.js";
   ```
2. Add the optional config interface in `src/core/types/config.ts`.
3. Add an adversarial unit test in `tests/guards/license-header.test.ts`.
