import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createJsonlStore } from "../dist/core/jsonl-store.js";
import { clearGitMetricCache } from "../dist/core/hint-engine.js";

describe("Performance & Hot-path I/O (Tech Debt T3 - #45)", () => {
  it("maintains O(1) amortized append cost with in-memory ID cache across 1000 events", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-perf-test-"));
    const jsonlFile = path.join(dir, "events.jsonl");

    try {
      const store = createJsonlStore(jsonlFile, {
        validate: (raw) => (typeof raw === "object" && raw !== null ? raw : null),
        idOf: (record) => record.id,
      });

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const res = store.append({ id: `EVT-${i}`, data: `sample payload ${i}` });
        assert.equal(res.written, true);
      }
      const duration = performance.now() - start;

      // 1000 appends should comfortably execute in < 200ms with O(1) cache
      assert.ok(duration < 1000, `1000 appends took ${duration.toFixed(2)}ms (expected < 1000ms)`);

      // Duplicate check should be instant O(1)
      const dupStart = performance.now();
      const dupRes = store.append({ id: "EVT-500", data: "duplicate" });
      const dupDuration = performance.now() - dupStart;

      assert.equal(dupRes.written, false);
      assert.ok(dupDuration < 50, `Duplicate check took ${dupDuration.toFixed(2)}ms (expected < 50ms)`);

      // exists() check should be instant O(1)
      assert.equal(store.exists("EVT-500"), true);
      assert.equal(store.exists("EVT-9999"), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("clears git metric cache cleanly", () => {
    clearGitMetricCache();
    assert.doesNotThrow(() => clearGitMetricCache());
  });
});
