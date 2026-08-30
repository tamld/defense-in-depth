import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { dependencyAuditGuard } from "../../dist/guards/dependency-audit.js";
import { Severity } from "../../dist/core/types.js";

describe("dependencyAuditGuard", () => {
  function safeRm(p) {
    try {
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // Best effort cleanup
    }
  }

  function makeTmpRepo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-audit-test-"));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, "utf-8");
    }
    return dir;
  }

  it("passes silently when disabled in config (default)", async () => {
    const dir = makeTmpRepo({
      "package.json": '{"name": "test-pkg", "dependencies": {}}',
    });
    try {
      const res = await dependencyAuditGuard.check({
        stagedFiles: ["package.json"],
        projectRoot: dir,
        config: { version: "1.0", guards: { dependencyAudit: { enabled: false } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      safeRm(dir);
    }
  });

  it("passes when package.json does not exist in repo root", async () => {
    const dir = makeTmpRepo({
      "src/index.ts": "console.log('hi');",
    });
    try {
      const res = await dependencyAuditGuard.check({
        stagedFiles: ["src/index.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { dependencyAudit: { enabled: true } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      safeRm(dir);
    }
  });

  it("skips when non-package files are staged and not whole-project scan", async () => {
    const dir = makeTmpRepo({
      "package.json": '{"name": "test-pkg"}',
      "src/index.ts": "console.log('hi');",
    });
    try {
      const res = await dependencyAuditGuard.check({
        stagedFiles: ["src/index.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { dependencyAudit: { enabled: true } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      safeRm(dir);
    }
  });

  it("degrades gracefully when npm audit fails or package has no lockfile", async () => {
    const dir = makeTmpRepo({
      "package.json": '{"name": "test-pkg", "version": "1.0.0"}',
    });
    try {
      const res = await dependencyAuditGuard.check({
        stagedFiles: ["package.json"],
        projectRoot: dir,
        config: { version: "1.0", guards: { dependencyAudit: { enabled: true } } },
      });
      assert.ok(typeof res.passed === "boolean");
    } finally {
      safeRm(dir);
    }
  });

  it("handles lockfile staged files", async () => {
    const dir = makeTmpRepo({
      "package.json": '{"name": "test-pkg", "version": "1.0.0"}',
      "pnpm-lock.yaml": "lockfile: 1",
    });
    try {
      const res = await dependencyAuditGuard.check({
        stagedFiles: ["pnpm-lock.yaml"],
        projectRoot: dir,
        config: { version: "1.0", guards: { dependencyAudit: { enabled: true } } },
      });
      assert.ok(typeof res.passed === "boolean");
    } finally {
      safeRm(dir);
    }
  });

  describe("mocked npm audit responses", () => {
    function setupMockNpm(outputString, exitCode = 0) {
      const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "mock-npm-bin-"));
      const runnerJs = path.join(binDir, "runner.js");
      fs.writeFileSync(runnerJs, `process.stdout.write(${JSON.stringify(outputString)});\nprocess.exit(${exitCode});\n`);
      const npmSh = path.join(binDir, "npm");
      const npmCmd = path.join(binDir, "npm.cmd");
      fs.writeFileSync(npmSh, `#!/bin/sh\nnode "${runnerJs}"\n`, { mode: 0o755 });
      fs.writeFileSync(npmCmd, `@echo off\r\nnode "${runnerJs}"\r\n`, { mode: 0o755 });
      const origPath = process.env.PATH;
      process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
      return {
        cleanup() {
          process.env.PATH = origPath;
          safeRm(binDir);
        },
      };
    }

    it("blocks when critical or high vulnerabilities are detected", async () => {
      const mock = setupMockNpm(
        JSON.stringify({
          metadata: {
            vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 1, total: 2 },
          },
        }),
        1,
      );
      const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg"}' });
      try {
        const res = await dependencyAuditGuard.check({
          stagedFiles: ["package.json"],
          projectRoot: dir,
          config: { version: "1.0", guards: { dependencyAudit: { enabled: true, severity: "block" } } },
        });
        assert.equal(res.passed, false);
        assert.equal(res.findings.length, 1);
        assert.equal(res.findings[0].severity, Severity.BLOCK);
        assert.ok(res.findings[0].message.includes("1 critical, 1 high"));
      } finally {
        mock.cleanup();
        safeRm(dir);
      }
    });

    it("warns when critical or high vulnerabilities are detected and severity is warn", async () => {
      const mock = setupMockNpm(
        JSON.stringify({
          metadata: {
            vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 },
          },
        }),
        1,
      );
      const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg"}' });
      try {
        const res = await dependencyAuditGuard.check({
          stagedFiles: ["package.json"],
          projectRoot: dir,
          config: { version: "1.0", guards: { dependencyAudit: { enabled: true, severity: "warn" } } },
        });
        assert.equal(res.passed, true);
        assert.equal(res.findings.length, 1);
        assert.equal(res.findings[0].severity, Severity.WARN);
      } finally {
        mock.cleanup();
        safeRm(dir);
      }
    });

    it("warns when moderate vulnerabilities are detected", async () => {
      const mock = setupMockNpm(
        JSON.stringify({
          metadata: {
            vulnerabilities: { info: 0, low: 1, moderate: 2, high: 0, critical: 0, total: 3 },
          },
        }),
        0,
      );
      const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg"}' });
      try {
        const res = await dependencyAuditGuard.check({
          stagedFiles: ["package.json"],
          projectRoot: dir,
          config: { version: "1.0", guards: { dependencyAudit: { enabled: true } } },
        });
        assert.equal(res.passed, true);
        assert.equal(res.findings.length, 1);
        assert.equal(res.findings[0].severity, Severity.WARN);
        assert.ok(res.findings[0].message.includes("2 moderate"));
      } finally {
        mock.cleanup();
        safeRm(dir);
      }
    });

    it("handles non-JSON or invalid output gracefully", async () => {
      const mock = setupMockNpm("not json\n", 0);
      const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg"}' });
      try {
        const res = await dependencyAuditGuard.check({
          stagedFiles: ["package.json"],
          projectRoot: dir,
          config: { version: "1.0", guards: { dependencyAudit: { enabled: true } } },
        });
        assert.equal(res.passed, true);
        assert.equal(res.findings.length, 0);
      } finally {
        mock.cleanup();
        safeRm(dir);
      }
    });

    it("handles JSON parse error when output starts with { but is malformed", async () => {
      const mock = setupMockNpm("{ invalid json\n", 0);
      const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg"}' });
      try {
        const res = await dependencyAuditGuard.check({
          stagedFiles: ["package.json"],
          projectRoot: dir,
          config: { version: "1.0", guards: { dependencyAudit: { enabled: true } } },
        });
        assert.equal(res.passed, true);
        assert.equal(res.findings.length, 1);
        assert.ok(res.findings[0].message.includes("Failed to parse audit results"));
      } finally {
        mock.cleanup();
        safeRm(dir);
      }
    });
  });
});
