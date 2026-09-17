/**
 * Tests for the shared `createJsonlStore` factory (issue #43).
 *
 * Coverage:
 *   - append: id-based idempotency, returns existing record on collision
 *   - appendWithWindow: window dedupe by (key, timestamp) AND id fallback
 *   - read: filter / since / limit / runtime validation
 *   - exists: id lookup, file-missing tolerance
 *   - validators: runtime rejection of structurally wrong but JSON-valid lines
 *   - corrupt-line tolerance (mixed valid + invalid lines on disk)
 *   - lazy mkdir on first append
 *
 * The shared store is consumed by `feedback.ts` and `lesson-outcome.ts`;
 * those modules' own tests verify the typed adapters. This file exercises
 * the generic factory with a small synthetic record type.
 *
 * Executor: Devin
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  createJsonlStore,
  isObjectWithId,
  getString,
  getOptionalString,
  isStringEnum,
} from "../dist/core/jsonl-store.js";

// ─── Synthetic record + schema for the store under test ─────────────

/** @typedef {{ id: string; group: string; value: string; timestamp: string; note?: string }} Rec */

const KINDS = ["a", "b"];

/** @type {import("../dist/core/jsonl-store.js").JsonlSchema<Rec>} */
const recSchema = {
  validate(raw) {
    if (!isObjectWithId(raw)) return null;
    const group = getString(raw, "group");
    const value = isStringEnum(raw, "value", KINDS);
    const timestamp = getString(raw, "timestamp");
    if (group === null || value === null || timestamp === null) return null;
    const note = getOptionalString(raw, "note");
    if (note === null) return null;
    /** @type {Rec} */
    const out = { id: raw.id, group, value, timestamp };
    if (note !== undefined) out.note = note;
    return out;
  },
  idOf: (rec) => rec.id,
  timestampOf: (rec) => rec.timestamp,
};

// ─── Test scaffolding ───────────────────────────────────────────────

let tmpDir;
let storePath;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jsonl-store-test-"));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Fresh path per test so cases don't leak state.
  storePath = path.join(tmpDir, `s-${Date.now()}-${Math.random()}.jsonl`);
});

// ─── append() ───────────────────────────────────────────────────────

