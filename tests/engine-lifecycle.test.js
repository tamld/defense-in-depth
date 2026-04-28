/**
 * Lifecycle tests for DefendEngine — pins the v1.0 (#49) Guard
 * lifecycle contract:
 *
 *   - `init(ctx)` runs before `check(ctx)` for every enabled guard.
 *   - `dispose()` runs after the pipeline, in a `finally` block, for
 *     every guard the engine attempted to init — even on init crash,
 *     even on check crash.
 *   - `priority` (default 0) orders execution descending; ties preserve
 *     registration order (stable sort).
 *   - `init` crashes are recorded as a typed `GuardCrashError` BLOCK
 *     finding with prefix `"Guard init crashed: …"`. The crashed
 *     guard's `check()` is **not** invoked. `dispose()` still runs.
 *   - `dispose()` errors are swallowed: they warn to stderr but never
 *     change the verdict.
 *   - Disabled-in-config guards do NOT have `init` / `check` /
 *     `dispose` invoked.
 *
 * Mock audit: console.warn is silenced and captured per scenario so
 * the dispose-warning assertion has something concrete to bind to.
 *
 * Executor: Devin
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { DefendEngine } from "../dist/core/engine.js";
import { Severity } from "../dist/core/types.js";

function makeConfig(overrides = {}) {
  return { version: "1.0", guards: { ...overrides } };
}

let savedWarn;
let warnCalls;

beforeEach(() => {
  savedWarn = console.warn;
  warnCalls = [];
  console.warn = (...args) => {
    warnCalls.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
  };
});

afterEach(() => {
  console.warn = savedWarn;
});

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "did-lifecycle-"));
}

/**
 * Build a guard whose lifecycle calls are recorded in a shared `log`
 * array. Each entry is a string like `"<guardId>:<phase>"` so test
 * assertions can pin both ordering and presence.
 */
function recordingGuard(id, log, opts = {}) {
  const guard = {
    id,
    name: id,
    description: `recording ${id}`,
    async check(_ctx) {
      log.push(`${id}:check`);
      if (opts.checkThrows) {
        throw opts.checkThrows;
      }
      return { guardId: id, passed: true, findings: [], durationMs: 1 };
    },
  };
  if (opts.priority !== undefined) {
    guard.priority = opts.priority;
  }
  if (opts.withInit) {
    guard.init = async (_ctx) => {
      log.push(`${id}:init`);
      if (opts.initThrows) {
        throw opts.initThrows;
      }
    };
  }
  if (opts.withDispose) {
    guard.dispose = async () => {
      log.push(`${id}:dispose`);
      if (opts.disposeThrows) {
        throw opts.disposeThrows;
      }
    };
  }
  return guard;
}

describe("DefendEngine lifecycle — init() runs before check()", () => {
  it("calls init then check for each guard, in that order", async () => {
    const log = [];
    const a = recordingGuard("a", log, { withInit: true });
    const b = recordingGuard("b", log, { withInit: true });
    const engine = new DefendEngine(mkRoot(), makeConfig()).useAll([a, b]);

    const verdict = await engine.run({ files: [] });

    assert.deepStrictEqual(log, ["a:init", "a:check", "b:init", "b:check"]);
    assert.strictEqual(verdict.passed, true);
  });

  it("calls init exactly once per guard per run", async () => {
    const log = [];
    const a = recordingGuard("a", log, { withInit: true });
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(a);

    await engine.run({ files: [] });

    const initCount = log.filter((e) => e === "a:init").length;
    assert.strictEqual(initCount, 1);
  });

  it("guards without init still run check (backward compat)", async () => {
    const log = [];
    const noLifecycle = recordingGuard("legacy", log); // no withInit, no withDispose
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(noLifecycle);

    const verdict = await engine.run({ files: [] });

    assert.deepStrictEqual(log, ["legacy:check"]);
    assert.strictEqual(verdict.passed, true);
  });
});

