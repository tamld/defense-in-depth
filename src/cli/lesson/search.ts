import { searchLessons } from "../../core/memory.js";
import type { LessonSearchResult } from "../../core/memory.js";
import { readFlag, printLessonUsage } from "./helpers.js";

export async function runSearch(projectRoot: string, args: string[]): Promise<void> {
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
