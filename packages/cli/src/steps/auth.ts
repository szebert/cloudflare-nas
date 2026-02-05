/**
 * Step 1: Authentication
 * Check/ensure user is authenticated with Cloudflare and select account
 */

import { execa } from "execa";
import pc from "picocolors";
import prompts from "prompts";
import ora from "ora";
import {
  type CloudflareAccount,
  parseAccountsFromWhoami,
} from "../utils/wrangler.js";

export { type CloudflareAccount };

export interface AuthResult {
  authenticated: boolean;
  accounts?: CloudflareAccount[];
  email?: string;
}

/**
 * Check if the user is already authenticated with Cloudflare
 * Returns all available accounts so the user can select one
 */
export async function checkAuth(): Promise<AuthResult> {
  // First check for API token in environment
  if (process.env.CLOUDFLARE_API_TOKEN) {
    const spinner = ora("Validating API token...").start();
    try {
      const result = await execa("npx", ["wrangler", "whoami"], {
        env: { ...process.env },
        reject: false,
      });

      if (result.exitCode === 0) {
        spinner.succeed("API token validated");
        const accounts = parseAccountsFromWhoami(result.stdout);
        const emailMatch = result.stdout.match(/email[:\s]+([^\s,]+)/i);

        return {
          authenticated: true,
          accounts,
          email: emailMatch?.[1],
        };
      }
      spinner.fail("API token is invalid");
    } catch {
      spinner.fail("Failed to validate API token");
    }
  }

  // Check wrangler OAuth
  const spinner = ora("Checking authentication...").start();
  try {
    const result = await execa("npx", ["wrangler", "whoami"], {
      reject: false,
    });

    if (result.exitCode === 0 && !result.stdout.includes("not authenticated")) {
      spinner.succeed("Already authenticated with Cloudflare");
      const accounts = parseAccountsFromWhoami(result.stdout);
      const emailMatch = result.stdout.match(/email[:\s]+([^\s,]+)/i);

      return {
        authenticated: true,
        accounts,
        email: emailMatch?.[1],
      };
    }
    spinner.info("Not authenticated");
    return { authenticated: false };
  } catch {
    spinner.info("Not authenticated");
    return { authenticated: false };
  }
}

/**
 * Prompt user to authenticate with Cloudflare
 */
export async function ensureAuth(): Promise<boolean> {
  console.log();
  console.log(pc.yellow("It looks like you're not logged into Cloudflare."));
  console.log();
  console.log("Don't have a Cloudflare account yet?");
  console.log(
    pc.cyan("→ Sign up free at: https://dash.cloudflare.com/sign-up")
  );
  console.log();
  console.log("Cloudflare's free tier includes:");
  console.log("  - 100,000 Worker requests/day");
  console.log("  - 10 GB R2 storage");
  console.log("  - 5 GB D1 database storage");
  console.log();

  const { authMethod } = await prompts({
    type: "select",
    name: "authMethod",
    message: "How would you like to authenticate?",
    choices: [
      {
        title: "Browser login (recommended)",
        description:
          "Opens your browser to log in via Cloudflare OAuth. Best for personal use.",
        value: "oauth",
      },
      {
        title: "API Token",
        description:
          "Use a Cloudflare API token. Best for CI/CD or headless environments.",
        value: "token",
      },
    ],
  });

  if (authMethod === "oauth") {
    return await loginWithOAuth();
  } else if (authMethod === "token") {
    return await loginWithToken();
  }

  return false;
}

/**
 * Prompt user to select a Cloudflare account from multiple options
 */
export async function selectAccount(
  accounts: CloudflareAccount[]
): Promise<CloudflareAccount | null> {
  if (accounts.length === 0) {
    return null;
  }

  if (accounts.length === 1) {
    console.log(
      pc.dim(`Using account: ${accounts[0].name} (${accounts[0].id})`)
    );
    return accounts[0];
  }

  console.log();
  console.log(pc.yellow("Multiple Cloudflare accounts detected."));
  console.log();

  const { selectedAccount } = await prompts({
    type: "select",
    name: "selectedAccount",
    message: "Which account should we use?",
    choices: accounts.map((acc) => ({
      title: acc.name,
      description: acc.id,
      value: acc,
    })),
  });

  if (!selectedAccount) {
    return null;
  }

  console.log(
    pc.dim(`Selected: ${selectedAccount.name} (${selectedAccount.id})`)
  );
  return selectedAccount;
}

async function loginWithOAuth(): Promise<boolean> {
  console.log();
  console.log("Opening browser for Cloudflare login...");

  try {
    const result = await execa("npx", ["wrangler", "login"], {
      stdio: "inherit",
    });

    if (result.exitCode === 0) {
      console.log(pc.green("\n✓ Successfully logged in!"));
      return true;
    }
  } catch {
    console.error(pc.red("\nLogin failed. Please try again."));
  }

  return false;
}

async function loginWithToken(): Promise<boolean> {
  console.log();
  console.log(pc.bold("To create an API token:"));
  console.log();
  console.log(
    `  1. Go to: ${pc.cyan("https://dash.cloudflare.com/profile/api-tokens")}`
  );
  console.log('  2. Click "Create Token"');
  console.log('  3. Use "Custom token" and add these permissions:');
  console.log();
  console.log("     Account | D1              | Edit");
  console.log("     Account | Workers R2      | Edit");
  console.log("     Account | Workers Scripts | Edit");
  console.log();
  console.log("  4. Copy the token (you won't see it again!)");
  console.log();

  const { token } = await prompts({
    type: "password",
    name: "token",
    message: "Paste your API token:",
  });

  if (!token) {
    return false;
  }

  // Validate the token
  const spinner = ora("Validating token...").start();

  try {
    const result = await execa("npx", ["wrangler", "whoami"], {
      env: { ...process.env, CLOUDFLARE_API_TOKEN: token },
      reject: false,
    });

    if (result.exitCode === 0 && !result.stdout.includes("not authenticated")) {
      spinner.succeed("Token validated");

      // Set for the current process
      process.env.CLOUDFLARE_API_TOKEN = token;

      console.log();
      console.log(pc.green("✓ Token is valid"));
      console.log();
      console.log(
        pc.dim(
          "Tip: Set CLOUDFLARE_API_TOKEN environment variable to skip this step next time."
        )
      );

      return true;
    } else {
      spinner.fail("Token is invalid or lacks required permissions");
      return false;
    }
  } catch {
    spinner.fail("Failed to validate token");
    return false;
  }
}
