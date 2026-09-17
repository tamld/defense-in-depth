import { analyzeLessons, mergeLessons, DEFAULT_DEDUP_CONFIG } from "../../core/dedup.js";
import type { DedupConfig } from "../../core/dedup.js";
import type { Lesson } from "../../core/types.js";

export async function runDedup(projectRoot: string, args: string[]): Promise<void> {
  const showHelp = args.includes("--help") || args.includes("-h");

  // Parse options
  let threshold = DEFAULT_DEDUP_CONFIG.threshold;
  let autoMerge = DEFAULT_DEDUP_CONFIG.autoMerge;
  let format: "json" | "table" | "summary" = "summary";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--threshold" || arg === "-t") {
      threshold = Number(args[++i]);
    } else if (arg === "--auto-merge") {
      autoMerge = true;
    } else if (arg === "--format" || arg === "-f") {
      format = args[++i] as "json" | "table" | "summary";
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  if (showHelp) {
    printDedupUsage();
    return;
  }

  const config: DedupConfig = {
    threshold,
    autoMerge,
    preserveSources: true,
  };

  console.log(`🔍 Analyzing lessons for duplicates (threshold: ${threshold})...\n`);

  const result = await analyzeLessons(projectRoot, config);

  if (result.groups.length === 0) {
    console.log("✅ No duplicates found. All lessons are unique.");
    return;
  }

  console.log(
    `Found ${result.groups.length} duplicate group(s) affecting ${result.duplicateCount} lessons:\n`,
  );

  if (format === "json") {
    console.log(
      JSON.stringify(
        result.groups.map((g) => g.map((l) => l.id)),
        null,
        2,
      ),
    );
    return;
  }

  if (format === "table") {
    printTable(result.groups);
    return;
  }

  // Summary format (default)
  printSummary(result.groups);

  // Auto-merge or prompt
  if (autoMerge || dryRun) {
    console.log("\n🔧 Merging duplicates...");
    const merges = await mergeLessons(projectRoot, config);

    for (const merge of merges) {
      console.log(`  ✓ ${merge.summary}`);
      if (dryRun) {
        console.log(`     Canonical ID: ${merge.canonical.id}`);
        console.log(`     Title: ${merge.canonical.title}`);
        console.log(`     Sources: ${merge.sourceIds.join(", ")}`);
      }
    }

    if (!dryRun) {
      // TODO: Write merged lessons back to lessons.jsonl
      console.log("\n⚠️  Auto-merge not yet implemented for write-back. Use --dry-run to preview.");
    }
  } else {
    console.log("\n💡 Run with --auto-merge to merge, or --dry-run to preview merges.");
  }
}

export function printSummary(groups: Lesson[][]): void {
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const base = group.reduce((b, c) => (c.confidence > b.confidence ? c : b));
    console.log(
      `  Group ${i + 1}: ${group.length} lessons (score ≥ ${(DEFAULT_DEDUP_CONFIG.threshold * 100).toFixed(0)}%)`,
    );
    console.log(`    Base: ${base.id} — ${base.title}`);
    for (const l of group) {
      if (l.id !== base.id) {
        console.log(`    ↳ ${l.id} — ${l.title}`);
      }
    }
    console.log("");
  }
}

export function printTable(groups: Lesson[][]): void {
  console.log("Group | Count | Base ID | Title");
  console.log("------|-------|---------|------");
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const base = group.reduce((b, c) => (c.confidence > b.confidence ? c : b));
    console.log(`${i + 1} | ${group.length} | ${base.id.slice(0, 8)} | ${base.title.slice(0, 50)}`);
  }
}

export function printDedupUsage(): void {
  console.log(`
📚  defense-in-depth lesson dedup — Find and merge duplicate lessons

Usage:
  did lesson dedup [options]

Options:
  --threshold, -t   Similarity threshold 0-1 (default: 0.75)
  --auto-merge      Automatically merge duplicates (requires --dry-run first)
  --dry-run         Preview merges without writing
  --format, -f      Output format: summary | table | json (default: summary)
  --help, -h        Show this help

Examples:
  did lesson dedup                    # Summary with default threshold
  did lesson dedup --threshold 0.8    # Stricter matching
  did lesson dedup --format table     # Tabular output
  did lesson dedup --dry-run          # Preview what would be merged
  did lesson dedup --auto-merge --dry-run  # Preview then merge
`);
}
