/**
 * UI: Success message
 */

import pc from "picocolors";
import type { ProjectConfig } from "../steps/config.js";

export function showSuccess(config: ProjectConfig, url: string): void {
  console.log();
  console.log(pc.green("✓ Setup complete!"));
  console.log();
  console.log("Your Cloudflare NAS is deployed at:");
  console.log(pc.cyan(`  ${url}`));
  console.log();
  console.log("Next steps:");
  console.log("  1. Visit the URL above to create your admin account");
  console.log("  2. Start uploading files!");
  console.log();
  console.log(
    `Local project created at: ${pc.bold(`./${config.projectName}/`)}`
  );
  console.log(
    `  - Run '${pc.cyan(`cd ${config.projectName} && pnpm dev`)}' for local development`
  );
  console.log(`  - Run '${pc.cyan("pnpm deploy")}' to redeploy after changes`);
  console.log();
}
