# Writing Custom Guards

> Your first guard in 5 minutes.

---

## The Guard Interface

Every guard implements this interface from `src/core/types.ts`:

```typescript
interface Guard {
  readonly id: string;          // Unique kebab-case ID
  readonly name: string;        // Human-readable name
  readonly description: string; // What does this guard catch?
  check(ctx: GuardContext): Promise<GuardResult>;
}
```

---

## Example: File Size Guard

```typescript
// src/guards/file-size.ts
import * as fs from "node:fs";
import * as path from "node:path";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

const MAX_LINES = 500;

export const fileSizeGuard: Guard = {
  id: "file-size",
  name: "File Size Guard",
  description: "Prevents files larger than 500 lines from being committed",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const findings: Finding[] = [];

    for (const file of ctx.stagedFiles) {
      const fullPath = path.join(ctx.projectRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const lineCount = content.split("\n").length;

      if (lineCount > MAX_LINES) {
        findings.push({
          guardId: "file-size",
          severity: Severity.WARN,
          message: `File has ${lineCount} lines (max: ${MAX_LINES})`,
          filePath: file,
          fix: "Split into smaller modules",
          evidence: EvidenceLevel.RUNTIME,
        });
      }
    }

    return {
      guardId: "file-size",
      passed: findings.length === 0,
      findings,
      durationMs: 0,
    };
  },
};
```

## Rules for Guards

1. **Pure functions** — No side effects. Do not write files, make HTTP requests, or modify state.
2. **Crash-safe** — Handle errors internally. Never let an exception crash the pipeline.
3. **Fast** — Target < 100ms for typical workloads (≤ 50 files).
4. **Independent** — Do not import from other guards.
5. **Evidence-tagged** — Use `EvidenceLevel` on findings to show how you verified.
6. **Fix suggestions** — BLOCK findings MUST include a `fix` string.

## Registering Your Guard

Add to `src/guards/index.ts`:

```typescript
export { fileSizeGuard } from "./file-size.js";
```

That's it. The engine discovers guards through this barrel export.

## Testing Your Guard

```bash
# Build
npm run build

# Run your guard specifically
npx defend-in-depth verify --files "path/to/large-file.ts"
```

## Full Contract Reference

See [`.agents/contracts/guard-interface.md`](../.agents/contracts/guard-interface.md) for the complete interface specification with all types and invariants.
