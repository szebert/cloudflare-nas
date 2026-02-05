/**
 * Step 5: Deploy
 * Copy templates, generate config, and deploy to Cloudflare
 */

import { execa } from "execa";
import pc from "picocolors";
import ora from "ora";
import fs from "fs";
import path from "path";
import type { ProjectConfig } from "./config.js";
import type { CreatedResources } from "./resources.js";
import { copyTemplates } from "../utils/copy.js";

export interface DeployResult {
  success: boolean;
  url: string;
}

interface WranglerConfig {
  $schema: string;
  name: string;
  account_id?: string;
  main: string;
  compatibility_date: string;
  r2_buckets: Array<{
    binding: string;
    bucket_name: string;
  }>;
  d1_databases: Array<{
    binding: string;
    database_name: string;
    database_id: string;
  }>;
  observability: {
    enabled: boolean;
  };
  rules: Array<{
    type: string;
    globs: string[];
    fallthrough: boolean;
  }>;
}

/**
 * Deploy the worker to Cloudflare
 */
export async function deployWorker(
  config: ProjectConfig,
  resources: CreatedResources
): Promise<DeployResult> {
  console.log();
  console.log(pc.bold("Deploying to Cloudflare..."));

  // Step 1: Copy template files to target directory
  const copySpinner = ora("Copying project files...").start();
  try {
    copyTemplates(config.directory);
    copySpinner.succeed("Project files copied");
  } catch (error) {
    copySpinner.fail("Failed to copy project files");
    console.error(error);
    return { success: false, url: "" };
  }

  // Step 2: Generate wrangler.jsonc with actual resource IDs
  const configSpinner = ora("Generating configuration...").start();
  try {
    const wranglerConfig: WranglerConfig = {
      $schema: "node_modules/wrangler/config-schema.json",
      name: config.projectName,
      account_id: config.accountId,
      main: "src/index.ts",
      compatibility_date: new Date().toISOString().split("T")[0],
      r2_buckets: [
        {
          binding: "nas-storage",
          bucket_name: resources.bucketName,
        },
      ],
      d1_databases: [
        {
          binding: "DB",
          database_name: resources.d1DatabaseName,
          database_id: resources.d1DatabaseId,
        },
      ],
      observability: {
        enabled: true,
      },
      rules: [
        {
          type: "Text",
          globs: ["**/*.css"],
          fallthrough: true,
        },
      ],
    };

    // Generate wrangler.jsonc with helpful comments
    const wranglerContent = `// Wrangler configuration for ${config.projectName}
// Documentation: https://developers.cloudflare.com/workers/wrangler/configuration/
${JSON.stringify(wranglerConfig, null, 2)}
`;

    const wranglerPath = path.join(config.directory, "wrangler.jsonc");
    fs.writeFileSync(wranglerPath, wranglerContent);
    configSpinner.succeed("Configuration generated");
  } catch (error) {
    configSpinner.fail("Failed to generate configuration");
    console.error(error);
    return { success: false, url: "" };
  }

  // Step 3: Install dependencies
  const installSpinner = ora("Installing dependencies...").start();
  try {
    // Create a standalone pnpm-workspace.yaml to break any parent workspace chain
    // This ensures the project installs its own dependencies independently
    const workspaceYamlPath = path.join(config.directory, "pnpm-workspace.yaml");
    fs.writeFileSync(workspaceYamlPath, "packages: []\n");

    await execa("pnpm", ["install"], {
      cwd: config.directory,
      reject: true,
    });
    installSpinner.succeed("Dependencies installed");
  } catch (error) {
    installSpinner.fail("Failed to install dependencies");
    console.error(error);
    return { success: false, url: "" };
  }

  // Step 4: Run D1 migrations
  const migrateSpinner = ora("Running database migrations...").start();
  try {
    const schemaPath = path.join(config.directory, "schema.sql");
    if (fs.existsSync(schemaPath)) {
      await execa(
        "npx",
        [
          "wrangler",
          "d1",
          "execute",
          resources.d1DatabaseName,
          "--remote",
          "--file",
          "schema.sql",
        ],
        {
          cwd: config.directory,
          reject: true,
        }
      );
      migrateSpinner.succeed("Database migrations complete");
    } else {
      migrateSpinner.warn("No schema.sql found, skipping migrations");
    }
  } catch (error) {
    migrateSpinner.fail("Database migration failed");
    console.error(error);
    // Don't return - continue with deployment, user can migrate later
  }

  // Step 5: Deploy the worker
  const deploySpinner = ora("Deploying worker...").start();
  try {
    const result = await execa("npx", ["wrangler", "deploy"], {
      cwd: config.directory,
      reject: false,
    });

    if (result.exitCode === 0) {
      deploySpinner.succeed("Worker deployed");

      // Extract the URL from the output
      const urlMatch = result.stdout.match(
        /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i
      );
      const url =
        urlMatch?.[0] || `https://${config.projectName}.workers.dev`;

      return { success: true, url };
    } else {
      deploySpinner.fail("Deployment failed");
      console.error(pc.red(result.stderr || result.stdout));
      return { success: false, url: "" };
    }
  } catch (error) {
    deploySpinner.fail("Deployment failed");
    console.error(error);
    return { success: false, url: "" };
  }
}
