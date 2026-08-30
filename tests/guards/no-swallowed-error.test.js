import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { noSwallowedErrorGuard } from "../../dist/guards/no-swallowed-error.js";
import { Severity } from "../../dist/core/types.js";

async function makeTmpDir() {
  return mkdtemp(path.join(os.tmpdir(), "did-no-swallowed-"));
}

test("noSwallowedErrorGuard — contract shape & disabled state", async (t) => {
  assert.equal(noSwallowedErrorGuard.id, "noSwallowedError");

  await t.test("empty stagedFiles passes with zero findings", async () => {
    const root = await makeTmpDir();
    try {
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: [],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("enabled: false skips checks", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "bad.ts"), "try { work(); } catch (e) {}\n");
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: ["bad.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: { noSwallowedError: { enabled: false } } },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("noSwallowedErrorGuard — blocks empty & stub catches", async (t) => {
  await t.test("blocks empty catch block", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "app.ts"), "try { doSomething(); } catch (e) {}\n");
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: ["app.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].severity, Severity.BLOCK);
      assert.ok(result.findings[0].message.includes("empty catch block"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("blocks catch with only noop comment", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "service.ts"), "try {\n  run();\n} catch (_e) {\n  // ignore error\n}\n");
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: ["service.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.ok(result.findings.some((f) => f.message.includes("empty catch block")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("blocks catch with stub return null/{}", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "fetcher.ts"), "try { fetch(); } catch (err) { return null; }\n");
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: ["fetcher.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.ok(result.findings.some((f) => f.message.includes("Swallowed error with stub return")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("noSwallowedErrorGuard — allows valid error handling & ticket comments", async (t) => {
  await t.test("allows catch with error logging", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "logger.ts"), "try { run(); } catch (e) { console.error(e); }\n");
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: ["logger.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("allows catch with rethrow", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "rethrow.ts"), "try { run(); } catch (e) { throw new Error('wrap', { cause: e }); }\n");
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: ["rethrow.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("allows catch with ticket comment in stub return", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "ticket-stub.ts"), "try { fetch(); } catch { /* TODO(TK-555): fallback */ return null; }\n");
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: ["ticket-stub.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("skips non-code extensions, missing files, and allowlisted paths", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "notes.txt"), "try {} catch(e) {}");
      await writeFile(path.join(root, "allowed.js"), "try { run(); } catch(e) {}");
      const result = await noSwallowedErrorGuard.check({
        stagedFiles: ["notes.txt", "allowed.js", "missing.ts"],
        projectRoot: root,
        config: {
          version: "1.0",
          guards: {
            noSwallowedError: {
              enabled: true,
              severity: "warn",
              allowlistPaths: ["allowed.js"],
            },
          },
        },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

