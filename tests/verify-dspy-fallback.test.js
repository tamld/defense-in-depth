/**
 * Subprocess integration tests for `verify` DSPy-unavailable banner —
 * Issue #24 Site #2.
 *
 * Background: PR #20 closed two of four silent-degradation sites. The
 * post-merge audit identified that the default `verify` flow with
 * `useDspy: true` and DSPy down still produced zero stderr signal — the
 * hollow-artifact guard's Check 4 has no else branch for null dspyEval,
 * so the run exits clean and the user never learns L3 was skipped.
 *
 * Post-fix behavior: after engine.run(), verify inspects
 * verdict.semanticEvals.dspy. If useDspy was on AND any precomputed eval
 * is null, verify writes a single banner to stderr — same wording as the
 * `eval` banner from PR #20 for predictability.
 *
 * Why subprocess: the contract is observable only at the CLI's actual
 * stderr stream. Mirrors tests/eval-dspy-fallback.test.js shape.
 *
 * Mock audit: real fs (os.tmpdir), real subprocess (spawnSync / spawn),
 * no network. Closed port 1 forces ECONNREFUSED for the positive case;
 * a local stub on an ephemeral port covers the happy-path negative
 * control.
 *
 * Executor: Devin-AI
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(REPO_ROOT, "dist", "cli", "index.js");

// Port 1 is reserved/never bound — connect attempts surface ECONNREFUSED
// instantly. Same rationale as tests/eval-dspy-fallback.test.js.
const CLOSED_PORT_ENDPOINT = "http://127.0.0.1:1/evaluate";

const SUBSTANTIVE =
  "This document contains a real paragraph of meaningful content that is well above the default minimum length threshold so the length-based finding does not interfere with the case under test.";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-verify-dspy-fallback-"));
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

/**
 * Async variant — required when tests run a stub HTTP server inside this
 * Node process. spawnSync would block the event loop and starve the stub
 * of connections; the subprocess would hang. spawn + stream readers keep
 * the loop turning so the stub can accept connections.
 */
function runCliAsync(args, cwd = tmp) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function write(rel, content) {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const DSPY_CLOSED_PORT_CONFIG = [
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
  "  rootPollution:",
  "    enabled: false",
  "",
].join("\n");

const DSPY_OFF_CONFIG = [
  "version: '1.0'",
  "guards:",
  "  hollowArtifact:",
  "    enabled: true",
  "    useDspy: false",
  "    extensions: ['.md']",
  "    patterns:",
  "      - 'TODO'",
  "      - 'TBD'",
  "      - 'PLACEHOLDER'",
  "  rootPollution:",
  "    enabled: false",
  "",
].join("\n");

describe("verify — DSPy-unavailable banner (Site #2)", () => {
  it("emits the banner to stderr when useDspy=true and DSPy is unreachable", () => {
    write("defense.config.yml", DSPY_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--files", "docs/clean.md"]);

    assert.match(
      r.stderr,
      /⚠ {2}DSPy unavailable: semantic evaluation skipped\. Results reflect L1\+L2 only\./,
      `expected banner on stderr; got stderr:\n${r.stderr}`,
    );
  });

  it("does NOT emit the banner on stdout (stdout stays human-readable)", () => {
    write("defense.config.yml", DSPY_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--files", "docs/clean.md"]);

    assert.doesNotMatch(
      r.stdout,
      /DSPy unavailable: semantic evaluation skipped/,
      `banner must not leak into stdout; got stdout:\n${r.stdout}`,
    );
  });

  it("emits the banner exactly once per run", () => {
    write("defense.config.yml", DSPY_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);
    write("docs/clean2.md", SUBSTANTIVE);

    // Even with multiple staged files all returning null DSPy evals, the
    // banner should fire ONCE — not once-per-file. Single signal per run
    // matches the eval.ts contract and avoids stderr noise in CI logs.
    const r = runCli(["verify", "--files", "docs/clean.md", "docs/clean2.md"]);

    const matches =
      r.stderr.match(/DSPy unavailable: semantic evaluation skipped/g) ?? [];
    assert.equal(
      matches.length,
      1,
      `banner must appear exactly once per run; stderr:\n${r.stderr}`,
    );
  });
});

describe("verify — banner is silent when DSPy is off (negative control 1)", () => {
  it("does NOT emit the banner when useDspy=false", () => {
    write("defense.config.yml", DSPY_OFF_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--files", "docs/clean.md"]);

    // Without this assertion the positive test above would still pass
    // even if verify always emitted the banner. This pair is the
    // adversarial negative control proving the banner is gated on
    // `useDspy && dspyEval === null`.
    assert.doesNotMatch(
      r.stderr,
      /DSPy unavailable: semantic evaluation skipped/,
      `banner must not fire when useDspy=false; stderr:\n${r.stderr}`,
    );
  });
});

describe("verify --dry-run-dspy — distinct WARN remains intact (regression guard)", () => {
  it("keeps the --dry-run-dspy banner and does NOT add the unavailable banner", () => {
    write("defense.config.yml", DSPY_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["verify", "--dry-run-dspy", "--files", "docs/clean.md"]);

    // --dry-run-dspy forces useDspy=false at config-load time, so the
    // dry-run banner must fire (already shipped in PR #18) but the
    // new unavailable banner must NOT fire — the user explicitly asked
    // for L1+L2 only, this is not a degradation event.
    assert.match(
      r.stderr,
      /⚠ {2}--dry-run-dspy: DSPy semantic evaluation skipped/,
      "the existing --dry-run-dspy banner must still fire",
    );
    assert.doesNotMatch(
      r.stderr,
      /⚠ {2}DSPy unavailable: semantic evaluation skipped\. Results reflect L1\+L2 only\./,
      `unavailable banner must NOT fire under --dry-run-dspy; stderr:\n${r.stderr}`,
    );
  });
});

describe("verify — banner is silent when DSPy returns valid scores (negative control 2)", () => {
  it("does NOT emit the banner when DSPy stub returns healthy scores", async () => {
    const { createDspyStub } = await import("./helpers/dspy-stub.js");
    const stub = await createDspyStub({ mode: "score", score: 0.9 });
    try {
      const config = [
        "version: '1.0'",
        "guards:",
        "  hollowArtifact:",
        "    enabled: true",
        "    useDspy: true",
        `    dspyEndpoint: '${stub.endpoint}'`,
        "    dspyTimeoutMs: 5000",
        "    extensions: ['.md']",
        "    patterns:",
        "      - 'TODO'",
        "      - 'TBD'",
        "      - 'PLACEHOLDER'",
        "  rootPollution:",
        "    enabled: false",
        "",
      ].join("\n");
      write("defense.config.yml", config);
      write("docs/clean.md", SUBSTANTIVE);

      const r = await runCliAsync(["verify", "--files", "docs/clean.md"]);

      assert.doesNotMatch(
        r.stderr,
        /DSPy unavailable: semantic evaluation skipped/,
        `banner must not fire when DSPy succeeded; stderr:\n${r.stderr}`,
      );
      assert.ok(stub.requests.length >= 1, "stub server must have been contacted");
    } finally {
      await stub.close();
    }
  });
});
