import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { noTriviallyTrueTestGuard } from "../../dist/guards/no-trivially-true-test-guard.js";
import { Severity } from "../../dist/core/types.js";

async function makeTmpDir() {
  return mkdtemp(path.join(os.tmpdir(), "did-no-trivial-test-"));
}

describe("noTriviallyTrueTestGuard", () => {
  describe("contract shape & disabled state", () => {
    it("has id noTriviallyTrueTest", () => {
      assert.equal(noTriviallyTrueTestGuard.id, "noTriviallyTrueTest");
    });

    it("empty stagedFiles passes with zero findings", async () => {
      const root = await makeTmpDir();
      try {
        const result = await noTriviallyTrueTestGuard.check({
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

    it("enabled: false skips checks", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, "tests"), { recursive: true });
        await writeFile(path.join(root, "tests", "dummy.test.js"), "test('trivial', () => { assert.equal(1, 1); });\n");
        const result = await noTriviallyTrueTestGuard.check({
          stagedFiles: ["tests/dummy.test.js"],
          projectRoot: root,
          config: { version: "1.0", guards: { noTriviallyTrueTest: { enabled: false } } },
        });
        assert.equal(result.passed, true);
        assert.equal(result.findings.length, 0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  describe("blocks trivial assertions & empty test bodies", () => {
    it("blocks expect(true).toBe(true) and assert.strictEqual(1, 1)", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, "tests"), { recursive: true });
        await writeFile(
          path.join(root, "tests", "fake.test.js"),
          "test('fake test', () => {\n  assert.strictEqual(1, 1);\n});\n",
        );
        const result = await noTriviallyTrueTestGuard.check({
          stagedFiles: ["tests/fake.test.js"],
          projectRoot: root,
          config: { version: "1.0", guards: {} },
        });
        assert.equal(result.passed, false);
        assert.equal(result.findings.length, 1);
        assert.equal(result.findings[0].severity, Severity.BLOCK);
        assert.ok(result.findings[0].message.includes("Trivially true assertion"));
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("blocks test block executing code with zero assertions", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, "tests"), { recursive: true });
        await writeFile(
          path.join(root, "tests", "no-assert.test.js"),
          ["test('run without" + " check', () => {", "  const x = Math.random();", "  console.log(x);", "});", ""].join("\n"),
        );
        const result = await noTriviallyTrueTestGuard.check({
          stagedFiles: ["tests/no-assert.test.js"],
          projectRoot: root,
          config: { version: "1.0", guards: {} },
        });
        assert.equal(result.passed, false);
        assert.ok(result.findings.some((f) => f.message.includes("without any assert or expect")));
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  describe("allows real assertions & allowlists", () => {
    it("allows genuine assertion and assert.throws", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, "tests"), { recursive: true });
        await writeFile(
          path.join(root, "tests", "good.test.js"),
          "test('real check', () => {\n  const res = calc(2, 2);\n  assert.strictEqual(res, 4);\n  assert.throws(() => parse('bad'));\n});\n",
        );
        const result = await noTriviallyTrueTestGuard.check({
          stagedFiles: ["tests/good.test.js"],
          projectRoot: root,
          config: { version: "1.0", guards: {} },
        });
        assert.equal(result.passed, true);
        assert.equal(result.findings.length, 0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("blocks assert.ok(true) and expect(1).toBe(1) with warn mode support", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, "tests"), { recursive: true });
        await writeFile(
          path.join(root, "tests", "warn.test.js"),
          ["test('ok true', () => {", "  assert.ok(true);", "});", ""].join("\n"),
        );
        const result = await noTriviallyTrueTestGuard.check({
          stagedFiles: ["tests/warn.test.js"],
          projectRoot: root,
          config: {
            version: "1.0",
            guards: {
              noTriviallyTrueTest: {
                enabled: true,
                severity: "warn",
              },
            },
          },
        });
        assert.equal(result.passed, true);
        assert.equal(result.findings.length, 1);
        assert.equal(result.findings[0].severity, Severity.WARN);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("skips fixtures directory, missing files, and non-test files", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, "tests", "fixtures"), { recursive: true });
        await mkdir(path.join(root, "src"), { recursive: true });
        await writeFile(path.join(root, "tests", "fixtures", "dummy.test.js"), "test('stub', () => {});\n");
        await writeFile(path.join(root, "src", "logic.ts"), "const a = 1 === 1;\n");

        const result = await noTriviallyTrueTestGuard.check({
          stagedFiles: ["tests/fixtures/dummy.test.js", "src/logic.ts", "missing.test.js"],
          projectRoot: root,
          config: {
            version: "1.0",
            guards: {
              noTriviallyTrueTest: {
                enabled: true,
                severity: "warn",
                allowlistPaths: ["dummy.test.js"],
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
});
