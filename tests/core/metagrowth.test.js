/**
 * Core MetaGrowth Tests — comprehensive coverage for src/core/metagrowth.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// Import the compiled module
import {
  computeMetaGrowth,
  readMetaGrowth,
  getLatestMetaGrowth,
  persistMetaGrowth,
  estimateTimeToGuard,
  countCommunityContributions,
  computeSpecificity,
} from "../../dist/core/metagrowth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp directory
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "metagrowth-test-"));
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

// Helper to create feedback.jsonl
function createFeedbackFile(dir, feedback) {
  const recordsDir = path.join(dir, ".agents", "records");
  fs.mkdirSync(recordsDir, { recursive: true });
  const filePath = path.join(recordsDir, "feedback.jsonl");
  fs.writeFileSync(filePath, `${feedback.map((f) => JSON.stringify(f)).join("\n")}\n`);
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

describe("Core MetaGrowth", () => {
  let testDir;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  describe("estimateTimeToGuard", () => {
    it("should return placeholder estimate", () => {
      const lessons = [createLesson(), createLesson()];
      const result = estimateTimeToGuard(testDir, lessons);
      assert.equal(result, 72); // 3 days in hours
    });

    it("should return 72 for empty lessons", () => {
      const result = estimateTimeToGuard(testDir, []);
      assert.equal(result, 72);
    });
  });

  describe("countCommunityContributions", () => {
    it("should return 0 (placeholder)", () => {
      const start = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const end = Date.now();
      const result = countCommunityContributions(testDir, start, end);
      assert.equal(result, 0);
    });
  });

  describe("computeSpecificity", () => {
    it("should return 0 for empty lessons", () => {
      assert.equal(computeSpecificity([]), 0);
    });

    it("should compute specificity based on lesson fields", () => {
      const lessons = [
        createLesson({
          wrongApproachPattern: "todo",
          searchTerms: ["todo", "fixme"],
          relatedFiles: ["src/a.ts"],
          tags: ["code"],
          relatedLessons: ["lesson-1"],
        }),
        createLesson({
          wrongApproachPattern: "hack",
          searchTerms: [],
          relatedFiles: [],
          tags: [],
          relatedLessons: [],
        }),
      ];

      const result = computeSpecificity(lessons);

      // First lesson: 0.3 + 0.2 + 0.2 + 0.15 + 0.15 = 1.0
      // Second lesson: 0.3 + 0 + 0 + 0 + 0 = 0.3
      // Average: (1.0 + 0.3) / 2 = 0.65
      assert.ok(result > 0.6 && result < 0.7);
    });

    it("should return 1.0 for fully specified lessons", () => {
      const lessons = [
        createLesson({
          wrongApproachPattern: "todo",
          searchTerms: ["todo"],
          relatedFiles: ["src/a.ts"],
          tags: ["code"],
          relatedLessons: ["lesson-1"],
        }),
        createLesson({
          wrongApproachPattern: "hack",
          searchTerms: ["hack"],
          relatedFiles: ["src/b.ts"],
          tags: ["process"],
          relatedLessons: ["lesson-2"],
        }),
      ];

      const result = computeSpecificity(lessons);
      assert.equal(result, 1.0);
    });

    it("should return 0.3 for lessons with only wrongApproachPattern", () => {
      const lessons = [
        createLesson({
          wrongApproachPattern: "todo",
          searchTerms: [],
          relatedFiles: [],
          tags: [],
          relatedLessons: [],
        }),
      ];

      const result = computeSpecificity(lessons);
      assert.equal(result, 0.3);
    });
  });

  describe("persistMetaGrowth", () => {
    it("should persist snapshot to file", async () => {
      const snapshot = {
        period: "2024-01-01/2024-01-08",
        lessonsCreated: 5,
        lessonsEffective: 3,
        guardFalsePositiveTrend: "improving",
        timeToGuardHours: 48,
        communityContributions: 0,
        lessonSpecificityScore: 0.8,
        lessonsPerWeek: 2.5,
        runtimeEvidenceRatio: 0.6,
        trends: {
          lessonsCreated: "improving",
          lessonsEffective: "stable",
          guardFPRate: "improving",
          timeToGuard: "stable",
        },
        computedAt: new Date().toISOString(),
      };

      await persistMetaGrowth(testDir, snapshot);

      const filePath = path.join(testDir, ".agents", "records", "meta-growth.jsonl");
      assert.ok(fs.existsSync(filePath));
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content.trim());
      assert.equal(parsed.period, "2024-01-01/2024-01-08");
      assert.equal(parsed.lessonsCreated, 5);
    });

    it("should append multiple snapshots", async () => {
      const snapshot1 = {
        period: "2024-01-01/2024-01-08",
        lessonsCreated: 5,
        lessonsEffective: 3,
        guardFalsePositiveTrend: "improving",
        timeToGuardHours: 48,
        communityContributions: 0,
        lessonSpecificityScore: 0.8,
        lessonsPerWeek: 2.5,
        runtimeEvidenceRatio: 0.6,
        trends: {
          lessonsCreated: "improving",
          lessonsEffective: "stable",
          guardFPRate: "improving",
          timeToGuard: "stable",
        },
        computedAt: new Date().toISOString(),
      };

      const snapshot2 = {
        ...snapshot1,
        period: "2024-01-08/2024-01-15",
        lessonsCreated: 3,
      };

      await persistMetaGrowth(testDir, snapshot1);
      await persistMetaGrowth(testDir, snapshot2);

      const filePath = path.join(testDir, ".agents", "records", "meta-growth.jsonl");
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");
      assert.equal(lines.length, 2);
      assert.equal(JSON.parse(lines[0]).period, "2024-01-01/2024-01-08");
      assert.equal(JSON.parse(lines[1]).period, "2024-01-08/2024-01-15");
    });
  });

  describe("readMetaGrowth", () => {
    it("should return empty array for missing file", async () => {
      const result = await readMetaGrowth(testDir);
      assert.deepEqual(result, []);
    });

    it("should read snapshots from file", async () => {
      const snapshot = {
        period: "2024-01-01/2024-01-08",
        lessonsCreated: 5,
        lessonsEffective: 3,
        guardFalsePositiveTrend: "improving",
        timeToGuardHours: 48,
        communityContributions: 0,
        lessonSpecificityScore: 0.8,
        lessonsPerWeek: 2.5,
        runtimeEvidenceRatio: 0.6,
        trends: {
          lessonsCreated: "improving",
          lessonsEffective: "stable",
          guardFPRate: "improving",
          timeToGuard: "stable",
        },
        computedAt: new Date().toISOString(),
      };

      await persistMetaGrowth(testDir, snapshot);

      const result = await readMetaGrowth(testDir);
      assert.equal(result.length, 1);
      assert.equal(result[0].period, "2024-01-01/2024-01-08");
    });

    it("should read multiple snapshots", async () => {
      const snapshot1 = {
        period: "2024-01-01/2024-01-08",
        lessonsCreated: 5,
        lessonsEffective: 3,
        guardFalsePositiveTrend: "improving",
        timeToGuardHours: 48,
        communityContributions: 0,
        lessonSpecificityScore: 0.8,
        lessonsPerWeek: 2.5,
        runtimeEvidenceRatio: 0.6,
        trends: {
          lessonsCreated: "improving",
          lessonsEffective: "stable",
          guardFPRate: "improving",
          timeToGuard: "stable",
        },
        computedAt: new Date().toISOString(),
      };

      const snapshot2 = {
        ...snapshot1,
        period: "2024-01-08/2024-01-15",
        lessonsCreated: 3,
      };

      await persistMetaGrowth(testDir, snapshot1);
      await persistMetaGrowth(testDir, snapshot2);

      const result = await readMetaGrowth(testDir);
      assert.equal(result.length, 2);
    });

    it("should handle corrupted file gracefully", async () => {
      const recordsDir = path.join(testDir, ".agents", "records");
      fs.mkdirSync(recordsDir, { recursive: true });
      fs.writeFileSync(path.join(recordsDir, "meta-growth.jsonl"), "not valid json\n");

      const result = await readMetaGrowth(testDir);
      assert.deepEqual(result, []);
    });
  });

  describe("getLatestMetaGrowth", () => {
    it("should return null for empty file", async () => {
      const result = await getLatestMetaGrowth(testDir);
      assert.equal(result, null);
    });

    it("should return latest snapshot", async () => {
      const snapshot1 = {
        period: "2024-01-01/2024-01-08",
        lessonsCreated: 5,
        lessonsEffective: 3,
        guardFalsePositiveTrend: "improving",
        timeToGuardHours: 48,
        communityContributions: 0,
        lessonSpecificityScore: 0.8,
        lessonsPerWeek: 2.5,
        runtimeEvidenceRatio: 0.6,
        trends: {
          lessonsCreated: "improving",
          lessonsEffective: "stable",
          guardFPRate: "improving",
          timeToGuard: "stable",
        },
        computedAt: new Date().toISOString(),
      };

      const snapshot2 = {
        ...snapshot1,
        period: "2024-01-08/2024-01-15",
        lessonsCreated: 3,
      };

      await persistMetaGrowth(testDir, snapshot1);
      await persistMetaGrowth(testDir, snapshot2);

      const result = await getLatestMetaGrowth(testDir);
      assert.ok(result !== null);
      assert.equal(result.period, "2024-01-08/2024-01-15");
    });
  });

  describe("computeMetaGrowth", () => {
    it("should compute snapshot for period with lessons", async () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const periodEnd = now.toISOString().split("T")[0];
      const period = `${periodStart}/${periodEnd}`;

      const lessons = [
        createLesson({
          createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createLesson({
          createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      createLessonsFile(testDir, lessons);

      const feedback = [
        { id: "fb1", lessonId: lessons[0].id, label: "TP", timestamp: new Date().toISOString() },
        { id: "fb2", lessonId: lessons[1].id, label: "FP", timestamp: new Date().toISOString() },
      ];
      createFeedbackFile(testDir, feedback);

      const options = { projectRoot: testDir, period };
      const result = await computeMetaGrowth(options);

      assert.equal(result.period, period);
      assert.equal(result.lessonsCreated, 2);
      assert.ok(typeof result.lessonsEffective === "number");
      assert.ok(["improving", "stable", "degrading"].includes(result.guardFalsePositiveTrend));
      assert.ok(typeof result.timeToGuardHours === "number");
      assert.equal(result.communityContributions, 0);
      assert.ok(typeof result.lessonSpecificityScore === "number");
      assert.ok(typeof result.lessonsPerWeek === "number");
      assert.ok(typeof result.runtimeEvidenceRatio === "number");
      assert.ok(result.trends);
      assert.ok(result.computedAt);
    });

    it("should handle period with no lessons", async () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const periodEnd = now.toISOString().split("T")[0];
      const period = `${periodStart}/${periodEnd}`;

      const options = { projectRoot: testDir, period };
      const result = await computeMetaGrowth(options);

      assert.equal(result.lessonsCreated, 0);
      assert.equal(result.lessonsEffective, 0);
      assert.equal(result.runtimeEvidenceRatio, 0);
      assert.equal(result.lessonSpecificityScore, 0);
      assert.equal(result.lessonsPerWeek, 0);
    });

    it("should compute trends correctly for improving FPRate", async () => {
      const periodStart = new Date("2024-01-01T00:00:00.000Z");
      const periodEnd = new Date("2024-01-08T00:00:00.000Z");
      const period = `${periodStart.toISOString().split("T")[0]}/${periodEnd.toISOString().split("T")[0]}`;

      const feedback = [
        // First half: high FP rate (Jan 1-3)
        {
          id: "fb1",
          guardId: "hollowArtifact",
          ticketId: "tk-1",
          findingHash: "abc123",
          label: "FP",
          source: "cli",
          executor: "test",
          timestamp: "2024-01-01T12:00:00.000Z",
        },
        {
          id: "fb2",
          guardId: "hollowArtifact",
          ticketId: "tk-1",
          findingHash: "def456",
          label: "FP",
          source: "cli",
          executor: "test",
          timestamp: "2024-01-02T12:00:00.000Z",
        },
        {
          id: "fb3",
          guardId: "hollowArtifact",
          ticketId: "tk-1",
          findingHash: "ghi789",
          label: "TP",
          source: "cli",
          executor: "test",
          timestamp: "2024-01-03T12:00:00.000Z",
        },
        // Second half: low FP rate (Jan 5-7)
        {
          id: "fb4",
          guardId: "hollowArtifact",
          ticketId: "tk-2",
          findingHash: "jkl012",
          label: "TP",
          source: "cli",
          executor: "test",
          timestamp: "2024-01-05T12:00:00.000Z",
        },
        {
          id: "fb5",
          guardId: "hollowArtifact",
          ticketId: "tk-2",
          findingHash: "mno345",
          label: "TP",
          source: "cli",
          executor: "test",
          timestamp: "2024-01-06T12:00:00.000Z",
        },
      ];
      createFeedbackFile(testDir, feedback);

      const options = { projectRoot: testDir, period };
      const result = await computeMetaGrowth(options);

      assert.equal(result.guardFalsePositiveTrend, "improving");
    });

    it("should persist computed snapshot", async () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const periodEnd = now.toISOString().split("T")[0];
      const period = `${periodStart}/${periodEnd}`;

      const lessons = [createLesson()];
      createLessonsFile(testDir, lessons);

      const options = { projectRoot: testDir, period };
      await computeMetaGrowth(options);

      const snapshots = await readMetaGrowth(testDir);
      assert.equal(snapshots.length, 1);
      assert.equal(snapshots[0].period, period);
    });
  });

  describe("MetaGrowthOptions", () => {
    it("should have correct structure", () => {
      const options = {
        projectRoot: "/test",
        period: "2024-01-01/2024-01-08",
      };
      assert.equal(options.projectRoot, "/test");
      assert.equal(options.period, "2024-01-01/2024-01-08");
    });
  });
});
