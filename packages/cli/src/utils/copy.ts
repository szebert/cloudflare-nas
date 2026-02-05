/**
 * File copying utilities
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to bundled templates
 */
export function getTemplatesDir(): string {
  // Find templates relative to this file (works from both src and dist)
  const packageRoot = path.resolve(__dirname, "..", "..");
  return path.join(packageRoot, "templates", "worker");
}

/**
 * Copy bundled template files to the target directory
 */
export function copyTemplates(targetDir: string): void {
  const templatesDir = getTemplatesDir();

  if (!fs.existsSync(templatesDir)) {
    throw new Error(
      `Templates not found at ${templatesDir}.\n` +
        `Run 'pnpm run copy-templates' first.`
    );
  }

  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy all files recursively
  copyDirRecursive(templatesDir, targetDir);

  // Modify package.json for the user's project
  const packageJsonPath = path.join(targetDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    packageJson.name = "cloudflare-nas-worker";
    delete packageJson.private;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

/**
 * Recursively copy a directory
 */
export function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
