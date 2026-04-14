#!/usr/bin/env node

/**
 * defense-in-depth CLI
 *
 * Commands:
 *   init    — Install Git hooks into .git/hooks/
 *   verify  — Run guards against staged files or a directory
 *   doctor  — Health check: verify config, hooks, and guards
 */

import { init } from "./init.js";
import { verify } from "./verify.js";
import { doctor } from "./doctor.js";
import { handleLessonCommand } from "./lesson.js";
import { handleGrowthCommand } from "./growth.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));
const VERSION = packageJson.version;

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

    case "lesson":
      await handleLessonCommand(process.cwd(), args.slice(1));
      break;

    case "growth":
      await handleGrowthCommand(process.cwd(), args.slice(1));
      break;

    case "eval":
      const { evalCommand } = await import("./eval.js");
      await evalCommand(process.cwd(), args.slice(1));
      break;

    case "--help":
    case "-h":
    case undefined:
      printUsage();
      break;

    case "--version":
    case "-v":
      console.log(`defense-in-depth v${VERSION}`);
      break;

    default:
      console.error(`❌ Unknown command: "${command}"`);
      printUsage();
      process.exit(1);
  }
}

function printUsage(): void {
  console.log(`
🛡️  defense-in-depth — Git-based governance for AI coding agents

Usage:
  defense-in-depth <command> [options]

Commands:
  init      Install Git hooks (pre-commit + pre-push) into your project
  verify    Run all guards against staged files or a path
  doctor    Health check — verify config, hooks, and guard status
  lesson    Manage lessons (án lệ) in the local memory (v0.4)
  growth    Manage growth metrics checking the system's learning velocity (v0.4)
  eval      Evaluate artifact quality with DSPy semantic analysis (v0.5, opt-in)

Options:
  --help    Show this help
  --version Show version

Examples:
  npx defense-in-depth init
  npx defense-in-depth verify
  npx defense-in-depth verify --files src/app.ts docs/plan.md
  npx defense-in-depth doctor

Learn more: https://github.com/tamld/defense-in-depth
`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
