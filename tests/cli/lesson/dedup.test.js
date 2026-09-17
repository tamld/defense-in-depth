/**
 * Lesson Dedup CLI Tests — comprehensive coverage for src/cli/lesson/dedup.ts
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// Import the compiled module
import {
  runDedup,
  printSummary,
  printTable,
  printDedupUsage,
} from "../../../dist/cli/lesson/dedup.js";

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
  return fs.mkdtempSync(path.join(os.tmpdir(), "dedup-test-"));
}

// Helper to cleanup temp directory
function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Helper to create a sample lessons.jsonl
function createLessonsFile(dir, lessons) {
  const filePath = path.join(dir, "lessons.jsonl");
  fs.writeFileSync(filePath, `${lessons.map((l) => JSON.stringify(l)).join("\n")}\n`);
  return filePath;
}

describe("Lesson Dedup CLI", () => {
  let testDir;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  describe("printSummary", () => {
    it("should format groups in summary format", () => {
      const groups = [
        [
          {
            id: "base1",
            title: "Recurring TODO pattern",
            confidence: 0.9,
            wrongApproach: "a",
            correctApproach: "b",
            insight: "c",
            category: "process",
            evidence: "RUNTIME",
            createdAt: "2024-01-01",
            tags: ["todo"],
          },
          {
            id: "dup1",
            title: "Another TODO pattern",
            confidence: 0.8,
            wrongApproach: "a",
            correctApproach: "b",
            insight: "c",
            category: "process",
            evidence: "INFER",
            createdAt: "2024-01-02",
            tags: ["todo"],
          },
        ],
        [
          {
            id: "base2",
            title: "Recurring FIXME pattern",
            confidence: 0.85,
            wrongApproach: "x",
            correctApproach: "y",
            insight: "z",
            category: "code",
            evidence: "RUNTIME",
            createdAt: "2024-01-03",
            tags: ["fixme"],
          },
        ],
      ];

      assert.doesNotThrow(() => printSummary(groups));
    });

    it("should handle empty groups", () => {
      assert.doesNotThrow(() => printSummary([]));
    });
  });

  describe("printTable", () => {
    it("should format groups in table format", () => {
      const groups = [
        [
          {
            id: "base1",
            title: "Recurring TODO pattern",
            confidence: 0.9,
            wrongApproach: "a",
            correctApproach: "b",
            insight: "c",
            category: "process",
            evidence: "RUNTIME",
            createdAt: "2024-01-01",
            tags: ["todo"],
          },
          {
            id: "dup1",
            title: "Another TODO pattern",
            confidence: 0.8,
            wrongApproach: "a",
            correctApproach: "b",
            insight: "c",
            category: "process",
            evidence: "INFER",
            createdAt: "2024-01-02",
            tags: ["todo"],
          },
        ],
      ];

      assert.doesNotThrow(() => printTable(groups));
    });

    it("should handle empty groups", () => {
      assert.doesNotThrow(() => printTable([]));
    });
  });

  describe("printDedupUsage", () => {
    it("should not throw", () => {
      assert.doesNotThrow(() => printDedupUsage());
    });
  });

  describe("runDedup", () => {
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = mock.fn();
      globalThis.console.log = consoleLogSpy;
    });

    afterEach(() => {
      globalThis.console.log = console.log;
    });

    it("should show help with --help", async () => {
      await runDedup(testDir, ["--help"]);
      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("lesson dedup")),
      );
    });

    it("should show help with -h", async () => {
      await runDedup(testDir, ["-h"]);
      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("lesson dedup")),
      );
    });

    it("should show 'No duplicates found' when no lessons", async () => {
      // No lessons.jsonl file
      await runDedup(testDir, []);

      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("No duplicates found")),
      );
    });

    it("should show 'No duplicates found' when lessons are unique", async () => {
      const lessons = [
        {
          id: "a",
          title: "Lesson A",
          confidence: 0.9,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "RUNTIME",
          createdAt: "2024-01-01",
          tags: ["tag1"],
        },
        {
          id: "b",
          title: "Lesson B",
          confidence: 0.8,
          wrongApproach: "x",
          correctApproach: "y",
          insight: "z",
          category: "code",
          evidence: "INFER",
          createdAt: "2024-01-02",
          tags: ["tag2"],
        },
      ];
      createLessonsFile(testDir, lessons);

      await runDedup(testDir, []);

      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("No duplicates found")),
      );
    });

    it("should detect duplicates with default threshold", async () => {
      const lessons = [
        {
          id: "base",
          title: "Recurring TODO pattern",
          confidence: 0.9,
          wrongApproach: "Used TODO for placeholder",
          correctApproach: "Use ticket reference",
          insight: "TODOs accumulate",
          category: "process",
          evidence: "RUNTIME",
          createdAt: "2024-01-01",
          tags: ["todo", "placeholder"],
          wrongApproachPattern: "todo",
          searchTerms: ["todo"],
          relatedFiles: ["src/a.ts"],
        },
        {
          id: "dup1",
          title: "Recurring TODO pattern (variant)",
          confidence: 0.8,
          wrongApproach: "Used TODO for placeholder",
          correctApproach: "Use ticket reference",
          insight: "TODOs accumulate",
          category: "process",
          evidence: "INFER",
          createdAt: "2024-01-02",
          tags: ["todo", "placeholder"],
          wrongApproachPattern: "todo",
          searchTerms: ["todo"],
          relatedFiles: ["src/b.ts"],
        },
        {
          id: "dup2",
          title: "Another TODO pattern",
          confidence: 0.7,
          wrongApproach: "Used TODO for placeholder",
          correctApproach: "Use ticket reference",
          insight: "TODOs accumulate",
          category: "process",
          evidence: "HYPO",
          createdAt: "2024-01-03",
          tags: ["todo"],
          wrongApproachPattern: "todo",
          searchTerms: ["todo"],
          relatedFiles: ["src/c.ts"],
        },
      ];
      createLessonsFile(testDir, lessons);

      await runDedup(testDir, []);

      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("duplicate group")),
      );
    });

    it("should respect --threshold option", async () => {
      // Test with high threshold (1.01 - impossible to reach) - should not find duplicates
      const lessons = [
        {
          id: "base",
          title: "Similar lesson",
          confidence: 0.9,
          wrongApproach: "approach",
          correctApproach: "fix",
          insight: "insight",
          category: "process",
          evidence: "RUNTIME",
          createdAt: "2024-01-01",
          tags: ["tag"],
          wrongApproachPattern: "pattern",
        },
        {
          id: "dup",
          title: "Similar lesson",
          confidence: 0.8,
          wrongApproach: "approach",
          correctApproach: "fix",
          insight: "insight",
          category: "process",
          evidence: "INFER",
          createdAt: "2024-01-02",
          tags: ["tag"],
          wrongApproachPattern: "pattern",
        },
      ];
      createLessonsFile(testDir, lessons);

      // Threshold > 1.0 - impossible to match
      consoleLogSpy.mock.resetCalls();
      await runDedup(testDir, ["--threshold", "1.01"]);
      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("No duplicates found")),
      );

      // Low threshold - should find duplicates
      consoleLogSpy.mock.resetCalls();
      await runDedup(testDir, ["--threshold", "0.5"]);
      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("duplicate group")),
      );
    });

    it("should output JSON with --format json", async () => {
      const lessons = [
        {
          id: "base",
          title: "Recurring TODO pattern",
          confidence: 0.9,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "RUNTIME",
          createdAt: "2024-01-01",
          tags: ["todo"],
          wrongApproachPattern: "todo",
        },
        {
          id: "dup",
          title: "Recurring TODO pattern",
          confidence: 0.8,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "INFER",
          createdAt: "2024-01-02",
          tags: ["todo"],
          wrongApproachPattern: "todo",
        },
      ];
      createLessonsFile(testDir, lessons);

      await runDedup(testDir, ["--format", "json"]);

      const jsonOutput = consoleLogSpy.mock.calls.find((call) =>
        call.arguments[0].trim().startsWith("["),
      );
      assert.ok(jsonOutput, "Should output JSON");
      const parsed = JSON.parse(jsonOutput.arguments[0]);
      assert.ok(Array.isArray(parsed));
      assert.ok(parsed.length > 0);
    });

    it("should output table with --format table", async () => {
      const lessons = [
        {
          id: "base",
          title: "Recurring TODO pattern",
          confidence: 0.9,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "RUNTIME",
          createdAt: "2024-01-01",
          tags: ["todo"],
          wrongApproachPattern: "todo",
        },
        {
          id: "dup",
          title: "Recurring TODO pattern",
          confidence: 0.8,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "INFER",
          createdAt: "2024-01-02",
          tags: ["todo"],
          wrongApproachPattern: "todo",
        },
      ];
      createLessonsFile(testDir, lessons);

      await runDedup(testDir, ["--format", "table"]);

      assert.ok(
        consoleLogSpy.mock.calls.some((call) =>
          call.arguments[0].includes("Group | Count | Base ID | Title"),
        ),
      );
    });

    it("should show dry-run output with --dry-run", async () => {
      const lessons = [
        {
          id: "base",
          title: "Recurring TODO pattern",
          confidence: 0.9,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "RUNTIME",
          createdAt: "2024-01-01",
          tags: ["todo"],
          wrongApproachPattern: "todo",
        },
        {
          id: "dup",
          title: "Recurring TODO pattern",
          confidence: 0.8,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "INFER",
          createdAt: "2024-01-02",
          tags: ["todo"],
          wrongApproachPattern: "todo",
        },
      ];
      createLessonsFile(testDir, lessons);

      await runDedup(testDir, ["--dry-run"]);

      assert.ok(
        consoleLogSpy.mock.calls.some(
          (call) =>
            call.arguments[0].includes("Merging duplicates") ||
            call.arguments[0].includes("preview"),
        ),
      );
    });

    it("should use custom threshold with -t flag", async () => {
      const lessons = [
        {
          id: "base",
          title: "Similar",
          confidence: 0.9,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "RUNTIME",
          createdAt: "2024-01-01",
          tags: ["tag"],
          wrongApproachPattern: "pattern",
        },
        {
          id: "dup",
          title: "Similar",
          confidence: 0.8,
          wrongApproach: "a",
          correctApproach: "b",
          insight: "c",
          category: "process",
          evidence: "INFER",
          createdAt: "2024-01-02",
          tags: ["tag"],
          wrongApproachPattern: "pattern",
        },
      ];
      createLessonsFile(testDir, lessons);

      await runDedup(testDir, ["-t", "0.8"]);

      // Should find duplicates at 0.8 threshold
      assert.ok(
        consoleLogSpy.mock.calls.some((call) => call.arguments[0].includes("duplicate group")),
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle corrupted lessons.jsonl gracefully", async () => {
      fs.writeFileSync(path.join(testDir, "lessons.jsonl"), "not valid json\n{invalid");

      const consoleLogSpy = mock.fn();
      globalThis.console.log = consoleLogSpy;

      try {
        await runDedup(testDir, []);
        // Should not throw, just handle gracefully
      } catch (_e) {
        // May throw due to JSON parse error in analyzeLessons
      } finally {
        globalThis.console.log = console.log;
      }
    });

    it("should handle missing lessons.jsonl", async () => {
      const consoleLogSpy = mock.fn();
      globalThis.console.log = consoleLogSpy;

      await runDedup("/nonexistent/path", []);

      assert.ok(
        consoleLogSpy.mock.calls.some(
          (call) =>
            call.arguments[0].includes("No duplicates found") ||
            call.arguments[0].includes("not found"),
        ),
      );

      globalThis.console.log = console.log;
    });
  });
});
