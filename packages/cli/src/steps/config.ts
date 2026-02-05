/**
 * Step 3: Project Configuration
 * Prompt user for project name, directory, and R2 bucket selection
 */

import prompts from "prompts";
import pc from "picocolors";
import path from "path";
import fs from "fs";
import type { R2Bucket } from "../utils/wrangler.js";

export interface ProjectConfig {
  projectName: string;
  directory: string;
  bucketName: string;
  createNewBucket: boolean;
  accountId: string;
  accountName: string;
}

/**
 * Prompt user for project configuration
 */
export async function promptProjectConfig(
  existingBuckets: R2Bucket[],
  accountId: string,
  accountName: string
): Promise<ProjectConfig | null> {
  console.log();
  console.log(pc.bold("Project Configuration"));
  console.log();

  // Project name
  const { projectName } = await prompts({
    type: "text",
    name: "projectName",
    message: "Project name:",
    initial: "cloudflare-nas",
    validate: (value) => {
      if (!value) return "Project name is required";
      if (!/^[a-z0-9-]+$/.test(value)) {
        return "Project name can only contain lowercase letters, numbers, and hyphens";
      }
      return true;
    },
  });

  if (!projectName) return null;

  // Installation directory
  const defaultDir = path.resolve(process.cwd(), projectName);
  const { directory } = await prompts({
    type: "text",
    name: "directory",
    message: "Installation directory:",
    initial: defaultDir,
    validate: (value) => {
      if (!value) return "Directory is required";
      const resolvedPath = path.resolve(value);
      if (fs.existsSync(resolvedPath)) {
        const contents = fs.readdirSync(resolvedPath);
        if (contents.length > 0) {
          return `Directory "${resolvedPath}" is not empty`;
        }
      }
      return true;
    },
  });

  if (!directory) return null;

  // R2 bucket selection
  let bucketName: string;
  let createNewBucket = false;

  if (existingBuckets.length > 0) {
    // Show existing buckets and option to create new
    const bucketChoices = [
      {
        title: pc.green("+ Create new bucket"),
        description: `Will create "${projectName}-storage"`,
        value: "__new__",
      },
      ...existingBuckets.map((b) => ({
        title: b.name,
        description: `Created: ${new Date(b.creation_date).toLocaleDateString()}`,
        value: b.name,
      })),
    ];

    console.log();
    console.log(
      pc.dim(`Found ${existingBuckets.length} existing R2 bucket(s)`)
    );

    const { selectedBucket } = await prompts({
      type: "select",
      name: "selectedBucket",
      message: "Select R2 bucket for storage:",
      choices: bucketChoices,
    });

    if (!selectedBucket) return null;

    if (selectedBucket === "__new__") {
      createNewBucket = true;
      bucketName = `${projectName}-storage`;

      // Allow customizing the new bucket name
      const { customBucketName } = await prompts({
        type: "text",
        name: "customBucketName",
        message: "New bucket name:",
        initial: bucketName,
        validate: (value) => {
          if (!value) return "Bucket name is required";
          if (!/^[a-z0-9-]+$/.test(value)) {
            return "Bucket name can only contain lowercase letters, numbers, and hyphens";
          }
          if (existingBuckets.some((b) => b.name === value)) {
            return "A bucket with this name already exists";
          }
          return true;
        },
      });

      if (!customBucketName) return null;
      bucketName = customBucketName;
    } else {
      bucketName = selectedBucket;
    }
  } else {
    // No existing buckets, create new one
    console.log();
    console.log(pc.dim("No existing R2 buckets found. Creating a new one."));

    createNewBucket = true;
    const defaultBucketName = `${projectName}-storage`;

    const { newBucketName } = await prompts({
      type: "text",
      name: "newBucketName",
      message: "Bucket name:",
      initial: defaultBucketName,
      validate: (value) => {
        if (!value) return "Bucket name is required";
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Bucket name can only contain lowercase letters, numbers, and hyphens";
        }
        return true;
      },
    });

    if (!newBucketName) return null;
    bucketName = newBucketName;
  }

  // Confirm configuration
  console.log();
  console.log(pc.bold("Configuration Summary:"));
  console.log(
    `  Account:       ${pc.cyan(accountName)} ${pc.dim(`(${accountId})`)}`
  );
  console.log(`  Project name:  ${pc.cyan(projectName)}`);
  console.log(`  Directory:     ${pc.cyan(directory)}`);
  console.log(
    `  R2 Bucket:     ${pc.cyan(bucketName)} ${createNewBucket ? pc.dim("(will be created)") : ""}`
  );
  console.log();

  const { confirmed } = await prompts({
    type: "confirm",
    name: "confirmed",
    message: "Proceed with setup?",
    initial: true,
  });

  if (!confirmed) return null;

  return {
    projectName,
    directory,
    bucketName,
    createNewBucket,
    accountId,
    accountName,
  };
}
