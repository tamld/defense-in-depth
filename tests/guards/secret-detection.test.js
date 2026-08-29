import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { secretDetectionGuard } from "../../dist/guards/secret-detection.js";
import { Severity } from "../../dist/core/types.js";

describe("secretDetectionGuard", () => {
  function makeTmpRepo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-secret-test-"));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, "utf-8");
    }
    return dir;
  }

  it("passes when disabled in config", async () => {
    const mockAws = "AKI" + "AIOSFODNN7EXAMPLE";
    const dir = makeTmpRepo({
      "src/secret.ts": `const key = "${mockAws}";`,
    });
    try {
      const res = await secretDetectionGuard.check({
        stagedFiles: ["src/secret.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { secretDetection: { enabled: false } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes clean files with no credentials", async () => {
    const dir = makeTmpRepo({
      "src/index.ts": 'export function hello() { return "world"; }',
    });
    try {
      const res = await secretDetectionGuard.check({
        stagedFiles: ["src/index.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { secretDetection: { enabled: true } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks AWS access keys with redacted findings", async () => {
    const mockAws = "AKI" + "AIOSFODNN7EXAMPLE";
    const dir = makeTmpRepo({
      "src/aws.ts": `const awsKey = "${mockAws}";`,
    });
    try {
      const res = await secretDetectionGuard.check({
        stagedFiles: ["src/aws.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { secretDetection: { enabled: true } } },
      });
      assert.equal(res.passed, false);
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.BLOCK);
      assert.ok(res.findings[0].message.includes("Potential credential detected (AWS Access Key ID)"));
      assert.ok(res.findings[0].message.includes("[REDACTED:AKIA...MPLE]"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks private keys", async () => {
    const pemHeader = "-----" + "BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----";
    const dir = makeTmpRepo({
      "certs/server.pem": pemHeader,
    });
    try {
      const res = await secretDetectionGuard.check({
        stagedFiles: ["certs/server.pem"],
        projectRoot: dir,
        config: { version: "1.0", guards: { secretDetection: { enabled: true } } },
      });
      assert.equal(res.passed, false);
      assert.equal(res.findings[0].severity, Severity.BLOCK);
      assert.ok(res.findings[0].message.includes("Private Key"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks GitHub PATs and Stripe keys", async () => {
    const mockGh = "gh" + "p_111122223333444455556666777788889999";
    const mockStripe = "sk_" + "live_51A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6";
    const dir = makeTmpRepo({
      "src/keys.ts": `const gh = "${mockGh}";\nconst stripe = "${mockStripe}";`,
    });
    try {
      const res = await secretDetectionGuard.check({
        stagedFiles: ["src/keys.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { secretDetection: { enabled: true } } },
      });
      assert.equal(res.passed, false);
      assert.equal(res.findings.length, 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns on heuristic generic secret assignments", async () => {
    const mockApiKey = "a1b2c3d4e5f6g7h8i9j0";
    const dir = makeTmpRepo({
      "src/config.ts": `const api_` + `key = "${mockApiKey}";`,
    });
    try {
      const res = await secretDetectionGuard.check({
        stagedFiles: ["src/config.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { secretDetection: { enabled: true } } },
      });
      assert.equal(res.passed, true); // WARN does not block
      assert.equal(res.findings.length, 1);
      assert.equal(res.findings[0].severity, Severity.WARN);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports custom regex patterns and short secret redaction", async () => {
    const dir = makeTmpRepo({
      "src/custom.ts": 'const token = "MYCORP_TOKEN_123456";\nconst short = "pass" + "word=\'1234567\'";',
    });
    try {
      const res = await secretDetectionGuard.check({
        stagedFiles: ["src/custom.ts"],
        projectRoot: dir,
        config: {
          version: "1.0",
          guards: {
            secretDetection: {
              enabled: true,
              customPatterns: ["MYCORP_TOKEN_[0-9A-Z]+"],
            },
          },
        },
      });
      assert.equal(res.passed, false);
      assert.equal(res.findings.length, 1);
      assert.ok(res.findings[0].message.includes("Custom Secret Pattern"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips non-existent staged files gracefully", async () => {
    const dir = makeTmpRepo({});
    try {
      const res = await secretDetectionGuard.check({
        stagedFiles: ["missing.ts"],
        projectRoot: dir,
        config: { version: "1.0", guards: { secretDetection: { enabled: true } } },
      });
      assert.equal(res.passed, true);
      assert.equal(res.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
