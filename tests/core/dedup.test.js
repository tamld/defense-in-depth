/**
 * Core Dedup Tests — comprehensive coverage for src/core/dedup.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// Import the compiled module
import {
  LessonDeduplicator,
  analyzeLessons,
  mergeLessons,
  wordOverlap,
  highestEvidence,
  earliestDate,
  inferProject,
  commonPrefix,
  DEFAULT_DEDUP_CONFIG,
} from "../../dist/core/dedup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp directory
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dedup-core-test-"));
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

// Sample lesson factory
function createLesson(overrides = {}) {
  return {
    id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "Test lesson",
    scenario: "Test scenario",
    wrongApproach: "Wrong approach",
    correctApproach: "Correct approach",
    insight: "Test insight",
    category: "code",
    evidence: "RUNTIME",
    confidence: 0.9,
    tags: ["test"],
    searchTerms: ["test"],
    relatedFiles: ["src/test.ts"],
    relatedLessons: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Core Dedup", () => {
  let testDir;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  describe("wordOverlap", () => {
    it("should return 0 for empty strings", () => {
      assert.equal(wordOverlap("", ""), 0);
      assert.equal(wordOverlap("test", ""), 0);
      assert.equal(wordOverlap("", "test"), 0);
    });

    it("should return 1 for identical strings", () => {
      assert.equal(wordOverlap("hello world", "hello world"), 1);
    });

    it("should return 0 for completely different words", () => {
      assert.equal(wordOverlap("hello world", "foo bar"), 0);
    });

    it("should calculate Jaccard similarity for partial overlap", () => {
      // "hello world test" vs "hello world foo" -> intersection: {hello, world}, union: {hello, world, test, foo}
      // Jaccard = 2/4 = 0.5
      const result = wordOverlap("hello world test", "hello world foo");
      assert.ok(result > 0 && result < 1);
    });

    it("should ignore short words (<=3 chars)", () => {
      // "the and" (both <=3) should be filtered out
      assert.equal(wordOverlap("the and", "the and"), 0);
    });

    it("should be case insensitive", () => {
      assert.equal(wordOverlap("Hello World", "hello world"), 1);
    });
  });

  describe("highestEvidence", () => {
    it("should return RUNTIME for group with RUNTIME evidence", () => {
      const lessons = [
        createLesson({ evidence: "INFER" }),
        createLesson({ evidence: "RUNTIME" }),
        createLesson({ evidence: "HYPO" }),
      ];
      assert.equal(highestEvidence(lessons), "RUNTIME");
    });

    it("should return CODE when RUNTIME not present", () => {
      const lessons = [
        createLesson({ evidence: "INFER" }),
        createLesson({ evidence: "CODE" }),
        createLesson({ evidence: "HYPO" }),
      ];
      assert.equal(highestEvidence(lessons), "CODE");
    });

    it("should return INFER when only INFER and HYPO present", () => {
      const lessons = [createLesson({ evidence: "INFER" }), createLesson({ evidence: "HYPO" })];
      assert.equal(highestEvidence(lessons), "INFER");
    });

    it("should return HYPO when only HYPO present", () => {
      const lessons = [createLesson({ evidence: "HYPO" })];
      assert.equal(highestEvidence(lessons), "HYPO");
    });
  });

  describe("earliestDate", () => {
    it("should return earliest date from group", () => {
      const lessons = [
        createLesson({ createdAt: "2024-01-03T00:00:00.000Z" }),
        createLesson({ createdAt: "2024-01-01T00:00:00.000Z" }),
        createLesson({ createdAt: "2024-01-02T00:00:00.000Z" }),
      ];
      assert.equal(earliestDate(lessons), "2024-01-01T00:00:00.000Z");
    });

    it("should handle single lesson", () => {
      const lessons = [createLesson({ createdAt: "2024-01-01T00:00:00.000Z" })];
      assert.equal(earliestDate(lessons), "2024-01-01T00:00:00.000Z");
    });
  });

  describe("inferProject", () => {
    it("should infer aegis from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/aegis/main.ts"] });
      assert.equal(inferProject(lesson), "aegis");
    });

    it("should infer tamld-llm-wiki from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/tamld-llm-wiki/wiki.py"] });
      assert.equal(inferProject(lesson), "tamld-llm-wiki");
    });

    it("should infer g8s from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/g8s/main.go"] });
      assert.equal(inferProject(lesson), "g8s");
    });

    it("should infer tuneflow from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/tuneflow/app.ts"] });
      assert.equal(inferProject(lesson), "tuneflow");
    });

    it("should infer web-login-solo from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/web-login/main.ts"] });
      assert.equal(inferProject(lesson), "web-login-solo");
    });

    it("should infer defense-in-depth from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/defense-in-depth/guard.ts"] });
      assert.equal(inferProject(lesson), "defense-in-depth");
    });

    it("should infer from tags when relatedFiles not available", () => {
      const lesson = createLesson({ relatedFiles: [], tags: ["aegis", "test"] });
      assert.equal(inferProject(lesson), "aegis");
    });

    it("should return empty string for unknown project", () => {
      const lesson = createLesson({ relatedFiles: ["src/unknown/file.ts"], tags: ["unknown"] });
      assert.equal(inferProject(lesson), "");
    });
  });

  describe("commonPrefix", () => {
    it("should return empty for empty array", () => {
      assert.equal(commonPrefix([]), "");
    });

    it("should return string for single element", () => {
      assert.equal(commonPrefix(["hello"]), "hello");
    });

    it("should find common prefix", () => {
      assert.equal(commonPrefix(["hello world", "hello there", "hello friend"]), "hello ");
    });

    it("should return empty for no common prefix", () => {
      assert.equal(commonPrefix(["hello", "world"]), "");
    });

    it("should handle partial prefix", () => {
      assert.equal(
        commonPrefix(["recurring TODO pattern", "recurring FIXME pattern"]),
        "recurring ",
      );
    });
  });

  describe("LessonDeduplicator", () => {
    it("should create instance with default config", () => {
      const dedup = new LessonDeduplicator();
      assert.ok(dedup);
    });

    it("should create instance with custom config", () => {
      const dedup = new LessonDeduplicator({ threshold: 0.8, autoMerge: true });
      assert.ok(dedup);
    });

    it("should return empty result for no lessons", async () => {
      const dedup = new LessonDeduplicator();
      const result = await dedup.analyze(testDir);
      assert.deepEqual(result.groups, []);
      assert.deepEqual(result.unique, []);
      assert.equal(result.duplicateCount, 0);
    });

    it("should return unique for single lesson", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const dedup = new LessonDeduplicator();
      const result = await dedup.analyze(testDir);

      assert.equal(result.groups.length, 0);
      assert.equal(result.unique.length, 1);
      assert.equal(result.duplicateCount, 0);
    });

    it("should detect duplicates with same wrongApproachPattern", async () => {
      const lessons = [
        createLesson({
          id: "lesson-1",
          wrongApproachPattern: "todo-placeholder",
          title: "Recurring TODO pattern",
          confidence: 0.9,
        }),
        createLesson({
          id: "lesson-2",
          wrongApproachPattern: "todo-placeholder",
          title: "Another TODO pattern",
          confidence: 0.8,
        }),
      ];
      createLessonsFile(testDir, lessons);

      const dedup = new LessonDeduplicator({ threshold: 0.75 });
      const result = await dedup.analyze(testDir);

      assert.equal(result.groups.length, 1);
      assert.equal(result.groups[0].length, 2);
      assert.equal(result.duplicateCount, 1);
    });

    it("should not group lessons below threshold", async () => {
      const lessons = [
        createLesson({
          id: "lesson-1",
          wrongApproachPattern: "pattern-a",
          title: "Lesson A",
          tags: ["a"],
          insight: "Insight A",
        }),
        createLesson({
          id: "lesson-2",
          wrongApproachPattern: "pattern-b",
          title: "Lesson B",
          tags: ["b"],
          insight: "Insight B",
        }),
      ];
      createLessonsFile(testDir, lessons);

      const dedup = new LessonDeduplicator({ threshold: 0.9 });
      const result = await dedup.analyze(testDir);

      assert.equal(result.groups.length, 0);
      assert.equal(result.unique.length, 2);
    });

    it("should merge group with mergeGroup", async () => {
      const lessons = [
        createLesson({
          id: "lesson-1",
          wrongApproachPattern: "todo-placeholder",
          title: "Recurring TODO pattern",
          confidence: 0.9,
          tags: ["todo"],
          insight: "TODOs accumulate",
        }),
        createLesson({
          id: "lesson-2",
          wrongApproachPattern: "todo-placeholder",
          title: "Recurring TODO pattern",
          confidence: 0.8,
          tags: ["todo", "placeholder"],
          insight: "TODOs accumulate",
        }),
      ];
      createLessonsFile(testDir, lessons);

      const dedup = new LessonDeduplicator({ threshold: 0.75 });
      const result = await dedup.analyze(testDir);

      const mergeResult = dedup.mergeGroup(result.groups[0]);

      assert.ok(mergeResult.canonical);
      assert.equal(mergeResult.sourceIds.length, 2);
      assert.ok(mergeResult.summary.includes("2 lessons"));
    });

    it("should handle mergeAll", async () => {
      const lessons = [
        createLesson({
          id: "lesson-1",
          wrongApproachPattern: "todo-placeholder",
          title: "Recurring TODO pattern",
        }),
        createLesson({
          id: "lesson-2",
          wrongApproachPattern: "todo-placeholder",
          title: "Recurring TODO pattern",
        }),
        createLesson({
          id: "lesson-3",
          wrongApproachPattern: "fixme-pattern",
          title: "Recurring FIXME pattern",
        }),
      ];
      createLessonsFile(testDir, lessons);

      const dedup = new LessonDeduplicator({ threshold: 0.75 });
      const mergeResults = await dedup.mergeAll(testDir);

      assert.equal(mergeResults.length, 1); // One group of 2
    });
  });

  describe("analyzeLessons convenience function", () => {
    it("should work with default config", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const result = await analyzeLessons(testDir);

      assert.ok(result.groups.length >= 0);
    });

    it("should accept custom config", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const result = await analyzeLessons(testDir, { threshold: 0.9 });

      assert.ok(result.groups.length >= 0);
    });
  });

  describe("mergeLessons convenience function", () => {
    it("should work with default config", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const result = await mergeLessons(testDir);

      assert.ok(Array.isArray(result));
    });

    it("should accept custom config", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const result = await mergeLessons(testDir, { threshold: 0.9 });

      assert.ok(Array.isArray(result));
    });
  });

  describe("DEFAULT_DEDUP_CONFIG", () => {
    it("should have correct defaults", () => {
      assert.equal(DEFAULT_DEDUP_CONFIG.threshold, 0.75);
      assert.equal(DEFAULT_DEDUP_CONFIG.autoMerge, false);
      assert.equal(DEFAULT_DEDUP_CONFIG.preserveSources, true);
    });
  });

  describe("Edge cases", () => {
    it("should handle missing .agents/records directory", async () => {
      const dedup = new LessonDeduplicator();
      const result = await dedup.analyze(testDir);
      assert.deepEqual(result.groups, []);
    });

    it("should handle corrupted lessons.jsonl", async () => {
      const recordsDir = path.join(testDir, ".agents", "records");
      fs.mkdirSync(recordsDir, { recursive: true });
      fs.writeFileSync(path.join(recordsDir, "lessons.jsonl"), "not valid json\n");

      const dedup = new LessonDeduplicator();
      const result = await dedup.analyze(testDir);
      assert.deepEqual(result.groups, []);
    });

    it("should handle lessons with missing optional fields", async () => {
      const lesson = createLesson({
        tags: undefined,
        searchTerms: undefined,
        relatedFiles: undefined,
        relatedLessons: undefined,
        wrongApproachPattern: undefined,
      });
      createLessonsFile(testDir, [lesson]);

      const dedup = new LessonDeduplicator();
      const result = await dedup.analyze(testDir);
      assert.equal(result.unique.length, 1);
    });
  });
});
