/**
 * UI: Welcome banner
 */

import pc from "picocolors";

export function showWelcome(): void {
  console.log();
  console.log(
    pc.cyan("╔══════════════════════════════════════════════════════════════╗")
  );
  console.log(
    pc.cyan("║") +
      pc.bold("                    Cloudflare NAS Setup                      ") +
      pc.cyan("║")
  );
  console.log(
    pc.cyan("║") +
      "         Your personal cloud storage on Cloudflare            " +
      pc.cyan("║")
  );
  console.log(
    pc.cyan("╚══════════════════════════════════════════════════════════════╝")
  );
  console.log();
}
