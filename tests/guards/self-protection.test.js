import assert from "node:assert/strict";
import { test } from "node:test";
import { selfProtectionGuard } from "../../dist/guards/self-protection.js";
import { Severity } from "../../dist/core/types.js";

test("selfProtectionGuard — contract shape & disabled state", async (t) => {
  assert.equal(selfProtectionGuard.id, "selfProtection");

  await t.test("empty stagedFiles passes with zero findings", async () => {
    const result = await selfProtectionGuard.check({
      stagedFiles: [],
      projectRoot: "/tmp",
      config: { version: "1.0", guards: {} },
    });
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  await t.test("enabled: false skips checks", async () => {
    const result = await selfProtectionGuard.check({
      stagedFiles: ["scripts/check-coverage.mjs"],
      projectRoot: "/tmp",
      config: { version: "1.0", guards: { selfProtection: { enabled: false } } },
    });
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });
});

test("selfProtectionGuard — blocks unauthorized modifications to core governance files", async (t) => {
  await t.test("blocks changes to scripts/check-coverage.mjs without ticket", async () => {
    const result = await selfProtectionGuard.check({
      stagedFiles: ["scripts/check-coverage.mjs"],
      projectRoot: "/tmp",
      config: { version: "1.0", guards: {} },
      commitMessage: "chore: update coverage script",
    });
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, Severity.BLOCK);
    assert.ok(result.findings[0].message.includes("Self-protection violation"));
    assert.ok(result.findings[0].fix);
  });

  await t.test("blocks changes to .gitleaks.toml and .github/workflows/ci.yml without ticket", async () => {
    const result = await selfProtectionGuard.check({
      stagedFiles: [".gitleaks.toml", ".github/workflows/ci.yml"],
      projectRoot: "/tmp",
      config: { version: "1.0", guards: {} },
      commitMessage: "fix: bypass security scan",
    });
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 2);
  });
});

test("selfProtectionGuard — allows changes with authorized ticket or commit ticket reference", async (t) => {
  await t.test("allows change when commit message includes ticket ID (#116 or TK-123)", async () => {
    const result = await selfProtectionGuard.check({
      stagedFiles: ["scripts/check-coverage.mjs"],
      projectRoot: "/tmp",
      config: { version: "1.0", guards: {} },
      commitMessage: "feat(ci): adjust coverage threshold (#116)",
    });
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  await t.test("allows change when ticket context is provided", async () => {
    const result = await selfProtectionGuard.check({
      stagedFiles: ["tsconfig.json"],
      projectRoot: "/tmp",
      config: { version: "1.0", guards: {} },
      ticket: { id: "TK-20260407-001" },
    });
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  await t.test("skips regular source files that are not protected", async () => {
    const result = await selfProtectionGuard.check({
      stagedFiles: ["src/utils.ts", "README.md"],
      projectRoot: "/tmp",
      config: { version: "1.0", guards: {} },
    });
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });
});
