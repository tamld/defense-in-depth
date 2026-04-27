import { recordLesson, searchLessons } from "../core/memory.js";
import type { RecordLessonResult, LessonSearchResult } from "../core/memory.js";
import { EvidenceLevel, Lesson, LessonOutcome, RecallEvent } from "../core/types.js";
import {
  appendOutcome,
  outcomeEventId,
  readRecalls,
  scanOutcomes,
} from "../core/lesson-outcome.js";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Parses and executes 'lesson' subcommands.
 */
export async function handleLessonCommand(
  projectRoot: string,
  args: string[]
): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "record":
      await runRecord(projectRoot, args.slice(1));
      break;
    case "search":
      await runSearch(projectRoot, args.slice(1));
      break;
    case "outcome":
      await runOutcome(projectRoot, args.slice(1));
      break;
    case "scan-outcomes":
      await runScanOutcomes(projectRoot, args.slice(1));
      break;
    case "recalls":
      await runRecalls(projectRoot, args.slice(1));
      break;
    default:
      console.error(`❌ Unknown lesson command: "${subcommand || ""}"`);
      printLessonUsage();
      process.exit(1);
  }
}

async function runRecord(projectRoot: string, args: string[]): Promise<void> {
  // Simple payload ingestion: we expect --data '<json_string>' or --file <path.json>
  let rawJson = "";
  const useDspy = args.includes("--quality-gate");

  const fileIdx = args.indexOf("--file");
  const dataIdx = args.indexOf("--data");

  if (fileIdx >= 0 && args[fileIdx + 1]) {
    const filePath = path.resolve(projectRoot, args[fileIdx + 1]);
    try {
      rawJson = await fs.readFile(filePath, "utf-8");
    } catch (err: any) {
      console.error(`❌ Failed to read payload file ${filePath}: ${err.message}`);
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
  } catch (err: any) {
    console.error(`❌ Invalid JSON payload: ${err.message}`);
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

  if (!Object.values(EvidenceLevel).includes(payload.evidence as any)) {
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

async function runSearch(projectRoot: string, args: string[]): Promise<void> {
  const useSemantic = args.includes("--semantic");
  const ticketId = readFlag(args, "--ticket") ?? "";
  // Strip recognized flags (and their values) before joining the query.
  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--semantic") continue;
    if (a === "--ticket") {
      i++; // skip the value
      continue;
    }
    filteredArgs.push(a);
  }
  const query = filteredArgs.join(" ").trim();

  if (!query) {
    console.error("❌ You must provide a search query.");
    printLessonUsage();
    process.exit(1);
  }

  const results: LessonSearchResult[] = await searchLessons(
    query,
    projectRoot,
    useSemantic ? { enabled: true } : undefined,
    { ticketId, executor: "human" },
  );

  if (results.length === 0) {
    console.log(`🤷 No lessons found for "${query}"`);
    return;
  }

  const mode = useSemantic ? "semantic" : "keyword";
  console.log(`🔍 Found ${results.length} lesson(s) matching "${query}" [${mode} mode]:\n`);

  for (const r of results) {
    console.log(`[ID] ${r.lesson.id}`);
    console.log(`[Title] ${r.lesson.title}`);
    console.log(`[Insight] ${r.lesson.insight}`);
    console.log(`[Evidence] ${r.lesson.evidence}`);
    if (r.relevanceScore !== null) {
      console.log(`[Relevance] ${(r.relevanceScore * 100).toFixed(0)}%`);
    }
    console.log(`[Created] ${r.lesson.createdAt}`);
    console.log(`---`);
  }
}

async function runOutcome(projectRoot: string, args: string[]): Promise<void> {
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

async function runScanOutcomes(projectRoot: string, args: string[]): Promise<void> {
  const since = readFlag(args, "--since") ?? undefined;
  const maxRaw = readFlag(args, "--max");
  const max = maxRaw ? Math.max(1, Number.parseInt(maxRaw, 10)) : undefined;
  const dryRun = args.includes("--dry-run");
  const useDspy = args.includes("--dspy");

  const lessonsPath = path.join(projectRoot, "lessons.jsonl");
  let lessons: Array<{ id: string; wrongApproachPattern?: string; wrongApproach?: string }> = [];
  try {
    const raw = await fs.readFile(lessonsPath, "utf-8");
    lessons = raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as Lesson)
      .map((l) => ({
        id: l.id,
        wrongApproachPattern: l.wrongApproachPattern,
        wrongApproach: l.wrongApproach,
      }));
  } catch (err: unknown) {
    if (
      !(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ENOENT")
    ) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ failed to read lessons.jsonl: ${msg}`);
      process.exit(1);
    }
  }

  const result = await scanOutcomes(projectRoot, lessons, {
    since,
    max,
    dryRun,
    dspy: useDspy ? { enabled: true } : undefined,
  });

  process.stdout.write(
    `[scan-outcomes] scanned=${result.scanned} proposed=${result.proposed.length} ` +
      `written=${result.written} skippedDuplicates=${result.skippedDuplicates}` +
      (dryRun ? " (dry-run)" : "") +
      "\n",
  );
  for (const o of result.proposed) {
    const verdict = o.helpful === null ? "UNKNOWN" : o.helpful ? "HELPFUL" : "NOT-HELPFUL";
    process.stdout.write(
      `  ${verdict.padEnd(11)} lesson=${o.lessonId} recall=${o.recallId} src=${o.source}` +
        (o.matchedPattern ? `  pattern=${o.matchedPattern}` : "") +
        "\n",
    );
  }
}

async function runRecalls(projectRoot: string, args: string[]): Promise<void> {
  const sub = args[0];
  if (sub !== "list") {
    console.error("❌ Unknown lesson recalls subcommand. Try `did lesson recalls list`.");
    process.exit(1);
  }
  const lessonId = readFlag(args, "--lesson") ?? undefined;
  const ticketId = readFlag(args, "--ticket") ?? undefined;
  const since = readFlag(args, "--since") ?? undefined;
  const limitRaw = readFlag(args, "--limit");
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10)) : undefined;

  const events = readRecalls(projectRoot, { lessonId, ticketId, since, limit });
  if (events.length === 0) {
    process.stdout.write("(no recall events match)\n");
    return;
  }
  for (const e of events) {
    process.stdout.write(
      `${e.timestamp}  ${e.matchMethod.padEnd(8)} lesson=${e.lessonId} ` +
        `ticket=${e.ticketId || "-"} src=${e.source} id=${e.id}\n`,
    );
  }
  process.stdout.write(`\n${events.length} event(s)\n`);
}

function readFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith("--")) return undefined;
  return value;
}

function printLessonUsage(): void {
  console.log(`
🛡️  defense-in-depth lesson — Memory Management

Commands:
  record    Record a new lesson (Án Lệ) into the project memory.
            --file <path>      Load JSON payload from a file
            --data '<js>'      Provide JSON payload inline string
            --quality-gate     Enable DSPy quality evaluation (opt-in, v0.5)

  search    Search existing lessons by keyword or semantic similarity.
            --semantic         Use DSPy semantic ranking (opt-in, v0.5)
            --ticket <TKID>    Optional ticket context for the recall event
            Example: npx defense-in-depth lesson search "git hook"
            Example: npx defense-in-depth lesson search --semantic "pre-commit validation"

  outcome <lessonId> --helpful | --not-helpful
            Record an explicit outcome for a prior recall (issue #23).
            --ticket <TKID>    Disambiguate when many tickets share a lesson
            --recall <id>      Explicit recall id (default: most recent)
            --note "..."       Optional human note (plaintext)

  scan-outcomes
            Walk git history and infer outcomes from commit diffs.
            --since <ref>      Git ref to start from (default: HEAD)
            --max <N>          Hard cap on commits to scan
            --dry-run          Print proposed outcomes without writing
            --dspy             Enable DSPy fuzzy match for lessons without
                               an explicit wrongApproachPattern (opt-in)

  recalls list
            List recorded recall events.
            --lesson <id>      Filter by lessonId
            --ticket <TKID>    Filter by ticketId
            --since <ISO>      Only events at or after this timestamp
            --limit <N>        Cap output count
`);
}
