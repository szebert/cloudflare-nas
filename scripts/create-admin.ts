/**
 * Script to generate SQL for creating the first admin user
 * Usage: npx tsx scripts/create-admin.ts <username> <password>
 */

/// <reference types="node" />

import { hashPassword } from "../src/auth/password";

async function createAdminUser() {
  const args = process.argv.slice(2);
  const username = args[0];
  const password = args[1];

  if (!username || !password) {
    console.error(
      "Usage: npx tsx scripts/create-admin.ts <username> <password>"
    );
    console.error("   or: npm run create-admin <username> <password>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters long");
    process.exit(1);
  }

  // Hash the password
  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  const createdAt = Date.now();

  // Generate SQL to insert the user
  // Escape single quotes in username
  const escapedUsername = username.replace(/'/g, "''");
  const sql = `INSERT INTO users (id, username, password_hash, salt, is_admin, created_at)
VALUES ('${id}', '${escapedUsername}', '${hash}', '${salt}', 1, ${createdAt});`;

  console.log("\n=== Admin User Creation SQL ===\n");
  console.log(sql);
  console.log("\n=== Instructions ===\n");
  console.log("1. Copy the SQL above");
  console.log("2. Run it against your D1 database:");
  console.log(
    `   npx wrangler d1 execute nas-db --command="${sql.replace(/"/g, '\\"')}"`
  );
  console.log("\n   Or save it to a file and run:");
  console.log("   npx wrangler d1 execute nas-db --file=create-admin.sql");
  console.log("\n");
}

createAdminUser().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
