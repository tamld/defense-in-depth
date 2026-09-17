/**
 * Subprocess integration tests for `verify --dry-run-dspy` — Issue #15.
 *
 * Spec: GitHub issue #15 acceptance criteria + maintainer plan approval.
 *
 * What this catches that in-process tests cannot:
 *   - argv parsing (`--dry-run-dspy` actually recognised)
 *   - banner is written to stderr (not stdout)
 *   - process.stderr.write semantics (no Node-version timestamp prefix)
 *   - verdict + exit code match the no-flag run (deterministic guards
 *     remain authoritative)
 *   - flag combines correctly with --files
 *   - no DSPy HTTP call is attempted when the flag is set
 *
 * The "no network call" assertion is the central anti-hallucination test:
 * we point the config at a guaranteed-unreachable port and assert that NO
 * "ECONNREFUSED" or "DSPy evaluation failed" warning surfaces — proving
 * callDspy() was never invoked.
 *
 * Mock audit: real fs (os.tmpdir), real subprocess (spawnSync), no network.
 *
 * Executor: Devin-AI
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(REPO_ROOT, "dist", "cli", "index.js");

// Port 1 is reserved/never bound on any common OS, so any attempted connection
// surfaces immediately as ECONNREFUSED. We use this as a "DSPy is unreachable"
// canary: if the process tried to reach DSPy, callDspy() would log
// "DSPy evaluation failed for artifact:<file>: ... ECONNREFUSED ..." to
// stderr. With --dry-run-dspy that warning must NOT appear.
const CLOSED_PORT_ENDPOINT = "http://127.0.0.1:1/evaluate";

const SUBSTANTIVE =
  "This document contains a real paragraph of meaningful content that is well above the default minimum length threshold so the length-based finding does not interfere with the case under test.";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-cli-dry-run-dspy-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function runCli(args, cwd = tmp) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function write(rel, content) {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

/**
 * Config that points DSPy at the closed port AND enables useDspy. Without
 * the flag, the verify run will try to call this endpoint and surface an
 * ECONNREFUSED warning. With the flag, no call is made → no warning.
 */
const DSPY_ENABLED_CLOSED_PORT_CONFIG = [
  "version: '1.0'",
  "guards:",
  "  hollowArtifact:",
  "    enabled: true",
  "    useDspy: true",
  `    dspyEndpoint: '${CLOSED_PORT_ENDPOINT}'`,
  "    dspyTimeoutMs: 500",
  "    extensions: ['.md']",
  "    patterns:",
  "      - 'TODO'",
  "      - 'TBD'",
  "      - 'PLACEHOLDER'",
  "",
].join("\n");

describe("verify --dry-run-dspy — banner output", () => {
  it("writes the banner to stderr (not stdout)", () => {
    write("defense.config.yml", DSPY_ENABLED_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--dry-run-dspy", "--files", "docs/clean.md"]);

    assert.match(
      r.stderr,
      /--dry-run-dspy: DSPy semantic evaluation skipped/,
      `expected banner on stderr; got stderr=${JSON.stringify(r.stderr)}`,
    );
    assert.doesNotMatch(r.stdout, /--dry-run-dspy/, "banner must NOT appear on stdout");
  });

  it("no banner is emitted without the flag", () => {
    // Use defaults (useDspy disabled) so no network call happens; we only
    // care that the banner string is absent from both streams.
    write(
      "defense.config.yml",
      "version: '1.0'\nguards:\n  hollowArtifact:\n    enabled: true\n    patterns: ['TODO']\n",
    );
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--files", "docs/clean.md"]);

    assert.doesNotMatch(r.stderr, /--dry-run-dspy/);
    assert.doesNotMatch(r.stdout, /--dry-run-dspy/);
  });
});

describe("verify --dry-run-dspy — no DSPy network call", () => {
  // Anti-hallucination assertion: with useDspy=true + an unreachable endpoint,
  // a normal verify run would log "DSPy evaluation failed ... ECONNREFUSED".
  // With --dry-run-dspy that log MUST NOT appear, proving callDspy() was
  // never invoked.
  it("substantive doc: ECONNREFUSED warning is absent when flag is set", () => {
    write("defense.config.yml", DSPY_ENABLED_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--dry-run-dspy", "--files", "docs/clean.md"]);

    const combined = `${r.stdout}\n${r.stderr}`;
    assert.doesNotMatch(
      combined,
      /ECONNREFUSED/,
      "no DSPy connection should be attempted when flag is set",
    );
    assert.doesNotMatch(
      combined,
      /DSPy evaluation failed/,
      "callDspy() must not be invoked when flag is set",
    );
  });

  it("control: without the flag, the same config DOES surface a DSPy failure", () => {
    write("defense.config.yml", DSPY_ENABLED_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--files", "docs/clean.md"]);

    const combined = `${r.stdout}\n${r.stderr}`;
    assert.match(
      combined,
      /DSPy evaluation failed|ECONNREFUSED/,
      "without the flag, DSPy IS attempted and the failure is surfaced (this proves the previous test's silence is meaningful)",
    );
  });
});

describe("verify --dry-run-dspy — exit code parity", () => {
  it("clean substantive doc → exit 0 (matches no-flag run)", () => {
    write("defense.config.yml", DSPY_ENABLED_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--dry-run-dspy", "--files", "docs/clean.md"]);

    assert.equal(
      r.status,
      0,
      `expected exit 0 on clean doc; got status=${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`,
    );
  });

  it("hollow artifact → exit 1 (L1 BLOCK fires regardless of flag)", () => {
    write("defense.config.yml", DSPY_ENABLED_CLOSED_PORT_CONFIG);
    write("docs/hollow.md", `${SUBSTANTIVE}\n\nTODO: write the rest`);

    const r = runCli(["verify", "--dry-run-dspy", "--files", "docs/hollow.md"]);

    assert.equal(r.status, 1, "L1 BLOCK must still fire when DSPy is dry-run-disabled");
    assert.match(
      r.stdout,
      /Hollow Artifact/,
      "hollow-artifact guard finding must surface in stdout",
    );
  });
});

describe("verify --dry-run-dspy — flag combinations", () => {
  it("works after --files <paths>", () => {
    write("defense.config.yml", DSPY_ENABLED_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--files", "docs/clean.md", "--dry-run-dspy"]);

    assert.equal(r.status, 0);
    assert.match(r.stderr, /--dry-run-dspy/);
  });

  it("works before --files <paths>", () => {
    write("defense.config.yml", DSPY_ENABLED_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--dry-run-dspy", "--files", "docs/clean.md"]);

    assert.equal(r.status, 0);
    assert.match(r.stderr, /--dry-run-dspy/);
  });
});

describe("--help mentions --dry-run-dspy", () => {
  it("printUsage() includes the flag and a short explanation", () => {
    const r = runCli(["--help"]);

    assert.equal(r.status, 0);
    assert.match(r.stdout, /--dry-run-dspy/, "--help must document the new flag");
    assert.match(r.stdout, /DSPy/, "--help should explain what the flag does");
  });
});
