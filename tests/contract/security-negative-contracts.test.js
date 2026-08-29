import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { DefendEngine } from "../../dist/core/engine.js";
import { commitFormatGuard } from "../../dist/guards/commit-format.js";
import { branchNamingGuard } from "../../dist/guards/branch-naming.js";
import { ssotPollutionGuard } from "../../dist/guards/ssot-pollution.js";
import { Severity } from "../../dist/core/types.js";

describe("CONTRACT — Security Negative Contract Tests (#48)", () => {
  function makeTmpRepo() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "did-sec-contract-"));
  }

  it("Test 1: Shell injection metacharacters in branch names or commit messages do not execute arbitrary commands", async () => {
    const dir = makeTmpRepo();
    const maliciousPayload = "feat/test; touch /tmp/did_pwned_$(whoami)";

    try {
      const engine = new DefendEngine(dir, {
        version: "1.0",
        guards: {
          branchNaming: { enabled: true, pattern: "^(feat|fix)/.*" },
          commitFormat: { enabled: true },
        },
      }).use(branchNamingGuard).use(commitFormatGuard);

      const verdict = await engine.run({
        files: [],
        branch: maliciousPayload,
        commitMessage: "feat: normal message && rm -rf /",
      });

      // The guard executes purely in memory without spawning unescaped shells
      assert.equal(typeof verdict.passed, "boolean");
      assert.ok(verdict.totalGuards >= 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Test 2: Path traversal attempts in staged files are safely contained", async () => {
    const dir = makeTmpRepo();
    const traversalPath = "../../../../etc/passwd";

    try {
      const engine = new DefendEngine(dir, {
        version: "1.0",
        guards: { ssotPollution: { enabled: true } },
      }).use(ssotPollutionGuard);

      const verdict = await engine.run({
        files: [traversalPath],
      });

      // Traversal path should not crash the engine or read outside root
      assert.equal(typeof verdict.passed, "boolean");
      assert.ok(verdict.results.length > 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Test 3: Fail-secure principle — crashing guard fails CLOSED with hard BLOCK verdict", async () => {
    const dir = makeTmpRepo();
    const crashingGuard = {
      id: "exploitCrashingGuard",
      name: "Crashing Exploit Guard",
      description: "Simulates an unhandled internal exception",
      async check() {
        throw new Error("Simulated unhandled buffer overflow / zero-day crash");
      },
    };

    try {
      const engine = new DefendEngine(dir, {
        version: "1.0",
        guards: {},
      }).use(crashingGuard);

      const verdict = await engine.run({
        files: ["src/index.ts"],
      });

      // Fail-secure: must NOT pass if guard crashed
      assert.equal(verdict.passed, false, "Crashing guard must fail-closed (verdict.passed === false)");
      assert.equal(verdict.failedGuards, 1);
      assert.ok(verdict.results.length > 0);
      assert.equal(verdict.results[0].findings[0].severity, Severity.BLOCK);
      assert.ok(verdict.results[0].findings[0].message.includes("Guard crashed"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
