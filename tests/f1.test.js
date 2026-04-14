// F1 Score computation tests
import test from "node:test";
import assert from "node:assert";
import { computeF1, gradeF1, formatF1Summary } from "../dist/core/f1.js";

test("F1 Score Computation", async (t) => {
  await t.test("perfect guard: 100% precision and recall", async () => {
    const metric = computeF1("hollowArtifact", "2026-04/2026-04", 100, 20, 0, 0);
    assert.strictEqual(metric.precision, 1);
    assert.strictEqual(metric.recall, 1);
    assert.strictEqual(metric.f1, 1);
    assert.strictEqual(metric.guardId, "hollowArtifact");
  });

  await t.test("all false positives: 0% precision", async () => {
    const metric = computeF1("hollowArtifact", "2026-04/2026-04", 100, 0, 10, 0);
    assert.strictEqual(metric.precision, 0);
    assert.strictEqual(metric.recall, 0);
    assert.strictEqual(metric.f1, 0);
  });

  await t.test("all false negatives: 0% recall", async () => {
    const metric = computeF1("hollowArtifact", "2026-04/2026-04", 100, 0, 0, 10);
    assert.strictEqual(metric.precision, 0);
    assert.strictEqual(metric.recall, 0);
    assert.strictEqual(metric.f1, 0);
  });

  await t.test("realistic scenario: mixed results", async () => {
    // 80 TP, 10 FP, 5 FN → P=0.889, R=0.941, F1=0.914
    const metric = computeF1("hollowArtifact", "2026-04/2026-04", 200, 80, 10, 5);
    assert.ok(metric.precision > 0.88 && metric.precision < 0.90, `Precision ${metric.precision}`);
    assert.ok(metric.recall > 0.93 && metric.recall < 0.95, `Recall ${metric.recall}`);
    assert.ok(metric.f1 > 0.91 && metric.f1 < 0.92, `F1 ${metric.f1}`);
  });

  await t.test("zero runs edge case", async () => {
    const metric = computeF1("hollowArtifact", "2026-04/2026-04", 0, 0, 0, 0);
    assert.strictEqual(metric.precision, 0);
    assert.strictEqual(metric.recall, 0);
    assert.strictEqual(metric.f1, 0);
  });

  await t.test("gradeF1 returns correct labels", async () => {
    assert.strictEqual(gradeF1(0.95), "EXCELLENT");
    assert.strictEqual(gradeF1(0.75), "GOOD");
    assert.strictEqual(gradeF1(0.55), "FAIR");
    assert.strictEqual(gradeF1(0.35), "POOR");
    assert.strictEqual(gradeF1(0.15), "CRITICAL");
  });

  await t.test("formatF1Summary produces readable output", async () => {
    const metric = computeF1("hollowArtifact", "2026-04/2026-04", 100, 80, 10, 5);
    const summary = formatF1Summary(metric);
    assert.ok(summary.includes("[hollowArtifact]"));
    assert.ok(summary.includes("F1="));
    assert.ok(summary.includes("Grade="));
  });
});
