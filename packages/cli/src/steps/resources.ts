/**
 * Step 4: Create Resources
 * Create D1 database and optionally R2 bucket
 */

import pc from "picocolors";
import ora from "ora";
import type { ProjectConfig } from "./config.js";
import {
  runWrangler,
  parseD1DatabaseId,
  generateRandomSuffix,
} from "../utils/wrangler.js";

export interface CreatedResources {
  d1DatabaseId: string;
  d1DatabaseName: string;
  bucketName: string;
}

const MAX_CREATE_RETRIES = 5;

/**
 * Attempt to create a D1 database with the given name
 * Returns the database ID if successful, or "exists" if it already exists
 */
async function tryCreateD1Database(
  d1Name: string,
  accountId: string
): Promise<{ id: string } | "exists" | "error"> {
  const result = await runWrangler(["d1", "create", d1Name], accountId);

  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");

  if (result.exitCode === 0) {
    const databaseId = parseD1DatabaseId(stdout);
    if (databaseId) {
      return { id: databaseId };
    }
    // Created but couldn't parse ID - treat as error
    return "error";
  }

  // Check if it already exists
  if (stderr.includes("already exists") || stdout.includes("already exists")) {
    return "exists";
  }

  // Some other error
  console.error(pc.dim(`  Error: ${stderr || stdout}`));
  return "error";
}

/**
 * Attempt to create an R2 bucket with the given name
 * Returns "success" if created, "exists" if it already exists, or "error" on failure
 */
async function tryCreateR2Bucket(
  bucketName: string,
  accountId: string
): Promise<"success" | "exists" | "error"> {
  const result = await runWrangler(
    ["r2", "bucket", "create", bucketName],
    accountId
  );

  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");

  if (result.exitCode === 0) {
    return "success";
  }

  // Check if it already exists
  if (stderr.includes("already exists") || stdout.includes("already exists")) {
    return "exists";
  }

  // Some other error
  console.error(pc.dim(`  Error: ${stderr || stdout}`));
  return "error";
}

/**
 * Create Cloudflare resources (D1 database and optionally R2 bucket)
 */
export async function createResources(
  config: ProjectConfig
): Promise<CreatedResources | null> {
  console.log();
  console.log(pc.bold("Creating Cloudflare resources..."));

  // Create R2 bucket if needed, with retry logic for name collisions
  let finalBucketName = config.bucketName;

  if (config.createNewBucket) {
    const baseBucketName = config.bucketName;
    let bucketName = baseBucketName;
    let bucketAttempt = 0;

    const bucketSpinner = ora(
      `Creating R2 bucket "${bucketName}"...`
    ).start();

    while (bucketAttempt < MAX_CREATE_RETRIES) {
      bucketAttempt++;

      try {
        const result = await tryCreateR2Bucket(bucketName, config.accountId);

        if (result === "success") {
          bucketSpinner.succeed(`R2 bucket "${bucketName}" created`);
          finalBucketName = bucketName;
          break;
        }

        if (result === "exists") {
          // Bucket already exists - try with a random suffix
          bucketName = `${baseBucketName}-${generateRandomSuffix()}`;
          bucketSpinner.text = `Bucket "${baseBucketName}" exists, trying "${bucketName}"...`;
          continue;
        }

        // Error
        bucketSpinner.fail("Failed to create R2 bucket");
        return null;
      } catch (error) {
        bucketSpinner.fail("Failed to create R2 bucket");
        console.error(error);
        return null;
      }
    }

    if (bucketAttempt >= MAX_CREATE_RETRIES) {
      bucketSpinner.fail(
        `Failed to create R2 bucket after ${MAX_CREATE_RETRIES} attempts`
      );
      return null;
    }

    finalBucketName = bucketName;
  }

  // Create D1 database with retry logic for name collisions
  // We always create a new database - never reuse existing ones to avoid conflicts
  const baseD1Name = `${config.projectName}-db`;
  let d1Name = baseD1Name;
  let attempt = 0;

  const d1Spinner = ora(`Creating D1 database "${d1Name}"...`).start();

  while (attempt < MAX_CREATE_RETRIES) {
    attempt++;

    try {
      const result = await tryCreateD1Database(d1Name, config.accountId);

      if (result === "error") {
        d1Spinner.fail(`Failed to create D1 database "${d1Name}"`);
        return null;
      }

      if (result === "exists") {
        // Database already exists - try with a random suffix
        d1Name = `${baseD1Name}-${generateRandomSuffix()}`;
        d1Spinner.text = `Database "${baseD1Name}" exists, trying "${d1Name}"...`;
        continue;
      }

      // Success!
      d1Spinner.succeed(`D1 database "${d1Name}" created`);
      return {
        d1DatabaseId: result.id,
        d1DatabaseName: d1Name,
        bucketName: finalBucketName,
      };
    } catch (error) {
      d1Spinner.fail("Failed to create D1 database");
      console.error(error);
      return null;
    }
  }

  // Exhausted all retries
  d1Spinner.fail(
    `Failed to create D1 database after ${MAX_CREATE_RETRIES} attempts (all names already exist)`
  );
  console.log(
    pc.dim(
      `  Tried: ${baseD1Name}, and ${MAX_CREATE_RETRIES - 1} random variations`
    )
  );
  return null;
}
