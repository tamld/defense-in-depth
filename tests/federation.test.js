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
});
