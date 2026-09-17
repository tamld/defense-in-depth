/**
 * Typed error hierarchy tests (issue #37).
 *
 * Pins the v1.0 contract:
 *   - DiDError is the base of every public error class.
 *   - .code values are stable strings consumers can branch on.
 *   - GuardCrashError carries .guardId; ProviderError carries .providerName.
 *   - loadConfig() now THROWS a ConfigError on invalid YAML (was: warn + default).
 *   - The engine wraps a crashed guard's error into the BLOCK finding message
 *     while preserving the legacy "Guard crashed:" prefix the existing
 *     contract test (engine.test.js) already pins.
 *
 * Imports go through the published barrel (`dist/index.js`) and through the
 * `./errors` subpath — same surface external consumers will hit.
 *
 * Executor: Devin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  DiDError,
  ConfigError,
  GuardCrashError,
  ProviderError,
  ErrorCodes,
  loadConfig,
  DefendEngine,
  DEFAULT_CONFIG,
  Severity,
} from "../dist/index.js";

function mkProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "did-errors-"));
}

describe("typed errors — class identity & inheritance", () => {
  it("ConfigError instanceof DiDError instanceof Error", () => {
    const e = new ConfigError("bad config");
    assert.ok(e instanceof ConfigError);
    assert.ok(e instanceof DiDError);
    assert.ok(e instanceof Error);
  });

  it("GuardCrashError instanceof DiDError instanceof Error", () => {
    const e = new GuardCrashError("boom", "myGuard");
    assert.ok(e instanceof GuardCrashError);
    assert.ok(e instanceof DiDError);
    assert.ok(e instanceof Error);
  });

  it("ProviderError instanceof DiDError instanceof Error", () => {
    const e = new ProviderError("fail", "file");
    assert.ok(e instanceof ProviderError);
    assert.ok(e instanceof DiDError);
    assert.ok(e instanceof Error);
  });

  it("each subclass sets .name to its own class name (not 'Error')", () => {
    assert.strictEqual(new ConfigError("x").name, "ConfigError");
    assert.strictEqual(new GuardCrashError("x", "g").name, "GuardCrashError");
    assert.strictEqual(new ProviderError("x", "file").name, "ProviderError");
  });
});

describe("typed errors — .code property is stable & matches ErrorCodes", () => {
  it("ConfigError.code === DID_CONFIG_INVALID", () => {
    assert.strictEqual(new ConfigError("x").code, "DID_CONFIG_INVALID");
    assert.strictEqual(new ConfigError("x").code, ErrorCodes.CONFIG_INVALID);
  });

  it("GuardCrashError.code === DID_GUARD_CRASH", () => {
    assert.strictEqual(new GuardCrashError("x", "g").code, "DID_GUARD_CRASH");
    assert.strictEqual(new GuardCrashError("x", "g").code, ErrorCodes.GUARD_CRASH);
  });

  it("ProviderError.code === DID_PROVIDER_FAIL", () => {
    assert.strictEqual(new ProviderError("x", "file").code, "DID_PROVIDER_FAIL");
    assert.strictEqual(new ProviderError("x", "file").code, ErrorCodes.PROVIDER_FAIL);
  });

  it("ErrorCodes table has the documented members and no extras", () => {
    assert.deepStrictEqual(Object.keys(ErrorCodes).sort(), [
      "CONFIG_INVALID",
      "GUARD_CRASH",
      "PROVIDER_FAIL",
    ]);
  });
});

describe("typed errors — context fields", () => {
  it("GuardCrashError carries .guardId", () => {
    const e = new GuardCrashError("crashed", "hollowArtifact");
    assert.strictEqual(e.guardId, "hollowArtifact");
  });

  it("ProviderError carries .providerName", () => {
    const e = new ProviderError("down", "http");
    assert.strictEqual(e.providerName, "http");
  });

  it("ConfigError carries .configPath when supplied", () => {
    const e = new ConfigError("boom", { configPath: "/x/defense.config.yml" });
    assert.strictEqual(e.configPath, "/x/defense.config.yml");
  });

  it(".cause preserves the original error when one is supplied", () => {
    const original = new TypeError("inner");
    const e = new GuardCrashError("outer", "g", original);
    assert.strictEqual(e.cause, original);
  });
});

describe("loadConfig — ConfigError on invalid config (BREAKING vs v0.x)", () => {
  it("throws ConfigError with .code DID_CONFIG_INVALID on YAML parse failure", () => {
    const root = mkProjectRoot();
    fs.writeFileSync(
      path.join(root, "defense.config.yml"),
      "version: 1.0\n  guards:\n    - this is not: valid yaml: at all\n",
      "utf-8",
    );
    assert.throws(
      () => loadConfig(root),
      (err) => {
        assert.ok(err instanceof ConfigError, "must be a ConfigError");
        assert.strictEqual(err.code, "DID_CONFIG_INVALID");
        assert.ok(err.message.includes("defense.config.yml"));
        return true;
      },
    );
  });

  it("throws ConfigError when the YAML root is not a mapping", () => {
    const root = mkProjectRoot();
    fs.writeFileSync(path.join(root, "defense.config.yml"), "- 1\n- 2\n- 3\n", "utf-8");
    assert.throws(
      () => loadConfig(root),
      (err) => err instanceof ConfigError && err.code === "DID_CONFIG_INVALID",
    );
  });

  it("does NOT throw when the config file is missing (zero-config still works)", () => {
    // Pinned by tests/contract/public-api-contract.js — preserved here as a
    // reminder that the breaking change is scoped to *invalid* configs only.
    const root = mkProjectRoot();
    const cfg = loadConfig(root);
    assert.strictEqual(typeof cfg, "object");
    assert.ok(cfg.guards);
  });
});

describe("DefendEngine — GuardCrashError integration", () => {
  it("wraps a crashed guard into a BLOCK finding while preserving the 'Guard crashed:' prefix", async () => {
    // The engine itself doesn't re-throw — it records a BLOCK finding. The
    // typed error is constructed internally; the legacy message prefix
    // (pinned by engine.test.js) is preserved so existing consumers keep
    // working.
    const root = mkProjectRoot();
    const engine = new DefendEngine(root, DEFAULT_CONFIG);
    const crasher = {
      id: "crasher",
      check: async () => {
        throw new TypeError("synthetic crash");
      },
    };
    engine.use(crasher);
    const verdict = await engine.run({ files: [] });

    const result = verdict.results.find((r) => r.guardId === "crasher");
    assert.ok(result, "crasher result must be present");
    assert.strictEqual(result.passed, false);
    const finding = result.findings[0];
    assert.strictEqual(finding.severity, Severity.BLOCK);
    assert.ok(
      finding.message.startsWith("Guard crashed:"),
      "legacy 'Guard crashed:' prefix must be preserved (engine.test.js contract)",
    );
    assert.ok(
      finding.message.includes("synthetic crash"),
      "underlying error message must surface in the finding",
    );
  });
});
