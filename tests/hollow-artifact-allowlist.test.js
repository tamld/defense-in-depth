import test from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { hollowArtifactGuard } from "../dist/guards/hollow-artifact.js";
import { Severity } from "../dist/core/types.js";

function createTempWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-test-allowlist-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test("Hollow Artifact Guard - allowlistPaths", async (t) => {
  await t.test("file containing TODO is flagged when not allowlisted", async () => {
    const { dir, cleanup } = createTempWorkspace();
    try {
      const relPath = "docs/guide.md";
      const fullPath = path.join(dir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(
        fullPath,
        "# Guide\n\nTODO: write documentation here with plenty of extra words to exceed the minimum content length threshold easily.",
      );

      const ctx = {
        projectRoot: dir,
        stagedFiles: [relPath],
        config: {
          guards: {
            hollowArtifact: {
              enabled: true,
              allowlistPaths: [],
            },
          },
        },
      };

      const result = await hollowArtifactGuard.check(ctx);
      assert.strictEqual(result.passed, false, "Should fail when file is not allowlisted");
      assert.strictEqual(result.findings.length, 1);
      assert.strictEqual(result.findings[0].filePath, relPath);
      assert.strictEqual(result.findings[0].severity, Severity.BLOCK);
      assert.ok(result.findings[0].message.includes("TODO"));
    } finally {
      cleanup();
    }
  });

  await t.test("same file passes when its path matches an allowlistPaths substring", async () => {
    const { dir, cleanup } = createTempWorkspace();
    try {
      const relPath = "docs/guide.md";
      const fullPath = path.join(dir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(
        fullPath,
        "# Guide\n\nTODO: write documentation here with plenty of extra words to exceed the minimum content length threshold easily.",
      );

      const ctx = {
        projectRoot: dir,
        stagedFiles: [relPath],
        config: {
          guards: {
            hollowArtifact: {
              enabled: true,
              allowlistPaths: ["docs/"],
            },
          },
        },
      };

      const result = await hollowArtifactGuard.check(ctx);
      assert.strictEqual(
        result.passed,
        true,
        "Should pass when file path matches allowlistPaths substring",
      );
      assert.strictEqual(result.findings.length, 0);
    } finally {
      cleanup();
    }
  });

  await t.test("a non-matching allowlist entry does not suppress the finding", async () => {
    const { dir, cleanup } = createTempWorkspace();
    try {
      const relPath = "docs/guide.md";
      const fullPath = path.join(dir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(
        fullPath,
        "# Guide\n\nTODO: write documentation here with plenty of extra words to exceed the minimum content length threshold easily.",
      );

      const ctx = {
        projectRoot: dir,
        stagedFiles: [relPath],
        config: {
          guards: {
            hollowArtifact: {
              enabled: true,
              allowlistPaths: ["other/", "AGENTS.md"],
            },
          },
        },
      };

      const result = await hollowArtifactGuard.check(ctx);
      assert.strictEqual(
        result.passed,
        false,
        "Should fail when allowlist does not match file path",
      );
      assert.strictEqual(result.findings.length, 1);
      assert.strictEqual(result.findings[0].filePath, relPath);
      assert.strictEqual(result.findings[0].severity, Severity.BLOCK);
      assert.ok(result.findings[0].message.includes("TODO"));
    } finally {
      cleanup();
    }
  });
});
