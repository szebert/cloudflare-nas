/**
 * Login page UI
 */

import { escapeHtml } from "../utils/format";
import { renderHead } from "./components";

export interface LoginPageOptions {
  redirectUrl?: string;
  error?: string;
  theme?: "light" | "dark" | "system";
  isSetup?: boolean; // True if this is first-run setup (no users exist)
}

export function renderLoginPage(options: LoginPageOptions): string {
  const { redirectUrl, error, theme = "system", isSetup = false } = options;

  const redirectParam = redirectUrl
    ? `?redirect=${encodeURIComponent(redirectUrl)}`
    : "";

  if (isSetup) {
    return renderSetupPage({ redirectUrl, error, theme });
  }

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "Cloudflare NAS - Login", theme })}
<body>
  <div>
    <div class="container">
      <h1>Cloudflare NAS</h1>
      <p class="container-subtitle">Sign in to access your files</p>
      
      ${error ? `<div class="error-message">${escapeHtml(error)}</div>` : ""}
      
      <form method="POST" action="/login${redirectParam}" class="container-form">
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

function renderSetupPage(options: LoginPageOptions): string {
  const { error, theme = "system" } = options;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "Cloudflare NAS - Setup", theme })}
<body>
  <div>
    <div class="container">
      <h1>Cloudflare NAS</h1>
      <p class="container-subtitle">Welcome! Create your admin account to get started.</p>
      
      ${error ? `<div class="error-message">${escapeHtml(error)}</div>` : ""}
      
      <form method="POST" action="/setup" class="container-form">
        <div class="form-group">
          <label for="username">Admin Username</label>
          <input
            type="text"
            id="username"
            name="username"
            required
            autofocus
            autocomplete="username"
            minlength="3"
          />
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autocomplete="new-password"
            minlength="8"
          />
        </div>
        
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            autocomplete="new-password"
            minlength="8"
          />
        </div>
        
        <button type="submit" class="btn btn-primary">Create Admin Account</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}
