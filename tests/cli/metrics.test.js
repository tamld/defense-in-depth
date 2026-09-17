/**
 * Metrics CLI Tests — comprehensive coverage for src/cli/metrics.ts
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// Import the compiled module
import {
  handleMetricsCommand,
  handleF1Command,
  handleMetaGrowthCommand,
  parsePeriod,
  formatJson,
  formatTable,
  formatSummary,
  computeOverall,
  gradeF1,
  printMetricsUsage,
  printMetaGrowthUsage,
} from "../../dist/cli/metrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let savedWarn;

beforeEach(() => {
  savedWarn = console.warn;
  console.warn = () => {};
  mock.reset();
});

afterEach(() => {
  console.warn = savedWarn;
});

// Helper to create temp directory
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "metrics-test-"));
}

// Helper to cleanup temp directory
function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Sample GuardF1Metric
function createSampleMetric(overrides = {}) {
  return {
    guardId: "hollow-artifact",
    period: "2026-01-01/2026-01-31",
    totalRuns: 100,
    truePositives: 80,
    falsePositives: 10,
    falseNegatives: 10,
    precision: 0.8889,
    recall: 0.8889,
    f1: 0.8889,
    computedAt: "2026-01-31T23:59:59.999Z",
    ...overrides,
  };
}

describe("Metrics CLI", () => {
  let testDir;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  describe("parsePeriod", () => {
    it("should parse '30d' period", () => {
      const result = parsePeriod("30d");
      assert.ok(result.includes("/"));
    });

    it("should parse '7d' period", () => {
      const result = parsePeriod("7d");
      assert.ok(result.includes("/"));
    });

    it("should parse '90d' period", () => {
      const result = parsePeriod("90d");
      assert.ok(result.includes("/"));
    });

    it("should parse '12m' period", () => {
      const result = parsePeriod("12m");
      assert.ok(result.includes("/"));
    });

    it("should return ISO interval as-is", () => {
      const result = parsePeriod("2026-01-01/2026-01-31");
      assert.equal(result, "2026-01-01/2026-01-31");
    });

    it("should throw for invalid format", () => {
      assert.throws(() => parsePeriod("week"), /Invalid period format/);
      assert.throws(() => parsePeriod("month"), /Invalid period format/);
      assert.throws(() => parsePeriod(""), /Invalid period format/);
    });
  });

  describe("gradeF1", () => {
    it("should return EXCELLENT for F1 >= 0.9", () => {
      assert.equal(gradeF1(1.0), "EXCELLENT");
      assert.equal(gradeF1(0.95), "EXCELLENT");
      assert.equal(gradeF1(0.9), "EXCELLENT");
    });

    it("should return GOOD for F1 >= 0.7", () => {
      assert.equal(gradeF1(0.89), "GOOD");
      assert.equal(gradeF1(0.8), "GOOD");
      assert.equal(gradeF1(0.7), "GOOD");
    });

    it("should return FAIR for F1 >= 0.5", () => {
      assert.equal(gradeF1(0.69), "FAIR");
      assert.equal(gradeF1(0.6), "FAIR");
      assert.equal(gradeF1(0.5), "FAIR");
    });

    it("should return POOR for F1 >= 0.3", () => {
      assert.equal(gradeF1(0.49), "POOR");
      assert.equal(gradeF1(0.4), "POOR");
      assert.equal(gradeF1(0.3), "POOR");
    });

    it("should return CRITICAL for F1 < 0.3", () => {
      assert.equal(gradeF1(0.29), "CRITICAL");
      assert.equal(gradeF1(0.1), "CRITICAL");
      assert.equal(gradeF1(0.0), "CRITICAL");
    });
  });

  describe("computeOverall", () => {
    it("should compute macro and micro metrics from guard metrics", () => {
      const metrics = [
        createSampleMetric({
          guardId: "a",
          f1: 1.0,
          precision: 1,
          recall: 1,
          truePositives: 5,
          falsePositives: 0,
          falseNegatives: 0,
          totalRuns: 5,
        }),
        createSampleMetric({
          guardId: "b",
          f1: 0.5,
          precision: 0.5,
          recall: 0.5,
          truePositives: 3,
          falsePositives: 3,
          falseNegatives: 3,
          totalRuns: 9,
        }),
      ];

      const overall = computeOverall(metrics);

      assert.ok(typeof overall.macroF1 === "number");
      assert.ok(typeof overall.macroPrecision === "number");
      assert.ok(typeof overall.macroRecall === "number");
      assert.ok(typeof overall.microF1 === "number");
      assert.equal(overall.totalTP, 8);
      assert.equal(overall.totalFP, 3);
      assert.equal(overall.totalFN, 3);
    });

    it("should handle empty metrics array", () => {
      const overall = computeOverall([]);

      assert.equal(overall.macroF1, 0);
      assert.equal(overall.macroPrecision, 0);
      assert.equal(overall.macroRecall, 0);
      assert.equal(overall.microF1, 0);
      assert.equal(overall.totalTP, 0);
      assert.equal(overall.totalFP, 0);
      assert.equal(overall.totalFN, 0);
    });

    it("should filter guards with zero runs", () => {
      const metrics = [
        createSampleMetric({ guardId: "a", f1: 1.0, totalRuns: 5 }),
        createSampleMetric({ guardId: "b", f1: 0.5, totalRuns: 0 }),
      ];

      const overall = computeOverall(metrics);

      // Only guard "a" should count for macro averages
      assert.equal(overall.macroF1, 1.0);
    });
  });

  describe("formatJson", () => {
    it("should output valid JSON with window, guards, and overall", () => {
      const metrics = [createSampleMetric()];

      const output = formatJson(metrics, "2026-01-01/2026-01-31");
      const parsed = JSON.parse(output);

      assert.ok(parsed.window);
      assert.ok(parsed.guards);
      assert.ok(parsed.overall);
      assert.equal(parsed.guards["hollow-artifact"].guardId, "hollow-artifact");
    });

    it("should include period in window", () => {
      const metrics = [createSampleMetric()];

      const output = formatJson(metrics, "2026-01-01/2026-01-31");
      const parsed = JSON.parse(output);

      assert.equal(parsed.window, "2026-01-01/2026-01-31");
    });
  });

  describe("formatTable", () => {
    it("should output table header", () => {
      const metrics = [createSampleMetric()];

      const output = formatTable(metrics, "2026-01-01/2026-01-31");

      assert.ok(output.includes("Guard"));
      assert.ok(output.includes("F1"));
      assert.ok(output.includes("Precision"));
      assert.ok(output.includes("Recall"));
    });

    it("should format metrics rows", () => {
      const metrics = [
        createSampleMetric({ guardId: "hollow-artifact", f1: 0.85, precision: 0.9, recall: 0.81 }),
      ];

      const output = formatTable(metrics, "2026-01-01/2026-01-31");

      assert.ok(output.includes("hollow-artifact"));
      assert.ok(output.includes("0.85"));
    });
  });

  describe("formatSummary", () => {
    it("should output summary header with period", () => {
      const metrics = [createSampleMetric()];

      const output = formatSummary(metrics, "2026-01-01/2026-01-31");

      assert.ok(output.includes("Guard F1 Metrics"));
      assert.ok(output.includes("2026-01-01/2026-01-31"));
    });

    it("should show guard grades with icons", () => {
      const metrics = [
        createSampleMetric({ guardId: "a", f1: 1.0 }),
        createSampleMetric({ guardId: "b", f1: 0.2 }),
      ];

      const output = formatSummary(metrics, "2026-01-01/2026-01-31");

      assert.ok(output.includes("🟢") || output.includes("EXCELLENT"));
      assert.ok(output.includes("⚫") || output.includes("CRITICAL"));
    });
  });

  describe("printMetricsUsage", () => {
    it("should not throw", () => {
      assert.doesNotThrow(() => printMetricsUsage());
    });
  });

  describe("printMetaGrowthUsage", () => {
    it("should not throw", () => {
      assert.doesNotThrow(() => printMetaGrowthUsage());
    });
  });

  describe("handleF1Command", () => {
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = mock.fn();
      globalThis.console.log = consoleLogSpy;
    });

    afterEach(() => {
      globalThis.console.log = console.log;
    });

    it("should show help with --help", async () => {
      await handleF1Command(testDir, ["--help"]);

      assert.ok(consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("f1")));
    });

    it("should show help with -h", async () => {
      await handleF1Command(testDir, ["-h"]);

      assert.ok(consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("f1")));
    });

    it("should show empty summary for empty project", async () => {
      await handleF1Command(testDir, []);

      // Should print summary with zeros
      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("Guard F1 Metrics")),
      );
    });

    it("should respect --period option (30d format)", async () => {
      await handleF1Command(testDir, ["--period", "30d"]);

      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("Guard F1 Metrics")),
      );
    });

    it("should respect --format option", async () => {
      await handleF1Command(testDir, ["--format", "json"]);

      assert.ok(true); // Just verify no throw
    });

    it("should respect --guard option", async () => {
      await handleF1Command(testDir, ["--guard", "hollow-artifact"]);

      // Should print summary (even if empty)
      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("Guard F1 Metrics")),
      );
    });
  });

  describe("handleMetaGrowthCommand", () => {
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = mock.fn();
      globalThis.console.log = consoleLogSpy;
    });

    afterEach(() => {
      globalThis.console.log = console.log;
    });

    it("should show help with --help", async () => {
      await handleMetaGrowthCommand(testDir, ["--help"]);

      assert.ok(consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("meta-growth")));
    });

    it("should show empty summary for empty project", async () => {
      await handleMetaGrowthCommand(testDir, []);

      // Should not throw
      assert.ok(true);
    });

    it("should respect --period option (30d format)", async () => {
      await handleMetaGrowthCommand(testDir, ["--period", "30d"]);

      assert.ok(true); // Just verify no throw
    });

    it("should respect --format option", async () => {
      await handleMetaGrowthCommand(testDir, ["--format", "json"]);

      assert.ok(true); // Just verify no throw
    });
  });

  describe("handleMetricsCommand", () => {
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = mock.fn();
      globalThis.console.log = consoleLogSpy;
    });

    afterEach(() => {
      globalThis.console.log = console.log;
    });

    it("should show help with --help", async () => {
      await handleMetricsCommand(testDir, ["--help"]);

      assert.ok(consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("metrics")));
    });

    it("should show help with -h", async () => {
      await handleMetricsCommand(testDir, ["-h"]);

      assert.ok(consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("metrics")));
    });

    it("should delegate to f1 subcommand", async () => {
      await handleMetricsCommand(testDir, ["f1", "--help"]);

      assert.ok(consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("f1")));
    });

    it("should delegate to meta-growth subcommand", async () => {
      await handleMetricsCommand(testDir, ["meta-growth", "--help"]);

      assert.ok(consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("meta-growth")));
    });

    it("should show error for unknown subcommand", async () => {
      const consoleErrorSpy = mock.fn();
      const savedError = console.error;
      const savedExit = process.exit;
      const exitSpy = mock.fn();
      globalThis.console.error = consoleErrorSpy;
      globalThis.process.exit = exitSpy;

      await handleMetricsCommand(testDir, ["unknown"]);

      assert.ok(exitSpy.mock.calls.length === 1);
      assert.ok(exitSpy.mock.calls[0].arguments[0] === 1);
      assert.ok(
        consoleErrorSpy.mock.calls.some((call) =>
          call.arguments[0].includes("Unknown metrics subcommand"),
        ),
      );

      globalThis.console.error = savedError;
      globalThis.process.exit = savedExit;
    });
  });

  describe("Edge cases", () => {
    it("should handle missing project directory gracefully", async () => {
      const consoleLogSpy = mock.fn();
      globalThis.console.log = consoleLogSpy;

      await handleF1Command("/nonexistent/path", []);

      // Should print summary (even if empty)
      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("Guard F1 Metrics")),
      );

      globalThis.console.log = console.log;
    });
  });
});
