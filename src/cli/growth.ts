import { recordGrowthMetric } from "../core/memory.js";
import { GrowthMetric } from "../core/types.js";

/**
 * Parses and executes 'growth' subcommands.
 */
export async function handleGrowthCommand(
  projectRoot: string,
  args: string[]
): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "record":
      await runRecord(projectRoot, args.slice(1));
      break;
    default:
      console.error(`❌ Unknown growth command: "${subcommand || ""}"`);
      printGrowthUsage();
      process.exit(1);
  }
}

async function runRecord(projectRoot: string, args: string[]): Promise<void> {
  let name = "";
  let valueStr = "";
  let unit = "";
  let source = "";
  let trend = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) name = args[++i];
    else if (args[i] === "--value" && args[i + 1]) valueStr = args[++i];
    else if (args[i] === "--unit" && args[i + 1]) unit = args[++i];
    else if (args[i] === "--source" && args[i + 1]) source = args[++i];
    else if (args[i] === "--trend" && args[i + 1]) trend = args[++i];
  }

  if (!name || !valueStr || !unit) {
    console.error("❌ Growth record requires --name, --value, and --unit");
    printGrowthUsage();
    process.exit(1);
  }

  const value = parseFloat(valueStr);
  if (isNaN(value) || !isFinite(value)) {
    console.error(`❌ Invalid numeric value for --value: "${valueStr}"`);
    process.exit(1);
  }

  const payload: Partial<GrowthMetric> = { name, value, unit };
  if (source) payload.source = source;
  if (trend) {
    if (trend === "improving" || trend === "stable" || trend === "degrading") {
      payload.trend = trend as "improving" | "stable" | "degrading";
    } else {
      console.error(`❌ Unknown trend "${trend}". Acceptable values: improving, stable, degrading.`);
      process.exit(1);
    }
  }

  const created = await recordGrowthMetric(payload as Omit<GrowthMetric, "measuredAt">, projectRoot);
  console.log(`📈 Growth metric [${created.name}] recorded successfully.`);
}

function printGrowthUsage(): void {
  console.log(`
🛡️  defense-in-depth growth — Growth Metrics Tracking

Commands:
  record    Record a new growth metric.
            --name <string>      Metadata name (e.g. guard_false_positive_rate)
            --value <number>     Numeric value
            --unit <string>      Unit of measurement (e.g. 'percentage', 'count')
            [--source <string>]  Optional trigger source
            [--trend <string>]   Optional trend (improving|stable|degrading)

Examples:
  npx defense-in-depth growth record --name "lessons_per_ticket" --value 2 --unit "count" --source "TK-123"
`);
}
