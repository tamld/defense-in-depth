/**
 * Metrics CLI — F1 aggregation and guard effectiveness reporting.
 *
 * Provides `did metrics f1` to compute and display F1 scores across all guards
 * from the feedback JSONL records.
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeF1FromFeedback } from "../core/feedback.js";
import { allBuiltinGuards } from "../guards/index.js";
import { computeMetaGrowth } from "../core/metagrowth.js";
import type { GuardF1Metric } from "../core/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Parse a period string like "30d" or "2026-09-01/2026-09-30" into ISO interval */
export function parsePeriod(period: string): string {
  // If already contains "/", assume it's an ISO interval
  if (period.includes("/")) return period;

  // Parse relative durations like "30d", "7d", "90d", "12m"
  const match = period.match(/^(\d+)([dwm])$/);
  if (!match) {
    throw new Error(
      `Invalid period format: "${period}". Use "30d", "7d", "90d", "12m" or "2026-09-01/2026-09-30"`,
    );
  }

  const value = Number(match[1]);
  const unit = match[2];

  const end = new Date();
  // Set end to end of day (23:59:59.999) to make period inclusive
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  switch (unit) {
    case "d":
      start.setDate(start.getDate() - value);
      break;
    case "w":
      start.setDate(start.getDate() - value * 7);
      break;
    case "m":
      start.setMonth(start.getMonth() - value);
      break;
    default:
      throw new Error(`Unknown period unit: ${unit}`);
  }

  // Start at beginning of day (00:00:00.000)
  start.setHours(0, 0, 0, 0);

  return `${start.toISOString().split("T")[0]}/${end.toISOString()}`;
}

/** Compute F1 metrics for all guards (or a specific one) */
export async function computeAllF1(
  projectRoot: string,
  period: string,
  guardId?: string,
): Promise<GuardF1Metric[]> {
  const guards = guardId ? allBuiltinGuards.filter((g) => g.id === guardId) : allBuiltinGuards;

  const results: GuardF1Metric[] = [];

  for (const guard of guards) {
    try {
      const metric = computeF1FromFeedback(projectRoot, guard.id, period);
      results.push(metric);
    } catch (_error) {
      // Guard might not have any feedback events — return zero metric
      const { computeF1 } = await import("../core/f1.js");
      results.push(computeF1(guard.id, period, 0, 0, 0, 0));
    }
  }

  return results;
}

/** Format metrics as JSON */
export function formatJson(metrics: GuardF1Metric[], period: string): string {
  const overall = computeOverall(metrics);
  return JSON.stringify(
    {
      window: period,
      guards: Object.fromEntries(metrics.map((m) => [m.guardId, m])),
      overall,
    },
    null,
    2,
  );
}

/** Format metrics as table */
export function formatTable(metrics: GuardF1Metric[], period: string): string {
  const overall = computeOverall(metrics);

  const header = ["Guard ID", "F1", "Precision", "Recall", "Grade", "TP", "FP", "FN", "Runs"];

  const rows = metrics.map((m) => [
    m.guardId,
    m.f1.toFixed(3),
    m.precision.toFixed(3),
    m.recall.toFixed(3),
    gradeF1(m.f1),
    m.truePositives.toString(),
    m.falsePositives.toString(),
    m.falseNegatives.toString(),
    m.totalRuns.toString(),
  ]);

  // Add overall row
  rows.push([
    "OVERALL",
    overall.macroF1.toFixed(3),
    overall.macroPrecision.toFixed(3),
    overall.macroRecall.toFixed(3),
    gradeF1(overall.macroF1),
    overall.totalTP.toString(),
    overall.totalFP.toString(),
    overall.totalFN.toString(),
    overall.totalRuns.toString(),
  ]);

  const allRows = [header, ...rows];
  const colWidths = header.map((_, i) => Math.max(...allRows.map((r) => r[i].length)));

  const formatRow = (row: string[]) => row.map((cell, i) => cell.padEnd(colWidths[i])).join(" | ");

  const separator = colWidths.map((w) => "-".repeat(w)).join("-+-");

  return (
    `\nPeriod: ${period}\n\n` +
    formatRow(header) +
    "\n" +
    separator +
    "\n" +
    rows.map(formatRow).join("\n") +
    "\n"
  );
}

