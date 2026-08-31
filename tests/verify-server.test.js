import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyServer, parseVerifyServerArgs } from "../dist/cli/verify-server.js";

async function makeTmpDir() {
  return mkdtemp(path.join(os.tmpdir(), "did-verify-server-"));
}

async function runSilentVerifyServer(root, args = []) {
  const origLog = console.log;
  const origErr = console.error;

  console.log = () => {};
  console.error = () => {};

  try {
    return await verifyServer(root, args);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

describe("verifyServer", () => {
  it("parseVerifyServerArgs — flag extraction", () => {
    const args = [
      "--token", "ghp_12345",
      "--repo", "owner/repo",
      "--branch", "main",
      "--config", "custom.json",
      "--offline",
    ];
    const parsed = parseVerifyServerArgs(args);
    assert.equal(parsed.token, "ghp_12345");
    assert.equal(parsed.repo, "owner/repo");
    assert.equal(parsed.branch, "main");
    assert.equal(parsed.configFile, "custom.json");
    assert.equal(parsed.offlineOnly, true);
  });

  describe("validates local branch-protection specification", () => {
    it("fails when configuration file does not exist", async () => {
      const root = await makeTmpDir();
      try {
        const ok = await runSilentVerifyServer(root, ["--offline"]);
        assert.equal(ok, false);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("fails when configuration file contains invalid JSON", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(path.join(root, ".github", "branch-protection.json"), "{ invalid JSON");
        const ok = await runSilentVerifyServer(root, ["--offline"]);
        assert.equal(ok, false);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("fails when branches object is empty or target branch missing", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(path.join(root, ".github", "branch-protection.json"), JSON.stringify({ branches: {} }));
        const ok = await runSilentVerifyServer(root, ["--offline"]);
        assert.equal(ok, false);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("fails when required status checks are missing", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(
          path.join(root, ".github", "branch-protection.json"),
          JSON.stringify({
            branches: {
              main: {
                required_status_checks: { contexts: [] },
                required_pull_request_reviews: { required_approving_review_count: 1 },
              },
            },
          }),
        );
        const ok = await runSilentVerifyServer(root, ["--offline"]);
        assert.equal(ok, false);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("fails when pull request review approvals is 0", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(
          path.join(root, ".github", "branch-protection.json"),
          JSON.stringify({
            branches: {
              main: {
                required_status_checks: { contexts: ["ci"] },
                required_pull_request_reviews: { required_approving_review_count: 0 },
              },
            },
          }),
        );
        const ok = await runSilentVerifyServer(root, ["--offline"]);
        assert.equal(ok, false);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("passes with valid baseline spec in offline mode", async () => {
      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(
          path.join(root, ".github", "branch-protection.json"),
          JSON.stringify({
            branches: {
              main: {
                required_status_checks: { contexts: ["ci (20.x)", "coverage-gate"] },
                required_pull_request_reviews: { required_approving_review_count: 1 },
                enforce_admins: true,
              },
            },
          }),
        );
        const ok = await runSilentVerifyServer(root, ["--offline"]);
        assert.equal(ok, true);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("passes on the real repo .github/branch-protection.json", async () => {
      const ok = await runSilentVerifyServer(process.cwd(), ["--offline"]);
      assert.equal(ok, true);
    });
  });

  describe("live remote GitHub API validation (mocked)", () => {
    it("fails when remote branch protection is not enabled (404)", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: false,
        status: 404,
        json: async () => ({ message: "Branch not protected" }),
      });

      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(
          path.join(root, ".github", "branch-protection.json"),
          JSON.stringify({
            branches: {
              main: {
                required_status_checks: { contexts: ["ci"] },
                required_pull_request_reviews: { required_approving_review_count: 1 },
              },
            },
          }),
        );
        const ok = await runSilentVerifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
        assert.equal(ok, false);
      } finally {
        globalThis.fetch = originalFetch;
        await rm(root, { recursive: true, force: true });
      }
    });

    it("fails when remote is missing required status checks", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          required_status_checks: { contexts: ["ci (18.x)"] },
        }),
      });

      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(
          path.join(root, ".github", "branch-protection.json"),
          JSON.stringify({
            branches: {
              main: {
                required_status_checks: { contexts: ["ci (18.x)", "coverage-gate"] },
                required_pull_request_reviews: { required_approving_review_count: 1 },
                enforce_admins: true,
              },
            },
          }),
        );
        const ok = await runSilentVerifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
        assert.equal(ok, false);
      } finally {
        globalThis.fetch = originalFetch;
        await rm(root, { recursive: true, force: true });
      }
    });

    it("passes when remote protection matches baseline", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          required_status_checks: { contexts: ["ci (18.x)", "coverage-gate"] },
        }),
      });

      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(
          path.join(root, ".github", "branch-protection.json"),
          JSON.stringify({
            branches: {
              main: {
                required_status_checks: { contexts: ["ci (18.x)", "coverage-gate"] },
                required_pull_request_reviews: { required_approving_review_count: 1 },
                enforce_admins: true,
              },
            },
          }),
        );
        const ok = await runSilentVerifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
        assert.equal(ok, true);
      } finally {
        globalThis.fetch = originalFetch;
        await rm(root, { recursive: true, force: true });
      }
    });

    it("gracefully degrades when GitHub API returns 500 or throws network error", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const root = await makeTmpDir();
      try {
        await mkdir(path.join(root, ".github"), { recursive: true });
        await writeFile(
          path.join(root, ".github", "branch-protection.json"),
          JSON.stringify({
            branches: {
              main: {
                required_status_checks: { contexts: ["ci"] },
                required_pull_request_reviews: { required_approving_review_count: 1 },
              },
            },
          }),
        );
        const ok1 = await runSilentVerifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
        assert.equal(ok1, true);

        globalThis.fetch = async () => {
          throw new Error("DNS resolution failure");
        };
        const ok2 = await runSilentVerifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
        assert.equal(ok2, true);
      } finally {
        globalThis.fetch = originalFetch;
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
