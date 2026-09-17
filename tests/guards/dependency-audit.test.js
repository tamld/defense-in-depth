import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createDependencyAuditGuard } from "../../dist/guards/dependency-audit.js";
import { Severity, EvidenceLevel } from "../../dist/core/types.js";

describe("dependencyAuditGuard", () => {
  function makeTmpRepo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-audit-test-"));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, "utf-8");
    }
    return dir;
  }

  function createMockExecutor(
    stdout,
    shouldThrow = false,
    throwError = null,
    includeStdoutOnError = true,
  ) {
    return () => {
      if (shouldThrow) {
        const err = new Error(throwError ?? "npm audit failed");
        if (includeStdoutOnError) err.stdout = stdout;
        throw err;
      }
      return stdout;
    };
  }

  const baseConfig = { version: "1.0", guards: { dependencyAudit: { enabled: true } } };
  const baseContext = (dir, stagedFiles = ["package.json"], config = baseConfig) => ({
    stagedFiles,
    projectRoot: dir,
    config,
  });

  it("passes silently when disabled in config (default)", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "dependencies": {}}' });
    const guard = createDependencyAuditGuard();
    try {
      const res = await guard.check({
        stagedFiles: ["package.json"],
        projectRoot: dir,
        config: { version: "1.0", guards: { dependencyAudit: { enabled: false } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes when package.json does not exist in repo root", async () => {
    const dir = makeTmpRepo({ "src/index.ts": "console.log('hi');" });
    const guard = createDependencyAuditGuard();
    try {
      const res = await guard.check({
        stagedFiles: ["src/index.ts"],
        projectRoot: dir,
        config: baseConfig,
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips when non-package files are staged and not whole-project scan", async () => {
    const dir = makeTmpRepo({
      "package.json": '{"name": "test-pkg"}',
      "src/index.ts": "console.log('hi');",
    });
    const guard = createDependencyAuditGuard();
    try {
      const res = await guard.check({
        stagedFiles: ["src/index.ts"],
        projectRoot: dir,
        config: baseConfig,
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("degrades gracefully when npm audit fails with non-recoverable error", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const guard = createDependencyAuditGuard({
      executor: createMockExecutor("", true, "ENOENT: npm not found", false),
    });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.WARN);
      assert.ok(res.findings[0].message.includes("npm audit could not be executed"));
      assert.equal(res.findings[0].evidence, EvidenceLevel.RUNTIME);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles lockfile staged files", async () => {
    const dir = makeTmpRepo({
      "package.json": '{"name": "test-pkg", "version": "1.0.0"}',
      "pnpm-lock.yaml": "lockfile: 1",
    });
    const guard = createDependencyAuditGuard();
    try {
      const res = await guard.check({
        stagedFiles: ["pnpm-lock.yaml"],
        projectRoot: dir,
        config: baseConfig,
      });
      assert.ok(typeof res.passed === "boolean");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports BLOCK finding for critical vulnerabilities (default severity)", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const auditJson = JSON.stringify({
      metadata: {
        vulnerabilities: { critical: 2, high: 1, moderate: 0, low: 0, info: 0, total: 3 },
      },
    });
    const guard = createDependencyAuditGuard({ executor: createMockExecutor(auditJson) });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, false);
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.BLOCK);
      assert.ok(res.findings[0].message.includes("2 critical, 1 high"));
      assert.equal(res.findings[0].filePath, "package.json");
      assert.equal(res.findings[0].evidence, EvidenceLevel.RUNTIME);
      assert.ok(res.findings[0].fix?.includes("npm audit fix"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports BLOCK finding for high vulnerabilities (default severity)", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const auditJson = JSON.stringify({
      metadata: {
        vulnerabilities: { critical: 0, high: 3, moderate: 0, low: 0, info: 0, total: 3 },
      },
    });
    const guard = createDependencyAuditGuard({ executor: createMockExecutor(auditJson) });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, false);
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.BLOCK);
      assert.ok(res.findings[0].message.includes("0 critical, 3 high"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports WARN finding for critical/high when severity is warn", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const auditJson = JSON.stringify({
      metadata: {
        vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0, info: 0, total: 1 },
      },
    });
    const config = {
      version: "1.0",
      guards: { dependencyAudit: { enabled: true, severity: "warn" } },
    };
    const guard = createDependencyAuditGuard({ executor: createMockExecutor(auditJson) });
    try {
      const res = await guard.check({ ...baseContext(dir), config });
      assert.equal(res.passed, true); // WARN doesn't block
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.WARN);
      assert.ok(res.findings[0].message.includes("1 critical, 0 high"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports WARN finding for moderate vulnerabilities only", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const auditJson = JSON.stringify({
      metadata: {
        vulnerabilities: { critical: 0, high: 0, moderate: 5, low: 2, info: 0, total: 7 },
      },
    });
    const guard = createDependencyAuditGuard({ executor: createMockExecutor(auditJson) });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, true); // moderate only = WARN
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.WARN);
      assert.ok(res.findings[0].message.includes("5 moderate"));
      assert.ok(res.findings[0].fix?.includes("Review dependencies"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns no findings when no vulnerabilities detected", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const auditJson = JSON.stringify({
      metadata: {
        vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
      },
    });
    const guard = createDependencyAuditGuard({ executor: createMockExecutor(auditJson) });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles empty stdout gracefully", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const guard = createDependencyAuditGuard({ executor: createMockExecutor("") });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles non-JSON stdout gracefully", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const guard = createDependencyAuditGuard({ executor: createMockExecutor("not json output") });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports WARN finding on JSON parse error", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const guard = createDependencyAuditGuard({ executor: createMockExecutor("{ invalid json") });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, true); // parse error = WARN, not BLOCK
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.WARN);
      assert.ok(res.findings[0].message.includes("Failed to parse audit results"));
      assert.equal(res.findings[0].evidence, EvidenceLevel.RUNTIME);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles npm audit throwing with valid JSON in stdout (vulnerabilities found)", async () => {
    const dir = makeTmpRepo({ "package.json": '{"name": "test-pkg", "version": "1.0.0"}' });
    const auditJson = JSON.stringify({
      metadata: {
        vulnerabilities: { critical: 0, high: 2, moderate: 1, low: 0, info: 0, total: 3 },
      },
    });
    const guard = createDependencyAuditGuard({ executor: createMockExecutor(auditJson, true) });
    try {
      const res = await guard.check(baseContext(dir));
      assert.equal(res.passed, false);
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.BLOCK);
      assert.ok(res.findings[0].message.includes("0 critical, 2 high"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