/** Format metrics as summary (default) */
export function formatSummary(metrics: GuardF1Metric[], period: string): string {
  const overall = computeOverall(metrics);

  const lines = [
    `\n📊 Guard F1 Metrics — ${period}`,
    `═══════════════════════════════════════`,
    `Overall:  F1=${overall.macroF1.toFixed(3)} (Macro) | F1=${overall.microF1.toFixed(3)} (Micro)`,
    `          Precision=${overall.macroPrecision.toFixed(3)} Recall=${overall.macroRecall.toFixed(3)} | Grade=${gradeF1(overall.macroF1)}`,
    `          TP=${overall.totalTP} FP=${overall.totalFP} FN=${overall.totalFN} Runs=${overall.totalRuns}`,
    "",
    "Per-Guard:",
  ];

  // Sort by F1 descending
  const sorted = [...metrics].sort((a, b) => b.f1 - a.f1);

  for (const m of sorted) {
    const grade = gradeF1(m.f1);
    const gradeIcon =
      grade === "EXCELLENT"
        ? "🟢"
        : grade === "GOOD"
          ? "🟡"
          : grade === "FAIR"
            ? "🟠"
            : grade === "POOR"
              ? "🔴"
              : "⚫";
    lines.push(
      `  ${gradeIcon} ${m.guardId.padEnd(24)} F1=${m.f1.toFixed(3)} P=${m.precision.toFixed(3)} R=${m.recall.toFixed(3)} | TP=${m.truePositives} FP=${m.falsePositives} FN=${m.falseNegatives}`,
    );
  }

  // Guards with zero data
  const zeroData = metrics.filter((m) => m.totalRuns === 0);
  if (zeroData.length > 0) {
    lines.push("");
    lines.push("  ⚪ No data (0 runs):");
    for (const m of zeroData) {
      lines.push(`     ${m.guardId}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

interface OverallMetrics {
  macroF1: number;
  macroPrecision: number;
  macroRecall: number;
  microF1: number;
  totalTP: number;
  totalFP: number;
  totalFN: number;
  totalRuns: number;
}

export function computeOverall(metrics: GuardF1Metric[]): OverallMetrics {
  // Macro: average of per-guard metrics
  const withData = metrics.filter((m) => m.totalRuns > 0);
  const macroF1 =
    withData.length > 0 ? withData.reduce((s, m) => s + m.f1, 0) / withData.length : 0;
  const macroPrecision =
    withData.length > 0 ? withData.reduce((s, m) => s + m.precision, 0) / withData.length : 0;
  const macroRecall =
    withData.length > 0 ? withData.reduce((s, m) => s + m.recall, 0) / withData.length : 0;

  // Micro: aggregate TP/FP/FN then compute
  const totalTP = metrics.reduce((s, m) => s + m.truePositives, 0);
  const totalFP = metrics.reduce((s, m) => s + m.falsePositives, 0);
  const totalFN = metrics.reduce((s, m) => s + m.falseNegatives, 0);
  const _totalTN = metrics.reduce((s, m) => s + m.totalRuns - m.truePositives - m.falsePositives, 0);
  const totalRuns = metrics.reduce((s, m) => s + m.totalRuns, 0);

  const microPrecision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const microRecall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const microF1 =
    microPrecision + microRecall > 0
      ? (2 * microPrecision * microRecall) / (microPrecision + microRecall)
      : 0;

  return {
    macroF1: Math.round(macroF1 * 1000) / 1000,
    macroPrecision: Math.round(macroPrecision * 1000) / 1000,
    macroRecall: Math.round(macroRecall * 1000) / 1000,
    microF1: Math.round(microF1 * 1000) / 1000,
    totalTP,
    totalFP,
    totalFN,
    totalRuns,
  };
}

/** Re-export for consistency with core/f1.ts */
export function gradeF1(f1: number): string {
  if (f1 >= 0.9) return "EXCELLENT";
  if (f1 >= 0.7) return "GOOD";
  if (f1 >= 0.5) return "FAIR";
  if (f1 >= 0.3) return "POOR";
  return "CRITICAL";
}

/** Main handler for `did metrics` */
export async function handleMetricsCommand(projectRoot: string, args: string[]): Promise<void> {
  const subcommand = args[0];

  // Handle help at top level
  if (subcommand === "--help" || subcommand === "-h") {
    printMetricsUsage();
    return;
  }

  if (subcommand === "f1") {
    await handleF1Command(projectRoot, args.slice(1));
    return;
  }

  if (subcommand === "meta-growth") {
    await handleMetaGrowthCommand(projectRoot, args.slice(1));
    return;
  }

  console.error(`❌ Unknown metrics subcommand: "${subcommand}"`);
  console.error("Usage: did metrics <f1|meta-growth> [options]");
  process.exit(1);
}

/** Handler for `did metrics f1` */
export async function handleF1Command(projectRoot: string, args: string[]): Promise<void> {
  // Parse options
  let period = "30d";
  let format: "json" | "table" | "summary" = "summary";
  let guardId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--period" || arg === "-p") {
      period = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      format = args[++i] as "json" | "table" | "summary";
    } else if (arg === "--guard" || arg === "-g") {
      guardId = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      printMetricsUsage();
      return;
    }
  }

  const isoPeriod = parsePeriod(period);
  const metrics = await computeAllF1(projectRoot, isoPeriod, guardId);

  switch (format) {
    case "json":
      console.log(formatJson(metrics, isoPeriod));
      break;
    case "table":
      console.log(formatTable(metrics, isoPeriod));
      break;
    default:
      console.log(formatSummary(metrics, isoPeriod));
      break;
  }
}

/** Handler for `did metrics meta-growth` */
export async function handleMetaGrowthCommand(projectRoot: string, args: string[]): Promise<void> {
  let period = "30d";
  let format: "json" | "summary" = "summary";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--period" || arg === "-p") {
      period = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      format = args[++i] as "json" | "summary";
    } else if (arg === "--help" || arg === "-h") {
      printMetaGrowthUsage();
      return;
    }
  }

  const isoPeriod = parsePeriod(period);

  try {
    const snapshot = await computeMetaGrowth({ projectRoot, period: isoPeriod });

    if (format === "json") {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }

    // Summary format
    console.log(`\n📈 Meta Growth Snapshot — ${isoPeriod}`);
    console.log(`═══════════════════════════════════════`);
    console.log(
      `Lessons Created:     ${snapshot.lessonsCreated} (${snapshot.lessonsPerWeek.toFixed(1)}/week)`,
    );
    console.log(
      `Lessons Effective:   ${snapshot.lessonsEffective} (${snapshot.lessonsCreated > 0 ? ((snapshot.lessonsEffective / snapshot.lessonsCreated) * 100).toFixed(0) : 0}%)`,
    );
    console.log(`Runtime Evidence:    ${(snapshot.runtimeEvidenceRatio * 100).toFixed(0)}%`);
    console.log(`Specificity Score:   ${(snapshot.lessonSpecificityScore * 100).toFixed(0)}%`);
    console.log(`Guard FP Trend:      ${snapshot.guardFalsePositiveTrend}`);
    console.log(
      `Time to Guard:       ${snapshot.timeToGuardHours}h (${snapshot.trends.timeToGuard})`,
    );
    console.log(`Community Contrib:   ${snapshot.communityContributions}`);
    console.log("");
    console.log("Trends:");
    console.log(`  Lessons Created:  ${snapshot.trends.lessonsCreated}`);
    console.log(`  Lessons Effective: ${snapshot.trends.lessonsEffective}`);
    console.log(`  Guard FP Rate:    ${snapshot.trends.guardFPRate}`);
    console.log(`  Time to Guard:    ${snapshot.trends.timeToGuard}`);
    console.log("");
  } catch (error) {
    console.error(
      `❌ Failed to compute meta growth: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

export function printMetricsUsage(): void {
  console.log(`
📊  defense-in-depth metrics — Guard effectiveness & meta growth analytics

Usage:
  did metrics <f1|meta-growth> [options]

Subcommands:
  f1              Compute F1 scores from feedback records
  meta-growth     Measure growth system acceleration (Layer 3)

Options (f1):
  --period, -p    Time window (default: "30d")
                  Examples: 30d, 7d, 90d, 12m, 2026-09-01/2026-09-30
  --format, -f    Output format: json | table | summary (default: summary)
  --guard, -g     Filter to specific guard ID

Options (meta-growth):
  --period, -p    Time window (default: "30d")
  --format, -f    Output format: json | summary (default: summary)

Examples:
  did metrics f1                    # Last 30 days, summary format
  did metrics f1 --period 90d       # Last 90 days
  did metrics f1 --format json      # JSON output for scripting
  did metrics f1 --format table     # Tabular output
  did metrics f1 --guard hollowArtifact  # Single guard
  did metrics meta-growth           # Meta growth snapshot (30d)
  did metrics meta-growth --period 90d --format json
`);
}

export function printMetaGrowthUsage(): void {
  console.log(`
📈  defense-in-depth metrics meta-growth — Growth system acceleration

Usage:
  did metrics meta-growth [options]

Options:
  --period, -p    Time window (default: "30d")
                  Examples: 30d, 7d, 90d, 12m, 2026-09-01/2026-09-30
  --format, -f    Output format: json | summary (default: summary)

Examples:
  did metrics meta-growth                    # Last 30 days
  did metrics meta-growth --period 90d       # Last 90 days
  did metrics meta-growth --format json      # JSON output
`);
}
