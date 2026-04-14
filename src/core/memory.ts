import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { Lesson, GrowthMetric } from "./types.js";
import { callDspy, callDspyRank, DEFAULT_DSPY_ENDPOINT, DEFAULT_DSPY_TIMEOUT_MS } from "./dspy-client.js";

/**
 * Handles operations related to Layer 1 (Memory): lesson recording and growth metrics.
 *
 * v0.5.1: DSPy-powered lesson quality gate — rejects generic lessons
 * v0.5.2: DSPy-powered semantic search — replaces String.includes()
 */

// We assume these files live at the project root where defense-in-depth is executed
const LESSONS_FILE = "lessons.jsonl";
const GROWTH_METRICS_FILE = "growth_metrics.jsonl";

/** Options for DSPy-powered memory operations */
export interface MemoryDspyOptions {
  /** Enable DSPy for this operation (default: false) */
  enabled: boolean;
  /** DSPy HTTP endpoint */
  endpoint?: string;
  /** Timeout in ms */
  timeoutMs?: number;
}

/** Result of a lesson recording, including optional quality evaluation */
export interface RecordLessonResult {
  lesson: Lesson;
  /** Quality score from DSPy (null if DSPy disabled or unavailable) */
  qualityScore: number | null;
  /** Quality feedback from DSPy (null if DSPy disabled or unavailable) */
  qualityFeedback: string | null;
  /** Whether the lesson was persisted (false if quality gate rejected it) */
  persisted: boolean;
}

/** Search result with optional relevance score */
export interface LessonSearchResult {
  lesson: Lesson;
  /** Relevance score from DSPy semantic ranking (null if string-match mode) */
  relevanceScore: number | null;
  /** How the match was found */
  matchMethod: "string" | "semantic";
}

/**
 * Ensures the target file exists, creating it if necessary.
 * 
 * @param filepath - The absolute path of the target file to verify or create
 */
async function ensureFileExists(filepath: string): Promise<void> {
  try {
    await fs.access(filepath);
  } catch {
    // File does not exist, create it inside an empty block or just touch it
    await fs.writeFile(filepath, "", "utf-8");
  }
}

/**
 * Appends a JSON string followed by a newline to a file.
 * 
 * @param filepath - The absolute path of the target file
 * @param data - The JSON object to append
 */
async function appendJsonl(filepath: string, data: any): Promise<void> {
  await ensureFileExists(filepath);
  const line = JSON.stringify(data) + "\n";
  await fs.appendFile(filepath, line, "utf-8");
}

/**
 * Reads all lessons from the JSONL file.
 * 
 * @param projectRoot - Directory where the lessons.jsonl file resides
 * @returns Array of Lesson objects read from the file
 */
