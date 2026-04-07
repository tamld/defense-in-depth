#!/usr/bin/env node

/**
 * defend-in-depth CLI
 *
 * Commands:
 *   init    — Install Git hooks into .git/hooks/
 *   verify  — Run guards against staged files or a directory
 *   doctor  — Health check: verify config, hooks, and guards
 */

import { init } from "./init.js";
import { verify } from "./verify.js";
import { doctor } from "./doctor.js";

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  switch (command) {
    case "init":
      await init(process.cwd());
      break;

    case "verify":
      await verify(process.cwd(), args.slice(1));
      break;

    case "doctor":
      await doctor(process.cwd());
      break;

    case "--help":
    case "-h":
    case undefined:
      printUsage();
      break;

    case "--version":
    case "-v":
      console.log("defend-in-depth v0.1.0");
      break;

    default:
      console.error(`❌ Unknown command: "${command}"`);
      printUsage();
      process.exit(1);
  }
}

function printUsage(): void {
  console.log(`
🛡️  defend-in-depth — Git-based governance for AI coding agents

Usage:
  defend-in-depth <command> [options]

Commands:
  init      Install Git hooks (pre-commit + pre-push) into your project
  verify    Run all guards against staged files or a path
  doctor    Health check — verify config, hooks, and guard status

Options:
  --help    Show this help
  --version Show version

Examples:
  npx defend-in-depth init
  npx defend-in-depth verify
  npx defend-in-depth verify --files src/app.ts docs/plan.md
  npx defend-in-depth doctor

Learn more: https://github.com/tamld/defend-in-depth
`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
