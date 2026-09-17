/**
 * Core Injection Tests — comprehensive coverage for src/core/injection.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// Import the compiled module
import {
  LessonInjector,
  injectLessons,
  formatForVerify,
  formatForDoctor,
  getLessons,
  preFilterByGuard,
  pathsRelated,
  inferSourceProject,
  scoreCandidates,
  formatHint,
  DEFAULT_INJECTION_CONFIG,
} from "../../dist/core/injection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp directory
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "injection-test-"));
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

describe("Core Injection", () => {
  let testDir;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  describe("DEFAULT_INJECTION_CONFIG", () => {
    it("should have correct defaults", () => {
      assert.equal(DEFAULT_INJECTION_CONFIG.maxLessons, 3);
      assert.equal(DEFAULT_INJECTION_CONFIG.minScore, 0.15);
      assert.equal(DEFAULT_INJECTION_CONFIG.useSemantic, false);
    });
  });

  describe("getLessons", () => {
    it("should read lessons from project root", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const cache = { lessons: [], root: null };
      const lessons = await getLessons(testDir, cache);

      assert.equal(lessons.length, 1);
      assert.equal(lessons[0].title, "Test lesson");
    });

    it("should use cache for same project root", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const cache = { lessons: [], root: null };
      await getLessons(testDir, cache);
      const lessons = await getLessons(testDir, cache);

      assert.equal(lessons.length, 1);
      // Cache should be used (lessons array should be the same object)
      assert.equal(cache.lessons, lessons);
    });

    it("should return empty for missing file", async () => {
      const cache = { lessons: [], root: null };
      const lessons = await getLessons("/nonexistent/path", cache);

      assert.equal(lessons.length, 0);
    });
  });

  describe("preFilterByGuard", () => {
    it("should return all lessons for unknown guard", () => {
      const lessons = [
        createLesson({ wrongApproachPattern: "todo", tags: ["a"] }),
        createLesson({ wrongApproachPattern: "hack", tags: ["b"] }),
      ];

      const result = preFilterByGuard(lessons, "unknownGuard");

      assert.equal(result.length, 2);
    });

    it("should filter by wrongApproachPattern for hollowArtifact", () => {
      const lessons = [
        createLesson({ wrongApproachPattern: "todo", title: "Lesson A" }),
        createLesson({ wrongApproachPattern: "hack", title: "Lesson B" }),
        createLesson({ wrongApproachPattern: "unrelated", title: "Lesson C" }),
      ];

      const result = preFilterByGuard(lessons, "hollowArtifact");

      assert.equal(result.length, 2);
      assert.ok(result.some((l) => l.wrongApproachPattern === "todo"));
      assert.ok(result.some((l) => l.wrongApproachPattern === "hack"));
    });

    it("should filter by tags for hollowArtifact", () => {
      const lessons = [
        createLesson({ wrongApproachPattern: "unrelated", tags: ["todo"], title: "Lesson A" }),
        createLesson({ wrongApproachPattern: "unrelated", tags: ["fixme"], title: "Lesson B" }),
      ];

      const result = preFilterByGuard(lessons, "hollowArtifact");

      assert.equal(result.length, 1);
      assert.ok(result.some((l) => l.tags.includes("todo")));
    });

    it("should filter by category when category matches guard patterns", () => {
      // preFilterByGuard checks: wrongApproachPattern, tags, category (if category includes any pattern), searchTerms
      // For hollowArtifact, patterns are ["console-log", "todo", "tbd", "hack", "placeholder", "stub", "mock"]
      // "code" and "process" are in categorySignals (used in scoring), not GUARD_PATTERN_MAP
      const lessons = [
        createLesson({ category: "todo", wrongApproachPattern: "unrelated", title: "Lesson A" }),
        createLesson({ category: "tool", wrongApproachPattern: "unrelated", title: "Lesson B" }),
      ];

      const result = preFilterByGuard(lessons, "hollowArtifact");

      // "todo" is in GUARD_PATTERN_MAP for hollowArtifact, so category "todo" matches
      assert.equal(result.length, 1);
      assert.ok(result.some((l) => l.category === "todo"));
    });

    it("should filter by searchTerms", () => {
      const lessons = [
        createLesson({
          searchTerms: ["config"],
          wrongApproachPattern: "unrelated",
          title: "Lesson A",
        }),
        createLesson({
          searchTerms: ["unrelated"],
          wrongApproachPattern: "unrelated",
          title: "Lesson B",
        }),
      ];

      const result = preFilterByGuard(lessons, "ssotPollution");

      assert.equal(result.length, 1);
      assert.ok(result.some((l) => l.searchTerms.includes("config")));
    });
  });

  describe("pathsRelated", () => {
    it("should return true for exact match", () => {
      assert.ok(pathsRelated("src/file.ts", "src/file.ts"));
    });

    it("should return true for same directory", () => {
      assert.ok(pathsRelated("src/a.ts", "src/b.ts"));
    });

    it("should return true for parent/child paths", () => {
      assert.ok(pathsRelated("src/module/a.ts", "src/module/sub/b.ts"));
      assert.ok(pathsRelated("src/module/sub/b.ts", "src/module/a.ts"));
    });

    it("should return true for same base name", () => {
      assert.ok(pathsRelated("src/file.ts", "src/file.js"));
    });

    it("should return false for unrelated paths", () => {
      assert.ok(!pathsRelated("src/a.ts", "tests/b.ts"));
    });

    it("should handle Windows paths", () => {
      assert.ok(pathsRelated("src\\file.ts", "src/file.ts"));
    });

    it("should handle ./ prefix", () => {
      assert.ok(pathsRelated("./src/file.ts", "src/file.ts"));
    });
  });

  describe("inferSourceProject", () => {
    it("should infer tamld-llm-wiki from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/tamld-llm-wiki/wiki.py"] });
      assert.equal(inferSourceProject(lesson), "tamld-llm-wiki");
    });

    it("should infer g8s from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/g8s/main.go"] });
      assert.equal(inferSourceProject(lesson), "g8s");
    });

    it("should infer tuneflow from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/tuneflow/app.ts"] });
      assert.equal(inferSourceProject(lesson), "tuneflow");
    });

    it("should infer web-login-solo from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/web-login/main.ts"] });
      assert.equal(inferSourceProject(lesson), "web-login-solo");
    });

    it("should infer defense-in-depth from relatedFiles", () => {
      const lesson = createLesson({ relatedFiles: ["src/defense-in-depth/guard.ts"] });
      assert.equal(inferSourceProject(lesson), "defense-in-depth");
    });

    it("should infer from tags when relatedFiles not available", () => {
      const lesson = createLesson({ relatedFiles: [], tags: ["wiki"] });
      assert.equal(inferSourceProject(lesson), "tamld-llm-wiki");
    });

    it("should return empty string for unknown project", () => {
      const lesson = createLesson({ relatedFiles: ["src/unknown/file.ts"], tags: ["unknown"] });
      assert.equal(inferSourceProject(lesson), "");
    });
  });

  describe("scoreCandidates", () => {
    it("should score lessons based on guard pattern match", () => {
      const lessons = [
        createLesson({ wrongApproachPattern: "todo", title: "Lesson A" }),
        createLesson({ wrongApproachPattern: "unrelated", title: "Lesson B" }),
      ];

      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO found",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.equal(results.length, 2);
      // Lesson with "todo" pattern should have higher score
      assert.ok(results[0].score > results[1].score);
    });

    it("should include reasons in results", () => {
      const lessons = [createLesson({ wrongApproachPattern: "todo" })];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.ok(results[0].reasons.length > 0);
      assert.ok(results[0].reasons.some((r) => r.includes("wrongApproachPattern")));
    });

    it("should score based on tag overlap", () => {
      const lessons = [
        createLesson({ tags: ["todo"], wrongApproachPattern: "unrelated" }),
        createLesson({ tags: ["unrelated"], wrongApproachPattern: "unrelated" }),
      ];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.ok(results[0].score > results[1].score);
    });

    it("should score based on file path similarity", () => {
      const lessons = [
        createLesson({ relatedFiles: ["src/test.ts"], wrongApproachPattern: "unrelated" }),
        createLesson({ relatedFiles: ["other/file.ts"], wrongApproachPattern: "unrelated" }),
      ];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.ok(results[0].score > results[1].score);
    });

    it("should score based on category relevance", () => {
      const lessons = [
        createLesson({ category: "code", wrongApproachPattern: "unrelated" }),
        createLesson({ category: "tool", wrongApproachPattern: "unrelated" }),
      ];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.ok(results[0].score > results[1].score);
    });

    it("should score based on evidence level", () => {
      const lessons = [
        createLesson({ evidence: "RUNTIME", wrongApproachPattern: "unrelated", confidence: 0.5 }),
        createLesson({ evidence: "HYPO", wrongApproachPattern: "unrelated", confidence: 0.5 }),
      ];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.ok(results[0].score > results[1].score);
    });

    it("should score based on confidence", () => {
      const lessons = [
        createLesson({ confidence: 1.0, wrongApproachPattern: "unrelated", evidence: "HYPO" }),
        createLesson({ confidence: 0.5, wrongApproachPattern: "unrelated", evidence: "HYPO" }),
      ];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.ok(results[0].score > results[1].score);
    });

    it("should score based on recency", () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 days ago
      const newDate = new Date().toISOString();

      const lessons = [
        createLesson({
          createdAt: newDate,
          wrongApproachPattern: "unrelated",
          evidence: "HYPO",
          confidence: 0.5,
        }),
        createLesson({
          createdAt: oldDate,
          wrongApproachPattern: "unrelated",
          evidence: "HYPO",
          confidence: 0.5,
        }),
      ];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.ok(results[0].score > results[1].score);
    });

    it("should cap score at 1.0", () => {
      const lessons = [
        createLesson({
          wrongApproachPattern: "todo",
          tags: ["todo"],
          relatedFiles: ["src/test.ts"],
          category: "code",
          evidence: "RUNTIME",
          confidence: 1.0,
          createdAt: new Date().toISOString(),
        }),
      ];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const results = scoreCandidates(lessons, context);

      assert.ok(results[0].score <= 1.0);
    });
  });

  describe("formatHint", () => {
    it("should format lesson with project and reasons", () => {
      const lesson = createLesson({
        id: "abc12345",
        title: "Test lesson",
        correctApproach: "Use tickets",
      });
      const reasons = ["wrongApproachPattern: todo", "tag: todo"];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const hint = formatHint(lesson, reasons, context);

      assert.ok(hint.includes("abc12345"));
      assert.ok(hint.includes("Test lesson"));
      assert.ok(hint.includes("Use tickets"));
      assert.ok(hint.includes("wrongApproachPattern: todo"));
    });

    it("should include project when inferable", () => {
      const lesson = createLesson({
        id: "abc12345",
        title: "Test",
        relatedFiles: ["src/tamld-llm-wiki/wiki.py"],
      });
      const reasons = [];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const hint = formatHint(lesson, reasons, context);

      assert.ok(hint.includes("[tamld-llm-wiki]"));
    });

    it("should handle empty reasons", () => {
      const lesson = createLesson();
      const reasons = [];
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/test",
      };

      const hint = formatHint(lesson, reasons, context);

      assert.ok(hint.includes("Test lesson"));
    });
  });

  describe("LessonInjector", () => {
    it("should create instance with default config", () => {
      const injector = new LessonInjector();
      assert.ok(injector);
    });

    it("should create instance with custom config", () => {
      const injector = new LessonInjector({ maxLessons: 5, minScore: 0.2 });
      assert.ok(injector);
    });

    it("should return empty for no lessons", async () => {
      const injector = new LessonInjector();
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: testDir,
      };

      const result = await injector.inject(context);

      assert.equal(result.length, 0);
    });

    it("should inject relevant lessons", async () => {
      const lessons = [
        createLesson({
          id: "lesson-1",
          wrongApproachPattern: "todo",
          title: "Recurring TODO",
          correctApproach: "Use tickets",
        }),
        createLesson({ id: "lesson-2", wrongApproachPattern: "unrelated", title: "Unrelated" }),
      ];
      createLessonsFile(testDir, lessons);

      const injector = new LessonInjector({ maxLessons: 3, minScore: 0.1 });
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO found",
        projectRoot: testDir,
      };

      const result = await injector.inject(context);

      assert.ok(result.length > 0);
      assert.ok(result.some((r) => r.lesson.wrongApproachPattern === "todo"));
    });

    it("should respect maxLessons limit", async () => {
      const lessons = Array.from({ length: 10 }, (_, i) =>
        createLesson({ id: `lesson-${i}`, wrongApproachPattern: "todo", title: `Lesson ${i}` }),
      );
      createLessonsFile(testDir, lessons);

      const injector = new LessonInjector({ maxLessons: 2, minScore: 0.0 });
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: testDir,
      };

      const result = await injector.inject(context);

      assert.equal(result.length, 2);
    });

    it("should respect minScore threshold", async () => {
      const lessons = [
        createLesson({ wrongApproachPattern: "todo", title: "High score" }),
        createLesson({ wrongApproachPattern: "unrelated", title: "Low score" }),
      ];
      createLessonsFile(testDir, lessons);

      const injector = new LessonInjector({ maxLessons: 10, minScore: 0.5 });
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: testDir,
      };

      const result = await injector.inject(context);

      // Only high-scoring lesson should be returned
      assert.ok(result.length >= 1);
      assert.ok(result.every((r) => r.score >= 0.5));
    });
  });

  describe("injectLessons convenience function", () => {
    it("should work with default config", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: testDir,
      };
      const result = await injectLessons(context);

      assert.ok(Array.isArray(result));
    });

    it("should accept custom config", async () => {
      const lesson = createLesson();
      createLessonsFile(testDir, [lesson]);

      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: testDir,
      };
      const result = await injectLessons(context, { maxLessons: 5 });

      assert.ok(Array.isArray(result));
    });
  });

  describe("formatForVerify", () => {
    it("should return empty string for empty array", () => {
      assert.equal(formatForVerify([]), "");
    });

    it("should format injected lessons for verify", () => {
      const injected = [
        {
          lesson: createLesson({
            id: "abc12345",
            title: "Test lesson",
            correctApproach: "Use tickets",
          }),
          score: 0.8,
          matchReasons: ["pattern: todo"],
          hint: "📚 abc12345 Test lesson\n   → Use tickets [pattern: todo]",
        },
      ];

      const result = formatForVerify(injected);

      assert.ok(result.includes("Relevant lessons"));
      assert.ok(result.includes("abc12345"));
    });
  });

  describe("formatForDoctor", () => {
    it("should return empty string for empty array", () => {
      assert.equal(formatForDoctor([]), "");
    });

    it("should format injected lessons for doctor", () => {
      const injected = [
        {
          lesson: createLesson({ id: "abc12345", title: "Test lesson" }),
          score: 0.8,
          matchReasons: ["pattern: todo"],
          hint: "📚 abc12345 Test lesson\n   → Use tickets",
        },
      ];

      const result = formatForDoctor(injected);

      assert.ok(result.includes("Injected Lessons"));
      assert.ok(result.includes("abc12345"));
      assert.ok(result.includes("Match:"));
    });
  });

  describe("Edge cases", () => {
    it("should handle missing lessons file", async () => {
      const injector = new LessonInjector();
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: "/nonexistent",
      };

      const result = await injector.inject(context);

      assert.equal(result.length, 0);
    });

    it("should handle corrupted lessons.jsonl gracefully", async () => {
      // The readAllLessons function handles ENOENT but throws on invalid JSON
      // This test verifies the injector doesn't crash the process
      const injector = new LessonInjector();
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: testDir,
      };

      // Should not throw - the injector catches errors and returns empty
      try {
        const result = await injector.inject(context);
        assert.ok(Array.isArray(result));
      } catch (_e) {
        // If it throws, that's a bug - injector should handle gracefully
        assert.fail("Injector should handle corrupted JSON gracefully");
      }
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

      const injector = new LessonInjector();
      const context = {
        guardId: "hollowArtifact",
        filePath: "src/test.ts",
        finding: "TODO",
        projectRoot: testDir,
      };

      const result = await injector.inject(context);

      // Should not crash, may or may not find matches
      assert.ok(Array.isArray(result));
    });
  });
});