describe("DefendEngine lifecycle — dispose() runs after check()", () => {
  it("calls dispose for each guard after the pipeline finishes", async () => {
    const log = [];
    const a = recordingGuard("a", log, { withInit: true, withDispose: true });
    const b = recordingGuard("b", log, { withInit: true, withDispose: true });
    const engine = new DefendEngine(mkRoot(), makeConfig()).useAll([a, b]);

    await engine.run({ files: [] });

    assert.deepStrictEqual(log, [
      "a:init",
      "a:check",
      "b:init",
      "b:check",
      "a:dispose",
      "b:dispose",
    ]);
  });

  it("calls dispose for guards without an init, too", async () => {
    const log = [];
    const a = recordingGuard("a", log, { withDispose: true });
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(a);

    await engine.run({ files: [] });

    assert.deepStrictEqual(log, ["a:check", "a:dispose"]);
  });

  it("calls dispose even when check() throws", async () => {
    const log = [];
    const a = recordingGuard("a", log, {
      withInit: true,
      withDispose: true,
      checkThrows: new Error("boom in check"),
    });
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(a);

    const verdict = await engine.run({ files: [] });

    // dispose runs even though check threw
    assert.deepStrictEqual(log, ["a:init", "a:check", "a:dispose"]);
    assert.strictEqual(verdict.passed, false);
    const findings = verdict.results.flatMap((r) => r.findings);
    assert.ok(
      findings.some((f) => f.severity === Severity.BLOCK && /Guard crashed/.test(f.message)),
      "expected a Guard crashed BLOCK finding",
    );
  });

  it("calls dispose even when init() throws", async () => {
    const log = [];
    const a = recordingGuard("a", log, {
      withInit: true,
      withDispose: true,
      initThrows: new Error("boom in init"),
    });
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(a);

    const verdict = await engine.run({ files: [] });

    // init crashed → check skipped → dispose still ran
    assert.deepStrictEqual(log, ["a:init", "a:dispose"]);
    assert.strictEqual(verdict.passed, false);
    const findings = verdict.results.flatMap((r) => r.findings);
    assert.ok(
      findings.some(
        (f) =>
          f.severity === Severity.BLOCK &&
          /Guard init crashed:.*boom in init/.test(f.message),
      ),
      `expected a "Guard init crashed: …" BLOCK finding, got: ${JSON.stringify(findings)}`,
    );
  });

  it("swallows errors thrown from dispose() — verdict is unaffected, warn is logged", async () => {
    const log = [];
    const a = recordingGuard("a", log, {
      withInit: true,
      withDispose: true,
      disposeThrows: new Error("dispose blew up"),
    });
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(a);

    const verdict = await engine.run({ files: [] });

    assert.deepStrictEqual(log, ["a:init", "a:check", "a:dispose"]);
    assert.strictEqual(verdict.passed, true, "dispose error must NOT fail the verdict");
    assert.strictEqual(verdict.failedGuards, 0);
    assert.ok(
      warnCalls.some((line) => /Guard 'a' dispose failed.*dispose blew up/.test(line)),
      `expected a console.warn about dispose failure, got: ${JSON.stringify(warnCalls)}`,
    );
  });
});

describe("DefendEngine lifecycle — priority ordering", () => {
  it("runs higher-priority guards first (descending sort)", async () => {
    const log = [];
    const low = recordingGuard("low", log, { priority: 1 });
    const high = recordingGuard("high", log, { priority: 100 });
    const mid = recordingGuard("mid", log, { priority: 50 });
    // Register in low-mid-high order; engine must reorder to high-mid-low.
    const engine = new DefendEngine(mkRoot(), makeConfig()).useAll([low, mid, high]);

    await engine.run({ files: [] });

    assert.deepStrictEqual(log, ["high:check", "mid:check", "low:check"]);
  });

  it("treats missing priority as 0 (default)", async () => {
    const log = [];
    const negative = recordingGuard("neg", log, { priority: -10 });
    const noPriority = recordingGuard("default", log); // priority undefined → 0
    const positive = recordingGuard("pos", log, { priority: 10 });
    const engine = new DefendEngine(mkRoot(), makeConfig()).useAll([
      negative,
      noPriority,
      positive,
    ]);

    await engine.run({ files: [] });

    // pos (10) → default (0) → neg (-10)
    assert.deepStrictEqual(log, ["pos:check", "default:check", "neg:check"]);
  });

  it("preserves registration order on ties (stable sort)", async () => {
    const log = [];
    const first = recordingGuard("first", log, { priority: 5 });
    const second = recordingGuard("second", log, { priority: 5 });
    const third = recordingGuard("third", log, { priority: 5 });
    const engine = new DefendEngine(mkRoot(), makeConfig()).useAll([
      first,
      second,
      third,
    ]);

    await engine.run({ files: [] });

    assert.deepStrictEqual(log, ["first:check", "second:check", "third:check"]);
  });

  it("sorts even when init/dispose are present (init runs in priority order too)", async () => {
    const log = [];
    const low = recordingGuard("low", log, { withInit: true, priority: 1 });
    const high = recordingGuard("high", log, { withInit: true, priority: 100 });
    const engine = new DefendEngine(mkRoot(), makeConfig()).useAll([low, high]);

    await engine.run({ files: [] });

    assert.deepStrictEqual(log, [
      "high:init",
      "high:check",
      "low:init",
      "low:check",
    ]);
  });
});

