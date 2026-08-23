// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] Full branch coverage for src/cli/growth.ts (handleGrowthCommand).
// Error paths call process.exit(1); we intercept it to observe the exit code
// without terminating the test runner.
import test from "node:test";
import assert from "node:assert";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { handleGrowthCommand } from "../dist/cli/growth.js";

const EXIT_SENTINEL = "__PROCESS_EXIT__";

/**
 * Invokes handleGrowthCommand with process.exit and console streams captured.
 * Returns { exitCode, errors, logs }; exitCode stays null when the handler
 * returns normally (success path).
 */
async function runGrowth(projectRoot, args) {
  const captured = { exitCode: null, errors: [], logs: [] };
  const origExit = process.exit;
  const origError = console.error;
  const origLog = console.log;

  process.exit = (code) => {
    captured.exitCode = code;
    throw new Error(`${EXIT_SENTINEL}:${code}`);
  };
  console.error = (...parts) => {
    captured.errors.push(parts.join(" "));
  };
  console.log = (...parts) => {
    captured.logs.push(parts.join(" "));
  };

  try {
    await handleGrowthCommand(projectRoot, args);
  } catch (err) {
    // Only swallow our own sentinel; anything else is a real bug.
    if (!String(err.message).startsWith(EXIT_SENTINEL)) throw err;
  } finally {
    process.exit = origExit;
    console.error = origError;
    console.log = origLog;
  }
  return captured;
}

async function readMetricLines(projectRoot) {
  const metricPath = path.join(projectRoot, "growth_metrics.jsonl");
  try {
    const content = await fs.readFile(metricPath, "utf-8");
    return content.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

test("Growth CLI: command handling covers all branches", async (t) => {
  let tempDir;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "defense-growth-cli-"));

    await t.test("unknown subcommand exits 1 and prints usage", async () => {
      const r = await runGrowth(tempDir, ["frobnicate"]);
      assert.strictEqual(r.exitCode, 1);
      assert.ok(
        r.errors.some((e) => e.includes('Unknown growth command: "frobnicate"')),
      );
      assert.ok(
        r.logs.some((l) => l.includes("Growth Metrics Tracking")),
        "usage banner should be printed",
      );
    });

    await t.test("missing subcommand exits 1", async () => {
      const r = await runGrowth(tempDir, []);
      assert.strictEqual(r.exitCode, 1);
      assert.ok(r.errors.some((e) => e.includes('Unknown growth command: ""')));
    });

    await t.test("record without required flags exits 1", async () => {
      const r = await runGrowth(tempDir, ["record"]);
      assert.strictEqual(r.exitCode, 1);
      assert.ok(
        r.errors.some((e) =>
          e.includes("requires --name, --value, and --unit"),
        ),
      );
      assert.strictEqual(await readMetricLines(tempDir).then((l) => l.length), 0);
    });

    await t.test("flag at end of args treated as missing", async () => {
      const r = await runGrowth(tempDir, ["record", "--name"]);
      assert.strictEqual(r.exitCode, 1);
      assert.ok(
        r.errors.some((e) =>
          e.includes("requires --name, --value, and --unit"),
        ),
      );
    });

    await t.test("non-numeric --value exits 1", async () => {
      const r = await runGrowth(tempDir, [
        "record",
        "--name",
        "metric_a",
        "--value",
        "not-a-number",
        "--unit",
        "count",
      ]);
      assert.strictEqual(r.exitCode, 1);
      assert.ok(
        r.errors.some((e) =>
          e.includes('Invalid numeric value for --value: "not-a-number"'),
        ),
      );
    });

    await t.test("non-finite --value exits 1", async () => {
      const r = await runGrowth(tempDir, [
        "record",
        "--name",
        "metric_b",
        "--value",
        "Infinity",
        "--unit",
        "count",
      ]);
      assert.strictEqual(r.exitCode, 1);
      assert.ok(
        r.errors.some((e) =>
          e.includes('Invalid numeric value for --value: "Infinity"'),
        ),
      );
    });

    await t.test("unknown trend exits 1", async () => {
      const r = await runGrowth(tempDir, [
        "record",
        "--name",
        "metric_c",
        "--value",
        "1",
        "--unit",
        "count",
        "--trend",
        "skyrocketing",
      ]);
      assert.strictEqual(r.exitCode, 1);
      assert.ok(
        r.errors.some((e) =>
          e.includes('Unknown trend "skyrocketing"'),
        ),
      );
    });

    await t.test("valid minimal record persists and reports success", async () => {
      const r = await runGrowth(tempDir, [
        "record",
        "--name",
        "guard_false_positive_rate",
        "--value",
        "0.05",
        "--unit",
        "percentage",
      ]);
      assert.strictEqual(r.exitCode, null, "success path must not exit");
      assert.ok(
        r.logs.some((l) =>
          l.includes("[guard_false_positive_rate] recorded successfully"),
        ),
      );

      const lines = await readMetricLines(tempDir);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].name, "guard_false_positive_rate");
      assert.strictEqual(lines[0].value, 0.05);
      assert.strictEqual(lines[0].unit, "percentage");
      assert.ok(lines[0].measuredAt, "measuredAt should be generated");
      assert.strictEqual(lines[0].source, undefined);
      assert.strictEqual(lines[0].trend, undefined);
    });

    await t.test("valid full record persists source and whitelisted trend", async () => {
      const r = await runGrowth(tempDir, [
        "record",
        "--name",
        "lessons_per_ticket",
        "--value",
        "2",
        "--unit",
        "count",
        "--source",
        "TK-123",
        "--trend",
        "improving",
      ]);
      assert.strictEqual(r.exitCode, null);

      const lines = await readMetricLines(tempDir);
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[1].source, "TK-123");
      assert.strictEqual(lines[1].trend, "improving");
    });
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
});
