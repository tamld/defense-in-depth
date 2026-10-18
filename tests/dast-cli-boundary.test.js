import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../dist/cli/index.js");

test("Case 1: CLI with '--help' exits with status 0 and prints usage", () => {
  const result = spawnSync("node", [cliPath, "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `Expected exit status 0, got ${result.status}. Stderr: ${result.stderr}`);
  assert.match(
    result.stdout + result.stderr,
    /Usage|Options|Commands|defense-in-depth/i,
    "Expected usage output when called with --help"
  );
});

test("Case 2: CLI in temp directory with malformed defense.config.yml exits cleanly without unhandled crash", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "did-dast-test-"));
  try {
    const configPath = path.join(tempDir, "defense.config.yml");
    writeFileSync(configPath, "invalid: [unclosed", "utf8");

    const result = spawnSync("node", [cliPath, "verify"], {
      cwd: tempDir,
      encoding: "utf8",
    });

    assert.doesNotMatch(
      result.stderr,
      /UnhandledPromiseRejection|FATAL ERROR|unhandledRejection/i,
      "Expected no unhandled exception crash on malformed YAML"
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Case 3: CLI with an unknown subcommand exits with non-zero status", () => {
  const result = spawnSync("node", [cliPath, "nonexistent-cmd-xyz"], {
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0, "Expected non-zero exit status for unknown subcommand");
});
