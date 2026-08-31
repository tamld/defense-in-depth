import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { selfProtectionGuard } from "../../dist/guards/self-protection.js";
import { Severity } from "../../dist/core/types.js";

async function makeTmpDir() {
  return mkdtemp(path.join(os.tmpdir(), "did-self-protect-"));
}

describe("selfProtectionGuard", () => {
  describe("contract shape & disabled state", () => {
    it("has id selfProtection", () => {
      assert.equal(selfProtectionGuard.id, "selfProtection");
    });

    it("empty stagedFiles passes with zero findings", async () => {
      const root = await makeTmpDir();
      try {
        const result = await selfProtectionGuard.check({
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
        const result = await selfProtectionGuard.check({
          stagedFiles: ["scripts/check-coverage.mjs"],
          projectRoot: root,
          config: { version: "1.0", guards: { selfProtection: { enabled: false } } },
        });
        assert.equal(result.passed, true);
        assert.equal(result.findings.length, 0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  describe("blocks unauthorized modifications to core governance files", () => {
    it("blocks changes to scripts/check-coverage.mjs without ticket", async () => {
      const root = await makeTmpDir();
      try {
        const result = await selfProtectionGuard.check({
          stagedFiles: ["scripts/check-coverage.mjs"],
          projectRoot: root,
          config: { version: "1.0", guards: {} },
          commitMessage: "chore: update coverage script",
        });
        assert.equal(result.passed, false);
        assert.equal(result.findings.length, 1);
        assert.equal(result.findings[0].severity, Severity.BLOCK);
        assert.ok(result.findings[0].message.includes("Self-protection violation"));
        assert.ok(result.findings[0].fix);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("blocks changes to .gitleaks.toml and .github/workflows/ci.yml without ticket", async () => {
      const root = await makeTmpDir();
      try {
        const result = await selfProtectionGuard.check({
          stagedFiles: [".gitleaks.toml", ".github/workflows/ci.yml"],
          projectRoot: root,
          config: { version: "1.0", guards: {} },
          commitMessage: "fix: bypass security scan",
        });
        assert.equal(result.passed, false);
        assert.equal(result.findings.length, 2);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  describe("allows changes with authorized ticket or commit ticket reference", () => {
    it("allows change when commit message includes ticket ID (#116 or TK-123)", async () => {
      const root = await makeTmpDir();
      try {
        const result = await selfProtectionGuard.check({
          stagedFiles: ["scripts/check-coverage.mjs"],
          projectRoot: root,
          config: { version: "1.0", guards: {} },
          commitMessage: "feat(ci): adjust coverage threshold (#116)",
        });
        assert.equal(result.passed, true);
        assert.equal(result.findings.length, 0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("allows change when ticket context is provided", async () => {
      const root = await makeTmpDir();
      try {
        const result = await selfProtectionGuard.check({
          stagedFiles: ["tsconfig.json"],
          projectRoot: root,
          config: { version: "1.0", guards: {} },
          ticket: { id: "TK-20260407-001" },
        });
        assert.equal(result.passed, true);
        assert.equal(result.findings.length, 0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("skips regular source files that are not protected", async () => {
      const root = await makeTmpDir();
      try {
        const result = await selfProtectionGuard.check({
          stagedFiles: ["src/utils.ts", "README.md"],
          projectRoot: root,
          config: { version: "1.0", guards: {} },
        });
        assert.equal(result.passed, true);
        assert.equal(result.findings.length, 0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
