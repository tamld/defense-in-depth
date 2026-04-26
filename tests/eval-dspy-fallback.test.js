/**
 * Subprocess integration tests for `eval <file>` DSPy-unavailable banner —
 * Issue #19, PR B (deferred from PR A per maintainer Q2 answer).
 *
 * Why subprocess: the banner contract is observable *only* at the stderr
 * stream boundary. process.stderr.write semantics in some Node versions
 * add prefixes or buffering that are only visible end-to-end.
 *
 * Anti-hallucination test design: point the config at port 1 (closed,
 * reserved). Any real HTTP attempt surfaces ECONNREFUSED immediately.
 * The banner must appear EXACTLY ONCE on stderr.
 *
 * Mock audit: real fs (os.tmpdir), real subprocess (spawnSync), no network.
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

// Port 1 is reserved/never bound — see tests/cli-dry-run-dspy.test.js for
// rationale. Any connect attempt surfaces ECONNREFUSED instantly, so
// callDspy() returns null and eval.ts must emit the DSPy-unavailable banner.
const CLOSED_PORT_ENDPOINT = "http://127.0.0.1:1/evaluate";

const SUBSTANTIVE =
  "This document contains a real paragraph of meaningful content that is well above the default minimum length threshold so the length-based finding does not interfere with the case under test.";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-eval-dspy-fallback-"));
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
 * Async variant: used when the test also needs a local stub server running
 * in this process. spawnSync blocks the Node event loop, which prevents the
 * stub server from accepting connections — the subprocess would time out
 * even on localhost. spawn + stream readers let the event loop keep turning.
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

/**
 * eval forces useDspy=true regardless of config, but the endpoint is read
 * from config. We point it at a closed port so callDspy() must return null
 * and the banner must fire.
 */
const DSPY_CLOSED_PORT_CONFIG = [
  "version: '1.0'",
  "guards:",
  "  hollowArtifact:",
  "    enabled: true",
  `    dspyEndpoint: '${CLOSED_PORT_ENDPOINT}'`,
  "    dspyTimeoutMs: 500",
  "    extensions: ['.md']",
  "    patterns:",
  "      - 'TODO'",
  "      - 'TBD'",
  "      - 'PLACEHOLDER'",
  "",
].join("\n");

describe("eval <file> — DSPy-unavailable banner", () => {
  it("emits the banner to stderr when DSPy is unreachable", () => {
    write("defense.config.yml", DSPY_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["eval", "docs/clean.md"]);

    assert.match(
      r.stderr,
      /⚠ {2}DSPy unavailable: semantic evaluation skipped\. Results reflect L1\+L2 only\./,
      `expected banner on stderr; got stderr:\n${r.stderr}`,
    );
  });

  it("does NOT emit the banner on stdout (stdout stays clean for human output)", () => {
    write("defense.config.yml", DSPY_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["eval", "docs/clean.md"]);

    assert.doesNotMatch(
      r.stdout,
      /DSPy unavailable/,
      `banner must not leak into stdout; got stdout:\n${r.stdout}`,
    );
  });

  it("emits the banner exactly once per run", () => {
    write("defense.config.yml", DSPY_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["eval", "docs/clean.md"]);

    const matches = r.stderr.match(/DSPy unavailable: semantic evaluation skipped/g) ?? [];
    assert.equal(
      matches.length,
      1,
      `banner must appear exactly once; stderr:\n${r.stderr}`,
    );
  });

  it("exit code reflects the guard verdict (PASS for substantive content)", () => {
    write("defense.config.yml", DSPY_CLOSED_PORT_CONFIG);
    write("docs/clean.md", SUBSTANTIVE);

    const r = runCli(["eval", "docs/clean.md"]);

    // Banner firing must NOT change exit code — L1+L2 passed, so exit 0.
    assert.equal(
      r.status,
      0,
      `expected exit 0 for clean file; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
  });
});

describe("eval <file> — banner absent when DSPy succeeds (negative control)", () => {
  /**
   * This test is the anti-hallucination pair. Without it, the banner test
   * above would pass even if eval.ts always emitted the banner — we'd have
   * no way to distinguish "banner fires on failure" from "banner always
   * fires". Here we stand up a local DSPy stub that returns a healthy
   * score; the banner must NOT appear.
   */
  it("does NOT emit the banner when DSPy returns a valid score", async () => {
    const { createDspyStub } = await import("./helpers/dspy-stub.js");
    const stub = await createDspyStub({ mode: "score", score: 0.9 });
    try {
      const config = [
        "version: '1.0'",
        "guards:",
        "  hollowArtifact:",
        "    enabled: true",
        `    dspyEndpoint: '${stub.endpoint}'`,
        "    dspyTimeoutMs: 5000",
        "    extensions: ['.md']",
        "    patterns:",
        "      - 'TODO'",
        "      - 'TBD'",
        "      - 'PLACEHOLDER'",
        "",
      ].join("\n");
      write("defense.config.yml", config);
      write("docs/clean.md", SUBSTANTIVE);

      // MUST use async spawn — the stub server lives in this event loop;
      // spawnSync would block it and starve the stub of connections.
      const r = await runCliAsync(["eval", "docs/clean.md"]);

      assert.doesNotMatch(
        r.stderr,
        /DSPy unavailable/,
        `banner must not fire when DSPy succeeded; stderr:\n${r.stderr}`,
      );
      assert.ok(stub.requests.length >= 1, "stub server must have been contacted");
    } finally {
      await stub.close();
    }
  });
});
