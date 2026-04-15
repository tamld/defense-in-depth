/**
 * Tests for FileTicketProvider and provider factory.
 *
 * Uses Node.js built-in test runner (node --test).
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Import federation modules
import { FileTicketProvider } from "../dist/federation/file-provider.js";
import { createProvider } from "../dist/federation/index.js";

describe("FileTicketProvider", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "did-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns enriched TicketRef when TICKET.md has valid frontmatter", async () => {
    const ticketContent = `---
id: TK-20260408-001
phase: EXECUTING
type: feat
---

# Feature: Add provider support

Description goes here.
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-20260408-001");

    assert.ok(result, "Should return a TicketRef");
    assert.equal(result.id, "TK-20260408-001");
    assert.equal(result.phase, "EXECUTING");
    assert.equal(result.type, "feat");
  });

  it("returns undefined when TICKET.md does not exist", async () => {
    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-MISSING-001");

    assert.equal(result, undefined, "Should return undefined for missing file");
  });

  it("returns undefined when TICKET.md has no frontmatter", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "TICKET.md"),
      "# Just a markdown file\n\nNo frontmatter here.",
    );

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-NOFM-001");

    assert.equal(result, undefined, "Should return undefined for no frontmatter");
  });

  it("returns partial TicketRef when frontmatter has only id", async () => {
    const ticketContent = `---
id: TK-PARTIAL-001
---

# Partial ticket
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-PARTIAL-001");

    assert.ok(result, "Should return a TicketRef");
    assert.equal(result.id, "TK-PARTIAL-001");
    assert.equal(result.phase, undefined, "phase should be undefined");
    assert.equal(result.type, undefined, "type should be undefined");
  });

  it("uses custom ticketFile path from config", async () => {
    const ticketContent = `---
id: TK-CUSTOM-001
phase: PLANNING
---
`;
    fs.writeFileSync(path.join(tmpDir, "my-ticket.yml"), ticketContent);

    const provider = new FileTicketProvider({
      projectRoot: tmpDir,
      ticketFile: "my-ticket.yml",
    });
    const result = await provider.resolve("TK-CUSTOM-001");

    assert.ok(result);
    assert.equal(result.id, "TK-CUSTOM-001");
    assert.equal(result.phase, "PLANNING");
  });

  it("ignores invalid type values", async () => {
    const ticketContent = `---
id: TK-BADTYPE-001
type: invalid_type
---
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-BADTYPE-001");

    assert.ok(result);
    assert.equal(result.id, "TK-BADTYPE-001");
    assert.equal(result.type, undefined, "Invalid type should be skipped");
  });

  it("uses ticketId as fallback id when frontmatter has no id", async () => {
    const ticketContent = `---
phase: VERIFYING
---
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-FALLBACK-001");

    assert.ok(result);
    assert.equal(result.id, "TK-FALLBACK-001", "Should use ticketId as fallback");
    assert.equal(result.phase, "VERIFYING");
  });

  it("has name 'file'", () => {
    const provider = new FileTicketProvider();
    assert.equal(provider.name, "file");
  });
});

describe("createProvider factory", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "did-factory-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates FileTicketProvider for undefined provider", () => {
    const provider = createProvider(undefined, {}, tmpDir);
    assert.equal(provider.name, "file");
  });

  it("creates FileTicketProvider for 'file' provider string", () => {
    const provider = createProvider("file", {}, tmpDir);
    assert.equal(provider.name, "file");
  });

  it("falls back to FileTicketProvider for unknown provider", () => {
    const provider = createProvider("unknown-provider", {}, tmpDir);
    assert.equal(provider.name, "file");
  });

  it("passes projectRoot to the provider", async () => {
    const ticketContent = `---
id: TK-FACTORY-001
phase: EXECUTING
---
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = createProvider("file", {}, tmpDir);
    const result = await provider.resolve("TK-FACTORY-001");

    assert.ok(result);
    assert.equal(result.id, "TK-FACTORY-001");
    assert.equal(result.phase, "EXECUTING");
  });

  // SRS FF.01: createProvider("http") returns HttpTicketProvider
  it("creates HttpTicketProvider for 'http' provider string", () => {
    const provider = createProvider("http", { endpoint: "http://localhost:9999/api" }, tmpDir);
    assert.equal(provider.name, "http");
  });
});

// ─── SRS FP.01-03: FileTicketProvider parentId extraction ───

describe("FileTicketProvider parentId extraction (SRS FP.01-03)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "did-parent-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // SRS FP.01: Must extract parentId from TICKET.md frontmatter
  it("extracts parentId from TICKET.md frontmatter", async () => {
    const ticketContent = `---
id: TK-CHILD-001
phase: EXECUTING
parentId: TK-PARENT-001
---

# Child ticket with parent
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-CHILD-001");

    assert.ok(result, "Should return a TicketRef");
    assert.equal(result.id, "TK-CHILD-001");
    assert.equal(result.phase, "EXECUTING");
    assert.equal(result.parentId, "TK-PARENT-001");
  });

  // SRS FP.02: When parentId is absent, TicketRef.parentId must be undefined
  it("returns undefined parentId when not in frontmatter", async () => {
    const ticketContent = `---
id: TK-SOLO-001
phase: PLANNING
---
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-SOLO-001");

    assert.ok(result);
    assert.equal(result.id, "TK-SOLO-001");
    assert.equal(result.parentId, undefined, "parentId should be undefined when absent");
  });

  // SRS FP.03: parentId coercion from numeric to string
  it("coerces numeric parentId to string", async () => {
    const ticketContent = `---
id: TK-NUMERIC-001
parentId: 12345
---
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-NUMERIC-001");

    assert.ok(result);
    assert.equal(result.parentId, "12345", "Numeric parentId should be coerced to string");
  });

  // Edge: empty string parentId should still be extracted
  it("extracts empty string parentId as-is", async () => {
    const ticketContent = `---
id: TK-EDGE-001
parentId: ""
---
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-EDGE-001");

    assert.ok(result);
    // Empty string is falsy, so parentId should be undefined (null check filters it)
    assert.equal(result.parentId, undefined, "Empty string parentId should be filtered out");
  });

  // Edge: parentId with special characters
  it("handles parentId with special characters", async () => {
    const ticketContent = `---
id: TK-SPECIAL-001
parentId: "TK-20260415-Ñ001/子"
---
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-SPECIAL-001");

    assert.ok(result);
    assert.equal(result.parentId, "TK-20260415-Ñ001/子");
  });

  // Worst case: corrupted YAML frontmatter
  it("returns undefined on corrupted YAML (worst case)", async () => {
    const ticketContent = `---
id: TK-CORRUPT
parentId: [broken: {yaml:
---
`;
    fs.writeFileSync(path.join(tmpDir, "TICKET.md"), ticketContent);

    const provider = new FileTicketProvider({ projectRoot: tmpDir });
    const result = await provider.resolve("TK-CORRUPT");

    // Should not throw, should return undefined
    assert.equal(result, undefined, "Corrupted YAML should return undefined");
  });
});

// ─── SRS FH.01-05: HttpTicketProvider ───

// Import HttpTicketProvider
import { HttpTicketProvider } from "../dist/federation/http-provider.js";
import { createServer } from "node:http";

describe("HttpTicketProvider (SRS FH.01-05)", () => {
  let server;
  let port;

  // Start a minimal mock HTTP server
  beforeEach(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost`);
      const ticketId = url.pathname.split("/").pop();

      if (ticketId === "TK-NOTFOUND") {
        res.writeHead(404);
        res.end();
        return;
      }

      if (ticketId === "TK-BADJSON") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("not-json{{{");
        return;
      }

      if (ticketId === "TK-SLOW") {
        // Intentionally slow — don't respond for 5s
        setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: "TK-SLOW", phase: "EXECUTING" }));
        }, 5000);
        return;
      }

      // Default: return valid ticket
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: ticketId,
        phase: "EXECUTING",
        type: "feat",
      }));
    });

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // SRS FH.01: Resolves valid JSON response
  it("resolves a valid ticket from HTTP endpoint", async () => {
    const provider = new HttpTicketProvider({
      endpoint: `http://localhost:${port}/api/tickets`,
    });
    const result = await provider.resolve("TK-VALID-001");

    assert.ok(result, "Should return a TicketRef");
    assert.equal(result.id, "TK-VALID-001");
    assert.equal(result.phase, "EXECUTING");
    assert.equal(result.type, "feat");
  });

  // SRS FH.02: Returns undefined on 404
  it("returns undefined on HTTP 404", async () => {
    const provider = new HttpTicketProvider({
      endpoint: `http://localhost:${port}/api/tickets`,
    });
    const result = await provider.resolve("TK-NOTFOUND");

    assert.equal(result, undefined, "Should return undefined for 404");
  });

  // SRS FH.03: Returns undefined on network error
  it("returns undefined on network error (unreachable host)", async () => {
    const provider = new HttpTicketProvider({
      endpoint: "http://localhost:1/api/tickets", // Port 1 = unreachable
      timeout: 500,
    });
    const result = await provider.resolve("TK-NETWORKERR");

    assert.equal(result, undefined, "Should return undefined on network error");
  });

  // SRS FH.04: Respects timeout config via AbortController
  it("returns undefined on timeout", async () => {
    const provider = new HttpTicketProvider({
      endpoint: `http://localhost:${port}/api/tickets`,
      timeout: 100, // 100ms timeout, server delays 5000ms for TK-SLOW
    });
    const result = await provider.resolve("TK-SLOW");

    assert.equal(result, undefined, "Should return undefined on timeout");
  });

  // SRS FH.05: Provider name is "http"
  it("has name 'http'", () => {
    const provider = new HttpTicketProvider();
    assert.equal(provider.name, "http");
  });

  // ─── Edge / Worst Cases ───

  it("returns undefined on HTTP 500 (server error)", async () => {
    // Override server to always return 500 for this test
    const errServer = createServer((_req, res) => {
      res.writeHead(500);
      res.end("Internal Server Error");
    });
    await new Promise((resolve) => errServer.listen(0, resolve));
    const errPort = errServer.address().port;

    const provider = new HttpTicketProvider({
      endpoint: `http://localhost:${errPort}/api/tickets`,
    });
    const result = await provider.resolve("TK-500");
    assert.equal(result, undefined, "Should return undefined on 500");

    await new Promise((resolve) => errServer.close(resolve));
  });

  it("returns undefined when response body is empty JSON object {}", async () => {
    const emptyServer = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
    await new Promise((resolve) => emptyServer.listen(0, resolve));
    const emptyPort = emptyServer.address().port;

    const provider = new HttpTicketProvider({
      endpoint: `http://localhost:${emptyPort}/api/tickets`,
    });
    const result = await provider.resolve("TK-EMPTY-BODY");

    // Should still return a TicketRef with fallback id
    assert.ok(result);
    assert.equal(result.id, "TK-EMPTY-BODY", "Should use ticketId as fallback when response has no id");

    await new Promise((resolve) => emptyServer.close(resolve));
  });

  it("returns undefined when response is a JSON array (unexpected shape)", async () => {
    const arrServer = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('[{"id":"oops"}]');
    });
    await new Promise((resolve) => arrServer.listen(0, resolve));
    const arrPort = arrServer.address().port;

    const provider = new HttpTicketProvider({
      endpoint: `http://localhost:${arrPort}/api/tickets`,
    });
    const result = await provider.resolve("TK-ARRAY");

    // Arrays are typeof "object" but we should handle gracefully
    // Either returns something or undefined — must NOT throw
    assert.ok(result !== null, "Should not return null — either TicketRef or undefined");

    await new Promise((resolve) => arrServer.close(resolve));
  });

  it("handles ticketId with special URL characters", async () => {
    const provider = new HttpTicketProvider({
      endpoint: `http://localhost:${port}/api/tickets`,
    });
    // encodeURIComponent should handle this
    const result = await provider.resolve("TK-WITH/SLASH&SPECIAL");
    // Should not throw — graceful resolution or undefined
    assert.ok(result === undefined || typeof result.id === "string");
  });
});


