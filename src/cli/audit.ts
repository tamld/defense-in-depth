/**
 * Audit Command — Read-only pattern extraction from target projects
 *
 * Runs defense-in-depth guards on a target project WITHOUT modifying it.
 * Extracts patterns, findings, and failure modes for lesson generation.
 *
 * Usage:
 *   defense-in-depth audit <target-path> [--output json|text] [--export-lessons <path>]
 */

import { verify } from "./verify.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { Severity } from "../core/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AuditOptions {
  targetPath: string;
  outputFormat: "json" | "text";
  exportLessonsPath?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface AuditResult {
  targetPath: string;
  timestamp: string;
  version: string;
  summary: {
    filesScanned: number;
    findingsTotal: number;
    findingsBySeverity: Record<string, number>;
    findingsByGuard: Record<string, number>;
  };
  findings: AuditFinding[];
  patterns: {
    codePatterns: CodePattern[];
    commitPatterns: CommitPattern[];
    configDrift: ConfigDrift[];
    fileSizes: FileSizeInfo[];
  };
  suggestedLessons: SuggestedLesson[];
}

export interface AuditFinding {
  guardId: string;
  severity: "PASS" | "WARN" | "BLOCK";
  file: string;
  line?: number;
  message: string;
  fix?: string;
}

export interface CodePattern {
  pattern: string;
  count: number;
  files: string[];
  category: "todo" | "fixme" | "hack" | "tbd" | "empty-catch" | "console-log" | "type-any";
}

export interface CommitPattern {
  pattern: string;
  count: number;
  examples: string[];
  category: "fix" | "refactor" | "hack" | "workaround" | "revert";
}

export interface ConfigDrift {
  file: string;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  driftType: "missing" | "different" | "extra";
}

export interface FileSizeInfo {
  file: string;
  sizeBytes: number;
  sizeKB: number;
  category: "large" | "huge";
}

export interface SuggestedLesson {
  title: string;
  wrongApproach: string;
  correctApproach: string;
  insight: string;
  category: "code" | "process" | "tool" | "arch";
  evidence: "RUNTIME" | "INFER" | "HYPO";
  confidence: number;
  wrongApproachPattern?: string;
  relatedFiles?: string[];
  tags?: string[];
}

const PACKAGE_JSON = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));
const VERSION = PACKAGE_JSON.version;

/**
 * Main audit entry point
 */
