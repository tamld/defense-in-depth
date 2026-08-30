import { readRecalls } from "../../core/lesson-outcome.js";
import { readFlag } from "./helpers.js";

export async function runRecalls(projectRoot: string, args: string[]): Promise<void> {
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
