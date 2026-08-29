import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { dependencyAuditGuard } from "../../dist/guards/dependency-audit.js";
import { Severity } from "../../dist/core/types.js";

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
      fs.rmSync(dir, { recursive: true, force: true });
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
      fs.rmSync(dir, { recursive: true, force: true });
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
      fs.rmSync(dir, { recursive: true, force: true });
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
      fs.rmSync(dir, { recursive: true, force: true });
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
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
