#!/usr/bin/env tsx
/**
 * Script to copy worker package to CLI templates directory
 * Run this before publishing the CLI package or during dev
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliRoot = path.resolve(__dirname, "..");
const workerRoot = path.resolve(__dirname, "../../worker");
const templatesDir = path.join(cliRoot, "templates", "worker");

// Files and directories to copy from worker package
const itemsToCopy = [
  "src",
  "package.json",
  "tsconfig.json",
  "schema.sql",
  ".dev.vars.example",
];

// Files to exclude
const excludePatterns = [
  "node_modules",
  ".wrangler",
  "dist",
  ".dev.vars",
  "wrangler.jsonc",
  "worker-configuration.d.ts",
];

function shouldExclude(name: string): boolean {
  return excludePatterns.some(
    (pattern) => name === pattern || name.startsWith(pattern)
  );
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldExclude(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main(): void {
  console.log("Copying worker templates...");

  // Clean and recreate templates directory
  if (fs.existsSync(templatesDir)) {
    fs.rmSync(templatesDir, { recursive: true });
  }
  fs.mkdirSync(templatesDir, { recursive: true });

  // Copy each item
  for (const item of itemsToCopy) {
    const srcPath = path.join(workerRoot, item);
    const destPath = path.join(templatesDir, item);

    if (!fs.existsSync(srcPath)) {
      console.warn(`  Warning: ${item} not found, skipping`);
      continue;
    }

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
      console.log(`  Copied directory: ${item}`);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Copied file: ${item}`);
    }
  }

  // Modify the copied package.json to remove workspace-specific settings
  const packageJsonPath = path.join(templatesDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    // Change name for user's project
    packageJson.name = "cloudflare-nas-worker";
    delete packageJson.private;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log("  Modified package.json for template use");
  }

  // Build standalone tsconfig.json by merging base and worker configs
  const tsconfigPath = path.join(templatesDir, "tsconfig.json");
  const baseConfigPath = path.resolve(__dirname, "../../../tsconfig.base.json");
  const workerConfigPath = path.join(workerRoot, "tsconfig.json");

  if (fs.existsSync(baseConfigPath) && fs.existsSync(workerConfigPath)) {
    // Read both configs dynamically
    const baseConfig = JSON.parse(fs.readFileSync(baseConfigPath, "utf-8"));
    const workerConfig = JSON.parse(fs.readFileSync(workerConfigPath, "utf-8"));

    // Merge compilerOptions (worker overrides base)
    const mergedCompilerOptions = {
      ...baseConfig.compilerOptions,
      ...workerConfig.compilerOptions,
    };

    // Remove properties that don't make sense for standalone projects
    delete mergedCompilerOptions.composite;

    // Build the standalone tsconfig
    const standaloneTsconfig: Record<string, unknown> = {
      compilerOptions: mergedCompilerOptions,
    };

    // Copy other top-level properties from worker config (except extends)
    for (const key of Object.keys(workerConfig)) {
      if (key !== "extends" && key !== "compilerOptions") {
        standaloneTsconfig[key] = workerConfig[key];
      }
    }

    fs.writeFileSync(tsconfigPath, JSON.stringify(standaloneTsconfig, null, 2));
    console.log("  Built standalone tsconfig.json from base + worker configs");
  } else {
    console.warn(
      "  Warning: Could not find base or worker tsconfig, keeping original"
    );
  }

  console.log("\nTemplates copied successfully!");
}

main();
