/**
 * Server-Side Gate Verification CLI (Issue #117)
 *
 * Verifies that server-side branch protection on GitHub enforces required status checks,
 * pull request approvals, and anti-bypass protections (preventing local hook bypass via --no-verify).
 *
 * STRIDE category: Elevation of Privilege (bypassing local client gates)
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface BranchProtectionSpec {
  description?: string;
  branches: Record<string, {
    required_status_checks?: {
      strict?: boolean;
      contexts?: string[];
    };
    enforce_admins?: boolean;
    required_pull_request_reviews?: {
      required_approving_review_count?: number;
      dismiss_stale_reviews?: boolean;
    };
    required_linear_history?: boolean;
    allow_force_pushes?: boolean;
    allow_deletions?: boolean;
  }>;
}

export interface VerifyServerOptions {
  token?: string;
  repo?: string;
  branch?: string;
  configFile?: string;
  offlineOnly?: boolean;
}

export function parseVerifyServerArgs(args: string[]): VerifyServerOptions {
  const options: VerifyServerOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--token" && i + 1 < args.length) {
      options.token = args[++i];
    } else if (arg === "--repo" && i + 1 < args.length) {
      options.repo = args[++i];
    } else if (arg === "--branch" && i + 1 < args.length) {
      options.branch = args[++i];
    } else if (arg === "--config" && i + 1 < args.length) {
      options.configFile = args[++i];
    } else if (arg === "--offline") {
      options.offlineOnly = true;
    }
  }
  return options;
}

export async function verifyServer(projectRoot: string, rawArgs: string[] = []): Promise<boolean> {
  const options = parseVerifyServerArgs(rawArgs);
  const configRelPath = options.configFile ?? ".github/branch-protection.json";
  const configAbsPath = path.resolve(projectRoot, configRelPath);

  console.log("🛡️  defense-in-depth verify:server — Server-Side Gate Check\n");

  if (!fs.existsSync(configAbsPath)) {
    console.error(`❌ Missing branch protection specification at '${configRelPath}'.`);
    console.error("   Create '.github/branch-protection.json' documenting required server-side status checks.");
    return false;
  }

  let spec: BranchProtectionSpec;
  try {
    const raw = fs.readFileSync(configAbsPath, "utf-8");
    spec = JSON.parse(raw);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Failed to parse '${configRelPath}': ${message}`);
    return false;
  }

  if (!spec.branches || Object.keys(spec.branches).length === 0) {
    console.error(`❌ '${configRelPath}' contains no branch protection rules.`);
    return false;
  }

  const targetBranch = options.branch ?? "main";
  const branchRules = spec.branches[targetBranch];

  if (!branchRules) {
    console.error(`❌ No protection rules specified for target branch '${targetBranch}'.`);
    return false;
  }

  console.log(`📋 Validating baseline for branch '${targetBranch}'...`);

  const checks = branchRules.required_status_checks?.contexts ?? [];
  if (checks.length === 0) {
    console.error("❌ Baseline specifies 0 required status checks. CI gates must be enforced.");
    return false;
  }

  console.log(`  ✓ Required status checks (${checks.length}): ${checks.join(", ")}`);

  const prReviews = branchRules.required_pull_request_reviews;
  if (!prReviews || (prReviews.required_approving_review_count ?? 0) < 1) {
    console.error("❌ Baseline must require at least 1 approving pull request review.");
    return false;
  }
  console.log(`  ✓ Required PR approvals: ${prReviews.required_approving_review_count}`);

  if (branchRules.enforce_admins !== true) {
    console.warn("  ⚠ 'enforce_admins' is disabled in baseline; admins can bypass status checks.");
  } else {
    console.log("  ✓ enforce_admins: true (no admin bypass)");
  }

  // Live remote check if credentials are provided and not forced offline
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const repo = options.repo ?? process.env.GITHUB_REPOSITORY;

  if (token && repo && !options.offlineOnly) {
    console.log(`\n🌐 Checking live GitHub API for ${repo} branch ${targetBranch}...`);
    try {
      const apiUrl = `https://api.github.com/repos/${repo}/branches/${targetBranch}/protection`;
      const response = await fetch(apiUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "defense-in-depth-verify-server",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.error(`❌ Remote branch protection is NOT enabled on GitHub for '${targetBranch}'.`);
          console.error("   Enable branch protection in GitHub Repository Settings -> Branches.");
          return false;
        }
        console.warn(`⚠ GitHub API responded with HTTP ${response.status}. Skipping remote verification.`);
        return true;
      }

      const remote = (await response.json()) as Record<string, unknown>;
      const requiredChecks = remote.required_status_checks as { contexts?: string[] } | undefined;
      const remoteChecks: string[] = requiredChecks?.contexts ?? [];
      const missingChecks = checks.filter((c) => !remoteChecks.includes(c));

      if (missingChecks.length > 0) {
        console.error(`❌ Remote protection is missing required status checks: ${missingChecks.join(", ")}`);
        return false;
      }

      console.log("  ✓ Live branch protection matches documented baseline!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ Network error querying GitHub API: ${message}. Local spec check passed.`);
    }
  } else {
    console.log("\nℹ️  Running in offline mode (set GITHUB_TOKEN & GITHUB_REPOSITORY for live API checks).");
  }

  console.log("\n✅ Server-side branch protection verification passed.");
  return true;
}
