/**
 * Shared utilities for wrangler CLI interactions
 */

import { execa, type Options as ExecaOptions } from "execa";

/**
 * Get execa options with CLOUDFLARE_ACCOUNT_ID set
 */
export function getWranglerOptions(accountId: string): ExecaOptions {
  return {
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: accountId,
    },
    reject: false,
  };
}

/**
 * Run a wrangler command with the specified account
 */
export async function runWrangler(
  args: string[],
  accountId?: string,
  options?: ExecaOptions
) {
  const execaOptions: ExecaOptions = {
    ...(accountId ? getWranglerOptions(accountId) : {}),
    ...options,
    reject: false,
  };

  return execa("npx", ["wrangler", ...args], execaOptions);
}

/**
 * Parse accounts from wrangler whoami output
 * The output contains a table with Account Name and Account ID columns
 */
export interface CloudflareAccount {
  name: string;
  id: string;
}

export function parseAccountsFromWhoami(stdout: string): CloudflareAccount[] {
  const accounts: CloudflareAccount[] = [];

  // Match table rows with account name and ID
  // Format: │ Account Name     │ account-id-here                  │
  const rowPattern = /│\s*([^│]+?)\s*│\s*([a-f0-9]{32})\s*│/gi;
  let match;

  while ((match = rowPattern.exec(stdout)) !== null) {
    const name = match[1].trim();
    const id = match[2].trim();
    // Skip header row
    if (name.toLowerCase() !== "account name" && id.toLowerCase() !== "account id") {
      accounts.push({ name, id });
    }
  }

  return accounts;
}

/**
 * Parse R2 bucket list from wrangler text output
 */
export interface R2Bucket {
  name: string;
  creation_date: string;
}

export function parseR2BucketList(stdout: string): R2Bucket[] {
  const buckets: R2Bucket[] = [];

  const namePattern = /name:\s*(.+)/gi;
  const datePattern = /creation_date:\s*(.+)/gi;

  const names: string[] = [];
  const dates: string[] = [];

  let match;
  while ((match = namePattern.exec(stdout)) !== null) {
    names.push(match[1].trim());
  }
  while ((match = datePattern.exec(stdout)) !== null) {
    dates.push(match[1].trim());
  }

  for (let i = 0; i < names.length; i++) {
    buckets.push({
      name: names[i],
      creation_date: dates[i] || "",
    });
  }

  return buckets;
}

/**
 * Parse D1 database ID from wrangler d1 create output
 */
export function parseD1DatabaseId(stdout: string): string | undefined {
  // Try to match database_id = "uuid"
  const dbIdMatch = stdout.match(/database_id\s*=\s*"([a-f0-9-]+)"/i);
  if (dbIdMatch) {
    return dbIdMatch[1];
  }

  // Try to match UUID pattern directly
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  const uuidMatch = stdout.match(uuidPattern);
  return uuidMatch?.[0];
}

/**
 * Check if wrangler output indicates a permission/auth error
 */
export function isPermissionError(stdout: string, stderr: string): boolean {
  const combined = (stdout + stderr).toLowerCase();
  return (
    combined.includes("authentication") ||
    combined.includes("not authorized") ||
    combined.includes("permission denied") ||
    combined.includes("unauthorized") ||
    combined.includes("forbidden") ||
    combined.includes("api token") ||
    combined.includes("could not route")
  );
}

/**
 * Generate a random suffix for resource names
 */
export function generateRandomSuffix(): string {
  return Math.random().toString(36).substring(2, 8);
}
