/**
 * CLI: feedback subcommand (issue #22 MVP)
 *
 * Surface:
 *   did feedback <tp|fp|fn|tn> --guard <id> [--ticket <tkid>]
 *                              (--finding <hash|text>) [--note "..."]
 *   did feedback list [--guard <id>] [--since <iso>] [--limit N]
 *   did feedback f1   [--guard <id>] [--period <iso-interval>]
 *   did feedback scan-history [--since <git-ref>] [--max N] [--dry-run]
 *
 * Active mode writes one event per call. Passive mode (`scan-history`)
 * walks git log and infers events. Both append to
 * `.agents/records/feedback.jsonl` via the same idempotent writer.
 */

import {
  appendFeedback,
  computeF1FromFeedback,
  feedbackEventId,
  hashFinding,
  readFeedback,
  scanHistory,
} from "../core/feedback.js";
import { formatF1Summary } from "../core/f1.js";
import type { FeedbackEvent } from "../core/types.js";

const LABELS: Record<string, FeedbackEvent["label"]> = {
  tp: "TP",
  fp: "FP",
  fn: "FN",
  tn: "TN",
};

export async function handleFeedbackCommand(
  projectRoot: string,
  args: string[],
): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case "tp":
    case "fp":
    case "fn":
    case "tn":
      runWrite(projectRoot, sub, args.slice(1));
      return;
    case "list":
      runList(projectRoot, args.slice(1));
      return;
    case "f1":
      runF1(projectRoot, args.slice(1));
      return;
    case "scan-history":
      runScan(projectRoot, args.slice(1));
      return;
    case "--help":
    case "-h":
    case undefined:
      printUsage();
      return;
    default:
      process.stderr.write(`❌ Unknown feedback subcommand: "${sub}"\n`);
      printUsage();
      process.exit(1);
  }
}

function runWrite(projectRoot: string, sub: string, rest: string[]): void {
  const label = LABELS[sub];
  const guard = readFlag(rest, "--guard");
  const ticket = readFlag(rest, "--ticket") ?? "";
  const findingArg = readFlag(rest, "--finding");
  const note = readFlag(rest, "--note");

  if (!guard) {
    process.stderr.write("❌ feedback requires --guard <id>\n");
    process.exit(1);
  }
  if (!findingArg) {
    process.stderr.write(
      "❌ feedback requires --finding <hash-or-text>. Pass the finding text " +
        "(or its sha256-prefix hash) so the event is dedupable.\n",
    );
    process.exit(1);
  }

  const findingHash = isHexPrefix(findingArg) ? findingArg : hashFinding(findingArg);
  const timestamp = new Date().toISOString();
  const id = feedbackEventId(guard, ticket, findingHash, label);

  const event: FeedbackEvent = {
    id,
    guardId: guard,
    ticketId: ticket,
    findingHash,
    label,
    source: "cli",
    note,
    timestamp,
    executor: "human",
  };

  const result = appendFeedback(projectRoot, event);
  if (result.written) {
    process.stdout.write(
      `✅ ${label} recorded for guard "${guard}" (id=${id})\n   path: ${result.path}\n`,
    );
  } else {
    process.stderr.write(
      `⚠  feedback event ${id} already recorded — no-op (idempotent).\n`,
    );
  }
}

function runList(projectRoot: string, rest: string[]): void {
  const guard = readFlag(rest, "--guard") ?? undefined;
  const since = readFlag(rest, "--since") ?? undefined;
  const limitRaw = readFlag(rest, "--limit");
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10)) : undefined;

  const events = readFeedback(projectRoot, { guardId: guard, since, limit });
  if (events.length === 0) {
    process.stdout.write("(no feedback events match)\n");
    return;
  }
  for (const e of events) {
    process.stdout.write(
      `${e.timestamp}  ${e.label}  ${e.guardId.padEnd(20)} ` +
        `ticket=${e.ticketId || "-"} src=${e.source} id=${e.id}\n`,
    );
  }
  process.stdout.write(`\n${events.length} event(s)\n`);
}

function runF1(projectRoot: string, rest: string[]): void {
  const guard = readFlag(rest, "--guard");
  const period = readFlag(rest, "--period") ?? defaultPeriod();
  if (!guard) {
    process.stderr.write("❌ feedback f1 requires --guard <id>\n");
    process.exit(1);
  }
  const metric = computeF1FromFeedback(projectRoot, guard, period);
  process.stdout.write(formatF1Summary(metric) + "\n");
}

function runScan(projectRoot: string, rest: string[]): void {
  const since = readFlag(rest, "--since") ?? undefined;
  const maxRaw = readFlag(rest, "--max");
  const max = maxRaw ? Math.max(1, Number.parseInt(maxRaw, 10)) : undefined;
  const dryRun = rest.includes("--dry-run");

  const result = scanHistory(projectRoot, { since, max, dryRun });
  if (result.scanned === 0) {
    process.stdout.write("(scraper found no commits to scan)\n");
    return;
  }
  process.stdout.write(
    `[scraper] scanned=${result.scanned} proposed=${result.proposed.length} ` +
      `written=${result.written} skippedDuplicates=${result.skippedDuplicates}` +
      (dryRun ? " (dry-run)" : "") +
      "\n",
  );
  for (const e of result.proposed) {
    process.stdout.write(
      `  ${e.label} ${e.guardId.padEnd(18)} via ${e.source}  ${e.note ?? ""}\n`,
    );
  }
  if (result.proposed.length === 0) {
    process.stdout.write("  (no feedback inferred)\n");
  }
}

function readFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

function isHexPrefix(s: string): boolean {
  return /^[0-9a-f]{8,64}$/i.test(s);
}

function defaultPeriod(): string {
  // Last 30 days.
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return `${start.toISOString()}/${end.toISOString()}`;
}

function printUsage(): void {
  process.stdout.write(
    `\n📊 did feedback — Guard F1 input pipeline (issue #22 MVP)\n\n` +
      `Usage:\n` +
      `  did feedback <tp|fp|fn|tn> --guard <id> [--ticket TKID]\n` +
      `                             --finding <text-or-hash> [--note "..."]\n` +
      `  did feedback list   [--guard <id>] [--since <iso>] [--limit N]\n` +
      `  did feedback f1     --guard <id> [--period <iso-start>/<iso-end>]\n` +
      `  did feedback scan-history [--since <git-ref>] [--max N] [--dry-run]\n\n` +
      `Storage: .agents/records/feedback.jsonl (append-only, idempotent on id)\n`,
  );
}
