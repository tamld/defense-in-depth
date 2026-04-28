/**
 * Adversarial tests for the regex-escape fix in hollow-artifact.
 *
 * Closes the false-positive bug reported in issue #59: every default
 * pattern in DEFAULT_CONFIG.guards.hollowArtifact.patterns is a string
 * with regex metacharacters. Before the fix, those strings were passed
 * directly to `new RegExp(p, "i")` so `[Insert Here]` compiled into a
 * character class matching any single letter `I/n/s/e/r/t/space/H` —
 * any normal English text triggered a false-positive BLOCK.
 *
 * After the fix, user-supplied patterns are escaped before compilation
 * and behave as literal case-insensitive substrings.
 *
 * What this file covers:
 *   1. Each of the 6 default patterns from DEFAULT_CONFIG must NOT
 *      match common English content (the false-positive trip-wire).
 *   2. Each of the 6 default patterns MUST match its literal form
 *      somewhere inside a substantive document.
 *   3. User-supplied patterns containing regex metacharacters are
 *      treated as literal substrings (not regex), so a custom
 *      pattern like `"a|b"` only matches the literal three-char
 *      sequence `a|b` and not `a` or `b`.
 *   4. The case-insensitive flag still applies after escaping.
 *
 * Executor: Devin
 */

import test from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { hollowArtifactGuard } from "../dist/guards/hollow-artifact.js";
import { DEFAULT_CONFIG } from "../dist/core/config-loader.js";

// Substantive content well above the default 50-char minContentLength
// so we isolate the pattern-matching path from the "too short" path.
const SUBSTANTIVE_FILLER =
  "This document has plenty of substantive content to clear the minimum-length heuristic, intentionally written so length checks never fire and only pattern checks gate the verdict.";

function tempWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "did-regex-escape-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function writeFile(dir, name, content) {
  fs.writeFileSync(path.join(dir, name), content);
}

function ctxWithDefaults(dir, files) {
  return {
    projectRoot: dir,
    stagedFiles: files,
    config: {
      guards: {
        hollowArtifact: {
          // Mirror DEFAULT_CONFIG so the test exercises the user-supplied
          // string path (the one that was buggy), not the regex-literal
          // DEFAULT_HOLLOW_PATTERNS fallback.
          enabled: true,
          patterns: DEFAULT_CONFIG.guards.hollowArtifact.patterns,
          minContentLength: 50,
          useDspy: false,
        },
      },
    },
  };
}

