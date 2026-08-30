import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

test("sync-wiki.sh — dry run smoke test", async () => {
  const scriptPath = path.resolve(process.cwd(), "scripts/sync-wiki.sh");
  const { stdout, stderr } = await execFileAsync("bash", [scriptPath, "--dry-run"]);

  assert.ok(stdout.includes("Synchronizing defense-in-depth wiki"));
  assert.ok(stdout.includes("[dry-run]"));
  assert.equal(stderr, "");
});
