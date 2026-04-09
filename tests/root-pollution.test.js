// Executor: Gemini-CLI
import { strict as assert } from "node:assert";
import { rootPollutionGuard } from "../dist/guards/root-pollution.js";
import { Severity } from "../dist/core/types.js";

function createContext(stagedFiles, configOverrides = {}) {
  return {
    stagedFiles,
    projectRoot: "/fake/root",
    config: {
      version: "1.0",
      guards: {
        rootPollution: {
          enabled: true,
          allowedRootFiles: ["README.md", "package.json"],
          allowedRootPatterns: ["*.txt", ".*"],
          ...configOverrides,
        },
      },
    },
  };
}

// Test Suite
async function runTests() {
  console.log("Running rootPollutionGuard tests...");

  // Test 1: Allowed root file passes
  {
    const ctx = createContext(["README.md", "src/nested.ts", "docs/nested.txt"]);
    const result = await rootPollutionGuard.check(ctx);
    assert.equal(result.passed, true, "Valid files should pass");
    assert.equal(result.findings.length, 0);
  }

  // Test 2: Unallowed root file is blocked
  {
    const ctx = createContext(["src/valid.ts", "bad_file.json"]);
    const result = await rootPollutionGuard.check(ctx);
    assert.equal(result.passed, false, "Unauthorized root file should block");
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0]?.severity, Severity.BLOCK);
    assert.ok(result.findings[0]?.message.includes("bad_file.json"));
  }

  // Test 3: Allowed patterns
  {
    const ctx = createContext(["allowed_pattern.txt", ".hidden", "src/ok.js"]);
    const result = await rootPollutionGuard.check(ctx);
    assert.equal(result.passed, true, "Pattern matched root files should pass");
  }

  // Test 4: Nested files don't trigger it, even if they match unauthorized names
  {
    const ctx = createContext(["src/bad_file.json", "docs/README.md", "nested/folder/file.js"]);
    const result = await rootPollutionGuard.check(ctx);
    assert.equal(result.passed, true, "Nested files are inherently allowed by this guard");
  }

  console.log("✅ All rootPollutionGuard tests passed.");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
