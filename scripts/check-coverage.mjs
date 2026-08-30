#!/usr/bin/env node
/**
 * Coverage gate for CI.
 *
 * Runs `node --experimental-test-coverage --test 'tests/**\/*.test.js'`,
 * parses the "all files" summary line, and exits 1 if any metric is below
 * the configured threshold.
 *
 * Thresholds are set to the current `main` floor (rounded down). They
 * exist to prevent regression below the current state. When the test-
 * hardening PRs (#7, #8, #9, #10) are merged and the coverage rises, the
 * thresholds in this file should be ratcheted in a follow-up PR.
 *
 * Usage: node scripts/check-coverage.mjs
 *
 * Executor: Devin
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const THRESHOLDS = {
  line: 98,
  branch: 91,
  funcs: 97,
};

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");

console.log("Running tests with coverage…");
const result = spawnSync(
  process.execPath,
  [
    "--experimental-test-coverage",
    "--test",
  ],
  {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, NO_COLOR: "1" },
  },
);

const stdout = result.stdout || "";
if (stdout) {
  process.stdout.write(stdout);
}

if (result.status !== 0) {
  console.error(`✘ Test run failed with exit code ${result.status}`);
  process.exit(result.status ?? 1);
}

// Strip any residual ANSI escapes (NO_COLOR=1 should already prevent them,
// but Node test reporter sometimes emits cursor moves anyway).
// eslint-disable-next-line no-control-regex
const stripped = stdout.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");

// Match either the spec-reporter prefix ("ℹ ") or the TAP prefix ("# ").
const allFilesLine = stripped
  .split("\n")
  .map((l) => l.replace(/^[#ℹ]\s+/, "").trimEnd())
  .find((l) => /^all files\s*\|/.test(l));

if (!allFilesLine) {
  console.error("✘ Could not locate 'all files' coverage summary line.");
  console.error("Looked in stdout (first 200 chars):");
  console.error(stripped.slice(0, 200));
  process.exit(1);
}

// Format:  all files | 94.74 |   86.20 |  95.14 |
const cells = allFilesLine
  .replace(/^all files\s*\|/, "")
  .split("|")
  .map((s) => s.trim());

const [lineStr, branchStr, funcsStr] = cells;
const metrics = {
  line: parseFloat(lineStr),
  branch: parseFloat(branchStr),
  funcs: parseFloat(funcsStr),
};

if (
  Number.isNaN(metrics.line) ||
  Number.isNaN(metrics.branch) ||
  Number.isNaN(metrics.funcs)
) {
  console.error("✘ Failed to parse coverage numbers from:", allFilesLine);
  process.exit(1);
}

console.log("\n=== Coverage gate ===");
console.log(
  `  line:   ${metrics.line.toFixed(2)}% (threshold ${THRESHOLDS.line}%)`,
);
console.log(
  `  branch: ${metrics.branch.toFixed(2)}% (threshold ${THRESHOLDS.branch}%)`,
);
console.log(
  `  funcs:  ${metrics.funcs.toFixed(2)}% (threshold ${THRESHOLDS.funcs}%)`,
);

const failures = [];
if (metrics.line < THRESHOLDS.line)
  failures.push(`line ${metrics.line}% < ${THRESHOLDS.line}%`);
if (metrics.branch < THRESHOLDS.branch)
  failures.push(`branch ${metrics.branch}% < ${THRESHOLDS.branch}%`);
if (metrics.funcs < THRESHOLDS.funcs)
  failures.push(`funcs ${metrics.funcs}% < ${THRESHOLDS.funcs}%`);

if (failures.length > 0) {
  console.error("\n✘ Coverage gate failed:");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nFix: add tests, or — if intentional — bump thresholds in scripts/check-coverage.mjs.",
  );
  process.exit(1);
}

console.log("\n✓ Coverage gate passed.");
