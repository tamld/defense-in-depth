/**
 * CLI: hint command
 *
 * Usage:
 *   defense-in-depth hint dismiss <id>
 */

import { dismissHint } from "../core/hints.js";

export async function handleHintCommand(
  projectRoot: string,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    printHintUsage();
    return;
  }

  const subCommand = args[0];

  switch (subCommand) {
    case "dismiss": {
      const hintId = args[1];
      if (!hintId) {
        console.error("❌ Error: Missing hint ID.");
        console.log("Usage: defense-in-depth hint dismiss <id>");
        process.exit(1);
      }
      await dismissHint(projectRoot, hintId);
      console.log(`✅ Hint '${hintId}' dismissed permanently.`);
      break;
    }
    default:
      console.error(`❌ Unknown hint command: "${subCommand}"`);
      printHintUsage();
      process.exit(1);
  }
}

function printHintUsage(): void {
  console.log(`
🛡️  defense-in-depth hint

Usage:
  defense-in-depth hint <command>

Commands:
  dismiss <id>   Dismiss a discovery hint permanently so it never shows again
`);
}
