/**
 * Login page UI
 */

import { escapeHtml } from "../utils/format";
import { renderHead } from "./components";

export function renderLoginPage(
  redirectUrl?: string,
  error?: string,
  theme: "light" | "dark" | "system" = "system"
): string {
  const redirectParam = redirectUrl
    ? `?redirect=${encodeURIComponent(redirectUrl)}`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "Cloudflare NAS - Login", theme })}
<body>
  <div class="container">
    <div class="login-container">
      <h1>Cloudflare NAS</h1>
      <p class="login-subtitle">Sign in to access your files</p>
      
      ${error ? `<div class="error-message">${escapeHtml(error)}</div>` : ""}
      
      <form method="POST" action="/login${redirectParam}" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            required
            autofocus
            autocomplete="username"
          />
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autocomplete="current-password"
          />
        </div>
        
        <button type="submit" class="btn btn-primary">Sign In</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}
