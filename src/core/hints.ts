import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import type { DefendConfig, DiscoveryHint } from "./types.js";

export interface HintState {
  id: string;
  dismissed: boolean;
  lastShownAt?: string;
}

function getHintsFilePath(projectRoot: string): string {
  return path.join(projectRoot, ".agents", "records", "hints.jsonl");
}

function ensureDirExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Reads the hints.jsonl file and returns the latest state for each hint id.
 */
export async function getHintsState(projectRoot: string): Promise<Record<string, HintState>> {
  const filePath = getHintsFilePath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const state: Record<string, HintState> = {};
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as HintState;
      if (record && record.id) {
        state[record.id] = record; // Latest line overwrites earlier ones
      }
    } catch {
      // Ignore malformed lines
    }
  }

  return state;
}

/**
 * Appends a new hint state record to the hints.jsonl file.
 */
export async function appendHintState(projectRoot: string, state: HintState): Promise<void> {
  const filePath = getHintsFilePath(projectRoot);
  ensureDirExists(filePath);
  fs.appendFileSync(filePath, JSON.stringify(state) + "\n", "utf-8");
}

/**
 * Dismisses a hint permanently.
 */
export async function dismissHint(projectRoot: string, id: string): Promise<void> {
  const state = await getHintsState(projectRoot);
  const current = state[id] || { id, dismissed: false };
  current.dismissed = true;
  current.lastShownAt = current.lastShownAt || new Date().toISOString();
  await appendHintState(projectRoot, current);
}

/**
 * Records that a hint was shown (updates lastShownAt).
 */
export async function recordHintShown(projectRoot: string, id: string): Promise<void> {
  const state = await getHintsState(projectRoot);
  const current = state[id] || { id, dismissed: false };
  if (current.dismissed) return; // Do not update if already dismissed
  current.lastShownAt = new Date().toISOString();
  await appendHintState(projectRoot, current);
}

/**
 * Determines whether a hint should be shown based on its state and cooldown config.
 */
export async function shouldShowHint(projectRoot: string, id: string, config: DefendConfig): Promise<boolean> {
  const state = await getHintsState(projectRoot);
  const current = state[id];

  if (!current) {
    return true; // Never shown
  }

  if (current.dismissed) {
    return false; // Dismissed
  }

  if (!current.lastShownAt) {
    return true;
  }

  // Check cooldown
  const cooldownDays = config.hints?.cooldownDays ?? 7;
  const lastShown = new Date(current.lastShownAt).getTime();
  const now = new Date().getTime();
  const diffDays = (now - lastShown) / (1000 * 60 * 60 * 24);

  return diffDays >= cooldownDays;
}
