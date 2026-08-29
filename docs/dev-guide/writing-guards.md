# Authoring Custom Guards

> **The canonical guide to designing, implementing, registering, and testing a new Guard in `defense-in-depth`.**  
> *Target: Developers extending the deterministic Tier 0 guard pipeline.*

---

## 1. The Core Philosophy of a Guard

Every Guard in `defense-in-depth` is a **pure, deterministic validator** that runs before code is committed to Git history.

### The 6 Immutable Guard Invariants
1. **Pure Functions**: No side effects. A guard only reads files in the staging area or workspace. It never writes to the filesystem, mutates global state, or opens network connections.
2. **Crash-Safe**: Every internal error must be caught and handled gracefully. A guard must never crash the pipeline or invoke `process.exit()`.
3. **Execution Budget (<100ms)**: Guards run in the pre-commit hot path. Processing for typical changesets (≤50 files) must complete in milliseconds.
4. **Independent**: Guards never import or depend on other guards.
5. **Evidence-Tagged**: All findings attach an `EvidenceLevel` (`CODE`, `RUNTIME`, `INFER`, `HYPO`) to provide auditable proof.
6. **Actionable Fixes**: Any finding with `Severity.BLOCK` **must** provide a concrete `fix` string showing developers how to resolve the block.

---

## 2. The `Guard` Interface

From `src/core/types/guard.ts` (and exported at `defense-in-depth/types`):

```typescript
import type { Finding, Severity, EvidenceLevel } from "./engine.js";

export interface GuardContext {
  readonly projectRoot: string;
  readonly stagedFiles: readonly string[];
  readonly allFiles?: readonly string[];
  readonly config: DefendConfig;
  readonly branchName?: string;
  readonly commitMessage?: string;
}

export interface GuardResult {
  readonly guardId: string;
  readonly passed: boolean;
  readonly findings: readonly Finding[];
  readonly durationMs: number;
}

export interface Guard {
  readonly id: string;          // Kebab-case identifier (e.g. "secret-detection")
  readonly name: string;        // Human-readable title (e.g. "Secret Detection Guard")
  readonly description: string; // What anti-pattern this guard catches
  check(ctx: GuardContext): Promise<GuardResult>;
}
```

---

## 3. Step-by-Step Tutorial: Authoring a Guard

Let's build a **Secret Detection Guard** that catches accidentally staged private keys and API tokens.

### Step 1: Create the Guard File (`src/guards/secret-detection.ts`)

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import type { Guard, GuardContext, GuardResult, Finding } from "../core/types.js";
import { Severity, EvidenceLevel } from "../core/types.js";

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "Private Key", regex: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/ },
  { name: "AWS Access Key", regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "Generic API Token", regex: /(api_key|secret_key|auth_token)\s*=\s*['"][0-9a-zA-Z_\-]{20,}['"]/i },
];

export const secretDetectionGuard: Guard = {
  id: "secret-detection",
  name: "Secret Detection Guard",
  description: "Prevents accidental commits of private keys, AWS credentials, and API secrets",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const startTime = performance.now();
    const findings: Finding[] = [];

    // Respect configuration toggles
    const config = ctx.config.guards?.secretDetection;
    if (config?.enabled === false) {
      return {
        guardId: "secret-detection",
        passed: true,
        findings: [],
        durationMs: performance.now() - startTime,
      };
    }

    for (const file of ctx.stagedFiles) {
      const fullPath = path.join(ctx.projectRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.regex.test(line)) {
              findings.push({
                guardId: "secret-detection",
                severity: Severity.BLOCK,
                message: `Potential secret detected (${pattern.name}) at line ${index + 1}`,
                filePath: file,
                line: index + 1,
                evidence: EvidenceLevel.CODE,
                fix: `Remove the hardcoded secret from ${file} and store it in an environment variable (.env) or secret vault.`,
              });
            }
          }
        });
      } catch {
        // Gracefully ignore binary files or unreadable entries
      }
    }

    return {
      guardId: "secret-detection",
      passed: findings.filter((f) => f.severity === Severity.BLOCK).length === 0,
      findings,
      durationMs: performance.now() - startTime,
    };
  },
};
```

---

## 4. Registering Your Guard

### 1. Barrel Export (`src/guards/index.ts`)
Add your guard to the public barrel:

```typescript
export { secretDetectionGuard } from "./secret-detection.js";
```

### 2. Config Schema (`src/core/types/config.ts`)
Add the optional configuration key to `GuardsConfig`:

```typescript
export interface SecretDetectionConfig {
  readonly enabled?: boolean;
  readonly severity?: "block" | "warn";
  readonly customPatterns?: readonly string[];
}

export interface GuardsConfig {
  readonly hollowArtifact?: HollowArtifactConfig;
  readonly ssotPollution?: SSoTPollutionConfig;
  readonly secretDetection?: SecretDetectionConfig;
  // ...
}
```

---

## 5. Adversarial Testing Pattern

Every guard must be paired with an adversarial test suite in `tests/guards/<guard-name>.test.ts` verifying both positive catches and bypass resistance:

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { secretDetectionGuard } from "../../dist/guards/secret-detection.js";
import { Severity, EvidenceLevel } from "../../dist/core/types.js";

describe("Guard: secretDetection", () => {
  test("BLOCKS staging of private RSA keys", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "did-secret-test-"));
    const badFile = path.join(tmpDir, "server.pem");
    fs.writeFileSync(badFile, "-----BEGIN " + "RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END " + "RSA PRIVATE KEY-----");

    const result = await secretDetectionGuard.check({
      projectRoot: tmpDir,
      stagedFiles: ["server.pem"],
      config: {},
    });

    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, Severity.BLOCK);
    assert.match(result.findings[0].message, /Private Key/);
    assert.ok(result.findings[0].fix.length > 0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("PASSES clean source files with zero false-positives", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "did-clean-test-"));
    const cleanFile = path.join(tmpDir, "index.ts");
    fs.writeFileSync(cleanFile, "export const API_URL = process.env.API_URL || 'http://localhost:3000';");

    const result = await secretDetectionGuard.check({
      projectRoot: tmpDir,
      stagedFiles: ["index.ts"],
      config: {},
    });

    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
```

---

## 6. Verification Commands

```bash
# 1. Type check
npx tsc --noEmit

# 2. Run unit tests
npm test

# 3. Dogfood verification on your own repository
npx defense-in-depth verify
```
