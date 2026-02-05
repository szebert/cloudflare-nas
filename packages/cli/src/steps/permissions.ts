/**
 * Step 2: Verify Permissions
 * Check that the user has D1 and R2 access for the selected account
 */

import pc from "picocolors";
import ora from "ora";
import {
  runWrangler,
  parseR2BucketList,
  isPermissionError,
  type R2Bucket,
} from "../utils/wrangler.js";

export { type R2Bucket };

export interface PermissionsResult {
  success: boolean;
  d1: boolean;
  r2: boolean;
  buckets: R2Bucket[];
}

/**
 * Verify that the user has required permissions for D1 and R2
 * Uses the specified account ID for all wrangler commands
 *
 * Note: An empty list of databases/buckets still means the service is enabled.
 * We only fail if there's an actual permission error.
 */
export async function verifyPermissions(
  accountId: string
): Promise<PermissionsResult> {
  console.log();
  console.log(pc.bold("Verifying Cloudflare permissions..."));

  const result: PermissionsResult = {
    success: false,
    d1: false,
    r2: false,
    buckets: [],
  };

  // Check D1 access
  const d1Spinner = ora("Checking D1 database access...").start();
  try {
    const d1Result = await runWrangler(["d1", "list", "--json"], accountId);

    const d1Stdout = String(d1Result.stdout || "");
    const d1Stderr = String(d1Result.stderr || "");

    // Exit code 0 means success - even with empty results, D1 is enabled
    if (d1Result.exitCode === 0) {
      d1Spinner.succeed("D1 access: OK");
      result.d1 = true;
    } else if (isPermissionError(d1Stdout, d1Stderr)) {
      d1Spinner.fail("D1 access: Permission denied");
      showD1Error(accountId);
      return result;
    } else {
      // Non-zero exit but not a permission error - might be a wrangler issue
      d1Spinner.fail("D1 access: Failed");
      console.log(pc.dim(`  Error: ${d1Stderr || d1Stdout}`));
      showD1Error(accountId);
      return result;
    }
  } catch {
    d1Spinner.fail("D1 access: Failed");
    showD1Error(accountId);
    return result;
  }

  // Check R2 access (note: R2 bucket list doesn't support --json)
  const r2Spinner = ora("Checking R2 storage access...").start();
  try {
    const r2Result = await runWrangler(["r2", "bucket", "list"], accountId);

    const r2Stdout = String(r2Result.stdout || "");
    const r2Stderr = String(r2Result.stderr || "");

    // Exit code 0 means success - even with no buckets, R2 is enabled
    if (r2Result.exitCode === 0) {
      r2Spinner.succeed("R2 access: OK");
      result.r2 = true;

      // Parse existing buckets from text output
      result.buckets = parseR2BucketList(r2Stdout);
    } else if (isPermissionError(r2Stdout, r2Stderr)) {
      r2Spinner.fail("R2 access: Permission denied");
      showR2Error(accountId);
      return result;
    } else {
      // Non-zero exit but not a permission error
      r2Spinner.fail("R2 access: Failed");
      console.log(pc.dim(`  Error: ${r2Stderr || r2Stdout}`));
      showR2Error(accountId);
      return result;
    }
  } catch {
    r2Spinner.fail("R2 access: Failed");
    showR2Error(accountId);
    return result;
  }

  console.log(pc.green("\n✓ All permissions verified"));
  result.success = true;
  return result;
}

function showD1Error(accountId: string): void {
  console.log();
  console.log(pc.yellow("⚠ Unable to access D1 databases."));
  console.log();
  console.log("This could mean:");
  console.log("  • D1 isn't enabled for this account yet");
  console.log("  • Your API token lacks D1 permissions");
  console.log("  • There's a temporary issue with Cloudflare");
  console.log();
  console.log("To enable D1:");
  console.log(
    `  1. Go to: ${pc.cyan(`https://dash.cloudflare.com/${accountId}/workers/d1`)}`
  );
  console.log(
    "  2. You should see the D1 dashboard (create a test database if prompted)"
  );
  console.log("  3. Run this setup again");
  console.log();
  console.log("If using an API token, ensure it has:");
  console.log(`  ${pc.dim("Account | D1 | Edit")}`);
  console.log();
}

function showR2Error(accountId: string): void {
  console.log();
  console.log(pc.yellow("⚠ Unable to access R2 storage."));
  console.log();
  console.log("This could mean:");
  console.log("  • R2 isn't enabled for this account yet");
  console.log("  • Your API token lacks R2 permissions");
  console.log("  • There's a temporary issue with Cloudflare");
  console.log();
  console.log("To enable R2:");
  console.log(
    `  1. Go to: ${pc.cyan(`https://dash.cloudflare.com/${accountId}/r2`)}`
  );
  console.log(
    "  2. You should see the R2 dashboard (create a test bucket if prompted)"
  );
  console.log("  3. Run this setup again");
  console.log();
  console.log("If using an API token, ensure it has:");
  console.log(`  ${pc.dim("Account | Workers R2 Storage | Edit")}`);
  console.log();
}
