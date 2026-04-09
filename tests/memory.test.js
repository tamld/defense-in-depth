// Executor: Gemini-CLI
// [PROVEN] Ensure memory is isolated
import test from "node:test";
import assert from "node:assert";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { recordLesson, searchLessons, recordGrowthMetric } from "../dist/core/memory.js";
import { EvidenceLevel } from "../dist/core/types.js";

test("Memory Layer: Lesson and Growth Metrics tracking", async (t) => {
  let tempDir;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "defense-memory-test-"));

  await t.test("should record a new lesson to lessons.jsonl", async () => {
    const payload = {
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
    const payload = {
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

  } finally {
    // [PROVEN] Cleanup isolated directory cleanly
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
});