async function readAllLessons(projectRoot: string): Promise<Lesson[]> {
  const targetPath = path.join(projectRoot, LESSONS_FILE);
  try {
    const content = await fs.readFile(targetPath, "utf-8");
    const lines = content.split("\n").filter(line => line.trim().length > 0);
    return lines.map(line => JSON.parse(line));
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

/**
 * Records a new lesson into the system.
 *
 * When `dspy.enabled` is true, the lesson is first evaluated for quality.
 * Generic lessons (score < 0.5) are REJECTED with feedback explaining why.
 *
 * Quality criteria evaluated by DSPy:
 *   - Specificity: Does it describe a concrete scenario, not a platitude?
 *   - Actionability: Can an agent act on the insight in a future task?
 *   - Recall-worthiness: Would this lesson be useful when recalled?
 *
 * @param fragment The lesson data excluding auto-generated id and createdAt
 * @param projectRoot The root directory where lessons.jsonl should be saved
 * @param dspy Optional DSPy configuration for quality gate
 * @returns RecordLessonResult with quality info and persistence status
 */
export async function recordLesson(
  fragment: Omit<Lesson, "id" | "createdAt">,
  projectRoot: string = process.cwd(),
  dspy?: MemoryDspyOptions,
): Promise<RecordLessonResult> {
  const lesson: Lesson = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: fragment.title,
    scenario: fragment.scenario,
    wrongApproach: fragment.wrongApproach,
    correctApproach: fragment.correctApproach,
    insight: fragment.insight,
    category: fragment.category,
    evidence: fragment.evidence,
    confidence: fragment.confidence,
  };
  
  if (fragment.searchTerms) lesson.searchTerms = [...fragment.searchTerms];
  if (fragment.tags) lesson.tags = [...fragment.tags];
  if (fragment.relatedLessons) lesson.relatedLessons = [...fragment.relatedLessons];

  // v0.5.1: DSPy Quality Gate
  let qualityScore: number | null = null;
  let qualityFeedback: string | null = null;

  if (dspy?.enabled) {
    const lessonText = [
      `Title: ${lesson.title}`,
      `Scenario: ${lesson.scenario}`,
      `Wrong Approach: ${lesson.wrongApproach}`,
      `Correct Approach: ${lesson.correctApproach}`,
      `Insight: ${lesson.insight}`,
    ].join("\n");

    const evalResult = await callDspy(
      { type: "lesson", id: lesson.id, content: lessonText },
      dspy.endpoint ?? DEFAULT_DSPY_ENDPOINT,
      dspy.timeoutMs ?? DEFAULT_DSPY_TIMEOUT_MS,
    );

    if (evalResult) {
      qualityScore = evalResult.score;
      qualityFeedback = evalResult.feedback ?? null;

      if (evalResult.score < 0.5) {
        // Quality gate REJECTS this lesson — do NOT persist
        return {
          lesson,
          qualityScore,
          qualityFeedback: qualityFeedback ?? "Lesson is too generic or vague to be recall-worthy.",
          persisted: false,
        };
      }
    }
    // If DSPy fails (returns null), degrade gracefully → persist anyway
  }

  const targetPath = path.join(projectRoot, LESSONS_FILE);
  await appendJsonl(targetPath, lesson);

  return { lesson, qualityScore, qualityFeedback, persisted: true };
}

/**
 * Searches lessons by keyword or semantic similarity.
 *
 * Mode 1 (default): String matching against title, insight, searchTerms, tags.
 * Mode 2 (semantic): DSPy ranks all lessons by semantic relevance to query.
 *   Falls back to Mode 1 if DSPy is unavailable.
 *
 * @param query The search query
 * @param projectRoot The root directory containing lessons.jsonl
 * @param dspy Optional DSPy configuration for semantic search
 * @returns Array of LessonSearchResult sorted by relevance
 */
export async function searchLessons(
  query: string,
  projectRoot: string = process.cwd(),
  dspy?: MemoryDspyOptions,
): Promise<LessonSearchResult[]> {
  const lessons = await readAllLessons(projectRoot);
  if (lessons.length === 0) return [];

  // v0.5.2: Semantic search via DSPy
  if (dspy?.enabled) {
    const candidates = lessons.map(l => ({
      id: l.id,
      content: `${l.title}. ${l.scenario}. ${l.insight}`,
    }));

    const ranked = await callDspyRank(
      query,
      candidates,
      dspy.endpoint ?? DEFAULT_DSPY_ENDPOINT,
      dspy.timeoutMs ?? DEFAULT_DSPY_TIMEOUT_MS,
    );

    if (ranked) {
      // DSPy returned rankings — map back to lessons
      const results: LessonSearchResult[] = [];
      for (const r of ranked) {
        if (r.score <= 0.3) continue; // Filter irrelevant results
        const lesson = lessons.find(l => l.id === r.id);
        if (!lesson) continue;
        results.push({
          lesson,
          relevanceScore: r.score,
          matchMethod: "semantic",
        });
      }
      return results;
    }
    // DSPy failed → fall through to string matching
  }

  // Mode 1: String matching (original implementation)
  const lowerQuery = query.toLowerCase();
  return lessons
    .filter(lesson => {
      if (lesson.title.toLowerCase().includes(lowerQuery)) return true;
      if (lesson.insight.toLowerCase().includes(lowerQuery)) return true;
      if (lesson.searchTerms?.some(t => t.toLowerCase().includes(lowerQuery))) return true;
      if (lesson.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
      return false;
    })
    .map(lesson => ({
      lesson,
      relevanceScore: null,
      matchMethod: "string" as const,
    }));
}

/**
 * Records a growth metric into growth_metrics.jsonl.
 * @param metric The metric payload excluding measuredAt timestamp
 * @param projectRoot The project root
 */
export async function recordGrowthMetric(
  metric: Omit<GrowthMetric, "measuredAt">,
  projectRoot: string = process.cwd()
): Promise<GrowthMetric> {
  const fullMetric: GrowthMetric = {
    measuredAt: new Date().toISOString(),
    name: metric.name,
    value: metric.value,
    unit: metric.unit,
  };
  
  if (metric.source) fullMetric.source = metric.source;
  if (metric.trend) fullMetric.trend = metric.trend;

  const targetPath = path.join(projectRoot, GROWTH_METRICS_FILE);
  await appendJsonl(targetPath, fullMetric);

  return fullMetric;
}
