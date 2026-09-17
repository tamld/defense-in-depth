/**
 * Lesson Deduplication — detects and merges duplicate/overlapping lessons.
 *
 * As the lesson corpus grows across projects, the same failure patterns
 * emerge repeatedly. This module identifies near-duplicates and merges
 * them into canonical lessons with consolidated evidence.
 */

import type { Lesson } from "./types.js";
import { readAllLessons } from "./memory.js";

/** Similarity score between two lessons (0-1) */
export interface SimilarityScore {
  lessonA: Lesson;
  lessonB: Lesson;
  score: number;
  reasons: string[];
}

/** Deduplication result */
export interface DedupResult {
  /** Groups of similar lessons (each group should be merged) */
  groups: Lesson[][];
  /** Lessons that are unique (no similar counterpart) */
  unique: Lesson[];
  /** Total duplicates found */
  duplicateCount: number;
}

/** Merge result for a group of similar lessons */
export interface MergeResult {
  /** The canonical merged lesson */
  canonical: Lesson;
  /** Source lesson IDs that were merged */
  sourceIds: string[];
  /** Merge summary for audit trail */
  summary: string;
}

/** Configuration for deduplication */
export interface DedupConfig {
  /** Minimum similarity threshold to consider a duplicate (0-1) */
  threshold: number;
  /** Whether to auto-merge or just report */
  autoMerge: boolean;
  /** Preserve source project attribution */
  preserveSources: boolean;
}

/** Default deduplication configuration */
export const DEFAULT_DEDUP_CONFIG: DedupConfig = {
  threshold: 0.75,
  autoMerge: false,
  preserveSources: true,
};

/**
 * Word-level Jaccard similarity for text comparison.
 */
