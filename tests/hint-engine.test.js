/**
 * Hint engine tests (issue #21 Progressive Discovery).
 *
 * Drives the compiled core/hint-engine.js + core/hint-state.js as a library
 * against an isolated tmp dir. Covers:
 *   - H-001-no-dspy fires when config has no DSPy AND repo has ≥5 commits
 *   - H-002-no-lessons fires when lessons empty AND TP/FP feedback in 30d
 *   - H-003-no-feedback fires when feedback < 5 AND repo has ≥10 commits
 *   - H-004-no-federation fires when CHANGELOG/docs exist + ≥2 contributors
 *   - cold-start repos see 0 hints (anti-nag — no earned signal)
 *   - cooldown filters out hints shown within `cooldownDays`
 *   - permanent dismiss is forever, even outside the cooldown window
 *   - state file survives a corrupt JSON without breaking the engine
 *
 * Mock audit: real fs, real git plumbing, no network. The fixture builds a
 * minimal git repo per test and seeds files directly.
 *
 * Executor: Devin-AI
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

// Dynamic import requires a file:// URL on Windows (CI runs on win-latest);
// path.join produces "D:\\...\\hint-engine.js" which Node refuses with
// ERR_UNSUPPORTED_ESM_URL_SCHEME (protocol 'd:'). pathToFileURL normalises
// this on every platform.
const {
  evaluateHints,
  listAllHints,
  DEFAULT_COOLDOWN_DAYS,
} = await import(
  pathToFileURL(path.join(REPO_ROOT, "dist", "core", "hint-engine.js")).href
);
const {
  loadHintState,
  recordHintShown,
  dismissHint,
  resetHintState,
  hintStatePath,
} = await import(
  pathToFileURL(path.join(REPO_ROOT, "dist", "core", "hint-state.js")).href
);

let tmp;

const GIT_ENV = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-hint-"));
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: tmp });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Author N commits in the tmp repo, optionally with distinct authors. */
function commitN(n, { authors } = {}) {
  for (let i = 0; i < n; i++) {
    const file = path.join(tmp, `f${i}.txt`);
    fs.writeFileSync(file, `content-${i}\n`);
    spawnSync("git", ["add", `f${i}.txt`], { cwd: tmp, env: { ...process.env, ...GIT_ENV } });
    const author = authors ? authors[i % authors.length] : null;
    const args = ["-c", `user.name=${author?.name ?? "test"}`, "-c", `user.email=${author?.email ?? "test@example.com"}`,
      "commit", "-q", "-m", `feat: c${i}`];
    spawnSync("git", args, {
      cwd: tmp,
      env: {
        ...process.env,
        ...GIT_ENV,
        GIT_AUTHOR_NAME: author?.name ?? "test",
        GIT_AUTHOR_EMAIL: author?.email ?? "test@example.com",
        GIT_COMMITTER_NAME: author?.name ?? "test",
        GIT_COMMITTER_EMAIL: author?.email ?? "test@example.com",
      },
    });
  }
}

/** Write a minimal config without dspy + without federation. */
function writeBareConfig() {
  fs.writeFileSync(
    path.join(tmp, "defense.config.yml"),
    `version: "1.0"\nguards:\n  hollowArtifact:\n    enabled: true\n    useDspy: false\n`,
  );
}

/** Write a config that explicitly opts into DSPy + sets dspyEndpoint. */
function writeDspyConfig() {
  fs.writeFileSync(
    path.join(tmp, "defense.config.yml"),
    [
      `version: "1.0"`,
      `guards:`,
      `  hollowArtifact:`,
      `    enabled: true`,
      `    useDspy: true`,
      `    dspyEndpoint: "http://localhost:8080/evaluate"`,
    ].join("\n"),
  );
}

/** Write a config that sets a federation block. */
function writeFederationConfig() {
  fs.writeFileSync(
    path.join(tmp, "defense.config.yml"),
    [
      `version: "1.0"`,
      `guards:`,
      `  federation:`,
      `    enabled: true`,
      `    parentRepoUrl: "https://example.com/parent.git"`,
    ].join("\n"),
  );
}

/** Write a feedback event to .agents/records/feedback.jsonl. */
function appendFeedback(label, daysAgo = 0) {
  const dir = path.join(tmp, ".agents/records");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "feedback.jsonl");
  const ts = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const event = {
    id: `id-${label}-${daysAgo}-${Math.random().toString(36).slice(2, 8)}`,
    guardId: "hollowArtifact",
    ticketId: "",
    findingHash: "abc123",
    label,
    source: "cli",
    timestamp: ts,
    executor: "human",
  };
  fs.appendFileSync(file, JSON.stringify(event) + "\n");
}

describe("hint catalog — listAllHints", () => {
  it("exposes the four v1 hints in priority order", () => {
    const ids = listAllHints().map((h) => h.id);
    assert.deepEqual(ids, [
      "H-001-no-dspy",
      "H-002-no-lessons",
      "H-003-no-feedback",
      "H-004-no-federation",
    ]);
  });
});

describe("evaluateHints — H-001-no-dspy", () => {
  it("fires when config lacks DSPy AND repo has ≥5 commits", () => {
    writeBareConfig();
    commitN(6);
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.ok(hints.some((h) => h.id === "H-001-no-dspy"), JSON.stringify(hints));
  });

  it("does not fire when config explicitly enables DSPy", () => {
    writeDspyConfig();
    commitN(6);
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.equal(hints.find((h) => h.id === "H-001-no-dspy"), undefined);
  });

  it("does not fire on a fresh repo with <5 commits", () => {
    writeBareConfig();
    commitN(2);
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.equal(hints.find((h) => h.id === "H-001-no-dspy"), undefined);
  });
});

