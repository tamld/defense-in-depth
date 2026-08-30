import { recordLesson } from "../../core/memory.js";
import type { RecordLessonResult } from "../../core/memory.js";
import { EvidenceLevel, Lesson } from "../../core/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { printLessonUsage } from "./helpers.js";

export async function runRecord(projectRoot: string, args: string[]): Promise<void> {
  // Simple payload ingestion: we expect --data '<json_string>' or --file <path.json>
  let rawJson = "";
  const useDspy = args.includes("--quality-gate");

  const fileIdx = args.indexOf("--file");
  const dataIdx = args.indexOf("--data");

  if (fileIdx >= 0 && args[fileIdx + 1]) {
    const filePath = path.resolve(projectRoot, args[fileIdx + 1]);
    try {
      rawJson = await fs.readFile(filePath, "utf-8");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed to read payload file ${filePath}: ${msg}`);
      process.exit(1);
    }
  } else if (dataIdx >= 0 && args[dataIdx + 1]) {
    rawJson = args[dataIdx + 1];
  } else {
    console.error("❌ Lesson record requires --data '<json>' or --file <path>");
    printLessonUsage();
    process.exit(1);
  }

  let payload: Partial<Lesson>;
  try {
    payload = JSON.parse(rawJson);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Invalid JSON payload: ${msg}`);
    process.exit(1);
  }

  // Validate minimum requirements for an Án Lệ
  const missing = [];
  if (!payload.title) missing.push("title");
  if (!payload.scenario) missing.push("scenario");
  if (!payload.wrongApproach) missing.push("wrongApproach");
  if (!payload.correctApproach) missing.push("correctApproach");
  if (!payload.insight) missing.push("insight");
  if (!payload.category) missing.push("category");
  if (payload.evidence === undefined) missing.push("evidence");
  if (payload.confidence === undefined) missing.push("confidence");

  if (missing.length > 0) {
    console.error(`❌ Missing mandatory Lesson properties: ${missing.join(", ")}`);
    console.error("Every lesson must follow the Án Lệ strict structure for recall quality.");
    process.exit(1);
  }

  if (typeof payload.confidence !== 'number' || payload.confidence < 0 || payload.confidence > 1) {
    console.error(`❌ Invalid confidence score: must be a number between 0 and 1.`);
    process.exit(1);
  }

  const validEvidenceLevels = Object.values(EvidenceLevel) as readonly string[];
  if (typeof payload.evidence !== "string" || !validEvidenceLevels.includes(payload.evidence)) {
    console.error(`❌ Invalid evidence level: must be one of ${Object.values(EvidenceLevel).join(", ")}`);
    process.exit(1);
  }

  // Record it (with optional DSPy quality gate)
  const result: RecordLessonResult = await recordLesson(
    payload as Omit<Lesson, "id" | "createdAt">,
    projectRoot,
    useDspy ? { enabled: true } : undefined,
  );

  if (!result.persisted) {
    console.error(`🚫 Lesson REJECTED by quality gate (score: ${result.qualityScore?.toFixed(2) ?? "N/A"})`);
    if (result.qualityFeedback) {
      console.error(`   💡 Feedback: ${result.qualityFeedback}`);
    }
    console.error(`   Tip: Make the lesson more specific — describe concrete files, exact errors, and actionable fixes.`);
    process.exit(1);
  }

  console.log(`✅ Lesson recorded successfully [ID: ${result.lesson.id}]`);
  if (result.qualityScore !== null) {
    console.log(`📊 Quality score: ${result.qualityScore.toFixed(2)}/1.00`);
  }
}