export function wordOverlap(textA: string, textB: string): number {
  const wordsA = new Set(
    textA
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  const wordsB = new Set(
    textB
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

/**
 * Find highest evidence level in a group of lessons.
 */
export function highestEvidence(group: Lesson[]): Lesson["evidence"] {
  const order = { RUNTIME: 3, CODE: 3, INFER: 2, HYPO: 1 } as const;
  return group.reduce((best, current) =>
    order[current.evidence] > order[best.evidence] ? current : best,
  ).evidence;
}

/**
 * Find earliest creation date in a group of lessons.
 */
export function earliestDate(group: Lesson[]): string {
  return group.reduce((earliest, current) =>
    new Date(current.createdAt) < new Date(earliest.createdAt) ? current : earliest,
  ).createdAt;
}

/**
 * Infer source project from lesson metadata.
 */
export function inferProject(lesson: Lesson): string {
  if (lesson.relatedFiles) {
    for (const f of lesson.relatedFiles) {
      if (f.includes("aegis")) return "aegis";
      if (f.includes("tamld-llm-wiki") || f.includes("llm-wiki")) return "tamld-llm-wiki";
      if (f.includes("g8s")) return "g8s";
      if (f.includes("tuneflow")) return "tuneflow";
      if (f.includes("web-login") || f.includes("aaos")) return "web-login-solo";
      if (f.includes("defense-in-depth")) return "defense-in-depth";
    }
  }
  if (lesson.tags) {
    for (const t of lesson.tags) {
      if (t.includes("aegis")) return "aegis";
      if (t.includes("wiki")) return "tamld-llm-wiki";
      if (t.includes("g8s")) return "g8s";
      if (t.includes("tuneflow")) return "tuneflow";
      if (t.includes("aaos") || t.includes("web-login")) return "web-login-solo";
    }
  }
  return "";
}

/**
 * Find common prefix among strings.
 */
export function commonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    let j = 0;
    while (j < prefix.length && j < strings[i].length && prefix[j] === strings[i][j]) {
      j++;
    }
    prefix = prefix.slice(0, j);
    if (!prefix) break;
  }
  return prefix;
}

/**
 * Core deduplication engine for lessons.
 */
export class LessonDeduplicator {
  private config: DedupConfig;

  constructor(config: Partial<DedupConfig> = {}) {
    this.config = { ...DEFAULT_DEDUP_CONFIG, ...config };
  }

  /**
   * Analyze all lessons and find duplicate groups.
   */
  async analyze(projectRoot: string): Promise<DedupResult> {
    const lessons = await readAllLessons(projectRoot);
    if (lessons.length < 2) {
      return { groups: [], unique: lessons, duplicateCount: 0 };
    }

    const visited = new Set<string>();
    const groups: Lesson[][] = [];
    const unique: Lesson[] = [];

    for (let i = 0; i < lessons.length; i++) {
      const lessonA = lessons[i];
      if (visited.has(lessonA.id)) continue;

      const group = [lessonA];
      visited.add(lessonA.id);

      // Find all similar lessons
      for (let j = i + 1; j < lessons.length; j++) {
        const lessonB = lessons[j];
        if (visited.has(lessonB.id)) continue;

        const similarity = this.computeSimilarity(lessonA, lessonB);
        if (similarity.score >= this.config.threshold) {
          group.push(lessonB);
          visited.add(lessonB.id);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      } else {
        unique.push(lessonA);
      }
    }

    const duplicateCount = groups.reduce((sum, g) => sum + g.length - 1, 0);

    return { groups, unique, duplicateCount };
  }

  /**
   * Compute similarity between two lessons (0-1).
   * Uses multiple signals: wrongApproachPattern, tags, title, insight, category.
   */
  computeSimilarity(lessonA: Lesson, lessonB: Lesson): SimilarityScore {
    const reasons: string[] = [];
    let score = 0;

    // 1. wrongApproachPattern exact match (strongest signal)
    if (lessonA.wrongApproachPattern && lessonB.wrongApproachPattern) {
      if (lessonA.wrongApproachPattern === lessonB.wrongApproachPattern) {
        score += 0.4;
        reasons.push(`pattern: ${lessonA.wrongApproachPattern}`);
      } else if (
        lessonA.wrongApproachPattern.includes(lessonB.wrongApproachPattern) ||
        lessonB.wrongApproachPattern.includes(lessonA.wrongApproachPattern)
      ) {
        score += 0.3;
        reasons.push(
          `pattern-substring: ${lessonA.wrongApproachPattern} ~ ${lessonB.wrongApproachPattern}`,
        );
      }
    }

    // 2. Tag overlap (Jaccard similarity)
    const tagsA = new Set((lessonA.tags ?? []).map((t) => t.toLowerCase()));
    const tagsB = new Set((lessonB.tags ?? []).map((t) => t.toLowerCase()));
    if (tagsA.size > 0 && tagsB.size > 0) {
      const intersection = new Set([...tagsA].filter((t) => tagsB.has(t)));
      const union = new Set([...tagsA, ...tagsB]);
      const jaccard = intersection.size / union.size;
      if (jaccard > 0) {
        score += 0.25 * jaccard;
        reasons.push(`tags: ${[...intersection].join(", ")}`);
      }
    }

    // 3. Title similarity (word overlap)
    const titleSim = wordOverlap(lessonA.title, lessonB.title);
    if (titleSim > 0) {
      score += 0.15 * titleSim;
      reasons.push(`title-similarity: ${(titleSim * 100).toFixed(0)}%`);
    }

    // 4. Insight similarity (core actionable advice)
    const insightSim = wordOverlap(lessonA.insight, lessonB.insight);
    if (insightSim > 0) {
      score += 0.15 * insightSim;
      reasons.push(`insight-similarity: ${(insightSim * 100).toFixed(0)}%`);
    }

    // 5. Category match
    if (lessonA.category === lessonB.category) {
      score += 0.05;
      reasons.push(`category: ${lessonA.category}`);
    }

    // 6. wrongApproach text similarity
    const wrongSim = wordOverlap(lessonA.wrongApproach, lessonB.wrongApproach);
    if (wrongSim > 0) {
      score += 0.1 * wrongSim;
      reasons.push(`wrongApproach-similarity: ${(wrongSim * 100).toFixed(0)}%`);
    }

    return {
      lessonA,
      lessonB,
      score: Math.min(score, 1.0),
      reasons,
    };
  }

  /**
   * Merge a group of similar lessons into a canonical lesson.
   */
  mergeGroup(group: Lesson[]): MergeResult {
    if (group.length === 1) {
      return {
        canonical: group[0],
        sourceIds: [group[0].id],
        summary: "Single lesson (no merge needed)",
      };
    }

    // Pick the lesson with highest confidence as base
    const base = group.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );

    // Collect all unique fields
    const allTags = new Set<string>();
    const allSearchTerms = new Set<string>();
    const allRelatedFiles = new Set<string>();
    const allRelatedLessons = new Set<string>();
    const sourceProjects = new Set<string>();

    for (const lesson of group) {
      for (const t of lesson.tags ?? []) allTags.add(t);
      for (const s of lesson.searchTerms ?? []) allSearchTerms.add(s);
      for (const f of lesson.relatedFiles ?? []) allRelatedFiles.add(f);
      for (const r of lesson.relatedLessons ?? []) allRelatedLessons.add(r);
      // Extract project from relatedFiles or tags
      const project = inferProject(lesson);
      if (project) sourceProjects.add(project);
    }

    // Build canonical lesson
    const canonical: Lesson = {
      ...base,
      id: base.id, // Keep highest-confidence lesson's ID
      title: this.consolidateTitles(group),
      wrongApproach: this.consolidateWrongApproaches(group),
      correctApproach: this.consolidateCorrectApproaches(group),
      insight: this.consolidateInsights(group),
      tags: [...allTags],
      searchTerms: [...allSearchTerms],
      relatedFiles: [...allRelatedFiles],
      relatedLessons: [...allRelatedLessons],
      confidence: Math.max(...group.map((l) => l.confidence)),
      evidence: highestEvidence(group),
      createdAt: earliestDate(group),
    };

    const sourceIds = group.map((l) => l.id);

    return {
      canonical,
      sourceIds,
      summary: `Merged ${group.length} lessons from ${sourceProjects.size} project(s): ${[...sourceProjects].join(", ")}`,
    };
  }

  /**
   * Merge all groups and return canonical lessons.
   */
  async mergeAll(projectRoot: string): Promise<MergeResult[]> {
    const { groups } = await this.analyze(projectRoot);
    return groups.map((g) => this.mergeGroup(g));
  }

  /** Consolidate wrong approaches */
  private consolidateWrongApproaches(group: Lesson[]): string {
    const approaches = group.map((l) => l.wrongApproach).filter(Boolean);
    const unique = [...new Set(approaches)];
    if (unique.length === 1) return unique[0];
    return unique.map((a, i) => `${i + 1}. ${a}`).join("\n\n");
  }

  /** Consolidate correct approaches */
  private consolidateCorrectApproaches(group: Lesson[]): string {
    const approaches = group.map((l) => l.correctApproach).filter(Boolean);
    const unique = [...new Set(approaches)];
    if (unique.length === 1) return unique[0];
    return unique.map((a, i) => `${i + 1}. ${a}`).join("\n\n");
  }

  /** Consolidate insights */
  private consolidateInsights(group: Lesson[]): string {
    const insights = group.map((l) => l.insight).filter(Boolean);
    const unique = [...new Set(insights)];
    if (unique.length === 1) return unique[0];
    return unique.map((i) => `• ${i}`).join("\n");
  }

  /** Use exported commonPrefix for title consolidation */
  private consolidateTitles(group: Lesson[]): string {
    const titles = group.map((l) => l.title);
    // If all titles share a common prefix, use that
    const prefix = commonPrefix(titles);
    if (prefix && prefix.length > 10) {
      return `${prefix.trim()} (merged)`;
    }
    // Otherwise use the highest-confidence title with count
    const base = group.reduce((b, c) => (c.confidence > b.confidence ? c : b));
    return `${base.title} [${group.length} variants]`;
  }
}

/**
 * Convenience function for one-shot deduplication analysis.
 */
export async function analyzeLessons(
  projectRoot: string,
  config?: Partial<DedupConfig>,
): Promise<DedupResult> {
  const dedup = new LessonDeduplicator(config);
  return dedup.analyze(projectRoot);
}

/**
 * Convenience function for one-shot merge.
 */
export async function mergeLessons(
  projectRoot: string,
  config?: Partial<DedupConfig>,
): Promise<MergeResult[]> {
  const dedup = new LessonDeduplicator(config);
  return dedup.mergeAll(projectRoot);
}
