import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { noTypeSafetyBypassGuard } from "../../dist/guards/no-type-safety-bypass.js";
import { Severity } from "../../dist/core/types.js";

async function makeTmpDir() {
  return mkdtemp(path.join(os.tmpdir(), "did-no-type-safety-"));
}

test("noTypeSafetyBypassGuard — contract shape & disabled state", async (t) => {
  assert.equal(noTypeSafetyBypassGuard.id, "noTypeSafetyBypass");

  await t.test("empty stagedFiles passes with zero findings", async () => {
    const root = await makeTmpDir();
    try {
      const result = await noTypeSafetyBypassGuard.check({
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
      const file = path.join(root, "bad.ts");
      await writeFile(file, "const x = val as any;\n");
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["bad.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: { noTypeSafetyBypass: { enabled: false } } },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("noTypeSafetyBypassGuard — blocks bypass patterns", async (t) => {
  await t.test("blocks 'as any' cast", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "index.ts"), "const data: string = payload.field as any;\n");
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["index.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].severity, Severity.BLOCK);
      assert.ok(result.findings[0].message.includes("'as any'"));
      assert.ok(result.findings[0].fix);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("blocks '@ts-ignore' directive", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "service.ts"), "// @ts-ignore — temporary fix\nconst a: number = 'str';\n");
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["service.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.ok(result.findings.some((f) => f.message.includes("@ts-ignore")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("blocks '@ts-nocheck' directive", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "legacy.ts"), "// @ts-nocheck\nexport const val = 123;\n");
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["legacy.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.ok(result.findings.some((f) => f.message.includes("@ts-nocheck")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("blocks unreferenced '@ts-expect-error'", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "check.ts"), "// @ts-expect-error\nconst x: number = 'abc';\n");
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["check.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, false);
      assert.ok(result.findings.some((f) => f.message.includes("Unreferenced '@ts-expect-error'")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("noTypeSafetyBypassGuard — allowlists & escape hatches", async (t) => {
  await t.test("allows legitimate 'as unknown as ConcreteType'", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(
        path.join(root, "valid.ts"),
        "/**\n * Description mentioning 'as any' or '@ts-ignore' in docs\n */\nconst parsed = raw as unknown as Config;\n",
      );
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["valid.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("allows '@ts-expect-error' with ticket reference", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(
        path.join(root, "upstream-workaround.ts"),
        "// @ts-expect-error — TK-20260407-001: upstream typing bug in dependency\nconst v: string = badLib.call();\n",
      );
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["upstream-workaround.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("skips non-matching file extensions and non-existent files", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "readme.md"), "as any");
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["readme.md", "does-not-exist.ts"],
        projectRoot: root,
        config: { version: "1.0", guards: {} },
      });
      assert.equal(result.passed, true);
      assert.equal(result.findings.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("honors custom allowlist and warn severity", async () => {
    const root = await makeTmpDir();
    try {
      await writeFile(path.join(root, "vendor.ts"), "const v = x as any;\n");
      await writeFile(path.join(root, "warning.ts"), "const w = y as any;\n");
      const result = await noTypeSafetyBypassGuard.check({
        stagedFiles: ["vendor.ts", "warning.ts"],
        projectRoot: root,
        config: {
          version: "1.0",
          guards: {
            noTypeSafetyBypass: {
              enabled: true,
              severity: "warn",
              allowlistPaths: ["vendor.ts"],
            },
          },
        },
      });
      assert.equal(result.passed, true); // warn does not block
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].severity, Severity.WARN);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