export async function auditCommand(projectRoot: string, args: string[]): Promise<void> {
  const options = parseAuditOptions(args);

  if (!options.targetPath) {
    console.error("❌ Audit requires a target path: `defense-in-depth audit <path>`");
    printAuditUsage();
    process.exit(1);
  }

  const targetPath = resolve(projectRoot, options.targetPath);

  if (!existsSync(targetPath)) {
    console.error(`❌ Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  console.log(`🔍 Auditing: ${targetPath}`);
  console.log(`📦 defense-in-depth v${VERSION}`);

  const result = await runAudit(targetPath, options);

  // Output
  if (options.outputFormat === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printAuditSummary(result);
  }

  // Export lessons if requested
  if (options.exportLessonsPath) {
    const exportPath = resolve(projectRoot, options.exportLessonsPath);
    ensureDir(dirname(exportPath));
    writeFileSync(exportPath, result.suggestedLessons.map(l => JSON.stringify(l)).join("\n") + "\n", "utf-8");
    console.log(`\n📚 Exported ${result.suggestedLessons.length} suggested lessons to: ${exportPath}`);
  }

  console.log("\n✅ Audit complete. No modifications made to target project.");
}

/**
 * Run full audit on target project
 */
async function runAudit(targetPath: string, options: AuditOptions): Promise<AuditResult> {
  const startTime = Date.now();

  // 1. Run verify (read-only, no hooks)
  console.log("  → Running guard verification...");
  const verifyResult = await runVerifyReadOnly(targetPath, options);

  // 2. Extract code patterns
  console.log("  → Extracting code patterns...");
  const codePatterns = await extractCodePatterns(targetPath, options);

  // 3. Extract commit patterns
  console.log("  → Analyzing commit history...");
  const commitPatterns = await extractCommitPatterns(targetPath);

  // 4. Check config drift
  console.log("  → Checking config drift...");
  const configDrift = await checkConfigDrift(targetPath);

  // 5. Check file sizes
  console.log("  → Scanning file sizes...");
  const fileSizes = await scanFileSizes(targetPath);

  // 6. Generate suggested lessons
  console.log("  → Generating suggested lessons...");
  const suggestedLessons = generateSuggestedLessons(verifyResult, codePatterns, commitPatterns, configDrift, fileSizes);

  const durationMs = Date.now() - startTime;

  return {
    targetPath,
    timestamp: new Date().toISOString(),
    version: VERSION,
    summary: {
      filesScanned: verifyResult.filesScanned ?? 0,
      findingsTotal: verifyResult.findings?.length ?? 0,
      findingsBySeverity: countBySeverity(verifyResult.findings ?? []),
      findingsByGuard: countByGuard(verifyResult.findings ?? []),
    },
    findings: verifyResult.findings ?? [],
    patterns: {
      codePatterns,
      commitPatterns,
      configDrift,
      fileSizes,
    },
    suggestedLessons,
  };
}

/**
 * Run verify in read-only mode (no hooks, no writes)
 */
async function runVerifyReadOnly(targetPath: string, options: AuditOptions): Promise<{
  findings: AuditFinding[];
  filesScanned: number;
}> {
  // Import verify dynamically to avoid circular deps
  const { verify } = await import("./verify.js");

  // Capture console output
  const findings: AuditFinding[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  try {
    // We need to capture verify output. Since verify writes to console,
    // we'll run it and parse results from the engine directly.
    // For now, run verify with --files to scan all files.
    const files = await findScannableFiles(targetPath, options);

    // Use the engine directly for programmatic access
    const { DefendEngine } = await import("../core/engine.js");
    const { loadConfig } = await import("../core/config-loader.js");

    const config = await loadConfig(targetPath);
    const engine = new DefendEngine(targetPath, config);

    const result = await engine.run({ files, branch: "audit" });

    const auditFindings: AuditFinding[] = [];
    for (const guardResult of result.results) {
      for (const finding of guardResult.findings) {
        const severity = finding.severity === Severity.BLOCK ? "BLOCK" : finding.severity === Severity.WARN ? "WARN" : "PASS";
        auditFindings.push({
          guardId: guardResult.guardId,
          severity,
          file: finding.filePath || "unknown",
          line: finding.line,
          message: finding.message,
          fix: finding.fix,
        });
      }
    }

    return { findings: auditFindings, filesScanned: files.length };
  } catch (err) {
    console.error(`⚠ Audit verify failed: ${err instanceof Error ? err.message : String(err)}`);
    return { findings: [], filesScanned: 0 };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

/**
 * Find scannable files in target project
 */
async function findScannableFiles(targetPath: string, options: AuditOptions): Promise<string[]> {
  const { glob } = await import("glob");
  const patterns = options.includePatterns?.length ? options.includePatterns : [
    "**/*.{ts,tsx,js,jsx,json,yaml,yml,md,py,go,rs,java,kt,swift,cs,php,rb,sh,sql,html,css,scss,vue,svelte}",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/build/**",
    "!**/.git/**",
    "!**/coverage/**",
    "!**/.next/**",
    "!**/.turbo/**",
  ];

  const files: string[] = [];
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) continue;
    try {
      const matches = await glob(pattern, { cwd: targetPath, absolute: true, ignore: patterns.filter(p => p.startsWith("!")).map(p => p.slice(1)) });
      files.push(...matches);
    } catch {
      // Ignore glob errors
    }
  }
  return [...new Set(files)];
}

/**
 * Extract code patterns (TODO, FIXME, HACK, etc.)
 */
async function extractCodePatterns(targetPath: string, options: AuditOptions): Promise<CodePattern[]> {
  const files = await findScannableFiles(targetPath, options);
  const patternMap = new Map<string, CodePattern>();

  const patternCategories = [
    { regex: /\bTODO\b/gi, category: "todo" as const },
    { regex: /\bFIXME\b/gi, category: "fixme" as const },
    { regex: /\bHACK\b/gi, category: "hack" as const },
    { regex: /\bTBD\b/gi, category: "tbd" as const },
    { regex: /catch\s*\(\s*\)\s*\{/g, category: "empty-catch" as const },
    { regex: /console\.(log|error|warn)\(/g, category: "console-log" as const },
    { regex: /:\s*any\b/g, category: "type-any" as const },
  ];

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8");
      const relFile = file.replace(targetPath + "/", "");

      for (const { regex, category } of patternCategories) {
        const matches = content.match(regex);
        if (matches) {
          const key = `${category}:${regex.source}`;
          const existing = patternMap.get(key);
          if (existing) {
            existing.count += matches.length;
            existing.files.push(relFile);
          } else {
            patternMap.set(key, {
              pattern: regex.source,
              count: matches.length,
              files: [relFile],
              category,
            });
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return Array.from(patternMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

/**
 * Extract commit patterns from git history
 */
async function extractCommitPatterns(targetPath: string): Promise<CommitPattern[]> {
  try {
    const { execSync } = await import("child_process");
    const log = execSync("git log --oneline --grep='fix\\|refactor\\|hack\\|workaround\\|revert' -n 200", {
      cwd: targetPath,
      encoding: "utf-8",
      timeout: 5000,
    });

    const lines = log.trim().split("\n").filter(Boolean);
    const patternMap = new Map<string, CommitPattern>();

    for (const line of lines) {
      const msg = line.split(" ").slice(1).join(" ").toLowerCase();
      let category: CommitPattern["category"] = "fix";

      if (msg.includes("refactor")) category = "refactor";
      else if (msg.includes("hack") || msg.includes("workaround")) category = "hack";
      else if (msg.includes("revert")) category = "revert";

      const key = category;
      const existing = patternMap.get(key);
      if (existing) {
        existing.count++;
        if (existing.examples.length < 5) existing.examples.push(line.trim());
      } else {
        patternMap.set(key, { pattern: category, count: 1, examples: [line.trim()], category });
      }
    }

    return Array.from(patternMap.values()).sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

/**
 * Check config drift against defaults
 */
async function checkConfigDrift(targetPath: string): Promise<ConfigDrift[]> {
  const drifts: ConfigDrift[] = [];

  // Check package.json
  try {
    const pkgPath = join(targetPath, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const expected = { type: "module", engines: { node: ">=18" } };
      for (const [key, expVal] of Object.entries(expected)) {
        if (!(key in pkg)) {
          drifts.push({ file: "package.json", expected: { [key]: expVal }, actual: {}, driftType: "missing" });
        } else if (JSON.stringify(pkg[key]) !== JSON.stringify(expVal)) {
          drifts.push({ file: "package.json", expected: { [key]: expVal }, actual: { [key]: pkg[key] }, driftType: "different" });
        }
      }
    }
  } catch {}

  // Check tsconfig.json
  try {
    const tsPath = join(targetPath, "tsconfig.json");
    if (existsSync(tsPath)) {
      const tsconfig = JSON.parse(readFileSync(tsPath, "utf-8"));
      const expectedKeys = ["strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes"];
      for (const key of expectedKeys) {
        if (tsconfig.compilerOptions?.[key] !== true) {
          drifts.push({
            file: "tsconfig.json",
            expected: { compilerOptions: { [key]: true } },
            actual: { compilerOptions: { [key]: tsconfig.compilerOptions?.[key] } },
            driftType: tsconfig.compilerOptions?.[key] === undefined ? "missing" : "different",
          });
        }
      }
    }
  } catch {}

  return drifts;
}

/**
 * Scan for large files (potential hollow artifacts)
 */
async function scanFileSizes(targetPath: string): Promise<FileSizeInfo[]> {
  const { glob } = await import("glob");
  const files = await glob("**/*", { cwd: targetPath, absolute: true, nodir: true });
  const largeFiles: FileSizeInfo[] = [];

  for (const file of files) {
    try {
      const stats = await import("fs").then(fs => fs.statSync(file));
      const sizeKB = stats.size / 1024;
      if (sizeKB > 100) {
        largeFiles.push({
          file: file.replace(targetPath + "/", ""),
          sizeBytes: stats.size,
          sizeKB: Math.round(sizeKB),
          category: sizeKB > 1000 ? "huge" : "large",
        });
      }
    } catch {}
  }

  return largeFiles.sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 20);
}

/**
 * Generate suggested lessons from audit findings
 */
function generateSuggestedLessons(
  verifyResult: { findings: AuditFinding[] },
  codePatterns: CodePattern[],
  commitPatterns: CommitPattern[],
  configDrift: ConfigDrift[],
  fileSizes: FileSizeInfo[]
): SuggestedLesson[] {
  const lessons: SuggestedLesson[] = [];

  // From guard findings
  for (const finding of verifyResult.findings) {
    if (finding.severity === "BLOCK" || finding.severity === "WARN") {
      lessons.push({
        title: `Guard ${finding.guardId}: ${finding.message}`,
        wrongApproach: `Code triggered ${finding.guardId}: ${finding.message}`,
        correctApproach: finding.fix || `Follow ${finding.guardId} guidelines to avoid this pattern`,
        insight: `Guard ${finding.guardId} catches this pattern automatically. Ensure code passes pre-commit.`,
        category: "code",
        evidence: "RUNTIME",
        confidence: finding.severity === "BLOCK" ? 0.9 : 0.7,
        wrongApproachPattern: finding.message,
        relatedFiles: [finding.file],
        tags: [finding.guardId, "auto-generated"],
      });
    }
  }

  // From code patterns
  for (const pattern of codePatterns.slice(0, 10)) {
    if (pattern.count > 5) {
      lessons.push({
        title: `Recurring ${pattern.category.toUpperCase()} pattern (${pattern.count} occurrences)`,
        wrongApproach: `Found ${pattern.count} instances of ${pattern.category} across ${pattern.files.length} files`,
        correctApproach: `Resolve ${pattern.category} markers before commit. Use proper implementation instead of placeholders.`,
        insight: `High frequency of ${pattern.category} indicates technical debt accumulation. Address systematically.`,
        category: "process",
        evidence: "INFER",
        confidence: 0.7,
        wrongApproachPattern: pattern.category,
        relatedFiles: pattern.files.slice(0, 10),
        tags: ["pattern", pattern.category, "auto-generated"],
      });
    }
  }

  // From config drift
  for (const drift of configDrift.slice(0, 5)) {
    lessons.push({
      title: `Config drift in ${drift.file}: ${drift.driftType}`,
      wrongApproach: `${drift.file} has ${drift.driftType} configuration`,
      correctApproach: `Align ${drift.file} with project standards: ${JSON.stringify(drift.expected)}`,
      insight: `Config drift causes inconsistent behavior across environments. Keep configs synchronized.`,
      category: "tool",
      evidence: "RUNTIME",
      confidence: 0.8,
      relatedFiles: [drift.file],
      tags: ["config", "drift", "auto-generated"],
    });
  }

  // From large files
  for (const fs of fileSizes.slice(0, 5)) {
    lessons.push({
      title: `Large file detected: ${fs.file} (${fs.sizeKB} KB)`,
      wrongApproach: `${fs.file} is ${fs.sizeKB} KB — may indicate hollow artifact or over-engineering`,
      correctApproach: `Split into smaller modules. Keep files under 100 KB unless justified.`,
      insight: `Large files correlate with hollow artifacts and maintenance burden.`,
      category: "code",
      evidence: "INFER",
      confidence: 0.6,
      relatedFiles: [fs.file],
      tags: ["size", "hollow-artifact", "auto-generated"],
    });
  }

  return lessons;
}

function countBySeverity(findings: AuditFinding[]): Record<string, number> {
  return findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function countByGuard(findings: AuditFinding[]): Record<string, number> {
  return findings.reduce((acc, f) => {
    acc[f.guardId] = (acc[f.guardId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function parseAuditOptions(args: string[]): AuditOptions {
  const options: AuditOptions = {
    targetPath: "",
    outputFormat: "text",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" && args[i + 1]) {
      options.outputFormat = args[++i] as "json" | "text";
    } else if (arg === "--export-lessons" && args[i + 1]) {
      options.exportLessonsPath = args[++i];
    } else if (!arg.startsWith("-") && !options.targetPath) {
      options.targetPath = arg;
    }
  }

  return options;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function printAuditUsage(): void {
  console.log(`
🔍 defense-in-depth audit — Read-only pattern extraction

Usage:
  defense-in-depth audit <target-path> [options]

Options:
  --output json|text        Output format (default: text)
  --export-lessons <path>   Export suggested lessons to JSONL file

Examples:
  defense-in-depth audit ../my-project
  defense-in-depth audit ../my-project --output json
  defense-in-depth audit ../my-project --export-lessons .agents/records/audit-lessons.jsonl
`);
}

function printAuditSummary(result: AuditResult): void {
  console.log(`
📊 Audit Summary for: ${result.targetPath}
   Files scanned: ${result.summary.filesScanned}
   Total findings: ${result.summary.findingsTotal}
   By severity: ${JSON.stringify(result.summary.findingsBySeverity)}
   By guard: ${JSON.stringify(result.summary.findingsByGuard)}

📋 Top Code Patterns:
${result.patterns.codePatterns.slice(0, 10).map(p => `   ${p.category}: ${p.count} (${p.files.length} files)`).join("\n") || "   (none)"}

📝 Commit Patterns:
${result.patterns.commitPatterns.map(p => `   ${p.category}: ${p.count}`).join("\n") || "   (none)"}

⚙️ Config Drift:
${result.patterns.configDrift.map(d => `   ${d.file}: ${d.driftType}`).join("\n") || "   (none)"}

📦 Large Files:
${result.patterns.fileSizes.slice(0, 5).map(f => `   ${f.file}: ${f.sizeKB} KB (${f.category})`).join("\n") || "   (none)"}

💡 Suggested Lessons: ${result.suggestedLessons.length}
${result.suggestedLessons.slice(0, 5).map(l => `   - ${l.title} [${l.category}]`).join("\n") || "   (none)"}
`);
}
