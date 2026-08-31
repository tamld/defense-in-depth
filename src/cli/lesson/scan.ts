import type { Lesson } from "../../core/types.js";
import { scanOutcomes } from "../../core/lesson-outcome.js";
import * as fs from "fs/promises";
import * as path from "path";
import { readFlag } from "./helpers.js";

export async function runScanOutcomes(projectRoot: string, args: string[]): Promise<void> {
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
