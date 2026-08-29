import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileSizeLimitGuard } from "../../dist/guards/file-size-limit.js";
import { Severity } from "../../dist/core/types.js";

describe("fileSizeLimitGuard", () => {
  function makeTmpRepo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-size-test-"));
    for (const [rel, sizeOrContent] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      if (typeof sizeOrContent === "number") {
        const buf = Buffer.alloc(sizeOrContent, "a");
        fs.writeFileSync(full, buf);
      } else {
        fs.writeFileSync(full, sizeOrContent, "utf-8");
      }
    }
    return dir;
  }

  it("passes when disabled in config", async () => {
    const dir = makeTmpRepo({
      "big.bin": 2 * 1024 * 1024,
    });
    try {
      const res = await fileSizeLimitGuard.check({
        stagedFiles: ["big.bin"],
        projectRoot: dir,
        config: { version: "1.0", guards: { fileSizeLimit: { enabled: false } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes files under the 1MB default threshold", async () => {
    const dir = makeTmpRepo({
      "normal.ts": "console.log('hello world');",
    });
    try {
      const res = await fileSizeLimitGuard.check({
        stagedFiles: ["normal.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { fileSizeLimit: { enabled: true } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks files exceeding default 1MB threshold", async () => {
    const dir = makeTmpRepo({
      "large.dump": 1.5 * 1024 * 1024,
    });
    try {
      const res = await fileSizeLimitGuard.check({
        stagedFiles: ["large.dump"],
        projectRoot: dir,
        config: { version: "1.0", guards: { fileSizeLimit: { enabled: true } } },
      });
      assert.equal(res.passed, false);
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.BLOCK);
      assert.ok(res.findings[0].message.includes("1.50 MB"));
      assert.ok(res.findings[0].fix.includes("Git LFS"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports severity warn and byte formatting below 1024 bytes", async () => {
    const dir = makeTmpRepo({
      "tiny.bin": 500,
    });
    try {
      const res = await fileSizeLimitGuard.check({
        stagedFiles: ["tiny.bin"],
        projectRoot: dir,
        config: {
          version: "1.0",
          guards: {
            fileSizeLimit: {
              enabled: true,
              maxSizeBytes: 100,
              severity: "warn",
            },
          },
        },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.WARN);
      assert.ok(res.findings[0].message.includes("500 B"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("honors custom maxSizeBytes and ignoredExtensions", async () => {
    const dir = makeTmpRepo({
      "small_video.mp4": 500 * 1024,
      "small_code.ts": 500 * 1024,
    });
    try {
      const res = await fileSizeLimitGuard.check({
        stagedFiles: ["small_video.mp4", "small_code.ts"],
        projectRoot: dir,
        config: {
          version: "1.0",
          guards: {
            fileSizeLimit: {
              enabled: true,
              maxSizeBytes: 200 * 1024, // 200 KB
              ignoredExtensions: [".mp4"],
            },
          },
        },
      });
      assert.equal(res.passed, false);
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].filePath, "small_code.ts");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips non-existent files gracefully", async () => {
    const dir = makeTmpRepo({});
    try {
      const res = await fileSizeLimitGuard.check({
        stagedFiles: ["missing.bin"],
        projectRoot: dir,
        config: { version: "1.0", guards: { fileSizeLimit: { enabled: true } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
