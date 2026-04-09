import { recordLesson, searchLessons } from "../core/memory.js";
import { EvidenceLevel, Lesson } from "../core/types.js";
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
    default:
      console.error(`❌ Unknown lesson command: "${subcommand || ""}"`);
      printLessonUsage();
      process.exit(1);
  }
}

async function runRecord(projectRoot: string, args: string[]): Promise<void> {
  // Simple payload ingestion: we expect --data '<json_string>' or --file <path.json>
  let rawJson = "";

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

  // Record it
  const created = await recordLesson(payload as Omit<Lesson, "id" | "createdAt">, projectRoot);
  console.log(`✅ Lesson recorded successfully [ID: ${created.id}]`);
}

async function runSearch(projectRoot: string, args: string[]): Promise<void> {
  const query = args.join(" ").trim();
  if (!query) {
    console.error("❌ You must provide a search query.");
    printLessonUsage();
    process.exit(1);
  }

  const results = await searchLessons(query, projectRoot);
  if (results.length === 0) {
    console.log(`🤷 No lessons found for "${query}"`);
    return;
  }

  console.log(`🔍 Found ${results.length} lesson(s) matching "${query}":\n`);
  for (const r of results) {
    console.log(`[ID] ${r.id}`);
    console.log(`[Title] ${r.title}`);
    console.log(`[Insight] ${r.insight}`);
    console.log(`[Evidence] ${r.evidence}`);
    console.log(`[Created] ${r.createdAt}`);
    console.log(`---`);
  }
}

function printLessonUsage(): void {
  console.log(`
🛡️  defense-in-depth lesson — Memory Management

Commands:
  record    Record a new lesson (Án Lệ) into the project memory.
            --file <path>   Load JSON payload from a file
            --data '<js>'   Provide JSON payload inline string

  search    Search existing lessons by keyword.
            Example: npx defense-in-depth lesson search "git hook"
`);
}
