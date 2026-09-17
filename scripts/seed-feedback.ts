#!/usr/bin/env node
/**
 * Seed feedback records from audit lessons for initial F1 computation.
 *
 * Converts audit lesson patterns into FeedbackEvent records so that
 * `did metrics f1` shows meaningful initial data.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

interface AuditLesson {
  title: string;
  wrongApproach: string;
  correctApproach: string;
  insight: string;
  category: string;
  evidence: string;
  confidence: number;
  wrongApproachPattern?: string;
  relatedFiles?: string[];
  tags?: string[];
}

interface FeedbackEvent {
  id: string;
  guardId: string;
  ticketId: string;
  findingHash: string;
  label: "TP" | "FP" | "FN" | "TN";
  source: "cli" | "scraper-fixup" | "scraper-revert" | "scraper-override" | "scraper-clean";
  note?: string;
  timestamp: string;
  executor: string;
}

const FEEDBACK_JSONL = ".agents/records/feedback.jsonl";
const SCRAPER_VERSION = "scraper:v1";

/** Map audit pattern tags to guard IDs */
const PATTERN_TO_GUARD: Record<string, string[]> = {
  "console-log": ["hollowArtifact"],
  "todo": ["hollowArtifact"],
  "tbd": ["hollowArtifact"],
  "hack": ["hollowArtifact"],
  "drift": ["ssotPollution", "rootPollution"],
  "config": ["ssotPollution"],
  "type-any": ["noTypeSafetyBypass"],
  "empty-catch": ["noSwallowedError"],
  "stub": ["noStubReturn"],
  "test": ["noTriviallyTrueTest"],
  "secret": ["secretDetection"],
  "file-size": ["fileSizeLimit"],
  "dependency": ["dependencyAudit"],
};

/** Hash a finding text into a stable hex prefix (16 chars) */
function hashFinding(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Compute stable feedback event ID */
function feedbackEventId(
  guardId: string,
  ticketId: string,
  findingHash: string,
  label: string,
): string {
  return createHash("sha256")
    .update(`${guardId}|${ticketId}|${findingHash}|${label}`)
    .digest("hex")
    .slice(0, 16);
}

/** Read existing feedback to avoid duplicates */
function readExistingFeedback(): Set<string> {
  const filePath = resolve(PROJECT_ROOT, FEEDBACK_JSONL);
  if (!existsSync(filePath)) return new Set();

  const content = readFileSync(filePath, "utf-8");
  const ids = new Set<string>();

  for (const line of content.trim().split("\n")) {
    try {
      const event = JSON.parse(line) as FeedbackEvent;
      ids.add(event.id);
    } catch {
      // ignore malformed lines
    }
  }
  return ids;
}

/** Append feedback event to JSONL */
function appendFeedback(event: FeedbackEvent): void {
  const filePath = resolve(PROJECT_ROOT, FEEDBACK_JSONL);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    require("node:fs").mkdirSync(dir, { recursive: true });
  }
  const line = JSON.stringify(event) + "\n";
  require("node:fs").appendFileSync(filePath, line, "utf-8");
}

/** Generate feedback events from audit lessons */
function generateFeedbackFromLessons(lessons: AuditLesson[]): FeedbackEvent[] {
  const events: FeedbackEvent[] = [];
  const existingIds = readExistingFeedback();
  const timestamp = new Date().toISOString();

  for (const lesson of lessons) {
    // Determine which guards this lesson applies to
    const guardIds = new Set<string>();

    if (lesson.tags) {
      for (const tag of lesson.tags) {
        const guards = PATTERN_TO_GUARD[tag];
        if (guards) {
          for (const g of guards) guardIds.add(g);
        }
      }
    }

    // Also check wrongApproachPattern
    if (lesson.wrongApproachPattern) {
      const guards = PATTERN_TO_GUARD[lesson.wrongApproachPattern];
      if (guards) {
        for (const g of guards) guardIds.add(g);
      }
    }

    // Default to hollowArtifact for generic patterns
    if (guardIds.size === 0) {
      guardIds.add("hollowArtifact");
    }

    for (const guardId of guardIds) {
      // Create TP event (audit found real pattern = true positive)
      const findingText = `${lesson.wrongApproachPattern || "pattern"}: ${lesson.wrongApproach}`;
      const findingHash = hashFinding(findingText);
      const id = feedbackEventId(guardId, "audit-seed", findingHash, "TP");

      if (!existingIds.has(id)) {
        events.push({
          id,
          guardId,
          ticketId: "audit-seed",
          findingHash,
          label: "TP",
          source: "cli",
          note: `[audit-seed] ${lesson.title}: ${lesson.insight}`,
          timestamp,
          executor: "human:audit-seed",
        });
      }
    }
  }

  return events;
}

/** Load audit lessons from JSONL files */
function loadAuditLessons(): AuditLesson[] {
  const lessonFiles = [
    "/tmp/audit-lessons.jsonl",
    "/tmp/audit-tamld-llm-wiki.jsonl",
    "/tmp/audit-g8s.jsonl",
    "/tmp/audit-tuneflow.jsonl",
  ];

  const lessons: AuditLesson[] = [];

  for (const file of lessonFiles) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf-8");
    for (const line of content.trim().split("\n")) {
      try {
        lessons.push(JSON.parse(line) as AuditLesson);
      } catch {
        // ignore malformed
      }
    }
  }

  return lessons;
}

/** Main */
async function main(): Promise<void> {
  console.log("🌱 Seeding feedback from audit lessons...");

  const lessons = loadAuditLessons();
  console.log(`  Loaded ${lessons.length} audit lessons`);

  const events = generateFeedbackFromLessons(lessons);
  console.log(`  Generated ${events.length} feedback events`);

  let written = 0;
  for (const event of events) {
    appendFeedback(event);
    written++;
  }

  console.log(`  Written: ${written} new events`);
  console.log("✅ Seed complete. Run: npx defense-in-depth metrics f1");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});