import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig, validateConfigSchema } from "../dist/core/config-loader.js";
import { ConfigError } from "../dist/core/errors.js";

describe("Config Schema Runtime Validation", () => {
  function makeTmpRepo(configYaml) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-config-test-"));
    if (configYaml !== undefined) {
      fs.writeFileSync(path.join(dir, "defense.config.yml"), configYaml, "utf-8");
    }
    return dir;
  }

  it("loads valid configuration successfully", () => {
    const dir = makeTmpRepo(`
version: "1.0"
guards:
  hollowArtifact:
    enabled: true
    minContentLength: 40
    patterns: ["EMPTY", "STUB"]
  secretDetection:
    enabled: true
    customPatterns: ["MY_KEY_[0-9]+"]
hints:
  enabled: true
  cooldownDays: 5
  channels: ["doctor"]
`);
    try {
      const cfg = loadConfig(dir);
      assert.equal(cfg.version, "1.0");
      assert.equal(cfg.guards.hollowArtifact.minContentLength, 40);
      assert.equal(cfg.guards.secretDetection.enabled, true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws ConfigError on unknown top-level key", () => {
    const dir = makeTmpRepo(`
version: "1.0"
invalidTopLevel: true
guards:
  hollowArtifact:
    enabled: true
`);
    try {
      assert.throws(
        () => loadConfig(dir),
        (err) => err instanceof ConfigError && err.message.includes('Unknown top-level configuration key "invalidTopLevel"'),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws ConfigError on unknown guard key", () => {
    const dir = makeTmpRepo(`
version: "1.0"
guards:
  unknownGuardName:
    enabled: true
`);
    try {
      assert.throws(
        () => loadConfig(dir),
        (err) => err instanceof ConfigError && err.message.includes('Unknown guard "unknownGuardName"'),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws ConfigError on invalid boolean or enum value", () => {
    const dir = makeTmpRepo(`
version: "1.0"
guards:
  hollowArtifact:
    enabled: "yes" # invalid: must be boolean
`);
    try {
      assert.throws(
        () => loadConfig(dir),
        (err) => err instanceof ConfigError && err.message.includes("guards.hollowArtifact.enabled must be a boolean"),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws ConfigError on invalid severity value", () => {
    const dir = makeTmpRepo(`
version: "1.0"
guards:
  ticketIdentity:
    enabled: true
    severity: "fatal" # invalid: must be warn or block
`);
    try {
      assert.throws(
        () => loadConfig(dir),
        (err) => err instanceof ConfigError && err.message.includes('guards.ticketIdentity.severity must be "warn" or "block"'),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws ConfigError on invalid numeric types or negative bounds", () => {
    const dir = makeTmpRepo(`
version: "1.0"
guards:
  hollowArtifact:
    enabled: true
    minContentLength: -10 # invalid: must be non-negative
`);
    try {
      assert.throws(
        () => loadConfig(dir),
        (err) => err instanceof ConfigError && err.message.includes("must be a non-negative number"),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws ConfigError on invalid string arrays", () => {
    const dir = makeTmpRepo(`
version: "1.0"
guards:
  hollowArtifact:
    enabled: true
    patterns: 12345 # invalid: must be array of strings
`);
    try {
      assert.throws(
        () => loadConfig(dir),
        (err) => err instanceof ConfigError && err.message.includes("must be an array of strings"),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates hints block correctly", () => {
    assert.throws(
      () => validateConfigSchema({ hints: { channels: ["invalid-channel"] } }, "test.yml"),
      (err) => err instanceof ConfigError && err.message.includes("hints.channels"),
    );
  });
});