describe("DefendEngine lifecycle — init crash semantics", () => {
  it("init crash skips check() but still records a BLOCK finding", async () => {
    const log = [];
    const a = recordingGuard("a", log, {
      withInit: true,
      initThrows: new Error("init failure"),
    });
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(a);

    const verdict = await engine.run({ files: [] });

    // check() was NOT called
    assert.deepStrictEqual(log, ["a:init"]);
    assert.strictEqual(verdict.passed, false);
    assert.strictEqual(verdict.results.length, 1);
    const r = verdict.results[0];
    assert.strictEqual(r.guardId, "a");
    assert.strictEqual(r.passed, false);
    assert.strictEqual(r.findings.length, 1);
    assert.strictEqual(r.findings[0].severity, Severity.BLOCK);
    assert.match(r.findings[0].message, /^Guard init crashed:/);
    assert.match(r.findings[0].message, /init failure/);
  });

  it("init crash on one guard does not block subsequent guards", async () => {
    const log = [];
    const broken = recordingGuard("broken", log, {
      withInit: true,
      initThrows: new Error("kaboom"),
      priority: 100,
    });
    const healthy = recordingGuard("healthy", log, { priority: 50 });
    const engine = new DefendEngine(mkRoot(), makeConfig()).useAll([broken, healthy]);

    const verdict = await engine.run({ files: [] });

    // broken:init crashed → broken:check skipped → healthy:check still runs
    assert.deepStrictEqual(log, ["broken:init", "healthy:check"]);
    assert.strictEqual(verdict.results.length, 2);
    assert.strictEqual(verdict.passed, false); // because broken failed
    assert.strictEqual(verdict.failedGuards, 1);
    assert.strictEqual(verdict.passedGuards, 1);
  });

  it("non-Error init crash gets stringified into the finding message", async () => {
    const log = [];
    const a = recordingGuard("a", log, {
      withInit: true,
      // eslint-disable-next-line no-throw-literal — intentional
      initThrows: "raw string thrown from init",
    });
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(a);

    const verdict = await engine.run({ files: [] });

    assert.match(
      verdict.results[0].findings[0].message,
      /Guard init crashed:.*raw string thrown from init/,
    );
  });
});

describe("DefendEngine lifecycle — provider dispose is also crash-safe", () => {
  it("swallows errors thrown from provider.dispose() — verdict is unaffected, warn is logged", async () => {
    const log = [];
    const a = recordingGuard("a", log, { withInit: true, withDispose: true });
    const engine = new DefendEngine(mkRoot(), makeConfig()).use(a);

    // Inject a stub provider whose dispose() throws. This mirrors the
    // path a custom TicketStateProvider implementation could take per
    // src/federation/types.ts. The engine MUST swallow this — same
    // contract as guard dispose — otherwise the verdict is unreachable
    // because the throw escapes the finally block.
    engine.enrichTicketRef = async () => ({
      ticket: undefined,
      provider: {
        async getTicketState() {
          return undefined;
        },
        async dispose() {
          throw new Error("provider dispose blew up");
        },
      },
    });

    const verdict = await engine.run({ files: [] });

    // Guard dispose still ran first (unchanged); provider dispose ran
    // after, threw, was logged, and did not abort the verdict.
    assert.deepStrictEqual(log, ["a:init", "a:check", "a:dispose"]);
    assert.strictEqual(verdict.passed, true);
    assert.strictEqual(verdict.failedGuards, 0);
    assert.ok(
      warnCalls.some((line) =>
        /Ticket provider dispose failed.*provider dispose blew up/.test(line),
      ),
      `expected a console.warn about provider dispose failure, got: ${JSON.stringify(warnCalls)}`,
    );
  });
});

describe("DefendEngine lifecycle — disabled guards", () => {
  it("does NOT call init / check / dispose for guards disabled in config", async () => {
    const log = [];
    // hollowArtifact is the only id the config-loader recognises that
    // we can safely toggle off via overrides without affecting other
    // behaviours of the engine. We create a recording stub with that id.
    const fake = recordingGuard("hollowArtifact", log, {
      withInit: true,
      withDispose: true,
    });
    const engine = new DefendEngine(
      mkRoot(),
      makeConfig({ hollowArtifact: { enabled: false, blockPatterns: [] } }),
    ).use(fake);

    const verdict = await engine.run({ files: [] });

    // Nothing fired — guard was skipped by the enabled=false branch
    // before init/check/dispose could be invoked.
    assert.deepStrictEqual(log, []);
    assert.strictEqual(verdict.results.length, 0);
    assert.strictEqual(verdict.passed, true);
  });
});
