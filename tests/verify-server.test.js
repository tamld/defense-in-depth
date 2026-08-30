import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyServer, parseVerifyServerArgs } from "../dist/cli/verify-server.js";

async function makeTmpDir() {
  return mkdtemp(path.join(os.tmpdir(), "did-verify-server-"));
}

test("parseVerifyServerArgs — flag extraction", () => {
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

test("verifyServer — validates local branch-protection specification", async (t) => {
  await t.test("fails when configuration file does not exist", async () => {
    const root = await makeTmpDir();
    try {
      const ok = await verifyServer(root, ["--offline"]);
      assert.equal(ok, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("fails when configuration file contains invalid JSON", async () => {
    const root = await makeTmpDir();
    try {
      await mkdir(path.join(root, ".github"), { recursive: true });
      await writeFile(path.join(root, ".github", "branch-protection.json"), "{ invalid JSON");
      const ok = await verifyServer(root, ["--offline"]);
      assert.equal(ok, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("fails when branches object is empty or target branch missing", async () => {
    const root = await makeTmpDir();
    try {
      await mkdir(path.join(root, ".github"), { recursive: true });
      await writeFile(path.join(root, ".github", "branch-protection.json"), JSON.stringify({ branches: {} }));
      const ok = await verifyServer(root, ["--offline"]);
      assert.equal(ok, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("fails when required status checks are missing", async () => {
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
      const ok = await verifyServer(root, ["--offline"]);
      assert.equal(ok, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("fails when pull request review approvals is 0", async () => {
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
      const ok = await verifyServer(root, ["--offline"]);
      assert.equal(ok, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("passes with valid baseline spec in offline mode", async () => {
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
      const ok = await verifyServer(root, ["--offline"]);
      assert.equal(ok, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("passes on the real repo .github/branch-protection.json", async () => {
    const ok = await verifyServer(process.cwd(), ["--offline"]);
    assert.equal(ok, true);
  });
});

test("verifyServer — live remote GitHub API validation (mocked)", async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("fails when remote branch protection is not enabled (404)", async () => {
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
      const ok = await verifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
      assert.equal(ok, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("fails when remote is missing required status checks", async () => {
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
      const ok = await verifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
      assert.equal(ok, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("passes when remote protection matches baseline", async () => {
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
      const ok = await verifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
      assert.equal(ok, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("gracefully degrades when GitHub API returns 500 or throws network error", async () => {
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
      const ok1 = await verifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
      assert.equal(ok1, true);

      globalThis.fetch = async () => {
        throw new Error("DNS resolution failure");
      };
      const ok2 = await verifyServer(root, ["--token", "fake-token", "--repo", "owner/repo"]);
      assert.equal(ok2, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
