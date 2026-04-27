/**
 * Feedback → F1 adapter tests (issue #22 MVP).
 *
 * Drives `did feedback f1` against hand-crafted JSONL fixtures so we can
 * verify the math against known confusion-matrix counts. Also tests the
 * empty / malformed cases — the adapter must NEVER throw, only return a
 * zero metric.
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
const FEEDBACK_PATH = ".agents/records/feedback.jsonl";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-feedback-f1-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, "feedback", ...args], {
    cwd: tmp,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

/**
 * Write a hand-crafted JSONL fixture so we can verify the math against
 * known confusion-matrix counts, independent of the CLI writer path.
 */
function seed(events) {
  const full = path.join(tmp, FEEDBACK_PATH);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(
    full,
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
}

const ISO_2026_APR_15 = "2026-04-15T12:00:00.000Z";

function mkEvent(guardId, label, idSeed) {
  return {
    id: `seed-${idSeed}`,
    guardId,
    ticketId: "",
    findingHash: `hash-${idSeed}`,
    label,
    source: "cli",
    timestamp: ISO_2026_APR_15,
    executor: "human",
  };
}

describe("feedback f1 — math via CLI", () => {
  it("3 TP / 1 FP / 1 FN gives precision=0.75, recall=0.75, F1=0.75", () => {
    seed([
      mkEvent("hollowArtifact", "TP", 1),
      mkEvent("hollowArtifact", "TP", 2),
      mkEvent("hollowArtifact", "TP", 3),
      mkEvent("hollowArtifact", "FP", 4),
      mkEvent("hollowArtifact", "FN", 5),
    ]);
    const r = runCli([
      "f1",
      "--guard",
      "hollowArtifact",
      "--period",
      "2026-04-01T00:00:00.000Z/2026-05-01T00:00:00.000Z",
    ]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /F1=0\.750/);
    assert.match(r.stdout, /P=0\.750/);
    assert.match(r.stdout, /R=0\.750/);
    assert.match(r.stdout, /TP=3 FP=1 FN=1/);
  });

  it("only TPs gives perfect precision/recall", () => {
    seed([
      mkEvent("phaseGate", "TP", 1),
      mkEvent("phaseGate", "TP", 2),
    ]);
    const r = runCli([
      "f1",
      "--guard",
      "phaseGate",
      "--period",
      "2026-04-01T00:00:00.000Z/2026-05-01T00:00:00.000Z",
    ]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /F1=1\.000/);
    assert.match(r.stdout, /Grade=EXCELLENT/);
  });

  it("empty feedback file → zero metric, no throw", () => {
    seed([]);
    const r = runCli([
      "f1",
      "--guard",
      "ssotPollution",
      "--period",
      "2026-04-01T00:00:00.000Z/2026-05-01T00:00:00.000Z",
    ]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /F1=0\.000/);
    assert.match(r.stdout, /TP=0 FP=0 FN=0/);
  });

  it("missing feedback file → still works (graceful), zero metric", () => {
    // Note: tmp dir has no .agents/records/ at all.
    const r = runCli([
      "f1",
      "--guard",
      "ssotPollution",
      "--period",
      "2026-04-01T00:00:00.000Z/2026-05-01T00:00:00.000Z",
    ]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /F1=0\.000/);
  });

  it("period filter excludes events outside the window", () => {
    seed([
      mkEvent("hollowArtifact", "TP", 1),
      {
        ...mkEvent("hollowArtifact", "TP", 99),
        // Outside the period below
        timestamp: "2025-01-01T00:00:00.000Z",
      },
    ]);
    const r = runCli([
      "f1",
      "--guard",
      "hollowArtifact",
      "--period",
      "2026-04-01T00:00:00.000Z/2026-05-01T00:00:00.000Z",
    ]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /TP=1/);
  });

  it("malformed JSONL line is skipped, not thrown on", () => {
    const full = path.join(tmp, FEEDBACK_PATH);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(
      full,
      [
        JSON.stringify(mkEvent("hollowArtifact", "TP", 1)),
        "{this is not valid json",
        JSON.stringify(mkEvent("hollowArtifact", "FP", 2)),
      ].join("\n") + "\n",
    );
    const r = runCli([
      "f1",
      "--guard",
      "hollowArtifact",
      "--period",
      "2026-04-01T00:00:00.000Z/2026-05-01T00:00:00.000Z",
    ]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /TP=1 FP=1/);
  });
});
