/**
 * Meta Growth Snapshot — measures whether the GROWTH SYSTEM itself is improving.
 *
 * This is the highest meta layer (Layer 3). It doesn't ask "are guards catching errors?"
 * It asks "is the RATE of guard improvement accelerating?"
 *
 * Think of it as the second derivative:
 *   - Growth (Layer 1) = velocity (lessons created, F1 scores)
 *   - MetaGrowth (Layer 3) = acceleration (is velocity increasing?)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { MetaGrowthSnapshot } from "./types.js";
import { readAllLessons } from "./memory.js";
import { readFeedback } from "./feedback.js";

const META_GROWTH_FILE = ".agents/records/meta-growth.jsonl";

/** Options for computing meta growth */
export interface MetaGrowthOptions {
  /** Period to analyze (ISO interval) */
  period: string;
  /** Project root */
  projectRoot: string;
}

/**
 * Compute Meta Growth Snapshot for a given period.
 */
export async function computeMetaGrowth(options: MetaGrowthOptions): Promise<MetaGrowthSnapshot> {
  const { projectRoot, period } = options;
  const [periodStart, periodEnd] = period.split("/").map((d) => new Date(d).getTime());

  // 1. Load lessons in period
  const allLessons = await readAllLessons(projectRoot);
  const periodLessons = allLessons.filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return t >= periodStart && t < periodEnd;
  });

  // 2. Load feedback in period
  const feedback = readFeedback(projectRoot, { period });
  const _tpCount = feedback.filter((f) => f.label === "TP").length;
  const _fpCount = feedback.filter((f) => f.label === "FP").length;

  // 3. Load lesson outcomes (recall effectiveness) - placeholder for now
  // TODO: Integrate with lesson-outcome.ts when available
  const lessonsEffective = Math.round(periodLessons.length * 0.3); // Estimate

  // 4. Compute guard FP trend (compare first half vs second half of period)
  const midPoint = periodStart + (periodEnd - periodStart) / 2;
  const firstHalf = readFeedback(projectRoot, {
    period: `${new Date(periodStart).toISOString().split("T")[0]}/${new Date(midPoint).toISOString().split("T")[0]}`,
  });
  const secondHalf = readFeedback(projectRoot, {
    period: `${new Date(midPoint).toISOString().split("T")[0]}/${new Date(periodEnd).toISOString().split("T")[0]}`,
  });

  const fpRateFirst =
    firstHalf.length > 0 ? firstHalf.filter((f) => f.label === "FP").length / firstHalf.length : 0;
  const fpRateSecond =
    secondHalf.length > 0
      ? secondHalf.filter((f) => f.label === "FP").length / secondHalf.length
      : 0;

  // 5. Time to guard (placeholder - would need git history analysis)
  // Estimate: days from lesson creation to guard rule implementation
  const timeToGuardHours = estimateTimeToGuard(projectRoot, periodLessons);

  // 6. Community contributions (placeholder - would need git log analysis)
  const communityContributions = countCommunityContributions(projectRoot, periodStart, periodEnd);

  // 7. Specificity score: average unique searchTerms per lesson
  const specificityScore = computeSpecificity(periodLessons);

  // 8. Runtime evidence ratio
  const runtimeEvidenceRatio =
    periodLessons.length > 0
      ? periodLessons.filter((l) => l.evidence === "RUNTIME").length / periodLessons.length
      : 0;

  // 9. Lessons per week
  const periodWeeks = (periodEnd - periodStart) / (7 * 24 * 60 * 60 * 1000);
  const lessonsPerWeek = periodWeeks > 0 ? periodLessons.length / periodWeeks : 0;

  // 10. Trends
  const trends = {
    lessonsCreated:
      lessonsPerWeek > 2
        ? ("improving" as const)
        : lessonsPerWeek > 0.5
          ? ("stable" as const)
          : ("degrading" as const),
    lessonsEffective:
      lessonsEffective > periodLessons.length * 0.5
        ? ("improving" as const)
        : lessonsEffective > periodLessons.length * 0.2
          ? ("stable" as const)
          : ("degrading" as const),
    guardFPRate:
      fpRateSecond < fpRateFirst * 0.9
        ? ("improving" as const)
        : fpRateSecond < fpRateFirst * 1.1
          ? ("stable" as const)
          : ("degrading" as const),
    timeToGuard:
      timeToGuardHours < 48
        ? ("improving" as const)
        : timeToGuardHours < 168
          ? ("stable" as const)
          : ("degrading" as const),
  };

  const snapshot: MetaGrowthSnapshot = {
    period,
    lessonsCreated: periodLessons.length,
    lessonsEffective,
    guardFalsePositiveTrend: trends.guardFPRate,
    timeToGuardHours,
    communityContributions,
    lessonSpecificityScore: specificityScore,
    lessonsPerWeek,
    runtimeEvidenceRatio,
    trends,
    computedAt: new Date().toISOString(),
  };

  // Persist
  await persistMetaGrowth(projectRoot, snapshot);

  return snapshot;
}

/** Persist meta growth snapshot */
export async function persistMetaGrowth(
  projectRoot: string,
  snapshot: MetaGrowthSnapshot,
): Promise<void> {
  const filePath = path.join(projectRoot, META_GROWTH_FILE);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const line = `${JSON.stringify(snapshot)}\n`;
  await fs.appendFile(filePath, line, "utf-8");
}

/** Estimate time from lesson creation to guard implementation */
export function estimateTimeToGuard(_projectRoot: string, _lessons: unknown[]): number {
  // Placeholder: would analyze git log for commits referencing lesson IDs
  // that implement guard rules or fixes
  return 72; // 3 days average estimate
}

/** Count community contributions (PRs from external contributors) */
export function countCommunityContributions(
  _projectRoot: string,
  _start: number,
  _end: number,
): number {
  // Placeholder: would analyze git log for external contributors
  return 0;
}

/** Compute lesson specificity score (0-1) */
export function computeSpecificity(lessons: Array<{ wrongApproachPattern?: string; searchTerms?: string[]; relatedFiles?: string[]; tags?: string[]; relatedLessons?: string[] }>): number {
  if (lessons.length === 0) return 0;
  let totalScore = 0;
  for (const lesson of lessons) {
    let score = 0;
    // Has wrongApproachPattern
    if (lesson.wrongApproachPattern) score += 0.3;
    // Has searchTerms
    if (lesson.searchTerms && lesson.searchTerms.length > 0) score += 0.2;
    // Has relatedFiles
    if (lesson.relatedFiles && lesson.relatedFiles.length > 0) score += 0.2;
    // Has tags
    if (lesson.tags && lesson.tags.length > 0) score += 0.15;
    // Has relatedLessons
    if (lesson.relatedLessons && lesson.relatedLessons.length > 0) score += 0.15;
    totalScore += score;
  }
  return totalScore / lessons.length;
}

/** Read all meta growth snapshots */
export async function readMetaGrowth(projectRoot: string): Promise<MetaGrowthSnapshot[]> {
  const filePath = path.join(projectRoot, META_GROWTH_FILE);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

/** Get latest meta growth snapshot */
export async function getLatestMetaGrowth(projectRoot: string): Promise<MetaGrowthSnapshot | null> {
  const snapshots = await readMetaGrowth(projectRoot);
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}