test("hollow-artifact regex-escape (issue #59)", async (t) => {
  await t.test("DEFAULT_CONFIG ships 6 known patterns", () => {
    const expected = ["TODO", "TBD", "FILL IN HERE", "<Empty>", "[Insert Here]", "PLACEHOLDER"];
    assert.deepStrictEqual(
      DEFAULT_CONFIG.guards.hollowArtifact.patterns,
      expected,
      "If this fails, update the default-pattern audit in this test to match the new default set.",
    );
  });

  await t.test("does NOT false-positive on common English text", async () => {
    const { dir, cleanup } = tempWorkspace();
    try {
      // Each filename is a content sample that, before the fix, would
      // have triggered the `[Insert Here]` character class via one of
      // its individual letters or via the spaces in `"FILL IN HERE"`,
      // `"<Empty>"`, or `"[Insert Here]"`.
      const samples = {
        "english-the.md": "# Doc\n\nthe quick brown fox jumps. " + SUBSTANTIVE_FILLER,
        "english-i-am.md": "# Doc\n\nI am writing prose here. " + SUBSTANTIVE_FILLER,
        "english-insert.md": "# Doc\n\nWe insert rows into the table. " + SUBSTANTIVE_FILLER,
        "english-here.md": "# Doc\n\nLook here for the answer. " + SUBSTANTIVE_FILLER,
        "english-fill.md": "# Doc\n\nFill the form completely. " + SUBSTANTIVE_FILLER,
        "english-empty.md": "# Doc\n\nThe container is not empty. " + SUBSTANTIVE_FILLER,
      };
      for (const [name, content] of Object.entries(samples)) {
        writeFile(dir, name, content);
      }

      const ctx = ctxWithDefaults(dir, Object.keys(samples));
      const result = await hollowArtifactGuard.check(ctx);

      const offenders = result.findings.filter((f) =>
        f.message.startsWith("Hollow content detected"),
      );
      assert.deepStrictEqual(
        offenders,
        [],
        `No file with normal English text may trigger a hollow-pattern BLOCK. Got: ${JSON.stringify(offenders, null, 2)}`,
      );
      assert.strictEqual(
        result.passed,
        true,
        "Pipeline must pass when no hollow patterns and no length warnings fire.",
      );
    } finally {
      cleanup();
    }
  });

  await t.test("each default pattern matches its literal form (regression)", async () => {
    // Build one file per pattern. If any fires, the literal-substring
    // contract is preserved after the escape change.
    const patternFixtures = {
      "todo.md": "# Doc\n\nTODO: implement this. " + SUBSTANTIVE_FILLER,
      "tbd.md": "# Doc\n\nNotes: TBD. " + SUBSTANTIVE_FILLER,
      "fill-in-here.md": "# Doc\n\nFILL IN HERE — author's note. " + SUBSTANTIVE_FILLER,
      "empty-marker.md": "# Doc\n\nStatus marker: <Empty>. " + SUBSTANTIVE_FILLER,
      "insert-here.md": "# Doc\n\nValue: [Insert Here] — owner. " + SUBSTANTIVE_FILLER,
      "placeholder.md": "# Doc\n\nThis is a PLACEHOLDER for the real text. " + SUBSTANTIVE_FILLER,
    };

    for (const [name, content] of Object.entries(patternFixtures)) {
      const { dir, cleanup } = tempWorkspace();
      try {
        writeFile(dir, name, content);
        const ctx = ctxWithDefaults(dir, [name]);
        const result = await hollowArtifactGuard.check(ctx);

        const blocked = result.findings.find(
          (f) => f.filePath === name && f.message.startsWith("Hollow content detected"),
        );
        assert.ok(
          blocked,
          `Default pattern in ${name} must still BLOCK its literal form. Findings: ${JSON.stringify(result.findings, null, 2)}`,
        );
      } finally {
        cleanup();
      }
    }
  });

  await t.test("case-insensitive flag survives escaping", async () => {
    const { dir, cleanup } = tempWorkspace();
    try {
      writeFile(dir, "lower.md", "# Doc\n\ntodo: lowercase variant. " + SUBSTANTIVE_FILLER);
      writeFile(dir, "mixed.md", "# Doc\n\nFiLl In HeRe mixed-case. " + SUBSTANTIVE_FILLER);

      const ctx = ctxWithDefaults(dir, ["lower.md", "mixed.md"]);
      const result = await hollowArtifactGuard.check(ctx);

      for (const file of ["lower.md", "mixed.md"]) {
        const blocked = result.findings.find(
          (f) => f.filePath === file && f.message.startsWith("Hollow content detected"),
        );
        assert.ok(blocked, `Case variant in ${file} must still BLOCK.`);
      }
    } finally {
      cleanup();
    }
  });

  await t.test("custom patterns with regex metachars are treated as literals", async () => {
    const { dir, cleanup } = tempWorkspace();
    try {
      // Pre-fix: `"a|b"` compiled to `/a|b/i` and matched any "a" or "b"
      // anywhere in any file — virtually every doc.
      // Post-fix: `"a|b"` is escaped to `/a\|b/i` and only matches the
      // literal three-char sequence `a|b`.
      writeFile(dir, "harmless.md", "# Doc\n\nThis has the letters a and b but no pipe. " + SUBSTANTIVE_FILLER);
      writeFile(dir, "literal.md", "# Doc\n\nThis intentionally contains a|b as a literal. " + SUBSTANTIVE_FILLER);

      const ctx = {
        projectRoot: dir,
        stagedFiles: ["harmless.md", "literal.md"],
        config: {
          guards: {
            hollowArtifact: {
              enabled: true,
              patterns: ["a|b"],
              minContentLength: 50,
              useDspy: false,
            },
          },
        },
      };

      const result = await hollowArtifactGuard.check(ctx);

      const harmlessBlocked = result.findings.find(
        (f) => f.filePath === "harmless.md" && f.message.startsWith("Hollow content detected"),
      );
      assert.strictEqual(
        harmlessBlocked,
        undefined,
        "Custom pattern 'a|b' must NOT match a file that only contains 'a' and 'b' separately.",
      );

      const literalBlocked = result.findings.find(
        (f) => f.filePath === "literal.md" && f.message.startsWith("Hollow content detected"),
      );
      assert.ok(
        literalBlocked,
        "Custom pattern 'a|b' MUST match a file that contains the literal three-char substring 'a|b'.",
      );
    } finally {
      cleanup();
    }
  });

  await t.test("custom pattern with character-class metachars is harmless", async () => {
    // Direct repro of the issue #59 scenario, but reproducible by any
    // user who picks a placeholder syntax with brackets.
    const { dir, cleanup } = tempWorkspace();
    try {
      writeFile(dir, "english.md", "# Doc\n\nthe sun is hot today. " + SUBSTANTIVE_FILLER);
      writeFile(dir, "literal.md", "# Doc\n\nValue: [Insert Here] for real. " + SUBSTANTIVE_FILLER);

      const ctx = {
        projectRoot: dir,
        stagedFiles: ["english.md", "literal.md"],
        config: {
          guards: {
            hollowArtifact: {
              enabled: true,
              patterns: ["[Insert Here]"],
              minContentLength: 50,
              useDspy: false,
            },
          },
        },
      };

      const result = await hollowArtifactGuard.check(ctx);

      const englishBlocked = result.findings.find(
        (f) => f.filePath === "english.md" && f.message.startsWith("Hollow content detected"),
      );
      assert.strictEqual(
        englishBlocked,
        undefined,
        "Pre-fix bug repro: '[Insert Here]' must NOT character-class-match common English letters.",
      );

      const literalBlocked = result.findings.find(
        (f) => f.filePath === "literal.md" && f.message.startsWith("Hollow content detected"),
      );
      assert.ok(
        literalBlocked,
        "'[Insert Here]' MUST still match its literal form.",
      );
    } finally {
      cleanup();
    }
  });
});
