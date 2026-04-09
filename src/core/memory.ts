import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { Lesson, GrowthMetric } from "./types.js";

/**
 * Handles operations related to Layer 1 (Memory): lesson recording and growth metrics.
 */

// We assume these files live at the project root where defense-in-depth is executed
const LESSONS_FILE = "lessons.jsonl";
const GROWTH_METRICS_FILE = "growth_metrics.jsonl";

/**
 * Ensures the target file exists, creating it if necessary.
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
 */
async function appendJsonl(filepath: string, data: any): Promise<void> {
  await ensureFileExists(filepath);
  const line = JSON.stringify(data) + "\n";
  await fs.appendFile(filepath, line, "utf-8");
}

/**
 * Records a new lesson into the system (appends to lessons.jsonl).
 * @param fragment The lesson data excluding auto-generated id and createdAt
 * @param projectRoot The root directory where lessons.jsonl should be saved
 * @returns The fully constructed Lesson object
 */
export async function recordLesson(
  fragment: Omit<Lesson, "id" | "createdAt">,
  projectRoot: string = process.cwd()
): Promise<Lesson> {
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

  const targetPath = path.join(projectRoot, LESSONS_FILE);
  await appendJsonl(targetPath, lesson);

  return lesson;
}

/**
 * Searches lessons by matching keywords against the searchTerms, title, insight, and tags.
 * @param query The search sequence
 * @param projectRoot The root directory containing lessons.jsonl
 */
export async function searchLessons(
  query: string,
  projectRoot: string = process.cwd()
): Promise<Lesson[]> {
  const targetPath = path.join(projectRoot, LESSONS_FILE);
  
  try {
    const content = await fs.readFile(targetPath, "utf-8");
    const lines = content.split("\n").filter(line => line.trim().length > 0);
    
    const lessons: Lesson[] = lines.map(line => JSON.parse(line));
    const lowerQuery = query.toLowerCase();

    // Simple search strategy
    return lessons.filter(lesson => {
      if (lesson.title.toLowerCase().includes(lowerQuery)) return true;
      if (lesson.insight.toLowerCase().includes(lowerQuery)) return true;
      if (lesson.searchTerms?.some(t => t.toLowerCase().includes(lowerQuery))) return true;
      if (lesson.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
      return false;
    });

  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return []; // No lessons file yet
    }
    throw err;
  }
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
