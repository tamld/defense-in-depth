import test from "node:test";
import assert from "node:assert";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { recordLesson, searchLessons, recordGrowthMetric } from "../src/core/memory.js";
import { EvidenceLevel, Lesson, GrowthMetric } from "../src/core/types.js";

test("Memory Layer: Lesson and Growth Metrics tracking", async (t) => {
  // Create a temporary directory for tests to avoid writing to actual project root
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "defense-memory-test-"));

  await t.test("should record a new lesson to lessons.jsonl", async () => {
    const payload: Omit<Lesson, "id" | "createdAt"> = {
      title: "Test Lesson",
      scenario: "Running memory tests",
      wrongApproach: "Not testing",
      correctApproach: "Writing tests",
      insight: "Tests are good",
      category: "code",
      evidence: EvidenceLevel.RUNTIME,
      confidence: 0.9,
      searchTerms: ["test", "memory"],
    };

    const recorded = await recordLesson(payload, tempDir);
    
    assert.ok(recorded.id, "ID should be generated");
    assert.ok(recorded.createdAt, "Timestamp should be generated");
    assert.strictEqual(recorded.title, "Test Lesson");

    // File should exist and contain the recorded lesson
    const lessonsPath = path.join(tempDir, "lessons.jsonl");
    const content = await fs.readFile(lessonsPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    assert.strictEqual(lines.length, 1);
    
    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.id, recorded.id);
  });

  await t.test("should search lessons by keywords", async () => {
    // We expect the previous lesson to be returned
    const results = await searchLessons("memory", tempDir);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].title, "Test Lesson");

    // Case-insensitive search
    const resultsUpper = await searchLessons("TEST", tempDir);
    assert.strictEqual(resultsUpper.length, 1);

    // Unmatched search
    const empty = await searchLessons("nonexistentkeyword", tempDir);
    assert.strictEqual(empty.length, 0);
  });

  await t.test("should record a growth metric", async () => {
    const payload: Omit<GrowthMetric, "measuredAt"> = {
      name: "guard_false_positive_rate",
      value: 0.05,
      unit: "percentage",
      trend: "improving",
    };

    const recorded = await recordGrowthMetric(payload, tempDir);

    assert.ok(recorded.measuredAt, "Timestamp should be generated");
    assert.strictEqual(recorded.name, "guard_false_positive_rate");

    // Verify file output
    const metricPath = path.join(tempDir, "growth_metrics.jsonl");
    const content = await fs.readFile(metricPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    assert.strictEqual(lines.length, 1);

    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.value, 0.05);
  });

  // Cleanup
  await fs.rm(tempDir, { recursive: true, force: true });
});
