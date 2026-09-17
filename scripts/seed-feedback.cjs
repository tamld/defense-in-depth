#!/usr/bin/env node
/**
 * Seed feedback records from audit lessons for initial F1 computation.
 * Simple Node.js version without TypeScript compilation.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FEEDBACK_JSONL = path.join(PROJECT_ROOT, ".agents/records/feedback.jsonl");

const PATTERN_TO_GUARD = {
  "console-log": ["hollowArtifact"],
  "todo": ["hollowArtifact"],
  "tbd": ["hollowArtifact"],
  "hack": ["hollowArtifact"],
  "fixme": ["hollowArtifact"],
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

function hashFinding(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function feedbackEventId(guardId, ticketId, findingHash, label) {
  return crypto.createHash("sha256")
    .update(`${guardId}|${ticketId}|${findingHash}|${label}`)
    .digest("hex")
    .slice(0, 16);
}

function readExistingFeedback() {
  if (!fs.existsSync(FEEDBACK_JSONL)) return new Set();
  const content = fs.readFileSync(FEEDBACK_JSONL, "utf-8");
  const ids = new Set();
  for (const line of content.trim().split("\n")) {
    try {
      const event = JSON.parse(line);
      ids.add(event.id);
    } catch { }
  }
  return ids;
}

function appendFeedback(event) {
  const dir = path.dirname(FEEDBACK_JSONL);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const line = JSON.stringify(event) + "\n";
  fs.appendFileSync(FEEDBACK_JSONL, line, "utf-8");
}

function loadAuditLessons() {
  const lessonFiles = [
    "/tmp/audit-lessons.jsonl",
    "/tmp/audit-tamld-llm-wiki.jsonl",
    "/tmp/audit-g8s.jsonl",
    "/tmp/audit-tuneflow.jsonl",
    "/tmp/audit-aegis.jsonl",
  ];

  const lessons = [];
  for (const file of lessonFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    for (const line of content.trim().split("\n")) {
      try {
        lessons.push(JSON.parse(line));
      } catch { }
    }
  }
  return lessons;
}

function main() {
  console.log("🌱 Seeding feedback from audit lessons...");

  const lessons = loadAuditLessons();
  console.log(`  Loaded ${lessons.length} audit lessons`);

  const existingIds = readExistingFeedback();
  const timestamp = new Date().toISOString();
  let written = 0;

  for (const lesson of lessons) {
    const guardIds = new Set();

    if (lesson.tags) {
      for (const tag of lesson.tags) {
        const guards = PATTERN_TO_GUARD[tag];
        if (guards) {
          for (const g of guards) guardIds.add(g);
        }
      }
    }

    if (lesson.wrongApproachPattern) {
      const guards = PATTERN_TO_GUARD[lesson.wrongApproachPattern];
      if (guards) {
        for (const g of guards) guardIds.add(g);
      }
    }

    if (guardIds.size === 0) {
      guardIds.add("hollowArtifact");
    }

    for (const guardId of guardIds) {
      const findingText = `${lesson.wrongApproachPattern || "pattern"}: ${lesson.wrongApproach}`;
      const findingHash = hashFinding(findingText);
      const id = feedbackEventId(guardId, "audit-seed", findingHash, "TP");

      if (!existingIds.has(id)) {
        const event = {
          id,
          guardId,
          ticketId: "audit-seed",
          findingHash,
          label: "TP",
          source: "cli",
          note: `[audit-seed] ${lesson.title}: ${lesson.insight}`,
          timestamp,
          executor: "human:audit-seed",
        };
        appendFeedback(event);
        written++;
      }
    }
  }

  console.log(`  Written: ${written} new events`);
  console.log("✅ Seed complete. Run: npx defense-in-depth metrics f1");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});