/**
 * Guard F1 Score Computation Utility
 *
 * Computes Information Retrieval metrics for guard pipeline effectiveness.
 * Used by the growth/meta layers to track whether guards are helping or annoying.
 *
 * @module core/f1
 */

import type { GuardF1Metric } from "./types.js";

/**
 * Compute F1 metric from raw confusion matrix counts.
 *
 * @param guardId - Guard being measured
 * @param period - ISO interval string (e.g., "2026-04-01/2026-04-15")
 * @param totalRuns - Total guard executions in the period
 * @param tp - True positives (correctly flagged issues)
 * @param fp - False positives (incorrectly flagged clean code)
 * @param fn - False negatives (missed real issues)
 */
export function computeF1(
  guardId: string,
  period: string,
  totalRuns: number,
  tp: number,
  fp: number,
  fn: number,
): GuardF1Metric {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0;

  return {
    guardId,
    period,
    totalRuns,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Interpret an F1 score as a human-readable quality grade.
 *
 * @param f1 - The computed F1 score (0 to 1)
 * @returns A string grade (e.g. "EXCELLENT", "POOR")
 */
export function gradeF1(f1: number): string {
  if (f1 >= 0.9) return "EXCELLENT";
  if (f1 >= 0.7) return "GOOD";
  if (f1 >= 0.5) return "FAIR";
  if (f1 >= 0.3) return "POOR";
  return "CRITICAL";
}

/**
 * Format a GuardF1Metric as a human-readable summary line.
 *
 * @param metric - The computed F1 metric object
 * @returns A formatted string summary
 */
export function formatF1Summary(metric: GuardF1Metric): string {
  const grade = gradeF1(metric.f1);
  return `[${metric.guardId}] F1=${metric.f1.toFixed(3)} (P=${metric.precision.toFixed(3)} R=${metric.recall.toFixed(3)}) Grade=${grade} | TP=${metric.truePositives} FP=${metric.falsePositives} FN=${metric.falseNegatives} Runs=${metric.totalRuns}`;
}
