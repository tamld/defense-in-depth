/**
 * Shared append-only JSONL store with runtime validation (issue #43).
 * Extracted from the duplicated I/O in `feedback.ts` and `lesson-outcome.ts`
 * — same id-dedupe + same line-by-line reader + same `JSON.parse(line) as T`
 * cast. The cast is the type-without-validation surface Antigravity flagged
 * on PR #32. The `validate` hook narrows untrusted JSON field by field.
 *
 * Executor: Devin
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface JsonlSchema<T> {
  validate: (raw: unknown) => T | null;
  idOf: (record: T) => string;
  timestampOf?: (record: T) => string | undefined;
}

export interface JsonlAppendResult<T> {
  written: boolean;
  event: T;
  path: string;
  windowDeduped?: boolean;
}

export interface JsonlAppendWindowOptions<T> {
  windowMs: number;
  windowKeyOf: (record: T) => string;
}

export interface JsonlReadOptions<T> {
  filter?: (record: T) => boolean;
  since?: string;
  limit?: number;
}

export interface JsonlStore<T> {
  readonly path: string;
  append(record: T): JsonlAppendResult<T>;
  appendWithWindow(
    record: T,
    options: JsonlAppendWindowOptions<T>,
  ): JsonlAppendResult<T>;
  read(options?: JsonlReadOptions<T>): T[];
  exists(id: string): boolean;
}

export function createJsonlStore<T>(
  filePath: string,
  schema: JsonlSchema<T>,
): JsonlStore<T> {
  let idCache: Set<string> | null = null;

  function ensureIdCache(): Set<string> {
    if (idCache === null) {
      idCache = new Set<string>();
      if (fs.existsSync(filePath)) {
        for (const existing of readAll()) {
          idCache.add(schema.idOf(existing));
        }
      }
    }
    return idCache;
  }

  function readAll(): T[] {
    if (!fs.existsSync(filePath)) return [];
    const out: T[] = [];
    for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const v = schema.validate(parsed);
      if (v !== null) out.push(v);
    }
    return out;
  }

  function append(record: T): JsonlAppendResult<T> {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const targetId = schema.idOf(record);
    const cache = ensureIdCache();

    if (cache.has(targetId)) {
      for (const existing of readAll()) {
        if (schema.idOf(existing) === targetId) {
          return { written: false, event: existing, path: filePath };
        }
      }
      return { written: false, event: record, path: filePath };
    }

    fs.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf-8");
    cache.add(targetId);
    return { written: true, event: record, path: filePath };
  }

  function appendWithWindow(
    record: T,
    options: JsonlAppendWindowOptions<T>,
  ): JsonlAppendResult<T> {
    if (!schema.timestampOf) {
      throw new Error(
        "createJsonlStore: appendWithWindow requires schema.timestampOf",
      );
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const targetId = schema.idOf(record);
    const cache = ensureIdCache();

    if (cache.has(targetId)) {
      for (const existing of readAll()) {
        if (schema.idOf(existing) === targetId) {
          return { written: false, event: existing, path: filePath };
        }
      }
      return { written: false, event: record, path: filePath };
    }

    const incomingTsRaw = schema.timestampOf(record);
    const incomingTs = incomingTsRaw ? Date.parse(incomingTsRaw) : NaN;
    const incomingKey = options.windowKeyOf(record);

    for (const existing of readAll()) {
      if (Number.isNaN(incomingTs)) continue;
      if (options.windowKeyOf(existing) !== incomingKey) continue;
      const eTsRaw = schema.timestampOf(existing);
      const eTs = eTsRaw ? Date.parse(eTsRaw) : NaN;
      if (Number.isNaN(eTs)) continue;
      if (Math.abs(incomingTs - eTs) <= options.windowMs) {
        return {
          written: false,
          event: existing,
          path: filePath,
          windowDeduped: true,
        };
      }
    }
    fs.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf-8");
    cache.add(targetId);
    return { written: true, event: record, path: filePath };
  }

  function read(options: JsonlReadOptions<T> = {}): T[] {
    const sinceMs = options.since ? Date.parse(options.since) : undefined;
    if (sinceMs !== undefined && !schema.timestampOf) {
      throw new Error(
        "createJsonlStore: read({since}) requires schema.timestampOf",
      );
    }
    const out: T[] = [];
    for (const r of readAll()) {
      if (options.filter && !options.filter(r)) continue;
      if (sinceMs !== undefined && !Number.isNaN(sinceMs)) {
        const tsRaw = schema.timestampOf!(r);
        const ts = tsRaw ? Date.parse(tsRaw) : NaN;
        if (Number.isNaN(ts) || ts < sinceMs) continue;
      }
      out.push(r);
      if (options.limit !== undefined && out.length >= options.limit) break;
    }
    return out;
  }

  function exists(id: string): boolean {
    const cache = ensureIdCache();
    return cache.has(id);
  }

  return { path: filePath, append, appendWithWindow, read, exists };
}

// Validator helpers shared by every schema in the project.

/** Narrow `unknown` to a record with a non-empty string `id`. */
export function isObjectWithId(raw: unknown): raw is Record<string, unknown> {
  return (
    typeof raw === "object" && raw !== null && !Array.isArray(raw) &&
    typeof (raw as { id?: unknown }).id === "string" &&
    (raw as { id: string }).id.length > 0
  );
}

/** `raw[key]` if it's a string, else null. */
export function getString(
  raw: Record<string, unknown>,
  key: string,
): string | null {
  const v = raw[key];
  return typeof v === "string" ? v : null;
}

/** `undefined` if absent, the string if present, `null` if wrong type. */
export function getOptionalString(
  raw: Record<string, unknown>,
  key: string,
): string | undefined | null {
  if (!(key in raw)) return undefined;
  const v = raw[key];
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : null;
}

/** Narrow `raw[key]` to one of `allowed`. */
export function isStringEnum<E extends string>(
  raw: Record<string, unknown>,
  key: string,
  allowed: readonly E[],
): E | null {
  const v = raw[key];
  if (typeof v !== "string") return null;
  return (allowed as readonly string[]).includes(v) ? (v as E) : null;
}
