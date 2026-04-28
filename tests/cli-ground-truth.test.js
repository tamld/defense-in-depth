/**
 * Ground-truth CLI integration tests for defense-in-depth.
 *
 * Spec: tests/fixtures/cli-ground-truth/edge_cases.md
 *
 * Phase 4 of the test-hardening track. Existing tests load the engine in-process;
 * NONE exercise the compiled CLI as a subprocess. This file does that — it
 * spawns `node dist/cli/index.js <cmd>` against isolated temp fixtures and
 * asserts on exit code + stdout/stderr substrings.
 *
 * What this catches that in-process tests miss:
 *   - argv parsing
 *   - exit codes
 *   - YAML config loading + deep-merge with defaults
 *   - guard registration order
 *   - human-readable output formatting
 *
 * Mock audit: real fs, real subprocess. No network (useDspy defaults to false).
 * No git: every test passes --files explicitly so getStagedFiles() is bypassed.
 *
 * Executor: Devin
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

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-cli-gt-"));
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

const SUBSTANTIVE =
  "This document contains a real paragraph of meaningful content well above the default minimum length threshold so length-based findings do not interfere with the pattern checks under test.";

// PINNED bug in DEFAULT_CONFIG (config-loader.ts):
//   patterns: ["TODO", "TBD", "FILL IN HERE", "<Empty>", "[Insert Here]", "PLACEHOLDER"]
// String "[Insert Here]" is interpreted as a regex character class, which makes
// it match almost any prose. Tests that need a clean baseline override the
// patterns list explicitly.
const SAFE_PATTERNS_CONFIG =
  "version: '1.0'\nguards:\n  hollowArtifact:\n    patterns:\n      - 'TODO'\n      - 'TBD'\n      - 'PLACEHOLDER'\n";

describe("CLI ground truth — exit-code matrix", () => {
  it("--version → exit 0 and prints semver", () => {
    const r = runCli(["--version"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /defense-in-depth v\d+\.\d+\.\d+/);
  });

  it("--help → exit 0 and prints the usage banner", () => {
    const r = runCli(["--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage:/);
    assert.match(r.stdout, /\binit\b/);
    assert.match(r.stdout, /\bverify\b/);
    assert.match(r.stdout, /\bdoctor\b/);
  });

  it("no command → exit 0 and prints the usage banner", () => {
    const r = runCli([]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage:/);
  });

  it("unknown command → exit 1 and prints an error to stderr", () => {
    const r = runCli(["this-command-does-not-exist"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown command/);
    assert.match(r.stderr, /this-command-does-not-exist/);
  });
});

describe("CLI ground truth — verify against clean fixtures", () => {
  it("verify on a substantive markdown file (under docs/) → exit 0", () => {
    write("defense.config.yml", SAFE_PATTERNS_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);
    const r = runCli(["verify", "--files", "docs/clean.md"]);
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);
    assert.match(r.stdout, /guards passed/);
  });

  it("verify with phaseGate disabled (default) ignores src/* files", () => {
    write("src/clean.ts", "export const ok = true;\n");
    const r = runCli(["verify", "--files", "src/clean.ts"]);
    assert.equal(r.status, 0);
  });
});

describe("CLI ground truth — verify catches each guard category", () => {
  it("hollow markdown → exit 1, mentions Hollow Artifact Detector", () => {
    write("defense.config.yml", SAFE_PATTERNS_CONFIG);
    write("docs/hollow.md", `${SUBSTANTIVE}\n\nTODO: write this`);
    const r = runCli(["verify", "--files", "docs/hollow.md"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Hollow Artifact Detector/);
  });

  it("file under .agents/ → exit 1, mentions SSOT pollution", () => {
    write("defense.config.yml", SAFE_PATTERNS_CONFIG);
    write(".agents/rule-x.md", SUBSTANTIVE);
    const r = runCli(["verify", "--files", ".agents/rule-x.md"]);
    assert.equal(r.status, 1);
    // Match the human-readable label without locking to exact wording
    assert.match(r.stdout, /SSOT|ssotPollution|protected/i);
  });

  it("non-allow-listed root file → exit 1, mentions root pollution", () => {
    write("defense.config.yml", SAFE_PATTERNS_CONFIG);
    write("custom-root-file.txt", SUBSTANTIVE);
    const r = runCli(["verify", "--files", "custom-root-file.txt"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Root|root.*pollut|allowed/i);
  });

  it("combined offenders → exit 1, surfaces multiple guards", () => {
    write("defense.config.yml", SAFE_PATTERNS_CONFIG);
    write("docs/hollow.md", `${SUBSTANTIVE}\n\nTODO: write this`);
    write(".agents/rule-x.md", SUBSTANTIVE);
    const r = runCli([
      "verify",
      "--files",
      "docs/hollow.md",
      ".agents/rule-x.md",
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Hollow/);
    assert.match(r.stdout, /SSOT|ssotPollution|protected/i);
  });
});

describe("CLI ground truth — custom defense.config.yml", () => {
  it("custom minContentLength suppresses what defaults would warn on", () => {
    write(
      "defense.config.yml",
      "version: '1.0'\nguards:\n  hollowArtifact:\n    minContentLength: 5\n    patterns:\n      - 'TODO'\n      - 'TBD'\n",
    );
    write("docs/short.md", "# Title\n\nMm.uu"); // post-strip: 5 chars
    const r = runCli(["verify", "--files", "docs/short.md"]);
    assert.equal(
      r.status,
      0,
      `stdout=${r.stdout}\nstderr=${r.stderr}`,
    );
  });

  it("disabling hollowArtifact lets a TODO-only file through", () => {
    write(
      "defense.config.yml",
      "version: '1.0'\nguards:\n  hollowArtifact:\n    enabled: false\n",
    );
    write("docs/hollow.md", `${SUBSTANTIVE}\n\nTODO: tomorrow`);
    const r = runCli(["verify", "--files", "docs/hollow.md"]);
    assert.equal(r.status, 0);
  });

  it("enabling phaseGate without a plan file → exit 1", () => {
    write(
      "defense.config.yml",
      "version: '1.0'\nguards:\n  phaseGate:\n    enabled: true\n    planFile: implementation_plan.md\n    sourcePatterns:\n      - 'src/**'\n",
    );
    write("src/x.ts", "export const x = 1;\n");
    const r = runCli(["verify", "--files", "src/x.ts"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Phase|phaseGate|plan/i);
  });
});

describe("CLI ground truth — argv-edge handling", () => {
  it("verify with no --files and no staged files → exit 0 and prints helpful tip", () => {
    const r = runCli(["verify"]);
    // No staged files in a tempdir not under git → friendly message, exit 0
    assert.equal(r.status, 0);
    assert.match(r.stdout, /No staged files|Nothing to verify/i);
  });

  it("verify --files <missing-file in docs/> → guards silently skip → exit 0", () => {
    write("defense.config.yml", SAFE_PATTERNS_CONFIG);
    const r = runCli(["verify", "--files", "docs/ghost.md"]);
    assert.equal(
      r.status,
      0,
      `stdout=${r.stdout}\nstderr=${r.stderr}`,
    );
  });
});

describe("CLI ground truth — doctor command", () => {
  it("doctor in a bare fixture → exit 0 and prints a health report", () => {
    const r = runCli(["doctor"]);
    assert.equal(r.status, 0);
    // The doctor banner / header should be present regardless of warnings
    assert.match(r.stdout, /doctor|Health|Doctor/i);
  });
});

describe("CLI ground truth — default hollowArtifact patterns are literal substrings (issue #59)", () => {
  // src/core/config-loader.ts ships
  //   patterns: ["TODO", "TBD", "FILL IN HERE", "<Empty>", "[Insert Here]", "PLACEHOLDER"]
  // and src/guards/hollow-artifact.ts now escapes each entry before compiling with
  // `new RegExp(escapeRegExp(p), "i")`. The previous behavior — `[Insert Here]`
  // compiling into a character class that matched any letter `I/n/s/e/r/t/space/H`
  // and false-positiving on common English text — is fixed.
  //
  // This test is the regression target: substantive prose under the shipped default
  // config must NOT trigger any hollow-pattern BLOCK, and the literal placeholder
  // string MUST still trigger one.
  it("substantive prose under default config does NOT trigger any hollow pattern", () => {
    // No defense.config.yml → loadConfig returns DEFAULT_CONFIG.
    write("docs/innocent.md", SUBSTANTIVE);
    const r = runCli(["verify", "--files", "docs/innocent.md"]);
    assert.equal(
      r.status,
      0,
      `Default patterns must not match clean prose. stdout=${r.stdout}\nstderr=${r.stderr}`,
    );
    assert.doesNotMatch(r.stdout, /Hollow content detected/);
  });

  it("the literal placeholder string still triggers a BLOCK under default config", () => {
    write("docs/with-placeholder.md", `${SUBSTANTIVE}\n\nValue: [Insert Here] for owner.`);
    const r = runCli(["verify", "--files", "docs/with-placeholder.md"]);
    assert.equal(
      r.status,
      1,
      `Literal placeholder must still BLOCK. stdout=${r.stdout}\nstderr=${r.stderr}`,
    );
    assert.match(r.stdout, /Hollow content detected/);
  });
});
