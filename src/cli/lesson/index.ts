import { runRecord } from "./record.js";
import { runSearch } from "./search.js";
import { runOutcome } from "./outcome.js";
import { runScanOutcomes } from "./scan.js";
import { runRecalls } from "./recalls.js";
import { printLessonUsage } from "./helpers.js";

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

export {
  runRecord,
  runSearch,
  runOutcome,
  runScanOutcomes,
  runRecalls,
  printLessonUsage,
};
