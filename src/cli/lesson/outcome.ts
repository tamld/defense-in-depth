import type { LessonOutcome, RecallEvent } from "../../core/types.js";
import {
  appendOutcome,
  outcomeEventId,
  readRecalls,
} from "../../core/lesson-outcome.js";
import { readFlag, printLessonUsage } from "./helpers.js";

export async function runOutcome(projectRoot: string, args: string[]): Promise<void> {
  const lessonId = args[0];
  if (!lessonId || lessonId.startsWith("--")) {
    console.error("❌ lesson outcome requires a <lessonId> as the first arg.");
    printLessonUsage();
    process.exit(1);
  }
  const helpfulFlag = args.includes("--helpful");
  const notHelpfulFlag = args.includes("--not-helpful");
  if (helpfulFlag === notHelpfulFlag) {
    // Either both true or both false — both are errors.
    console.error("❌ lesson outcome requires exactly one of --helpful or --not-helpful.");
    process.exit(1);
  }
  const ticketId = readFlag(args, "--ticket") ?? "";
  const note = readFlag(args, "--note");
  const recallIdFlag = readFlag(args, "--recall");

  // Resolve the recallId. Preference order:
  //   1. Explicit --recall <id>
  //   2. Most recent recall for (lessonId, ticketId) in the JSONL
  //   3. Most recent recall for lessonId alone
  let recall: RecallEvent | undefined;
  if (recallIdFlag) {
    const all = readRecalls(projectRoot);
    recall = all.find((r) => r.id === recallIdFlag);
    if (!recall) {
      console.error(`❌ no recall event with id "${recallIdFlag}" found.`);
      process.exit(1);
    }
  } else {
    const candidates = readRecalls(projectRoot, { lessonId, ticketId: ticketId || undefined });
    if (candidates.length > 0) {
      recall = candidates[candidates.length - 1];
    } else {
      const fallback = readRecalls(projectRoot, { lessonId });
      if (fallback.length > 0) recall = fallback[fallback.length - 1];
    }
  }
  if (!recall) {
    console.error(
      `❌ no prior recall event for lesson "${lessonId}" — run \`did lesson search\` first ` +
        `or pass --recall <id>.`,
    );
    process.exit(1);
  }

  const helpful = helpfulFlag;
  const label = String(helpful);
  const id = outcomeEventId(recall.id, label);
  const outcome: LessonOutcome = {
    id,
    recallId: recall.id,
    lessonId: recall.lessonId,
    helpful,
    source: "cli-explicit",
    timestamp: new Date().toISOString(),
    executor: "human",
  };
  if (note) outcome.note = note;

  const result = appendOutcome(projectRoot, outcome);
  if (result.written) {
    process.stdout.write(
      `✅ outcome ${helpful ? "HELPFUL" : "NOT-HELPFUL"} recorded for lesson ` +
        `${recall.lessonId} (recall=${recall.id} outcome=${id})\n   path: ${result.path}\n`,
    );
  } else {
    process.stderr.write(
      `⚠  outcome ${id} already recorded — no-op (idempotent).\n`,
    );
  }
}
