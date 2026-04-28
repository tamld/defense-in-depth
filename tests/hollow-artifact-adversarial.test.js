/**
 * Adversarial tests for hollowArtifactGuard.
 *
 * Spec: tests/fixtures/hollow-artifact-adversarial/edge_cases.md
 *
 * Phase 3 of the test-hardening track. The existing
 * tests/hollow-artifact.test.js covers happy-path scenarios; this file adds
 * adversarial scenarios per the "Happy Path Complacency" warning in
 * .agents/contracts/jules.md.
 *
 * Goal: lift hollow-artifact branch coverage from 75% to ≥90% AND document
 * pattern-evasion limitations (T0DO, TΟDO, T\u200BODO, T\nODO).
 *
 * Mock audit: real fs (temp dirs); DSPy injected via ctx.semanticEvals.
 *
 * Executor: Devin
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { hollowArtifactGuard } from "../dist/guards/hollow-artifact.js";
import { Severity } from "../dist/core/types.js";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "did-hollow-adv-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function ctxIn(stagedFiles, hollowConfig, semanticEvals) {
  return {
    stagedFiles,
    projectRoot: tmp,
    config: {
      version: "1.0",
      guards: {
        hollowArtifact: hollowConfig
          ? { enabled: true, ...hollowConfig }
          : { enabled: true },
      },
    },
    ...(semanticEvals ? { semanticEvals } : {}),
  };
}

function write(rel, content) {
  fs.writeFileSync(path.join(tmp, rel), content);
}

const SUBSTANTIVE =
  "This document contains a real paragraph of meaningful content that is well above the default minimum length threshold so that length-based findings do not interfere with the pattern check we are exercising right now.";

describe("hollowArtifactGuard — pattern-evasion limitations (PINNED)", () => {
  it("does NOT catch 'T0DO' (digit-zero substitution) under defaults — limitation", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nLater note: T0DO refactor.`);
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, true, "default ASCII regex does not match T0DO");
  });

  it("does NOT catch 'TΟDO' (Greek omicron lookalike) under defaults — limitation", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nLater note: TΟDO refactor.`);
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, true);
  });

  it("does NOT catch 'T\\u200BODO' (zero-width-space split) under defaults — limitation", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nLater note: T\u200BODO refactor.`);
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, true);
  });

  it("does NOT catch 'T\\nODO' (newline-split) under defaults — limitation", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nT\nODO`);
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, true);
  });

  it("DOES catch lowercase 'todo' (case-insensitive flag)", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nIn the future, todo: refactor this.`);
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, false);
    assert.equal(result.findings[0].severity, Severity.BLOCK);
  });

  it("DOES catch 'TODO' inside line comments", async () => {
    write(
      "a.md",
      `${SUBSTANTIVE}\n\n\`\`\`js\n// TODO: implement\n\`\`\`\n`,
    );
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, false);
  });

  it("DOES catch 'TODO' inside HTML comments and shell-style comments", async () => {
    for (const filename of ["a.md", "b.md"]) {
      write(filename, `${SUBSTANTIVE}\n\n<!-- TODO: x -->\n# TODO: y\n`);
    }
    const result = await hollowArtifactGuard.check(ctxIn(["a.md", "b.md"]));
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 2);
  });

  it("DOES catch 'TODO' embedded in a string literal", async () => {
    write(
      "a.md",
      `${SUBSTANTIVE}\n\nExample: \`const x = "This is just the word TODO in a string"\``,
    );
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, false);
  });
});

describe("hollowArtifactGuard — multibyte / international content", () => {
  it("flags Vietnamese-content file containing literal 'TODO'", async () => {
    write(
      "vi.md",
      "Tài liệu tiếng Việt với nội dung đầy đủ và chi tiết để vượt qua kiểm tra độ dài tối thiểu mặc định.\n\nGhi chú: TODO bổ sung sau.",
    );
    const result = await hollowArtifactGuard.check(ctxIn(["vi.md"]));
    assert.equal(result.passed, false);
    assert.equal(result.findings[0].filePath, "vi.md");
  });

  it("flags CJK-content file containing literal 'TBD'", async () => {
    write(
      "cn.md",
      "这是一份包含足够内容的中文文档以通过默认的最小长度阈值检查。\n\n备注：TBD 之后补充详细信息。",
    );
    const result = await hollowArtifactGuard.check(ctxIn(["cn.md"]));
    assert.equal(result.passed, false);
  });

  it("flags emoji-prefixed 'TODO'", async () => {
    write("emoji.md", `${SUBSTANTIVE}\n\n🚧 TODO 🚧`);
    const result = await hollowArtifactGuard.check(ctxIn(["emoji.md"]));
    assert.equal(result.passed, false);
  });
});

describe("hollowArtifactGuard — custom pattern configuration", () => {
  it("custom pattern catches 'T0DO' (zero-instead-of-O typo) that defaults miss", async () => {
    // After the issue #59 fix, custom patterns are escaped and treated as
    // literal case-insensitive substrings. To cover multiple spellings of
    // the same typo, list each one as its own entry instead of relying on
    // regex alternation.
    write("a.md", `${SUBSTANTIVE}\n\nT0DO fix later`);
    const result = await hollowArtifactGuard.check(
      ctxIn(["a.md"], { patterns: ["T0DO", "TΟDO"] }),
    );
    assert.equal(result.passed, false);
  });

  it("PINNED FOOTGUN: empty patterns: [] disables ALL pattern checks (no fallback to defaults)", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nTODO: would normally be caught`);
    const result = await hollowArtifactGuard.check(
      ctxIn(["a.md"], { patterns: [] }),
    );
    assert.equal(
      result.passed,
      true,
      "empty patterns list → no pattern checks; documented footgun",
    );
  });

  it("multi-pattern: first match wins (single finding per file)", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nTODO and TBD on same line`);
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    const blocks = result.findings.filter(
      (f) => f.severity === Severity.BLOCK && f.filePath === "a.md",
    );
    assert.equal(blocks.length, 1);
  });
});

describe("hollowArtifactGuard — header/frontmatter stripping", () => {
  it("blocks file with ONLY markdown headers (zero substantive content)", async () => {
    write("a.md", "# Title\n\n## Subtitle\n\n### Sub-sub\n");
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, false);
    assert.ok(
      result.findings.some(
        (f) =>
          f.severity === Severity.BLOCK &&
          f.message.includes("only headers/frontmatter"),
      ),
    );
  });

  it("blocks file with ONLY YAML frontmatter (no body)", async () => {
    write(
      "a.md",
      "---\nname: x\nstatus: draft\n---\n",
    );
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, false);
  });

  it("blocks file with headers + only blank lines", async () => {
    write("a.md", "# A\n\n\n\n## B\n\n   \n\n");
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.passed, false);
  });
});

describe("hollowArtifactGuard — minContentLength tuning", () => {
  it("just under default 50 chars after stripping → WARN (no BLOCK)", async () => {
    // Body is 49 chars after stripping the header:
    write("a.md", "# T\n\n" + "x".repeat(49));
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    const warns = result.findings.filter((f) => f.severity === Severity.WARN);
    assert.equal(warns.length, 1);
    assert.equal(result.passed, true);
  });

  it("at default 50 chars after stripping → no length finding", async () => {
    write("a.md", "# T\n\n" + "x".repeat(50));
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(result.findings.length, 0);
  });

  it("custom minContentLength=10 lowers the bar", async () => {
    write("a.md", "# T\n\n" + "x".repeat(20));
    const result = await hollowArtifactGuard.check(
      ctxIn(["a.md"], { minContentLength: 10 }),
    );
    assert.equal(result.findings.length, 0);
  });
});

describe("hollowArtifactGuard — filesystem edges", () => {
  it("silently skips a staged file that does not exist on disk", async () => {
    const result = await hollowArtifactGuard.check(ctxIn(["ghost.md"]));
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("does not check files outside the configured extensions filter", async () => {
    write("script.sh", "#!/bin/bash\necho TODO");
    const result = await hollowArtifactGuard.check(ctxIn(["script.sh"]));
    assert.equal(result.passed, true);
  });

  it("custom extensions: ['.rst'] only checks .rst files", async () => {
    write("notes.rst", `${SUBSTANTIVE}\n\nTODO follow-up`);
    write("notes.md", `${SUBSTANTIVE}\n\nTODO follow-up`);
    const result = await hollowArtifactGuard.check(
      ctxIn(["notes.rst", "notes.md"], { extensions: [".rst"] }),
    );
    const flagged = result.findings.map((f) => f.filePath);
    assert.deepEqual(flagged, ["notes.rst"]);
  });

  it("readFileSync error during check → file is skipped (catch-continue path)", async () => {
    // Create the file, then replace it with a directory so existsSync is true
    // but readFileSync throws EISDIR. Exercises the try/catch around read.
    fs.mkdirSync(path.join(tmp, "weird.md"));
    const result = await hollowArtifactGuard.check(ctxIn(["weird.md"]));
    // Should NOT throw; file is silently skipped.
    assert.equal(result.passed, true);
  });
});

describe("hollowArtifactGuard — multi-file aggregation", () => {
  it("emits one BLOCK per offending file", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nTODO`);
    write("b.md", `${SUBSTANTIVE}\n\nTBD`);
    write("c.md", SUBSTANTIVE);
    const result = await hollowArtifactGuard.check(
      ctxIn(["a.md", "b.md", "c.md"]),
    );
    const blocks = result.findings.filter((f) => f.severity === Severity.BLOCK);
    assert.equal(blocks.length, 2);
    const offenders = blocks.map((f) => f.filePath).sort();
    assert.deepEqual(offenders, ["a.md", "b.md"]);
  });
});

describe("hollowArtifactGuard — DSPy adversarial paths", () => {
  it("DSPy null (network failure) on otherwise-clean file → no extra finding", async () => {
    write("a.md", SUBSTANTIVE);
    const result = await hollowArtifactGuard.check(
      ctxIn(["a.md"], { useDspy: true }, { dspy: { "a.md": null } }),
    );
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it("DSPy boundary: score JUST under 0.5 emits a WARN", async () => {
    write("a.md", SUBSTANTIVE);
    const result = await hollowArtifactGuard.check(
      ctxIn(
        ["a.md"],
        { useDspy: true },
        { dspy: { "a.md": { score: 0.4999, feedback: "filler-y" } } },
      ),
    );
    const warns = result.findings.filter((f) => f.severity === Severity.WARN);
    assert.equal(warns.length, 1);
    assert.ok(warns[0].message.includes("filler-y"));
    assert.equal(result.passed, true);
  });

  it("DSPy is SKIPPED when a BLOCK pattern already fires (no double-flag)", async () => {
    write("a.md", `${SUBSTANTIVE}\n\nTODO`);
    const result = await hollowArtifactGuard.check(
      ctxIn(
        ["a.md"],
        { useDspy: true },
        { dspy: { "a.md": { score: 0.1, feedback: "garbage" } } },
      ),
    );
    // Exactly one BLOCK from the pattern; no DSPy WARN added.
    const blocks = result.findings.filter((f) => f.severity === Severity.BLOCK);
    const warns = result.findings.filter((f) => f.severity === Severity.WARN);
    assert.equal(blocks.length, 1);
    assert.equal(warns.length, 0);
  });

  it("DSPy missing feedback string → message still constructed without crash", async () => {
    write("a.md", SUBSTANTIVE);
    const result = await hollowArtifactGuard.check(
      ctxIn(
        ["a.md"],
        { useDspy: true },
        { dspy: { "a.md": { score: 0.2 } } }, // feedback is undefined
      ),
    );
    const warns = result.findings.filter((f) => f.severity === Severity.WARN);
    assert.equal(warns.length, 1);
    assert.ok(warns[0].message.includes("0.20"));
  });
});

describe("hollowArtifactGuard — guard contract invariants", () => {
  it("guardId is correct on the result", async () => {
    const result = await hollowArtifactGuard.check(ctxIn([]));
    assert.equal(result.guardId, "hollowArtifact");
  });

  it("durationMs is non-negative", async () => {
    write("a.md", SUBSTANTIVE);
    const result = await hollowArtifactGuard.check(ctxIn(["a.md"]));
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0);
  });
});
