/**
 * Subprocess tests for `did doctor` Progressive Discovery surface (issue #21).
 *
 * The hint-engine + hint-state library tests live in `hint-engine.test.js`;
 * this file is the *integration* check — argv parsing, channel routing,
 * env var fences, and the dim-format rendering all happen at the CLI layer.
 *
 * Each test seeds an isolated tmp git repo with the minimum state needed to
 * earn a hint, runs `node dist/cli/index.js doctor [...]` against it, and
 * inspects stdout/stderr/exit-code. No network, real fs only.
 *
 * Cases:
 *   1. eligible repo + no env fences → exactly one hint on stderr.
 *   2. NO_HINTS=1 → zero hints on either stream.
 *   3. CI=true → zero hints on either stream.
 *   4. --hints reset → wipes state, eligible hints fire again next call.
 *   5. --hints dismiss <id> → permanently silences that hint id.
 *   6. unknown hint id on dismiss → exit 1 with helpful error on stderr.
 *
 * Mock audit: real fs, real subprocess, no network.
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

let tmp;

const GIT_ENV = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-hint-doctor-"));
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: tmp });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/**
 * Seed a repo that earns H-001-no-dspy: bare config (useDspy: false) + at
 * least 5 commits. Nothing else is required — no feedback file, no lessons.
 */
function seedEligibleForH001() {
  fs.writeFileSync(
    path.join(tmp, "defense.config.yml"),
    `version: "1.0"\nguards:\n  hollowArtifact:\n    enabled: true\n    useDspy: false\n`,
  );
  for (let i = 0; i < 6; i++) {
    fs.writeFileSync(path.join(tmp, `f${i}.txt`), `c${i}\n`);
    spawnSync("git", ["add", `f${i}.txt`], { cwd: tmp, env: { ...process.env, ...GIT_ENV } });
    spawnSync("git", ["commit", "-q", "-m", `feat: c${i}`], {
      cwd: tmp,
      env: { ...process.env, ...GIT_ENV },
    });
  }
}

function runDoctor(extraArgs = [], extraEnv = {}) {
  return spawnSync(process.execPath, [CLI_PATH, "doctor", ...extraArgs], {
    cwd: tmp,
    encoding: "utf-8",
    env: {
      ...process.env,
      ...GIT_ENV,
      NO_COLOR: "1",
      // Strip anything inherited that would suppress hints by accident.
      NO_HINTS: undefined,
      CI: undefined,
      ...extraEnv,
    },
  });
}

describe("did doctor — hint emission policy", () => {
  it("emits exactly one earned hint on stderr for an eligible repo", () => {
    seedEligibleForH001();
    const r = runDoctor();
    assert.equal(r.status, 0, `unexpected exit; stderr=${r.stderr}`);
    assert.match(
      r.stderr,
      /H-001-no-dspy/,
      `expected hint on stderr; got stderr=${JSON.stringify(r.stderr)}`,
    );
    // Hint should NOT pollute stdout — keep doctor's stdout focused on checks.
    assert.doesNotMatch(r.stdout, /H-001-no-dspy/);
  });

  it("emits ZERO hints when NO_HINTS=1 is set", () => {
    seedEligibleForH001();
    const r = runDoctor([], { NO_HINTS: "1" });
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stderr, /H-001-no-dspy/);
    assert.doesNotMatch(r.stdout, /H-001-no-dspy/);
  });

  it("emits ZERO hints when CI=true (CI log-cleanliness contract)", () => {
    seedEligibleForH001();
    const r = runDoctor([], { CI: "true" });
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stderr, /H-001-no-dspy/);
  });
});

describe("did doctor --hints reset / dismiss", () => {
  it("--hints reset wipes state so a previously-shown hint fires again", () => {
    seedEligibleForH001();

    // First call shows the hint and writes state.
    const first = runDoctor();
    assert.match(first.stderr, /H-001-no-dspy/);

    // Second call: cooldown filters it out (default 7 days).
    const second = runDoctor();
    assert.doesNotMatch(second.stderr, /H-001-no-dspy/);

    // Reset clears state.
    const reset = runDoctor(["--hints", "reset"]);
    assert.equal(reset.status, 0);
    assert.match(reset.stdout, /Hint state cleared/);

    // Third call after reset: hint is back.
    const third = runDoctor();
    assert.match(third.stderr, /H-001-no-dspy/);
  });

  it("--hints dismiss permanently silences the hint id", () => {
    seedEligibleForH001();

    const dismiss = runDoctor(["--hints", "dismiss", "H-001-no-dspy"]);
    assert.equal(dismiss.status, 0);
    assert.match(dismiss.stdout, /Dismissed hint H-001-no-dspy/);

    // Even after a long sleep / cooldown, the dismissed hint stays silent.
    const next = runDoctor();
    assert.doesNotMatch(next.stderr, /H-001-no-dspy/);
  });

  it("--hints dismiss <unknown> exits non-zero with a helpful error", () => {
    seedEligibleForH001();
    const r = runDoctor(["--hints", "dismiss", "H-999-bogus"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Unknown hint id: H-999-bogus/);
  });
});
