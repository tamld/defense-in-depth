import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { noStubReturnGuard } from "../../dist/guards/no-stub-return.js";
import { Severity } from "../../dist/core/types.js";

async function makeTmpDir() {
  return mkdtemp(path.join(os.tmpdir(), "did-no-stub-"));
}

test("noStubReturnGuard — contract shape & disabled state", async (t) => {
  assert.equal(noStubReturnGuard.id, "noStubReturn");

  await t.test("empty stagedFiles passes with zero findings", async () => {
    const root = await makeTmpDir();
    try {
      const result = await noStubReturnGuard.check({
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
      await writeFile(path.join(root, "stub.ts"), "function get(): any { return null; }\n");
      const result = await noStubReturnGuard.check({
        stagedFiles: ["stub.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: { noStubReturn: { enabled: false } } },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("noStubReturnGuard — blocks hollow placeholder functions", async (t) => {
  await t.test("blocks function returning null", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "api.ts"), "function fetchUser(id: string) {\n  return null;\n}\n");
      const result = await noStubReturnGuard.check({
        stagedFiles: ["api.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].severity, Severity.BLOCK);
      assert.ok(result.findings[0].message.includes("Hollow stub function"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("blocks function throwing 'Not implemented' or 'TODO'", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(
        path.join(root, "service.ts"),
        "async function saveOrder(order: any) {\n  throw new Error('Not implemented');\n}\n",
      );
      const result = await noStubReturnGuard.check({
        stagedFiles: ["service.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.ok(result.findings.some((f) => f.message.includes("Hollow stub function")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("blocks arrow function returning null", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "handler.ts"), "const handler = () => null;\n");
      const result = await noStubReturnGuard.check({
        stagedFiles: ["handler.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.ok(result.findings.some((f) => f.message.includes("Hollow stub arrow function")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("noStubReturnGuard — allows real logic & ticket annotations", async (t) => {
  await t.test("allows functions with multiple statements and branching returns", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(
        path.join(root, "real.ts"),
        "function find(id: string) {\n  if (!id) return null;\n  return { id, name: 'Alice' };\n}\n",
      );
      const result = await noStubReturnGuard.check({
        stagedFiles: ["real.ts"],
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
      await writeFile(path.join(root, "data.json"), "{}");
      await writeFile(path.join(root, "allow.ts"), "function get() { return null; }");
      const result = await noStubReturnGuard.check({
        stagedFiles: ["data.json", "allow.ts", "not-found.ts"],
        projectRoot: root,
        config: {
          version: "1.0",
          guards: {
            noStubReturn: {
              enabled: true,
              severity: "warn",
              allowlistPaths: ["allow.ts"],
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