describe("createJsonlStore — append() id idempotency", () => {
  it("first append writes; on-disk file contains one line", () => {
    const store = createJsonlStore(storePath, recSchema);
    const r1 = store.append({
      id: "1",
      group: "g1",
      value: "a",
      timestamp: "2025-01-01T00:00:00Z",
    });
    assert.equal(r1.written, true);
    assert.equal(r1.event.id, "1");
    assert.equal(r1.path, storePath);

    const onDisk = fs.readFileSync(storePath, "utf-8");
    assert.equal(onDisk.split("\n").filter(Boolean).length, 1);
  });

  it("re-append with same id is a no-op; returns the existing record", () => {
    const store = createJsonlStore(storePath, recSchema);
    const original = {
      id: "1",
      group: "g1",
      value: "a",
      timestamp: "2025-01-01T00:00:00Z",
    };
    store.append(original);

    // Same id but DIFFERENT payload — store should return the *original*,
    // not silently overwrite.
    const r2 = store.append({
      id: "1",
      group: "DIFFERENT",
      value: "b",
      timestamp: "2099-12-31T23:59:59Z",
    });
    assert.equal(r2.written, false);
    assert.deepStrictEqual(r2.event, original);

    const lines = fs.readFileSync(storePath, "utf-8").split("\n").filter(Boolean);
    assert.equal(lines.length, 1, "no second line written on dedupe");
  });

  it("different ids both persist", () => {
    const store = createJsonlStore(storePath, recSchema);
    store.append({ id: "1", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" });
    store.append({ id: "2", group: "g", value: "a", timestamp: "2025-01-02T00:00:00Z" });
    assert.equal(store.read().length, 2);
  });

  it("creates the parent directory lazily on first append", () => {
    const nested = path.join(tmpDir, `nested-${Date.now()}`, "deep", "store.jsonl");
    assert.equal(fs.existsSync(path.dirname(nested)), false);
    const store = createJsonlStore(nested, recSchema);
    store.append({ id: "1", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" });
    assert.equal(fs.existsSync(nested), true);
  });
});

// ─── appendWithWindow() ─────────────────────────────────────────────

describe("createJsonlStore — appendWithWindow() time-window dedupe", () => {
  const windowMs = 60 * 1000; // 1 minute

  it("inside-window same-key collapse: returns windowDeduped=true and does not write", () => {
    const store = createJsonlStore(storePath, recSchema);
    const a = {
      id: "1",
      group: "shared-key",
      value: "a",
      timestamp: "2025-01-01T00:00:00Z",
    };
    store.appendWithWindow(a, { windowMs, windowKeyOf: (r) => r.group });

    // 30s later, same group, DIFFERENT id — should still be deduped.
    const r2 = store.appendWithWindow(
      {
        id: "2",
        group: "shared-key",
        value: "a",
        timestamp: "2025-01-01T00:00:30Z",
      },
      { windowMs, windowKeyOf: (r) => r.group },
    );
    assert.equal(r2.written, false);
    assert.equal(r2.windowDeduped, true);
    assert.deepStrictEqual(r2.event, a);
    assert.equal(store.read().length, 1);
  });

  it("outside-window same-key writes; both rows persist", () => {
    const store = createJsonlStore(storePath, recSchema);
    store.appendWithWindow(
      { id: "1", group: "k", value: "a", timestamp: "2025-01-01T00:00:00Z" },
      { windowMs, windowKeyOf: (r) => r.group },
    );
    const r2 = store.appendWithWindow(
      { id: "2", group: "k", value: "a", timestamp: "2025-01-01T00:05:00Z" }, // 5min later
      { windowMs, windowKeyOf: (r) => r.group },
    );
    assert.equal(r2.written, true);
    assert.equal(store.read().length, 2);
  });

  it("inside-window different-key writes (the key, not just time, gates dedupe)", () => {
    const store = createJsonlStore(storePath, recSchema);
    store.appendWithWindow(
      { id: "1", group: "k1", value: "a", timestamp: "2025-01-01T00:00:00Z" },
      { windowMs, windowKeyOf: (r) => r.group },
    );
    const r2 = store.appendWithWindow(
      { id: "2", group: "k2", value: "a", timestamp: "2025-01-01T00:00:30Z" },
      { windowMs, windowKeyOf: (r) => r.group },
    );
    assert.equal(r2.written, true);
    assert.equal(store.read().length, 2);
  });

  it("id-equality wins over window: same id returns written=false WITHOUT windowDeduped", () => {
    const store = createJsonlStore(storePath, recSchema);
    const original = {
      id: "1",
      group: "k",
      value: "a",
      timestamp: "2025-01-01T00:00:00Z",
    };
    store.appendWithWindow(original, { windowMs, windowKeyOf: (r) => r.group });
    const r2 = store.appendWithWindow(
      { id: "1", group: "k", value: "b", timestamp: "2099-01-01T00:00:00Z" },
      { windowMs, windowKeyOf: (r) => r.group },
    );
    assert.equal(r2.written, false);
    assert.equal(r2.windowDeduped, undefined);
    assert.deepStrictEqual(r2.event, original);
  });

  it("throws if schema lacks timestampOf", () => {
    const noTsSchema = { ...recSchema };
    delete noTsSchema.timestampOf;
    const store = createJsonlStore(storePath, noTsSchema);
    assert.throws(
      () =>
        store.appendWithWindow(
          { id: "1", group: "k", value: "a", timestamp: "2025-01-01T00:00:00Z" },
          { windowMs, windowKeyOf: (r) => r.group },
        ),
      /timestampOf/,
    );
  });
});

// ─── read() ─────────────────────────────────────────────────────────

describe("createJsonlStore — read() with filters", () => {
  function seed() {
    const store = createJsonlStore(storePath, recSchema);
    store.append({ id: "1", group: "g1", value: "a", timestamp: "2025-01-01T00:00:00Z" });
    store.append({ id: "2", group: "g1", value: "b", timestamp: "2025-01-02T00:00:00Z" });
    store.append({ id: "3", group: "g2", value: "a", timestamp: "2025-01-03T00:00:00Z" });
    return store;
  }

  it("no options returns all valid records in order", () => {
    const store = seed();
    const all = store.read();
    assert.deepStrictEqual(
      all.map((r) => r.id),
      ["1", "2", "3"],
    );
  });

  it("filter narrows to matching records", () => {
    const store = seed();
    const out = store.read({ filter: (r) => r.group === "g1" });
    assert.deepStrictEqual(
      out.map((r) => r.id),
      ["1", "2"],
    );
  });

  it("since filters by timestamp inclusive of bound", () => {
    const store = seed();
    const out = store.read({ since: "2025-01-02T00:00:00Z" });
    assert.deepStrictEqual(
      out.map((r) => r.id),
      ["2", "3"],
    );
  });

  it("limit short-circuits the read", () => {
    const store = seed();
    const out = store.read({ limit: 2 });
    assert.equal(out.length, 2);
    assert.deepStrictEqual(
      out.map((r) => r.id),
      ["1", "2"],
    );
  });

  it("missing file returns []", () => {
    const store = createJsonlStore(storePath, recSchema);
    assert.deepStrictEqual(store.read(), []);
  });

  it("read({since}) throws if schema lacks timestampOf", () => {
    const noTsSchema = { ...recSchema };
    delete noTsSchema.timestampOf;
    const store = createJsonlStore(storePath, noTsSchema);
    fs.writeFileSync(
      storePath,
      `${JSON.stringify({ id: "1", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" })}\n`,
    );
    assert.throws(() => store.read({ since: "2024-01-01T00:00:00Z" }), /timestampOf/);
  });
});

// ─── Runtime validation ─────────────────────────────────────────────

describe("createJsonlStore — runtime validation rejects malformed records", () => {
it("missing required field is dropped silently", () => {
    fs.writeFileSync(
      storePath,
      `${[
        JSON.stringify({ id: "1", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }),
        JSON.stringify({ id: "2", group: "g", timestamp: "2025-01-01T00:00:00Z" }), // no value
        JSON.stringify({ id: "3", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }),
      ].join("\n")}\n`,
    );
    const store = createJsonlStore(storePath, recSchema);
    const out = store.read();
    assert.deepStrictEqual(
      out.map((r) => r.id),
      ["1", "3"],
    );
  });

  it("wrong type for required field is dropped (e.g. value=42 instead of string)", () => {
    fs.writeFileSync(
      storePath,
      `${[
        JSON.stringify({ id: "1", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }),
        JSON.stringify({ id: "2", group: "g", value: 42, timestamp: "2025-01-01T00:00:00Z" }),
        JSON.stringify({ id: "3", group: "g", value: "b", timestamp: "2025-01-01T00:00:00Z" }),
      ].join("\n")}\n`,
    );
    const out = createJsonlStore(storePath, recSchema).read();
    assert.deepStrictEqual(
      out.map((r) => r.id),
      ["1", "3"],
    );
  });

  it("string value not in enum is dropped", () => {
    fs.writeFileSync(
      storePath,
      `${JSON.stringify({ id: "1", group: "g", value: "z", timestamp: "2025-01-01T00:00:00Z" })}\n`,
    );
    assert.deepStrictEqual(createJsonlStore(storePath, recSchema).read(), []);
  });

  it("missing or non-string id is dropped", () => {
    fs.writeFileSync(
      storePath,
      `${[
        JSON.stringify({ group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }), // no id
        JSON.stringify({ id: 42, group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }), // numeric id
        JSON.stringify({ id: "", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }), // empty id
      ].join("\n")}\n`,
    );
    assert.deepStrictEqual(createJsonlStore(storePath, recSchema).read(), []);
  });

  it("array, null, primitive lines are dropped", () => {
    fs.writeFileSync(
      storePath,
      `${[
        JSON.stringify([1, 2, 3]),
        "null",
        "42",
        '"a string"',
        JSON.stringify({ id: "1", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }),
      ].join("\n")}\n`,
    );
    const out = createJsonlStore(storePath, recSchema).read();
    assert.equal(out.length, 1);
  });
});

// ─── Corrupt-line tolerance ─────────────────────────────────────────

describe("createJsonlStore — corrupt-line tolerance", () => {
  it("malformed JSON lines are skipped, valid ones returned", () => {
    fs.writeFileSync(
      storePath,
      `${[
        JSON.stringify({ id: "1", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }),
        "{ not valid json",
        JSON.stringify({ id: "2", group: "g", value: "a", timestamp: "2025-01-02T00:00:00Z" }),
        "",
        "    ",
        JSON.stringify({ id: "3", group: "g", value: "a", timestamp: "2025-01-03T00:00:00Z" }),
      ].join("\n")}\n`,
    );
    const out = createJsonlStore(storePath, recSchema).read();
    assert.deepStrictEqual(
      out.map((r) => r.id),
      ["1", "2", "3"],
    );
  });

  it("a corrupt line does not block append idempotency check", () => {
    fs.writeFileSync(
      storePath,
      `${[
        "garbage line",
        JSON.stringify({
          id: "existing",
          group: "g",
          value: "a",
          timestamp: "2025-01-01T00:00:00Z",
        }),
      ].join("\n")}\n`,
    );
    const store = createJsonlStore(storePath, recSchema);
    const r = store.append({
      id: "existing",
      group: "different",
      value: "b",
      timestamp: "2099-01-01T00:00:00Z",
    });
    assert.equal(r.written, false);
    assert.equal(r.event.group, "g");
  });
});

// ─── exists() ───────────────────────────────────────────────────────

describe("createJsonlStore — exists()", () => {
  it("returns false when the file does not exist", () => {
    const store = createJsonlStore(storePath, recSchema);
    assert.equal(store.exists("anything"), false);
  });

  it("returns true after a record with that id is appended", () => {
    const store = createJsonlStore(storePath, recSchema);
    store.append({ id: "1", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" });
    assert.equal(store.exists("1"), true);
    assert.equal(store.exists("nope"), false);
  });

  it("ignores malformed lines when checking existence", () => {
    fs.writeFileSync(
      storePath,
      `${[
        "garbage",
        JSON.stringify({ id: "real", group: "g", value: "a", timestamp: "2025-01-01T00:00:00Z" }),
      ].join("\n")}\n`,
    );
    const store = createJsonlStore(storePath, recSchema);
    assert.equal(store.exists("real"), true);
    assert.equal(store.exists("garbage"), false);
  });
});

// ─── Validator helpers ──────────────────────────────────────────────

describe("createJsonlStore — exported validator helpers", () => {
  it("isObjectWithId rejects non-objects, arrays, and missing/empty/non-string ids", () => {
    assert.equal(isObjectWithId(null), false);
    assert.equal(isObjectWithId(undefined), false);
    assert.equal(isObjectWithId("string"), false);
    assert.equal(isObjectWithId(42), false);
    assert.equal(isObjectWithId([1, 2]), false);
    assert.equal(isObjectWithId({}), false);
    assert.equal(isObjectWithId({ id: 1 }), false);
    assert.equal(isObjectWithId({ id: "" }), false);
    assert.equal(isObjectWithId({ id: "ok" }), true);
  });

  it("getString returns the string or null", () => {
    assert.equal(getString({ a: "x" }, "a"), "x");
    assert.equal(getString({ a: 1 }, "a"), null);
    assert.equal(getString({}, "a"), null);
  });

  it("getOptionalString distinguishes absent (undefined) from wrong-type (null)", () => {
    assert.equal(getOptionalString({}, "a"), undefined);
    assert.equal(getOptionalString({ a: undefined }, "a"), undefined);
    assert.equal(getOptionalString({ a: "x" }, "a"), "x");
    assert.equal(getOptionalString({ a: 1 }, "a"), null);
  });

  it("isStringEnum returns the narrowed value or null", () => {
    assert.equal(isStringEnum({ k: "a" }, "k", ["a", "b"]), "a");
    assert.equal(isStringEnum({ k: "z" }, "k", ["a", "b"]), null);
    assert.equal(isStringEnum({ k: 42 }, "k", ["a", "b"]), null);
  });
});