describe("evaluateHints — H-002-no-lessons", () => {
  it("fires when lessons.jsonl missing AND a TP feedback exists in last 30d", () => {
    writeBareConfig();
    commitN(6);
    appendFeedback("TP", 5);
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.ok(hints.some((h) => h.id === "H-002-no-lessons"));
  });

  it("does not fire when no recent block exists", () => {
    writeBareConfig();
    commitN(6);
    appendFeedback("TP", 60); // older than 30d
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.equal(hints.find((h) => h.id === "H-002-no-lessons"), undefined);
  });

  it("does not fire when lessons.jsonl already has entries", () => {
    writeBareConfig();
    commitN(6);
    appendFeedback("TP", 1);
    fs.writeFileSync(
      path.join(tmp, "lessons.jsonl"),
      JSON.stringify({ id: "lesson-1" }) + "\n",
    );
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.equal(hints.find((h) => h.id === "H-002-no-lessons"), undefined);
  });
});

describe("evaluateHints — H-003-no-feedback", () => {
  it("fires when feedback < 5 AND ≥10 commits", () => {
    writeBareConfig();
    commitN(11);
    appendFeedback("TP", 1);
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.ok(hints.some((h) => h.id === "H-003-no-feedback"));
  });

  it("does not fire when feedback already has ≥5 entries", () => {
    writeBareConfig();
    commitN(11);
    for (let i = 0; i < 6; i++) appendFeedback("TP", i + 1);
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.equal(hints.find((h) => h.id === "H-003-no-feedback"), undefined);
  });
});

describe("evaluateHints — H-004-no-federation", () => {
  it("fires when CHANGELOG.md exists AND ≥2 contributors AND no federation config", () => {
    writeBareConfig();
    commitN(2, {
      authors: [
        { name: "alice", email: "alice@example.com" },
        { name: "bob", email: "bob@example.com" },
      ],
    });
    fs.writeFileSync(path.join(tmp, "CHANGELOG.md"), "# changelog\n");
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.ok(hints.some((h) => h.id === "H-004-no-federation"));
  });

  it("does not fire when federation is already configured", () => {
    writeFederationConfig();
    commitN(2, {
      authors: [
        { name: "alice", email: "alice@example.com" },
        { name: "bob", email: "bob@example.com" },
      ],
    });
    fs.writeFileSync(path.join(tmp, "CHANGELOG.md"), "# changelog\n");
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.equal(hints.find((h) => h.id === "H-004-no-federation"), undefined);
  });

  it("does not fire on a solo repo (1 contributor only)", () => {
    writeBareConfig();
    commitN(2);
    fs.writeFileSync(path.join(tmp, "CHANGELOG.md"), "# changelog\n");
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.equal(hints.find((h) => h.id === "H-004-no-federation"), undefined);
  });
});

describe("evaluateHints — cooldown + dismissal", () => {
  it("filters out a hint shown within the cooldown window", () => {
    writeBareConfig();
    commitN(6);
    recordHintShown(tmp, "H-001-no-dspy");
    const hints = evaluateHints({
      projectRoot: tmp,
      state: loadHintState(tmp),
      cooldownDays: DEFAULT_COOLDOWN_DAYS,
    });
    assert.equal(hints.find((h) => h.id === "H-001-no-dspy"), undefined);
  });

  it("re-fires after the cooldown elapses", () => {
    writeBareConfig();
    commitN(6);
    recordHintShown(tmp, "H-001-no-dspy", new Date(Date.now() - 10 * 24 * 60 * 60 * 1000));
    const hints = evaluateHints({
      projectRoot: tmp,
      state: loadHintState(tmp),
      cooldownDays: DEFAULT_COOLDOWN_DAYS,
    });
    assert.ok(hints.some((h) => h.id === "H-001-no-dspy"));
  });

  it("permanently dismissed hints are forever ineligible", () => {
    writeBareConfig();
    commitN(6);
    dismissHint(tmp, "H-001-no-dspy");
    // Even with a far-future `now` the dismissed hint stays out.
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const hints = evaluateHints({
      projectRoot: tmp,
      state: loadHintState(tmp),
      cooldownDays: 1,
      now: farFuture,
    });
    assert.equal(hints.find((h) => h.id === "H-001-no-dspy"), undefined);
  });
});

describe("evaluateHints — anti-nag", () => {
  it("returns an empty list for a cold-start repo (no commits, no config)", () => {
    const hints = evaluateHints({ projectRoot: tmp, state: loadHintState(tmp) });
    assert.deepEqual(hints, []);
  });
});

describe("hint-state — corruption resilience", () => {
  it("loadHintState returns a fresh empty state when the JSON is malformed", () => {
    const file = hintStatePath(tmp);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{ not valid json");
    const state = loadHintState(tmp);
    assert.deepEqual(state, { version: 1, shown: {} });
  });

  it("resetHintState removes the file", () => {
    recordHintShown(tmp, "H-001-no-dspy");
    assert.ok(fs.existsSync(hintStatePath(tmp)));
    resetHintState(tmp);
    assert.equal(fs.existsSync(hintStatePath(tmp)), false);
  });
});
