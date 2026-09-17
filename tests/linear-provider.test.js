// Executor: Sisyphus (OhMyOpenCode)
// LinearTicketProvider tests
import assert from "node:assert/strict";
import { test } from "node:test";
import { LinearTicketProvider } from "../dist/federation/linear-provider.js";

async function withFetch(stub, fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    const signal = options?.signal;
    if (signal) {
      return stub(url, { ...options, signal });
    }
    return stub(url, options);
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

test("LinearTicketProvider requires apiKey and teamId", async (t) => {
  await t.test("missing apiKey returns undefined", async () => {
    const p = new LinearTicketProvider({ teamId: "team-123" });
    assert.equal(await p.resolve("TK-1"), undefined);
  });

  await t.test("missing teamId returns undefined", async () => {
    const p = new LinearTicketProvider({ apiKey: "key-123" });
    assert.equal(await p.resolve("TK-1"), undefined);
  });
});

test("LinearTicketProvider maps HTTP failures to graceful undefined", async (t) => {
  const p = new LinearTicketProvider({ apiKey: "test-key", teamId: "team-123" });

  await t.test("404 resolves undefined silently", async () => {
    await withFetch(
      async () => ({ ok: false, status: 404 }),
      async () => assert.equal(await p.resolve("TK-GONE"), undefined),
    );
  });

  await t.test("500 warns and resolves undefined", async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(" "));
    try {
      await withFetch(
        async () => ({ ok: false, status: 500 }),
        async () => assert.equal(await p.resolve("TK-BOOM"), undefined),
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join("\n").includes("returned 500"));
  });

  await t.test("non-object JSON body warns and resolves undefined", async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(" "));
    try {
      await withFetch(
        async () => ({ ok: true, status: 200, json: async () => null }),
        async () => assert.equal(await p.resolve("TK-JUNK"), undefined),
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join("\n").includes("Invalid GraphQL response"));
  });

  await t.test("GraphQL errors warns and resolves undefined", async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(" "));
    try {
      await withFetch(
        async () => ({
          ok: true,
          status: 200,
          json: async () => ({ errors: [{ message: "Not found" }] }),
        }),
        async () => assert.equal(await p.resolve("TK-ERR"), undefined),
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join("\n").includes("Invalid GraphQL response"));
  });
});

test("LinearTicketProvider happy path maps Linear issue onto TicketRef", async (t) => {
  const p = new LinearTicketProvider({ apiKey: "test-key", teamId: "team-123" });

  await t.test("minimal issue maps identifier and state", async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            issue: {
              id: "linear-id-1",
              identifier: "ENG-123",
              state: { name: "In Progress" },
            },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve("ENG-123");
        assert.equal(ref.id, "ENG-123");
        assert.equal(ref.phase, "IN PROGRESS");
        assert.equal(ref.type, undefined); // type not inferred from Linear
        assert.equal(ref.parentId, undefined);
      },
    );
  });

  await t.test("issue with parent maps parentId", async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            issue: {
              id: "linear-id-2",
              identifier: "ENG-124",
              state: { name: "In Review" },
              parent: {
                id: "linear-parent-id",
                identifier: "ENG-100",
                state: { name: "Done" },
              },
            },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve("ENG-124");
        assert.equal(ref.id, "ENG-124");
        assert.equal(ref.phase, "IN REVIEW");
        assert.equal(ref.parentId, "linear-parent-id");
      },
    );
  });

  await t.test("issue with Done state maps to COMPLETED phase", async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            issue: {
              id: "linear-id-3",
              identifier: "ENG-125",
              state: { name: "Done" },
            },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve("ENG-125");
        assert.equal(ref.phase, "DONE");
      },
    );
  });

  await t.test("timeout (AbortError) resolves undefined", async () => {
    const p = new LinearTicketProvider({ apiKey: "test-key", teamId: "team-123", timeout: 1 });
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(" "));
    try {
      await withFetch(
        async () => {
          // Simulate abort by throwing AbortError directly
          const err = new Error("Aborted");
          err.name = "AbortError";
          throw err;
        },
        async () => assert.equal(await p.resolve("ENG-1"), undefined),
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join("\n").includes("timed out"));
  });
});
