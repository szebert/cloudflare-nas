#!/usr/bin/env node
/**
 * Cloudflare NAS CLI
 *
 * A wizard-style CLI that guides users through setting up their personal
 * cloud storage on Cloudflare Workers + R2 + D1.
 *
 * Directory Structure:
 *   src/
 *     index.ts        - Entry point, orchestrates the wizard flow
 *     steps/          - Each wizard step as a separate module
 *       auth.ts       - Step 1: Authentication
 *       permissions.ts - Step 2: Verify D1/R2 permissions
 *       config.ts     - Step 3: Project configuration prompts
 *       resources.ts  - Step 4: Create D1/R2 resources
 *       deploy.ts     - Step 5: Deploy worker
 *     ui/             - UI components (banners, success messages)
 *     utils/          - Shared utilities (wrangler helpers, file copy)
 */

import pc from "picocolors";

// UI
import { showWelcome } from "./ui/welcome.js";
import { showSuccess } from "./ui/success.js";

// Wizard steps
import { checkAuth, ensureAuth, selectAccount } from "./steps/auth.js";
import { verifyPermissions } from "./steps/permissions.js";
import { promptProjectConfig } from "./steps/config.js";
import { createResources } from "./steps/resources.js";
import { deployWorker } from "./steps/deploy.js";

async function main() {
  try {
    // Show welcome banner
    showWelcome();

    // Step 1: Check/ensure authentication
    let authResult = await checkAuth();

    if (!authResult.authenticated) {
      const ensured = await ensureAuth();
      if (!ensured) {
        console.log(pc.yellow("\nSetup cancelled. Please authenticate first."));
        process.exit(1);
      }
      authResult = await checkAuth();
    }

    // Select account if multiple are available
    const accounts = authResult.accounts || [];
    if (accounts.length === 0) {
      console.log(
        pc.red("\nNo Cloudflare accounts found. Please check your login.")
      );
      process.exit(1);
    }

    const selectedAccount = await selectAccount(accounts);
    if (!selectedAccount) {
      console.log(pc.yellow("\nSetup cancelled."));
      process.exit(1);
    }

    // Step 2: Verify permissions for D1 and R2
    const permissions = await verifyPermissions(selectedAccount.id);
    if (!permissions.success) {
      process.exit(1);
    }

    // Step 3: Get project configuration from user
    const config = await promptProjectConfig(
      permissions.buckets,
      selectedAccount.id,
      selectedAccount.name
    );

    if (!config) {
      console.log(pc.yellow("\nSetup cancelled."));
      process.exit(0);
    }

    // Step 4: Create Cloudflare resources (D1 database, optionally R2 bucket)
    const resources = await createResources(config);
    if (!resources) {
      process.exit(1);
    }

    // Step 5: Deploy the worker
    const deployResult = await deployWorker(config, resources);
    if (!deployResult.success) {
      process.exit(1);
    }

    // Show success message
    showSuccess(config, deployResult.url);
  } catch (error) {
    console.error(pc.red("\nAn unexpected error occurred:"));
    console.error(error);
    process.exit(1);
  }
}

main();
