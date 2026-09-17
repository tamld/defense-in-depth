/**
 * Audit CLI Tests — comprehensive coverage for src/cli/audit.ts
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// Import the compiled module
import {
  auditCommand,
  runAudit,
  runVerifyReadOnly,
  extractCodePatterns,
  extractCommitPatterns,
  checkConfigDrift,
  scanFileSizes,
  generateSuggestedLessons,
  parseAuditOptions,
  printAuditUsage,
  printAuditSummary,
} from "../../dist/cli/audit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let savedWarn;

beforeEach(() => {
  savedWarn = console.warn;
  console.warn = () => {};
  mock.reset();
});

afterEach(() => {
  console.warn = savedWarn;
});

// Helper to create temp directory
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
}

// Helper to cleanup temp directory
function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("Audit CLI", () => {
  let testDir;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  describe("parseAuditOptions", () => {
    it("should parse target path", () => {
      const result = parseAuditOptions(["../my-project"]);
      assert.equal(result.targetPath, "../my-project");
      assert.equal(result.outputFormat, "text");
    });

    it("should parse --output json", () => {
      const result = parseAuditOptions(["../my-project", "--output", "json"]);
      assert.equal(result.outputFormat, "json");
    });

    it("should parse --export-lessons", () => {
      const result = parseAuditOptions(["../my-project", "--export-lessons", "out.jsonl"]);
      assert.equal(result.exportLessonsPath, "out.jsonl");
    });

    it("should handle multiple flags", () => {
      const result = parseAuditOptions([
        "--output",
        "json",
        "--export-lessons",
        "lessons.jsonl",
        "../target",
      ]);
      assert.equal(result.outputFormat, "json");
      assert.equal(result.exportLessonsPath, "lessons.jsonl");
      assert.equal(result.targetPath, "../target");
    });
  });

  describe("printAuditUsage", () => {
    it("should not throw", () => {
      assert.doesNotThrow(() => printAuditUsage());
    });
  });

  describe("printAuditSummary", () => {
    it("should format summary with findings", () => {
      const mockResult = {
        targetPath: "/test/project",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        summary: {
          filesScanned: 100,
          findingsTotal: 5,
          findingsBySeverity: { BLOCK: 3, WARN: 2 },
          findingsByGuard: { hollowArtifact: 3, ssotPollution: 2 },
        },
        findings: [],
        patterns: {
          codePatterns: [
            { pattern: "TODO", count: 10, files: ["src/a.ts", "src/b.ts"], category: "todo" },
            { pattern: "FIXME", count: 5, files: ["src/c.ts"], category: "fixme" },
          ],
          commitPatterns: [{ pattern: "fix", count: 20, examples: ["fix: bug"], category: "fix" }],
          configDrift: [],
          fileSizes: [],
        },
        suggestedLessons: [{ title: "Lesson 1", category: "code", confidence: 0.9 }],
      };

      assert.doesNotThrow(() => printAuditSummary(mockResult));
    });

    it("should handle empty results", () => {
      const mockResult = {
        targetPath: "/test/project",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        summary: { filesScanned: 0, findingsTotal: 0, findingsBySeverity: {}, findingsByGuard: {} },
        findings: [],
        patterns: { codePatterns: [], commitPatterns: [], configDrift: [], fileSizes: [] },
        suggestedLessons: [],
      };

      assert.doesNotThrow(() => printAuditSummary(mockResult));
    });
  });

  describe("extractCodePatterns", () => {
    it("should detect TODO patterns", async () => {
      const file = path.join(testDir, "test.ts");
      fs.writeFileSync(file, "// TODO: implement this\nconsole.log('hello');");

      const patterns = await extractCodePatterns(testDir, {});

      const todoPattern = patterns.find((p) => p.category === "todo");
      assert.ok(todoPattern, "TODO pattern should be found");
      assert.ok(todoPattern.count > 0);
      assert.ok(todoPattern.files.includes("test.ts"));
    });

    it("should detect FIXME patterns", async () => {
      const file = path.join(testDir, "test.ts");
      fs.writeFileSync(file, "// FIXME: this is broken");

      const patterns = await extractCodePatterns(testDir, {});

      const fixmePattern = patterns.find((p) => p.category === "fixme");
      assert.ok(fixmePattern, "FIXME pattern should be found");
    });

    it("should detect HACK patterns", async () => {
      const file = path.join(testDir, "test.ts");
      fs.writeFileSync(file, "// HACK: temporary workaround");

      const patterns = await extractCodePatterns(testDir, {});

      const hackPattern = patterns.find((p) => p.category === "hack");
      assert.ok(hackPattern, "HACK pattern should be found");
    });

    it("should detect TBD patterns", async () => {
      const file = path.join(testDir, "test.ts");
      fs.writeFileSync(file, "// TBD: decide later");

      const patterns = await extractCodePatterns(testDir, {});

      const tbdPattern = patterns.find((p) => p.category === "tbd");
      assert.ok(tbdPattern, "TBD pattern should be found");
    });

    it("should detect empty catch blocks", async () => {
      const file = path.join(testDir, "test.ts");
      fs.writeFileSync(file, "try {} catch () {}");

      const patterns = await extractCodePatterns(testDir, {});

      const emptyCatchPattern = patterns.find((p) => p.category === "empty-catch");
      assert.ok(emptyCatchPattern, "Empty catch pattern should be found");
    });

    it("should detect console.log patterns", async () => {
      const file = path.join(testDir, "test.ts");
      fs.writeFileSync(file, "console.log('debug')");

      const patterns = await extractCodePatterns(testDir, {});

      const consolePattern = patterns.find((p) => p.category === "console-log");
      assert.ok(consolePattern, "Console.log pattern should be found");
    });

    it("should detect type any patterns", async () => {
      const file = path.join(testDir, "test.ts");
      fs.writeFileSync(file, "const x: any = 5;");

      const patterns = await extractCodePatterns(testDir, {});

      const typeAnyPattern = patterns.find((p) => p.category === "type-any");
      assert.ok(typeAnyPattern, "Type any pattern should be found");
    });

    it("should handle unreadable files gracefully", async () => {
      // Create a file we can't read (simulate by making it a directory)
      fs.mkdirSync(path.join(testDir, "unreadable.ts"));

      const patterns = await extractCodePatterns(testDir, {});

      // Should not throw, just skip the file
      assert.ok(Array.isArray(patterns));
    });

    it("should sort by count descending", async () => {
      // Create multiple files with different pattern counts
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(
          path.join(testDir, `file${i}.ts`),
          "// TODO: test\n// TODO: another\n// TODO: more",
        );
      }

      const patterns = await extractCodePatterns(testDir, {});

      const todoPattern = patterns.find((p) => p.category === "todo");
      assert.ok(todoPattern);
      // First should have highest count
      if (patterns.length > 1) {
        assert.ok(patterns[0].count >= patterns[1].count);
      }
    });
  });

  describe("extractCommitPatterns", () => {
    it("should parse git log output and categorize commits", async () => {
      // Initialize git repo in test dir
      execFileSync("git", ["init"], { cwd: testDir, encoding: "utf-8" });
      execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: testDir });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: testDir });

      // Create commits
      const file1 = path.join(testDir, "file1.ts");
      fs.writeFileSync(file1, "code");
      execFileSync("git", ["add", "file1.ts"], { cwd: testDir });
      execFileSync("git", ["commit", "-m", "fix: fixed bug"], { cwd: testDir });

      const file2 = path.join(testDir, "file2.ts");
      fs.writeFileSync(file2, "code");
      execFileSync("git", ["add", "file2.ts"], { cwd: testDir });
      execFileSync("git", ["commit", "-m", "refactor: improved code"], { cwd: testDir });

      const file3 = path.join(testDir, "file3.ts");
      fs.writeFileSync(file3, "code");
      execFileSync("git", ["add", "file3.ts"], { cwd: testDir });
      execFileSync("git", ["commit", "-m", "hack: quick workaround"], { cwd: testDir });

      const patterns = await extractCommitPatterns(testDir);

      assert.ok(patterns.length >= 3);
      const categories = patterns.map((p) => p.category).sort();
      assert.ok(categories.includes("fix"));
      assert.ok(categories.includes("hack"));
      assert.ok(categories.includes("refactor"));
    });

    it("should handle git errors gracefully (non-git dir)", async () => {
      // testDir is not a git repo
      const patterns = await extractCommitPatterns(testDir);

      // Should return empty array instead of throwing
      assert.deepEqual(patterns, []);
    });
  });

  describe("checkConfigDrift", () => {
    it("should detect missing package.json fields", async () => {
      const pkgPath = path.join(testDir, "package.json");
      fs.writeFileSync(pkgPath, JSON.stringify({ name: "test" }, null, 2));

      const drifts = await checkConfigDrift(testDir);

      assert.ok(drifts.length > 0);
      const typeDrift = drifts.find((d) => d.file === "package.json" && d.driftType === "missing");
      assert.ok(typeDrift, "Should detect missing 'type' field");
    });

    it("should detect different package.json values", async () => {
      const pkgPath = path.join(testDir, "package.json");
      fs.writeFileSync(pkgPath, JSON.stringify({ name: "test", type: "commonjs" }, null, 2));

      const drifts = await checkConfigDrift(testDir);

      const typeDrift = drifts.find(
        (d) => d.file === "package.json" && d.driftType === "different",
      );
      assert.ok(typeDrift, "Should detect different 'type' value");
    });

    it("should detect missing tsconfig.json keys", async () => {
      const tsPath = path.join(testDir, "tsconfig.json");
      fs.writeFileSync(tsPath, JSON.stringify({ compilerOptions: {} }, null, 2));

      const drifts = await checkConfigDrift(testDir);

      const strictDrift = drifts.find(
        (d) => d.file === "tsconfig.json" && d.driftType === "missing",
      );
      assert.ok(strictDrift, "Should detect missing 'strict' key");
    });

    it("should detect different tsconfig.json values", async () => {
      const tsPath = path.join(testDir, "tsconfig.json");
      fs.writeFileSync(tsPath, JSON.stringify({ compilerOptions: { strict: false } }, null, 2));

      const drifts = await checkConfigDrift(testDir);

      const strictDrift = drifts.find(
        (d) => d.file === "tsconfig.json" && d.driftType === "different",
      );
      assert.ok(strictDrift, "Should detect different 'strict' value");
    });

    it("should handle missing files gracefully (no drift for missing files)", async () => {
      // The function only checks drift for existing files
      // Missing files don't generate drift entries
      const drifts = await checkConfigDrift("/nonexistent/path/that/does/not/exist");
      assert.equal(drifts.length, 0);
    });
  });

  describe("scanFileSizes", () => {
    it("should detect large files (>100KB)", async () => {
      const largeFile = path.join(testDir, "large.ts");
      fs.writeFileSync(largeFile, "x".repeat(150 * 1024)); // 150KB

      const files = await scanFileSizes(testDir);

      assert.ok(files.length > 0);
      const large = files.find((f) => f.file === "large.ts");
      assert.ok(large, "Large file should be detected");
      assert.equal(large.category, "large");
      assert.ok(large.sizeKB > 100);
    });

    it("should categorize huge files (>1000KB)", async () => {
      const hugeFile = path.join(testDir, "huge.ts");
      fs.writeFileSync(hugeFile, "x".repeat(1500 * 1024)); // 1.5MB

      const files = await scanFileSizes(testDir);

      const huge = files.find((f) => f.file === "huge.ts");
      assert.ok(huge, "Huge file should be detected");
      assert.equal(huge.category, "huge");
    });

    it("should ignore files under 100KB", async () => {
      const smallFile = path.join(testDir, "small.ts");
      fs.writeFileSync(smallFile, "small content");

      const files = await scanFileSizes(testDir);

      const small = files.find((f) => f.file === "small.ts");
      assert.equal(small, undefined, "Small files should be ignored");
    });

    it("should sort by size descending and limit to 20", async () => {
      for (let i = 0; i < 25; i++) {
        fs.writeFileSync(path.join(testDir, `file${i}.ts`), "x".repeat(200 * 1024));
      }

      const files = await scanFileSizes(testDir);

      assert.ok(files.length <= 20);
      assert.ok(files[0].sizeBytes >= files[files.length - 1].sizeBytes);
    });
  });

  describe("generateSuggestedLessons", () => {
    it("should generate lessons from guard findings", () => {
      const verifyResult = {
        findings: [
          {
            guardId: "hollowArtifact",
            severity: "BLOCK",
            file: "src/a.ts",
            message: "TODO found",
            fix: "Implement",
          },
          {
            guardId: "ssotPollution",
            severity: "WARN",
            file: "config.json",
            message: "Drift detected",
            fix: "Sync",
          },
        ],
      };

      const lessons = generateSuggestedLessons(verifyResult, [], [], [], []);

      assert.equal(lessons.length, 2);
      assert.ok(lessons[0].title.includes("hollowArtifact"));
      assert.equal(lessons[0].category, "code");
      assert.equal(lessons[0].evidence, "RUNTIME");
      assert.equal(lessons[0].confidence, 0.9); // BLOCK = 0.9
    });

    it("should generate lessons from code patterns with count > 5", () => {
      const codePatterns = [
        { pattern: "TODO", count: 10, files: ["src/a.ts", "src/b.ts"], category: "todo" },
        { pattern: "FIXME", count: 3, files: ["src/c.ts"], category: "fixme" }, // < 5, should be skipped
      ];

      const lessons = generateSuggestedLessons({ findings: [] }, codePatterns, [], [], []);

      assert.equal(lessons.length, 1);
      assert.ok(lessons[0].title.includes("TODO"));
      assert.equal(lessons[0].category, "process");
      assert.equal(lessons[0].evidence, "INFER");
    });

    it("should generate lessons from config drift", () => {
      const configDrift = [
        { file: "package.json", expected: { type: "module" }, actual: {}, driftType: "missing" },
        {
          file: "tsconfig.json",
          expected: { compilerOptions: { strict: true } },
          actual: { compilerOptions: { strict: false } },
          driftType: "different",
        },
      ];

      const lessons = generateSuggestedLessons({ findings: [] }, [], [], configDrift, []);

      assert.equal(lessons.length, 2);
      assert.equal(lessons[0].category, "tool");
      assert.equal(lessons[0].evidence, "RUNTIME");
    });

    it("should generate lessons from large files", () => {
      const fileSizes = [
        { file: "src/huge.ts", sizeBytes: 1500 * 1024, sizeKB: 1500, category: "huge" },
        { file: "src/large.ts", sizeBytes: 200 * 1024, sizeKB: 200, category: "large" },
      ];

      const lessons = generateSuggestedLessons({ findings: [] }, [], [], [], fileSizes);

      assert.equal(lessons.length, 2);
      assert.equal(lessons[0].category, "code");
      assert.equal(lessons[0].evidence, "INFER");
    });

    it("should limit to top N patterns/drifts/files", () => {
      const codePatterns = Array.from({ length: 15 }, (_, i) => ({
        pattern: `PATTERN${i}`,
        count: 10,
        files: [`src/file${i}.ts`],
        category: "todo",
      }));

      const lessons = generateSuggestedLessons({ findings: [] }, codePatterns, [], [], []);

      // Should limit to top 10 code patterns
      const patternLessons = lessons.filter((l) => l.tags?.includes("pattern"));
      assert.ok(patternLessons.length <= 10);
    });

    it("should handle empty inputs", () => {
      const lessons = generateSuggestedLessons({ findings: [] }, [], [], [], []);
      assert.deepEqual(lessons, []);
    });
  });

  describe("runVerifyReadOnly", () => {
    it("should run verify and return findings", async () => {
      // Create a simple file to scan
      fs.writeFileSync(path.join(testDir, "test.ts"), "console.log('test');");

      const result = await runVerifyReadOnly(testDir, {});

      assert.ok(result.findings.length >= 0);
      assert.ok(typeof result.filesScanned === "number");
    });
  });

  describe("runAudit (integration)", () => {
    it("should run full audit and return structured result", async () => {
      // Create minimal files
      fs.writeFileSync(path.join(testDir, "test.ts"), "// TODO: test\nconsole.log('debug')");
      fs.writeFileSync(path.join(testDir, "package.json"), JSON.stringify({ name: "test" }));
      fs.writeFileSync(
        path.join(testDir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: {} }),
      );

      // Initialize git for commit patterns
      execFileSync("git", ["init"], { cwd: testDir, encoding: "utf-8" });
      execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: testDir });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: testDir });
      execFileSync("git", ["add", "."], { cwd: testDir });
      execFileSync("git", ["commit", "-m", "fix: initial commit"], { cwd: testDir });

      const result = await runAudit(testDir, {
        targetPath: testDir,
        outputFormat: "text",
        exportLessonsPath: undefined,
      });

      assert.equal(result.targetPath, testDir);
      assert.ok(result.version);
      assert.ok(typeof result.summary.filesScanned === "number");
      assert.ok(Array.isArray(result.findings));
      assert.ok(Array.isArray(result.patterns.codePatterns));
      assert.ok(Array.isArray(result.patterns.commitPatterns));
      assert.ok(Array.isArray(result.patterns.configDrift));
      assert.ok(Array.isArray(result.patterns.fileSizes));
      assert.ok(Array.isArray(result.suggestedLessons));
    });
  });

  describe("auditCommand (CLI entry point)", () => {
    let consoleErrorSpy;
    let processExitSpy;

    beforeEach(() => {
      consoleErrorSpy = mock.fn();
      processExitSpy = mock.fn(() => {
        throw new Error("process.exit called");
      });
      globalThis.console.error = consoleErrorSpy;
      globalThis.process.exit = processExitSpy;
    });

    afterEach(() => {
      globalThis.console.error = console.error;
      globalThis.process.exit = process.exit;
    });

    it("should exit with error when no target path provided", async () => {
      try {
        await auditCommand("/test", []);
        assert.fail("Should have thrown");
      } catch (e) {
        assert.ok(e.message === "process.exit called");
      }

      assert.ok(
        consoleErrorSpy.mock.calls.some((call) =>
          call.arguments[0].includes("requires a target path"),
        ),
      );
      assert.ok(processExitSpy.mock.calls.some((call) => call.arguments[0] === 1));
    });

    it("should exit with error when target path does not exist", async () => {
      try {
        await auditCommand("/test", ["/nonexistent/path"]);
        assert.fail("Should have thrown");
      } catch (e) {
        assert.ok(e.message === "process.exit called");
      }

      assert.ok(
        consoleErrorSpy.mock.calls.some((call) => call.arguments[0].includes("does not exist")),
      );
      assert.ok(processExitSpy.mock.calls.some((call) => call.arguments[0] === 1));
    });
  });

  describe("Edge cases", () => {
    it("should handle commit patterns with mixed categories", async () => {
      execFileSync("git", ["init"], { cwd: testDir, encoding: "utf-8" });
      execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: testDir });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: testDir });

      const file1 = path.join(testDir, "file1.ts");
      fs.writeFileSync(file1, "code");
      execFileSync("git", ["add", "file1.ts"], { cwd: testDir });
      execFileSync("git", ["commit", "-m", "fix: bug"], { cwd: testDir });

      const file2 = path.join(testDir, "file2.ts");
      fs.writeFileSync(file2, "code");
      execFileSync("git", ["add", "file2.ts"], { cwd: testDir });
      execFileSync("git", ["commit", "-m", "refactor: cleanup"], { cwd: testDir });

      const file3 = path.join(testDir, "file3.ts");
      fs.writeFileSync(file3, "code");
      execFileSync("git", ["add", "file3.ts"], { cwd: testDir });
      execFileSync("git", ["commit", "-m", "feat: new feature"], { cwd: testDir }); // Not in grep

      const file4 = path.join(testDir, "file4.ts");
      fs.writeFileSync(file4, "code");
      execFileSync("git", ["add", "file4.ts"], { cwd: testDir });
      execFileSync("git", ["commit", "-m", "hack: workaround"], { cwd: testDir });

      const patterns = await extractCommitPatterns(testDir);

      const categories = patterns.map((p) => p.category).sort();
      assert.deepEqual(categories, ["fix", "hack", "refactor"]);
    });

    it("should handle malformed JSON in config files", async () => {
      fs.writeFileSync(path.join(testDir, "package.json"), "not valid json");

      const drifts = await checkConfigDrift(testDir);

      const pkgDrift = drifts.find((d) => d.file === "package.json");
      assert.ok(pkgDrift);
      assert.equal(pkgDrift.driftType, "missing");
    });
  });
});
